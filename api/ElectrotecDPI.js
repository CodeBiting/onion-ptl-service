/**
 * Copyright 2023 Code Biting S.L.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

const net = require('net');
const logger = require('./logger');
const constantsPTL = require('./constantsPTL');
const { time } = require('console');
const { timingSafeEqual } = require('crypto');
const { version } = require('os');

module.exports = class ElectrotecDPI {
  id = 0;
  ip = '';
  port = 0;
  timeout = 10000;        // 10s per defecte
  // intervalAlive = 10000;  // 10s per defecte
  client = new net.Socket();
  ptlCallback = null;
  socketEventCallback = null;
  recBuffer = '';         // Emmagatzemarem les dades rebudes per si rebem missatges parcials
  messageId = 0;

  // Id del missatge utilitzat en les comunicacions amb els PTL amb ACK (de 1 a 250)
  get NewMessageId() {
      this.messageId++;
      logger.info(`MessageId = ${this.messageId}`);
      this.messageId = (this.messageId % 251 === 0 ? 1 : this.messageId % 251);
      logger.info(`MessageId = ${this.messageId}`);
      return this.messageId.toString().padStart(3,'0');
  }

  constructor(dpi, timeout, ptlCallback, socketEventCallback) {
      this.id = dpi.id;
      this.ip = dpi.ip;
      this.port = dpi.port;
      this.timeout = timeout;
      // this.intervalAlive = intervalAlive;
      this.client = new net.Socket();
      this.client.ptlCallback = ptlCallback;  // Posem la funció de callback a dins de l'objecte socket ja que és ell el que rep les dades
      this.client.socketEventCallback = socketEventCallback;  // Posem la funció de callback que rebrà canvis en els sockets
      this.client.recBuffer = this.recBuffer = '';
      this.client.dpi = {
          id: dpi.id,
          ip: dpi.ip,
          port: dpi.port,
          timeout: timeout
      }
      // this.intervalObj = null;
      this.messageId = 0;
      // this.ptlCallback = ptlCallback;

      // Connect to the server on the configured port: Emitted when a socket connection is successfully established. See net.createConnection().
      logger.info(`ElectrotecDPI : Client ${this.id} : Connecting to server ${this.ip}:${this.port} ...`);
      this.client.connect(this.port, this.ip, function() {
          //Log when the connection is established
          logger.info(`ElectrotecDPI : Client ${dpi.id} : Connected to server ${dpi.ip}:${dpi.port}`);
      });

      // Handle data coming from the server: Emitted when data is received. The argument data will be a Buffer or String. Encoding of data is set by socket.setEncoding().
      // Atenció: En aquesta funció this és l'objecte client, no l'electrotedDPI
      this.client.on('data',function(data){
          logger.info(`ElectrotecDPI : Client ${this.id} : onData : received from server : ${data}`);
          // Obtenim el missatge parsejat en l'objecte amb:
          // * - dataReceived: missatge rebut convertit a Hex
          // * - msgParsed: Array amb missatges rebuts sense el camp d'inici \x02 ni el de fi \x03
          // * - dataRemainder: misstge no parsejat que es deixa per si n'arriba més
          // * - error: missatge d'error si n'hi ha
          let msgReceived = ElectrotecDPI.parseReceivedData(this.dpi, this.recBuffer + data);
          if (msgReceived.error) {
              logger.error(msgReceived.error);
          } else {
              // Guardem les dades no processades si ha sobrat alguna cosa pq li falta el camp de fi de missatge
              this.recBuffer = msgReceived.dataRemainder;
              // Per cada missatge rebut, processem les dades i les enviem al ControlPTL
              if (msgReceived && msgReceived.msgParsed && msgReceived.msgParsed.length > 0) {
                  for (let i = 0; i < msgReceived.msgParsed.length; i++) {
                    // Atenció: En aquest cas this és el socket

                    // Parsegem el missatge abans d'enviar-lo per facilitar la feina a l'objecte que el rebi
                    if (msgReceived.msgParsed[i] === undefined || msgReceived.msgParsed[i] === null || msgReceived.msgParsed[i] === '') {
                      logger.info(`ElectrotecDPI: : onData : received undefined, null o string empty`);
                    } else {
                      // Identifiquem el tipus de missatge
                      let [msgParsed, msgKeyPressed] = ElectrotecDPI.parseReceivedMessage(msgReceived.msgParsed[i], this.dpi);
                      this.ptlCallback(msgReceived.msgParsed[i], msgParsed, msgKeyPressed);
                    }
                  }
              }
          }
      });

      function delay(t, val) {
          return new Promise(function(resolve) {
              setTimeout(function() {
                  resolve(val);
              }, t);
          });
      };

      // Handle connection close 
      this.client.on('close', async function() {
          logger.info(`ElectrotecDPI : Client ${this.dpi.id} : Connection Closed, reconnecting in ${this.dpi.timeout}ms`);
          // ATENCIÓ: Intentem reconnectar en 10 segons, si no ho aconseguim 
          // s'emetrà un ECONNREFUSED que finalitzarà l'app, PM2 haurà de reiniciar-ho

          await delay(this.dpi.timeout);

          this.connect(this.dpi.port, this.dpi.ip, function() {
              //Log when the connection is established
              logger.info(`ElectrotecDPI : setTimeout : onClose : Connected to server ${this.dpi.ip}:${this.dpi.port}`);
          });

          /*
          setTimeout(function(this) {
              logger.info(`ElectrotecDPI : setTimeout : new Socket`);
              logger.info(`ElectrotecDPI : setTimeout : connect : Connecting to server ${this.client.dpi.ip}:${this.client.dpi.port}`);
              this.client = new net.Socket();
              this.client.connect(this.client.dpi.port, this.client.dpi.ip, function() {
                  //Log when the connection is established
                  logger.info(`ElectrotecDPI : setTimeout : onClose : Connected to server ${this.client.dpi.ip}:${this.client.dpi.port}`);
              });
          }, this.dpi.timeout);
          */
      });
      // Handle error: Emitted when an error occurs. The 'close' event will be called directly following this event.
      this.client.on('error',function(error) {
          logger.error(`ElectrotecDPI : Client ${this.dpi.id} : onError : Connection Error ${error}, reconnecting in ${this.dpi.timeout}ms`);


          // ATENCIÓ: Intentem reconnectar en 10 segons, si no ho aconseguim 
          // s'emetrà un ECONNREFUSED que finalitzarà l'app, PM2 haurà de reiniciar-ho
          // TODO
          // Si intentem reconnectar dins de l'event error petarà l'aplicació

          /*
          setTimeout(function() {
              this.client = new net.Socket();
              this.client.connect((this.dpi && this.dpi.port ? this.dpi.port : 16), (this.dpi && this.dpi.ip ? this.dpi.ip : '192.168.1.222'), function() {
                  //Log when the connection is established
                  logger.info(`ElectrotecDPI : Client ${this.dpi.id} : Connected to server ${this.dpi.ip}:${this.dpi.port}`);
              });
          }, this.dpi.timeout);
          */
      });
      //Handle lookup: Emitted after resolving the host name but before connecting. Not applicable to Unix sockets.
      this.client.on('lookup',function(error, address, family, host) {
          logger.info(`ElectrotecDPI : Client ${this.dpi.id} : Connection lookup ${error} ${address} ${family} ${host}`);
      });
      //Handle ready: Emitted when a socket is ready to be used.
      this.client.on('ready',function() {
          logger.info(`ElectrotecDPI : Client ${this.dpi.id} : Connection ready`);

          // TODO: Send open session
          this.socketEventCallback(0 /*SOCKED OPENED*/);
      });
      //Handle timeout: Emitted if the socket times out from inactivity. This is only to notify that the socket has been idle. The user must manually close the connection.
      this.client.on('timeout',function() {
          logger.info(`ElectrotecDPI : Client ${this.dpi.id} : Connection timeout`);
      });
      //Handle drain: Emitted when the write buffer becomes empty. Can be used to throttle uploads.
      this.client.on('drain',function() {
          logger.info(`ElectrotecDPI : Client ${this.dpi.id} : Connection drain`);
      });
      //Handle end: Emitted when the other end of the socket signals the end of transmission, thus ending the readable side of the socket.
      this.client.on('end',function() {
          logger.info(`ElectrotecDPI : Client ${this.dpi.id} : Connection end`);
      });

      // Nota: No cal mantenir viva la connexió amb el DPI enviant missatges de forma periòdica,
      // La dll d'electrotec, feia pings per saber si el DPI estava viu
      //this.intervalObj = setInterval(this.keepConnectionAlive, timeout);
  };

  send(data) {
    let result = {
      result: constantsPTL.RETURN_NOT_SENT,
      message: data,
      dataSent: data
    }
    try {
      if (data.startsWith('Error')) {
          logger.error(data);
          return result;
      }

      if (this.client) {
          logger.info(`ElectrotecDPI: sending data ${data} to Client ${this.id}`);
          this.client.write(data);
          result.result = constantsPTL.RETURN_OK;
          result.message = 'Sent ok';
      } else {
          let message = `ElectrotecDPI : Client ${this.id} : error sending, dpi connection not available`;
          logger.error(message);
          result.result = constantsPTL.RETURN_NOT_SENT;
          result.message = message;
      }
    } catch(ex) {
      let message = `ElectrotecDPI : Client ${this.id} : exception sending ${ex}`;
      logger.error(message);
      result.result = constantsPTL.RETURN_EXCEPTION;
      result.message = message;
    }

    return result;
  }

  /**
   * 
   * @param {*} id : client id
   * @param {*} data : dades rebudes dels DPI
   * @returns objecte amb:
   * - dpi: { id, ip, port }
   * - dataReceived: missatge rebut convertit a Hex
   * - msgParsed: Array amb missatges rebuts sense el camp d'inici \x02 i el de fi \x03
   * - dataRemainder: missatge no parsejat que es deixa per si n'arriba més
   * - error: missatge d'error si n'hi ha
   */
  static parseReceivedData(dpi, data) {
      let result = {
          dpi: dpi,
          dataReceived: '',
          msgParsed: [],
          dataRemainder: '',
          error: null
      };

      try {
          if (data === undefined || data == null || data.length <= 0)  {
              result.error = `ElectrotecDPI : Client ${dpi.id} : parseReceivedData parsing with no data`;
              return result;
          }

          result.dataReceived = ElectrotecDPI.convertASCIItoHex(data);

          logger.info(`ElectrotecDPI : Client ${dpi.id} : parseReceivedData parsing data ${data} to hex ${result.dataReceived}`);

          // Comprovem l'estructura del missatge rebut i extraiem els missatges dels DPI 
          // Suposem que podem rebre diversos missatges junts
          // Obtenim tots els missatges qu comencin per \x02, si no en trova cap retorna amb l'string original
          let splittedMsgs = data.split('\x02');

          //console.log(`splittedMsgs = ${splittedMsgs}`);
          for (let i = 0; i < splittedMsgs.length; i++) {

              if (splittedMsgs[i].length > 0) {
                  logger.info(`ElectrotecDPI : Client ${dpi.id} : parseReceivedData parsing message ${i+1}/${splittedMsgs.length} : ${splittedMsgs[i]}`);

                  // Comprobem que el missatge té format correcte i acaba amb \x03
                  // Si el missatge té més d'un \x03 retallem fins al primer
                  let endField = splittedMsgs[i].indexOf('\x03');
                  if (endField != -1) {
                      result.msgParsed.push(splittedMsgs[i].substring(0, endField));
                      // Si estem a l'últim missatge i el endField no és l'últim caràcter guardem el que hi hagi a continuació
                      if (i === (splittedMsgs.length - 1) && endField < (splittedMsgs[i].length - 1)) {
                          // Hi afegim el\x02 ja que l'hem tret quan hem fet l'split
                          result.dataRemainder = splittedMsgs[i].substring(endField + 1);
                      }
                  } else {
                      // Missatge amb format incorrecte, el descartem, si és l'últim el guardem, sinó el descartem
                      logger.info(`ElectrotecDPI : Client ${dpi.id} : parseReceivedData message ${i+1}/${splittedMsgs.length} without end field ${splittedMsgs[i]}`);
                      // Si estem a l'últim missatge i no té camp de final el guardem per si arriba mes tard
                      if (i === (splittedMsgs.length - 1)) {
                          // Hi afegim el\x02 ja que l'hem tret quan hem fet l'split
                          result.dataRemainder = '\x02' + splittedMsgs[i];
                      }
                  }
              } else {
                  // Sempre tindrem un primer missatge buit si el primer caracter rebut és el \x02
                  //console.log(`splittedMsgs[${i}] is empty`);
                  logger.info(`ElectrotecDPI : Client ${dpi.id} : parseReceivedData parsing message ${i+1}/${splittedMsgs.length} : message empty`);
              }
          }

          return result;
      } catch(ex) {
          result.error = `ElectrotecDPI : Client ${dpi.id} : parseReceivedData exception receiving data ${ex}`;
          return result;
      }
  }

  /**
   * Funció que a partiur d'un string amb les tecles apretades retornem un array amb les tecles
   * Nota: és un array ja que se'n pot apretar més d'una simultàniament
   * @param {*} msgKeys : string amb les tecles apretades separades per comes, els primers camps 
   *                      són el canal i l'id de ptl, ex: "1,2,V,+"
   * @returns : array d'strings amb les tecles apretades, ex: ['V', '+']
   */
  static parseKeys(msgKeys) {
    // Recuperem les tecles apretades
    let keys = [];
    if (msgKeys && msgKeys.length > 0) {
      // Obtenim les dades separades per comes del camp "keys", ex: "1,2,V,+"
      let aux = msgKeys.split(',');
      // Descartem els dos primers arrais que fan referència al canal i id de ptl
      for (let i=2; i<aux.length; i++) {
        keys.push(aux[i]);
      }
    }

    return keys;
  }

  /**
   * Demana la versió del DPI
   * @returns 
   */
  static buildMsgVersionRequest() {
      return '\x02\x31\x05\x03'.toString('hex');
  }

  static buildMsgOpenSession() {
      return '\x02\x32\x05\x03'.toString('hex');
  }

  /**
   * 
   * @param {*} nodeId : id from "001" to "250"
   * @param {*} channelNumber : "1" or "2"
   * @param {*} displayData : 1 to 31 bytes
   * @param {*} ledLight : 5 bytes with RGB separated with commas, ex: "0,1,0"
   * @param {*} ledBlinkMode : "0" no blink, "1" blink every 0,25 seconds, "2" blink every 0,5 seconds, "4" blink every second
   * @param {*} arrows : "0" none, "1" left/up, "2" right/up, "3" left/down, "4" right/down, "5" left, "6" right, "7" up, "8" down
   * @param {*} keySound : "0" deactivate, "1" activate
   * @param {*} makeBeep : "0" no beep, "1" single beep, "2" double beep (short-short), "4" double beep (short-long)
   * @returns 
   */
  static buildMsgDisplayPrint(nodeId, channelNumber, displayData, ledLight, ledBlinkMode, arrows, keySound, makeBeep) {
      let regNumeric = new RegExp('^[0-9]+$');   // verifiquem que és numèric sense signes
      let regOnly01 = new RegExp('^[01]$');  // verifiquem que és numèric amb 0,1
      let regOnly0124 = new RegExp('^[0124]$');  // verifiquem que és numèric amb 0,1,2,4
      let regOnly012345678 = new RegExp('^[01245678]$');  // verifiquem que és numèric amb 0,1,2,4,5,6,7,8
      let regLightFormat = new RegExp(/^[01]\,[01]\,[01]$/);

      if (nodeId === undefined || nodeId === null || nodeId.length != 3 || regNumeric.test(nodeId) === false || parseInt(nodeId) > 255) {
          return `Error: nodeId ${nodeId} is invalid`;
      }
      if (channelNumber === undefined || channelNumber === null || !(channelNumber === '1' || channelNumber === '2')) {
          return `Error: channelNumber ${channelNumber} is invalid`;
      }
      if (displayData === undefined || displayData === null || displayData.length > 31) {
          return `Error: displayData ${displayData} is invalid, must have less than 31 characters`;
      }
      if (ledLight === undefined || ledLight === null || ledLight.length != 5 || regLightFormat.test(ledLight) === false) {
          return `Error: ledLight ${ledLight} is invalid`;
      }
      if (ledBlinkMode === undefined || ledBlinkMode === null || ledBlinkMode.length != 1 || regOnly0124.test(ledBlinkMode) === false) {
          return `Error: ledBlinkMode ${ledBlinkMode} is invalid`;
      }
      if (arrows === undefined || arrows === null || regOnly012345678.test(arrows) === false) {
        return `Error: arrows ${arrows} is invalid`;
      }
      if (keySound === undefined || keySound === null || keySound.length != 1 || regOnly01.test(keySound) === false) {
          return `Error: keySound ${keySound} is invalid`;
      }
      if (makeBeep === undefined || makeBeep === null || makeBeep.length != 1 || regOnly0124.test(makeBeep) === false) {
          return `Error: makeBeep ${makeBeep} is invalid`;
      }

      // Si no es posa res a displayData hi posem com a mínim un espai en blanc
      if (displayData && displayData.length <= 0) {
          displayData = ' ';
      }

      return `\x02\x34\x05${nodeId}\x05${channelNumber}\x05${displayData}\x2c${ledLight}\x2c${ledBlinkMode}\x2c${arrows}\x2c${keySound}\x2c${makeBeep}\x03`.toString('hex');
  }

  /**
   * 
   * @param {*} messageId : id from "001" to "250"
   * @param {*} nodeId : id from "001" to "250"
   * @param {*} channelNumber : "1" or "2"
   * @param {*} displayData : 1 to 31 bytes
   * @param {*} ledLight : 5 bytes with RGB separated with commas, ex: "0,1,0"
   * @param {*} ledBlinkMode : "0" no blink, "1" blink every 0,25 seconds, "2" blink every 0,5 seconds, "4" blink every second
   * @param {*} arrows : "0" none, "1" left/up, "2" right/up, "3" left/down, "4" right/down, "5" left, "6" right, "7" up, "8" down
   * @param {*} keySound : "0" deactivate, "1" activate
   * @param {*} makeBeep : "0" no beep, "1" single beep, "2" double beep (short-short), "4" double beep (short-long)
   * @returns 
   */
  static buildMsgDisplayPrintAnswered(messageId, nodeId, channelNumber, displayData, ledLight, ledBlinkMode, arrows, keySound, makeBeep) {
      let regNumeric = new RegExp('^[0-9]+$');   // verifiquem que és numèric sense signes
      let regOnly01 = new RegExp('^[01]$');  // verifiquem que és numèric amb 0,1
      let regOnly0124 = new RegExp('^[0124]$');  // verifiquem que és numèric amb 0,1,2,4
      let regOnly012345678 = new RegExp('^[01245678]$');  // verifiquem que és numèric amb 0,1,2,4,5,6,7,8
      let regLightFormat = new RegExp(/^[01]\,[01]\,[01]$/);

      if (messageId === undefined || messageId === null || messageId.length != 3 || regNumeric.test(messageId) === false || parseInt(messageId) > 255) {
          return `Error: messageId ${messageId} is invalid`;
      }
      if (nodeId === undefined || nodeId === null || nodeId.length != 3 || regNumeric.test(nodeId) === false || parseInt(nodeId) > 255) {
          return `Error: nodeId ${nodeId} is invalid`;
      }
      if (channelNumber === undefined || channelNumber === null || !(channelNumber === '1' || channelNumber === '2')) {
          return `Error: channelNumber ${channelNumber} is invalid`;
      }
      if (displayData === undefined || displayData === null || displayData.length > 31) {
          return `Error: displayData ${displayData} is invalid, must have less than 31 characters`;
      }
      if (ledLight === undefined || ledLight === null || ledLight.length != 5 || regLightFormat.test(ledLight) === false) {
          return `Error: ledLight ${ledLight} is invalid`;
      }
      if (ledBlinkMode === undefined || ledBlinkMode === null || ledBlinkMode.length != 1 || regOnly0124.test(ledBlinkMode) === false) {
          return `Error: ledBlinkMode ${ledBlinkMode} is invalid`;
      }
      if (arrows === undefined || arrows === null || regOnly012345678.test(arrows) === false) {
        return `Error: arrows ${arrows} is invalid`;
      }
      if (keySound === undefined || keySound === null || keySound.length != 1 || regOnly01.test(keySound) === false) {
          return `Error: keySound ${keySound} is invalid`;
      }
      if (makeBeep === undefined || makeBeep === null || makeBeep.length != 1 || regOnly0124.test(makeBeep) === false) {
          return `Error: makeBeep ${makeBeep} is invalid`;
      }

      // Si no es posa res a displayData hi posem com a mínim un espai en blanc
      if (displayData && displayData.length <= 0) {
          displayData = ' ';
      }

      return `\x02\x42\x05${messageId}\x05${nodeId}\x05${channelNumber}\x05${displayData}\x2c${ledLight}\x2c${ledBlinkMode}\x2c${arrows}\x2c${keySound}\x2c${makeBeep}\x03`.toString('hex');
  }

  static parseReceivedMessage(dataReceived, fromDpi) {
      let msgParsed = null;   
      let msgKeyPressed = null;  // Guardem les dades enviades quan s'apreta una tecla del PTL

      switch (dataReceived[0]) {
          case '\x31':        // Version response
              msgParsed = ElectrotecDPI.parseVersionResponse(dataReceived, fromDpi);
              if (msgParsed.error) {
                  logger.error(`ElectrotecDPI : parsing version response received data: ${msgParsed.error}`);
              }
              break;
          case '\x32':        // Open session response
              msgParsed = ElectrotecDPI.parseOpenSessionResponse(dataReceived, fromDpi);
              if (msgParsed.error) {
                  logger.error(`ElectrotecDPI : parsing open session response received data: ${msgParsed.error}`);
              }
              break;
          case '\x33':        // Alarm reception
              msgParsed = ElectrotecDPI.parseAlarm(dataReceived, fromDpi);
              if (msgParsed.error) {
                  logger.error(`ElectrotecDPI : parsing alarm received data: ${msgParsed.error}`);
              } else {
                  logger.warn(`ElectrotecDPI : alarm received ${msgParsed.value}`);
              }
              break;
          case '\x42':        // Display print response
              msgParsed = ElectrotecDPI.parsePrintResponse(dataReceived, fromDpi);
              if (msgParsed.error) {
                  logger.error(`ElectrotecDPI : parsing ack received data: ${msgParsed.error}`);
              }
              /*
                  messageId: '',
                  nodeId: '',
                  channel: '',
                  ackType: '',
                  ackMessage: '',
                  error: null
                  */
              break;
          case '\x36':        // key pressed
              msgParsed = ElectrotecDPI.parseKeyPressed(dataReceived, fromDpi);
              if (msgParsed.error) {
                  logger.error(`ElectrotecDPI : parsing key pressed data: ${msgParsed.error}`);
              } else {
                let keyArray = ElectrotecDPI.parseKeys(msgParsed.keys);

                msgKeyPressed = {
                    dpi: msgParsed.dpi,
                    nodeId: msgParsed.nodeId,
                    channelId: msgParsed.channel,
                    keysMsg: msgParsed.keys,
                    keys: keyArray
                }
              }
              break;
          case '\x39':        // Network distribution response
              // this és el socket
              msgParsed = ElectrotecDPI.parseNetworkDistributionResponse(dataReceived, fromDpi);
              if (msgParsed.error) {
                  logger.error(`ElectrotecDPI : parsing network distribution received data: ${msgParsed.error}`);
              }
              break;
          default:
              logger.error(`ElectrotecDPI : message type ${dataReceived[0]} unknown`);
              break;
      }

      return [msgParsed, msgKeyPressed];
  }

  /**
   * Meessge received:
   *   Start 1 byte 0x02 Telegram start   // S'ha eliminat en el parseig inicial
   *   ID 1 byte 0x31 Telegram type
   *   Splitter 1 byte 0x05 Field splitter
   *   Data 0 1 byte 0x31 1
   *   Data 1 1 byte 0x2E .
   *   Data 2 1 byte 0x30 0
   *   End 1 byte 0x03 Telegram end       // S'ha eliminat en el parseig inicial
   * @param {*} message 
   * @param {*} dpi : { id:1, ip: '', port: 16 }
   * @returns objecte amb la versió i error si n'hi ha
   */
  static parseVersionResponse(message, dpi) {
      let result = {
          type: constantsPTL.ELECTROTEC_MSGTYPE_VERSION,
          value: '',
          dpi: dpi,
          error: null
      };

      if (message.length != 5) {
          result.error = `Error, version response ${message} must have 5 bytes`;
          return result;
      }

      if (message.charAt(0) != '\x31') {
          result.error = `Error, version response ${message} must have a the type in byte 1`;
          return result;
      }
      
      if (message.charAt(1) != '\x05') {
          result.error = `Error, version response ${message} must have a separator in byte 2`;
          return result;
      }

      result.value = message.substring(2,5);
      return result;
  }

  /**
   * 
   * @param {*} message 
   * @param {*} dpi : { id:1, ip: '', port: 16 }
   * @returns objecte amb el número de sessions (de 0 a 5 i 9 per error) i l'error si n'hi ha
   */
  static parseOpenSessionResponse(message, dpi) {
      let result = {
          type: constantsPTL.ELECTROTEC_MSGTYPE_SESSIONS,
          value: '',
          dpi: dpi,
          error: null
      };

      if (message.length != 3) {
          result.error = `Error, open session response ${message} must have 3 bytes`;
          return result;
      }

      if (message.charAt(0) != '\x32') {
          result.error = `Error, open session response ${message} must have a the type in byte 1`;
          return result;
      }
      
      if (message.charAt(1) != '\x05') {
          result.error = `Error, open session response ${message} must have a separator in byte 2`;
          return result;
      }

      result.value = message.substring(2,3);

      return result;
  }

  /**
   * 
   * @param {*} message 
   * @param {*} dpi : { id:1, ip: '', port: 16 }
   * @returns objecte amb l'id del node, el canal i l'alarma i l'error si n'hi ha 
   */
  static parseAlarm(message, dpi) {
      let result = {
          type: constantsPTL.ELECTROTEC_MSGTYPE_ALARM,
          value: '',
          dpi: dpi,
          nodeId: '',
          channel: '',
          alarmCode: '',
          alarmMessage: '',
          error: null
      };

      if (message.length != 9) {
          result.error = `Error, alarm ${message} must have 9 bytes`;
          return result;
      }

      if (message.charAt(0) != '\x33') {
          result.error = `Error, alarm ${message} must have a the type in byte 1`;
          return result;
      }
      
      if (message.charAt(1) != '\x05') {
          result.error = `Error, alarm ${message} must have a separator in byte 2`;
          return result;
      }
      if (message.charAt(5) != '\x05') {
          result.error = `Error, alarm ${message} must have a separator in byte 6`;
          return result;
      }
      if (message.charAt(7) != '\x05') {
          result.error = `Error, alarm ${message} must have a separator in byte 8`;
          return result;
      }

      result.nodeId = message.substring(2,5);
      result.channel = message.substring(6,7);
      result.alarmCode = message.substring(8,9);

      switch(result.alarmCode) {
          case constantsPTL.ELECTROTEC_ALARM_RING_BROKEN:
              result.alarmMessage = `Comunication Ring on channel ${result.channel} is broken`;
              break;
          case constantsPTL.ELECTROTEC_ALARM_NODE_DISCONNECT:
              result.alarmMessage = `Node ${result.nodeId} detected as disconnected`;
              break;
          case constantsPTL.ELECTROTEC_ALARM_HW_ERROR:
              result.alarmMessage = `Node ${result.nodeId} detected with hardware problems`;
              break;
          case constantsPTL.ELECTROTEC_ALARM_WRONG_FORMAT:
              result.alarmMessage = 'Frame with wrong format';
              break;
          case constantsPTL.ELECTROTEC_ALARM_NOT_CONFIG:
              result.alarmMessage = `Alarm when trying to send data to node ${result.nodeId} not configured in DPI interface`;
              break;
          case constantsPTL.ELECTROTEC_ALARM_TRANSMISSION_FAIL:
              result.alarmMessage = `Impossible to transmit the frame to node ${result.nodeId}`;
              break;
          default:
              result.alarmMessage = `Alarm code ${result.alarmCode} unexpected`;
              break;
      }

      result.value = `Node ${result.nodeId}, channel ${result.channel}, alarm code ${result.alarmCode}, ${result.alarmMessage}`;

      return result;
  }

  /**
   * 
   * @param {*} message 
   * @param {*} dpi : { id:1, ip: '', port: 16 }
   * @returns objecte amb l'id del node, el canal i l'ack i l'error si n'hi ha 
   */
  static parsePrintResponse(message, dpi) {
      let result = {
          type: constantsPTL.ELECTROTEC_MSGTYPE_PRINT_RESPONSE,
          value: '',
          dpi: dpi,
          messageId: '',
          nodeId: '',
          channel: '',
          ackType: '',
          ackMessage: '',
          error: null
      };

      if (message.length != 13) {
          result.error = `Error, print response ${message} must have 13 bytes`;
          return result;
      }

      if (message.charAt(0) != '\x42') {
          result.error = `Error, print response ${message} must have a the type in byte 1`;
          return result;
      }
      
      if (message.charAt(1) != '\x05') {
          result.error = `Error, print response ${message} must have a separator in byte 2`;
          return result;
      }
      if (message.charAt(5) != '\x05') {
          result.error = `Error, print response ${message} must have a separator in byte 6`;
          return result;
      }
      if (message.charAt(9) != '\x05') {
          result.error = `Error, print response ${message} must have a separator in byte 10`;
          return result;
      }
      if (message.charAt(11) != '\x05') {
          result.error = `Error, print response ${message} must have a separator in byte 12`;
          return result;
      }

      result.messageId = message.substring(2,5);
      result.nodeId = message.substring(6,9);
      result.channel = message.substring(10,11);
      result.ackType = message.substring(12,13);

      switch(result.ackType) {
          case constantsPTL.ELECTROTEC_ACK_OK:
              result.ackMessage = `Transmission ok`;
              break;
          case constantsPTL.ELECTROTEC_ACK_NODE_DISCONNECTED:
              result.ackMessage = `Node ${result.nodeId} detected as disconnected`;
              break;
          case constantsPTL.ELECTROTEC_ACK_HW_ERROR:
              result.ackMessage = `Node ${result.nodeId} detected with hardware problems`;
              break;
          case constantsPTL.ELECTROTEC_ACK_WRONG_FORMAT:
              result.ackMessage = 'Frame with wrong format';
              break;
          case constantsPTL.ELECTROTEC_ACK_NOT_CONFIG:
              result.ackMessage = `Alarm when trying to send data to node ${result.nodeId} not configured in DPI interface`;
              break;
          case constantsPTL.ELECTROTEC_ACK_TRANSMISSION_FAIL:
              result.ackMessage = `Impossible to transmit the frame to node ${result.nodeId}`;
              break;
          default:
              result.ackMessage = `ACK code ${result.ackType} unexpected`;
              break;
      }

      result.value = `Message ${result.messageId}, Node ${result.nodeId}, channel ${result.channel}, ack type ${result.ackType},  ${result.ackMessage}`;

      return result;
  }

  /**
   * 
   * @param {*} message 
   * @param {*} dpi : { id:1, ip: '', port: 16 }
   * @returns :
   * - It shows the symbol, that may be “V”, “+”, “-“ or “F”, or a combination of the 4 keys in displays DPA and DPM.
   */
  static parseKeyPressed(message, dpi) {
      let result = {
          type: constantsPTL.ELECTROTEC_MSGTYPE_KEY,
          value: '',
          dpi: dpi,
          nodeId: '',
          channel: '',
          keys: '',
          error: null
      };

      // Length de 9 a 15
      if (message.length <= 9 || message.length > 15) {
          result.error = `Error, key pressed ${message} must have a length between 9 an 15 bytes`;
          return result;
      }

      if (message.charAt(0) != '\x36') {
          result.error = `Error, key pressed ${message} must have a the type in byte 1`;
          return result;
      }
      
      if (message.charAt(1) != '\x05') {
          result.error = `Error, key pressed ${message} must have a separator in byte 2`;
          return result;
      }
      if (message.charAt(5) != '\x05') {
          result.error = `Error, key pressed ${message} must have a separator in byte 6`;
          return result;
      }
      if (message.charAt(7) != '\x05') {
          result.error = `Error, key pressed ${message} must have a separator in byte 8`;
          return result;
      }

      result.nodeId = message.substring(2,5);
      result.channel = message.substring(6,7);
      result.keys = message.substring(8);
      result.key = '';

      let keysValues = result.keys.split(',');
      // Les tecles pausades estan al 3r array
      if (keysValues && keysValues.length && keysValues.length >= 3) {
        result.key = keysValues[2];
      }

      result.value = `Node ${result.nodeId}, channel ${result.channel}, keys ${result.keys}, key ${result.key}`;

      return result;
  }


  /**
   * 
   * @param {*} message : networkdistribution message received from DPI
   * @param {*} dpi : { id:1, ip: '', port: 16 }
   * @returns :
   */
  static parseNetworkDistributionResponse(message, dpi) {
      let result = {
          type: constantsPTL.ELECTROTEC_MSGTYPE_NETWORK,
          value: '',
          dpi: dpi,
          channels: [],
          error: null
      };

      // Length superior a 4
      if (message.length <= 4) {
          result.error = `Error, network distribution ${message} must have a minumum length of 4 bytes`;
          return result;
      }
      if (message.charAt(0) != '\x39') {
          result.error = `Error, network distribution ${message} must have a the type in byte 1`;
          return result;
      }
      if (message.charAt(1) != '\x05') {
          result.error = `Error, network distribution ${message} must have a separator in byte 2`;
          return result;
      }

      // Processem per cada canal els nodes d'aquest canal
      // canal,#nodes,\x05
      //      nodeId,status,tipus\x05
      //      nodeId,status,tipus\x05
      //      ...
      let network = message.substring(2);
      let networkMessages = network.split('\x05');

      for (let i = 0; i < networkMessages.length; i++) {

          // Quan es fa un split de \x05 obtenim un últim missatge sense dades, l'hem d'ignorar
          if (networkMessages[i].length > 0) {
              // Primer sempre hem de trobar un canal
              let channelData = networkMessages[i].split(',');
              // Verifiquem que obtenim dos camps
              if (channelData.length != 2) {
                  result.error = `Error, processing network distribution, expected channel with id and total nodes and found ${networkMessages[i]}`;
                  return result;
              }
              // Comprovem que no estigui
              if (result.channels.find(o => o.channel === channelData[0])) {
                  result.error = `Error, processing network distribution, current channel is repeted ${networkMessages[i]}`;
                  return result;
              }

              let channelNodes = [];

              // Processem els nodes
              for (let j = 0; j < parseInt(channelData[1]); j++) {
                  //console.log(`parsing ${i+j+1} ${networkMessages[i+j+1]}`);
                  let nodeData = networkMessages[i+j+1].split(',');

                  // Comprovem que hi hagi 3 camps en el node
                  if (nodeData.length != 3) {
                      result.error = `Error, processing channel ${channelData[0]} and node ${j+1}, current node has invalid format ${networkMessages[i+1+j]}`;
                      return result;
                  }

                  channelNodes.push({
                      nodeId: nodeData[0], 
                      status: nodeData[1], 
                      statusDesc: ElectrotecDPI.getDescFromNodeStatus(nodeData[1]), 
                      type: parseInt(nodeData[2]), 
                      typeDesc: ElectrotecDPI.getDescFromNodeType(parseInt(nodeData[2]))
                  });
              }

              // Apuntem al següent canal
              i += parseInt(channelData[1]);

              // Afegim el nou canal
              result.channels.push({
                  channel: channelData[0],
                  numNodes: parseInt(channelData[1]),
                  nodes: channelNodes
              });
          }
      }

      result.value = '';

      return result;
  }

  /**
   * 
   * @param {*} output : 5 bytes with output active (1) or inactive (0) separated with commas, ex: "0,1,0"
   * @returns 
   */
  static buildMsgRelayOutput(output) {
      let regOutput = new RegExp('^[01]\,[01]\,[01]$');

      if (output === undefined || output === null || output.length != 5 || regOutput.test(output) === false) {
          return `Error: output ${output} is invalid`;
      }
      return `\x02\x35\x05${output}\x03`.toString('hex');
  }

  static buildMsgGetNetworkDistribution() {
      return '\x02\x39\x05\x03'.toString('hex');
  }

  connect() {
      if (this.client) {
          logger.info(`ElectrotecDPI : connect : disconnect`);
          this.client.disconnect();
          logger.info(`ElectrotecDPI : connect : destroy`);
          this.client.destroy();
      }
      logger.info(`ElectrotecDPI : connect : new`);
      this.client = new net.Socket();
      logger.info(`ElectrotecDPI : connect : connect`);
      this.client = net.connect( this.port, this.ip);
  };

  disconnect() {
      if (this.client) {
          logger.info(`ElectrotecDPI : disconnect : disconnect`);
          this.client.disconnect();
          logger.info(`ElectrotecDPI : disconnect : destroy`);
          this.client.destroy();
          // Finalitzem la funció que manté viva la connexió, no es necessari!
          //logger.info(`ElectrotecDPI : disconnect : clearInterval`);
          //clearInterval(intervalObj);
      }
  };

  /**
   * Funció per mantenir viva la connexió, no cal fer-ho servir!
   * La dll c# fa pings al DPI per detectar si ha caigut o no ja que el mètode
   * de detecció de connexió caiguda és molt lent en C#
   *
  keepConnectionAlive() {
      logger.info(`ElectrotecDPI : Client ${this.id} : Keep Connection Alive`);
  };
  */

  static convertASCIItoHex(asciiString) {
      let hex = '';
      let tempASCII, tempHex;
      asciiString.split('').map( i => {
          tempASCII = i.charCodeAt(0)
          tempHex = tempASCII.toString(16);
          hex = hex + '\\x' + tempHex;
      });
      return hex.trim(); 
  };

  static getDescFromNodeStatus(status) {
      let result = '';
      switch(status) {
          case constantsPTL.ELECTROTEC_NODE_STATE_UNK:
              result = 'Unknown';
              break;
          case constantsPTL.ELECTROTEC_NODE_STATE_INIT:
              result = 'Node initializing';
              break;
          case constantsPTL.ELECTROTEC_NODE_STATE_LOCAL:
              result = 'Node in local mode';
              break;
          case constantsPTL.ELECTROTEC_NODE_STATE_NORMAL:
              result = 'Node in normal state';
              break;
          case constantsPTL.ELECTROTEC_NODE_STATE_ERROR:
              result = 'Node in Error state';
              break;
          case constantsPTL.ELECTROTEC_NODE_STATE_PROG:
              result = 'Node in programming state';
              break;
          default:
              break;
      }
      return result;
  };

  static getNameFromNodeType(type) {
      let result = '';
      switch(type) {
          case constantsPTL.ELECTROTEC_NODE_TYPE_NOT_CONFIG:
              result = 'NotConfig';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPA1:
              result = 'DPA1';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPAZ1:
              result = 'DPAZ1';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPM1:
              result = 'DPM1';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPMZ1:
              result = 'DPMZ1';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_LC1:
              result = 'LC1';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_LCI2_LCIN1:
              result = 'LCI2/LCIN1';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPW1:
              result = 'DPW1';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPA2:
              result = 'DPA2';
              break;
      }
      return result;
  };

  static getDescFromNodeType(type) {
      let result = '';
      switch(type) {
          case constantsPTL.ELECTROTEC_NODE_TYPE_NOT_CONFIG:
              result = 'Node ID not configured';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPA1:
              result = 'DPA1: Display 4 digits 14seg';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPAZ1:
              result = 'DPAZ1: Display 12 digits 14seg';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPM1:
              result = 'DPM1: Display 4 digits dotmatrix';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPMZ1:
              result = 'DPMZ1: Display 12 digits dotmatrix';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_LC1:
              result = 'LC1: Display low cost 1 led 1 pushbutton';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_LCI2_LCIN1:
              result = 'LCI2/LCIN1: Interface DP/LC';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPW1:
              result = 'DPW1: Interface DP/RS232';
              break;
          case constantsPTL.ELECTROTEC_NODE_TYPE_DPA2:
              result = 'DPA2: Display 2 digits 14seg';
              break;
      }
      return result;
  };

  /**
   * Funció que a partir de la configuració de xarxa obtenida del DPI
   * la parseja per emmagatzemar-la a la BD en format.
   * Es generen automàticament identificadors i codis d'ubicació.
   * Es rep:
   * {
   *   dpi: {
   *       id: id,
   *       ip: ip,
   *       port: port
   *    },
   *   channels: [ 
   *   {
   *       channel: '1',
   *       numNodes: 2,
   *       nodes: [
   *           { nodeId: '001', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
   *           { nodeId: '002', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
   *       ]
   *   }], 
   *   };
   * S'ha d'obtenir:
   * [ 
   *   { location:"A1", shelf:"", shelf_type:"", id:1, internal_id:"001", channel_id:"1", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
   * ]
   * @param {*} networkConfiguration 
   * @param {*} shelfCode : string amb el codi de la estanteria, per defecte es posen tots els PTL a la mateixa estantería
   * @param {*} shelfType : tipus de l'estanteria
   *   '1', 'pick-to-light'
   *   '2', 'put-to-light'
   *   '3', 'pick-to-light + PT by product'
   *   '4', 'pick-to-light + PT by order'
   */
  static parseNetworkDistributionToConfiguration(networkConfiguration, shelfCode, shelfType) {
      let result = {
          error : null,
          configuration: []
      };

      if (networkConfiguration === undefined || networkConfiguration === null ||
          networkConfiguration.dpi === undefined || networkConfiguration.dpi === null) {
          result.error = `Error in networkConfiguration, format not expected`;
          return result;
      }

      let ptlId = 1;
      for (let i = 0; i < networkConfiguration.channels.length; i++) {
          for (let j = 0; j < networkConfiguration.channels[i].nodes.length; j++) {
              result.configuration.push({
                  location: `L${i.toString().padStart(3,'0')}${j.toString().padStart(3,'0')}`,
                  shelf: {
                    id: 0,
                    code: shelfCode,
                    type_id: (shelfType ? shelfType : constantsPTL.SHELF_TYPE_PICK_TO_LIGHT),  // Per defecte posem pick to light
                    type_code: ''
                  },
                  id: ptlId,
                  internal_id: networkConfiguration.channels[i].nodes[j].nodeId,
                  channel_id: networkConfiguration.channels[i].channel,
                  type: networkConfiguration.channels[i].nodes[j].type,
                  dpi: {
                      ip: networkConfiguration.dpi.ip,
                      port: networkConfiguration.dpi.port,
                      id: networkConfiguration.dpi.id
                  }
              });
              ptlId++;
          }
      }

      return result;
  };
}