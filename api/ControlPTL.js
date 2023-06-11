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

//import { networkInterfaces } from "os";

const logger = require(`${global.__base}api/logger`);
//const net = require('net');
const electrotecDPI = require(`${global.__base}api/ElectrotecDPI`);
const constantsPTL = require(`${global.__base}api/constantsPTL`);
const config = require(`${global.__base}config/config`);
const { send } = require('process');
const DataPTL = require(`${global.__base}api/DataPTL`);
const poolMySql = require(`${global.__base}api/poolMySql`);

const schedule = require('node-schedule');
//const ElectrotecDPI = require('./ElectrotecDPI');

// Paquets que implementen els diferents modes de treball
const executionMode = require(`${global.__base}api/modes/${config.mode.name}`);

const TIMEOUT_RETRY = 10000;
const INTERVAL_ALIVE = 10000;

const SENT_MESSAGES_MAX_LENGTH = 500;
const SENT_MESSAGES_PENDING_ACK_MAX_LENGTH = 500;
const RECV_MESSAGES_MAX_LENGTH = 500;
const RECV_ALARMS_MAX_LENGTH = 500;

/**
 * Funció que s'executa cada segón per reintentar enviar les missatges sense resposta
 * Quan és necessari reenviar?
 * - Quan s'envien dos comunicacions al mateix PTL amb poc temps, p.e. s'envia un apagar i un nou missatge, el missatge es perd
 */
const jobResendToPTL = schedule.scheduleJob(config.jobs.ResendToPTL.schedule, function() {
  let msgPendingToSend = [];
  let now = (new Date()).getTime();

  try {
    // Obtenim els objectes que s'han de reenviar
    let msgToResend = ControlPTL.SentMessagesPendingAck.filter(m => (m.date.getTime() + 1000) <= now);

    // Enviem el missatge i el treiem de la llista de missatges per reenviar
    for (let i=0; i<msgToResend.length; i++) {
      logger.info(`ControlPTL: jobResendToPTL: ${JSON.stringify(msgToResend[i])}`);
      let sendResult = ControlPTL.controlPTLReference.resend(msgToResend[i].ptl.id, msgToResend[i].type, msgToResend[i].message);

      if (sendResult.result !== constantsPTL.RETURN_OK) {
        // TODO: tractar l'error, no deixar que la cua de pendents de confirmar creixi excessívament
        logger.error(`ControlPTL: jobResendToPTL: Error ${sendResult.result} ${sendResult.message} resending message ${JSON.stringify(msgToResend[i])}`);
      } else {
        // Els treiem de la cua de pendents de confirmar
        let index = ControlPTL.SentMessagesPendingAck.findIndex(m => m.messageId === parseInt(msgToResend.messageId) 
          && m.dpi.id === msgToResend.dpi.id);
        if (index !== -1) {
          msgPendingToSend.splice(index, 1);
        }
      }
    }
  } catch(e) {
    logger.error(`ControlPTL: jobResendToPTL: Exception ${e.message}`);
  }
});

/**
 * Funció que s'executa cada 5 segóns per reintentar enviar les missatges sense resposta a Onion
 */
const jobResendToOnion = schedule.scheduleJob(config.jobs.ResendToOnion.schedule, async function() {
  let msgPendingToSend = [];
  let now = (new Date()).getTime();

  try {
    // Obtenim els objectes que s'han de reenviar de BD
    let result = await DataPTL.getMovementsToPendingToSendToOnion(poolMySql.getPromise(), 100, 0, 1);
    if (result.status === "OK") {
      // Enviem el missatge i el treiem de la llista de missatges per reenviar
      logger.info(`ControlPTL: jobResendToOnion: found ${result.movements.length} movements to send to Onion`);
      result.movements.forEach(async mov => {
        let movSentResult = await executionMode.process(ControlPTL.ModeState, null, 'sendMovToOnion', {
          onionConfig: config.onion,
          movement: mov
        });

        if (movSentResult) {
          
        }
      });
    } else {
      logger.error(`ControlPTL: jobResendToOnion: Error ${result.error} in function getMovementsToPendingToSendToOnion`);
    }
  } catch(e) {
    logger.error(`ControlPTL: jobResendToOnion: Exception ${e.message}`);
  }
});

/**
 * Funció que s'executa cada minut per enviar event als diferents modes de funcionament i que puguin
 * carregar fitxers, demanar ordres a Onion
 */
const jobImportOrders = schedule.scheduleJob(config.jobs.ImportOrders.schedule, function() {
  try {
    // TODO:
  } catch(e) {
    logger.error(`ControlPTL: jobImportOrders: Exception ${e.message}`);
  }
});

/**
 * Objecte Singleton per comunicar via TCP/IP amb els dispositius DPI d'Electrotec
 * Carrega la configuració de PTL, cada ptl té:
 * - una adreça IP del DPI
 * - el port del DPI
 * - un id de DPI dins la xarxa d'Electrotec
 * Gestiona les connexions via TCP/IP amb els DPI de la configuració
 * Reconnecta amb el DPI quan toca
 * Envia missatges d'alive periòdicament
 * 
 * Per fer-lo servir, importar el fitxer i ja es pot cridar a les funcions
 *   import electrotec from './ControlPTL.js';
 *   electrotec.send();
 */

class ControlPTL {
  // Variable per guardar la referencia de l'objecte creat, com que és un singleton només n'hi haurà un
  static controlPTLReference = null;

  // Esperem rebre la configuració del tipus [ { "location":"", "id":N, "dpi":{"ip":"0.0.0.0","port":N,"id":N} }, ... ]
  configuration = null;
  get Configuration() {
    return this.configuration;
  }
  /**
   * Returns the first configured element with a ptl zone device or undefined
   */
  getConfiguredPTLZoneDevice() {
    return this.configuration.find(o => o.type === constantsPTL.ELECTROTEC_NODE_TYPE_DPAZ1);
  }

  getConfiguredPTLFromLocation(locationCode) {
    return this.configuration.find(o => o.location === locationCode);
  }
  
  // Llista de objectes electrotecDPI
  // el posem com a variable estàtica, que es compartida per totes les instàncies
  static DPI = [];

  // Retornem només els valors que ens interessen per no passar l'objecte socket
  get ConfiguredDPIs() {
      // Retornem només id, ip i port
      let result = ControlPTL.DPI.map((o) => {
          return { id: o.id, ip: o.ip, port: o.port };
      });

      return result;
  }

  get DPIs() {
    return ControlPTL.DPI;
  }

  // Llista amb els PTLs del tipus 
  // [ { location:"A1", shelf:"", shelf_type:"", id:1, internal_id:1, channel_id:"1", type: constantsPTL.ELECTROTEC_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} }, ... ]
  static PTL = [];
  get ConfiguredPTLs() {
      return ControlPTL.PTL;
  }

  // Cerca un PTL en base al dpi, nodeId i channelId
  // ptlInfo = {
  //    dpi: msgParsed.dpi,
  //    nodeId: msgParsed.nodeId,
  //    channelId: msgParsed.channel,
  //    keys: msgParsed.keys
  //}
  static findPTL(ptlInfo) {
      let ptlFound = null;
      try {
          ptlFound = ControlPTL.PTL.find(o => (
              o.internal_id == ptlInfo.nodeId &&
              o.channel_id == ptlInfo.channelId &&
              o.dpi.ip == ptlInfo.dpi.ip &&
              o.dpi.port == ptlInfo.dpi.port));
      } catch (e) {
          logger.error(`ControlPTL : findPTL : ${e.message}`);
      }        
      return ptlFound;
  }
  
  // Llista de missatges rebuts dels DPI, el posem com a variable estàtica, que es
  // compartida per totes les instàncies, per poder accedir-hi des del 
  // receive que té com a this l'objecte que el crida
  static ReceivedMessages = [];
  // Llista d'alarmes rebudes del PTL
  static ReceivedAlarms = [];
  // Llista amb missatges enviats a DPI
  static SentMessages = [];
  // Llista de missatges pendents de rebre ACK
  static SentMessagesPendingAck = [];

  get NumReceivedMessages() {
    return ControlPTL.ReceivedMessages.length();
  }

  get ReceivedMessages() {
      return ControlPTL.ReceivedMessages;
  }

  get NumReceivedAlarms() {
    return ControlPTL.ReceivedAlarms.length();
  }

  get ReceivedAlarms() {
    return ControlPTL.ReceivedAlarms;
  }

  get SentMessages() {
      return ControlPTL.SentMessages;
  }

  get SentMessagesPendingAck() {
    return ControlPTL.SentMessagesPendingAck;
  }

  // Estat del mòde de treball
  static modeState = null;

  get ModeState() {
    return ControlPTL.modeState;
  }

  set ModeState(value) {
    ControlPTL.modeState = value;
  }
  
  /**
   * 
   */
  constructor(/*configuration*/) {
    logger.info(`ControlPTL : constructor`);
    // Guardem la referència de l'objecte en una variable estàtica de la class ControlPTL 
    // per poder accedir a l'objecte creat des de qualsevol punt
    ControlPTL.controlPTLReference = this;

    // Inicialitzem la màquina d'estats
    ControlPTL.ModeState = executionMode.getInitialState(this, DataPTL, poolMySql.getPromise(), config);
    /*
    .then(function (result) {
      ControlPTL.ModeState = result;
    })
    .catch(function (error) {
      logger.error(`ControlPTL : constructor : Retrieving initial configuration ${error.message}`);
    });
    */
  }

  async reloadMovements() {
    // Check if configured mode "picktolightonion", if not return error
    if (config.mode.name === "pick2lightonion") {
      await executionMode.process(ControlPTL.ModeState, null, 'reloadMovements', null);
    }
  }

  getMovements() {
    // Check if configured mode "picktolightonion", if not return error
    if (config.mode.name !== "pick2lightonion") {
      logger.error(`ControlPTL : getMovements : Wrong configuration, change mode configuration to picktolightonion or compatible`);
      return {
        result: constantsPTL.RETURN_ERROR,
        message : `Wrong configuration, change mode configuration to picktolightonion or compatible`
      }
    }

    return executionMode.process(ControlPTL.ModeState, null, 'getMovements', null);
  }

  getMovement(id) {
    // Check if configured mode "picktolightonion", if not return error
    if (config.mode.name !== "pick2lightonion") {
      logger.error(`ControlPTL : getMovement : Wrong configuration, change mode configuration to picktolightonion or compatible`);
      return {
        result: constantsPTL.RETURN_ERROR,
        message : `Wrong configuration, change mode configuration to picktolightonion or compatible`
      }
    }

    return executionMode.process(ControlPTL.ModeState, null, 'getMovement', { id: id });
  }

  async getMovementsPendingToSend(numMovs, page, getMovementsPendingToSend) {
    // Check if configured mode "picktolightonion", if not return error
    if (config.mode.name !== "pick2lightonion") {
      logger.error(`ControlPTL : getMovementsPendingToSend : Wrong configuration, change mode configuration to picktolightonion or compatible`);
      return {
        result: constantsPTL.RETURN_ERROR,
        message : `Wrong configuration, change mode configuration to picktolightonion or compatible`
      }
    }

    return await executionMode.process(ControlPTL.ModeState, null, 'getMovementsPendingToSend', {
      numMovs: numMovs, 
      page: page, 
      onlyPendingToSend: getMovementsPendingToSend
    });
  }

  async getMovementsPendingToSendArch(numMovs, page) {
    // Check if configured mode "picktolightonion", if not return error
    if (config.mode.name !== "pick2lightonion") {
      logger.error(`ControlPTL : getMovementsPendingToSendArch : Wrong configuration, change mode configuration to picktolightonion or compatible`);
      return {
        result: constantsPTL.RETURN_ERROR,
        message : `Wrong configuration, change mode configuration to picktolightonion or compatible`
      }
    }

    return await executionMode.process(ControlPTL.ModeState, null, 'getMovementsPendingToSendArch', {
      numMovs: numMovs, 
      page: page
    });
  }

  
  async getMovementsReceivedFromOnion(numMovs, page) {
    // Check if configured mode "picktolightonion", if not return error
    if (config.mode.name !== "pick2lightonion") {
      logger.error(`ControlPTL : getMovementsReceivedFromOnion : Wrong configuration, change mode configuration to picktolightonion or compatible`);
      return {
        result: constantsPTL.RETURN_ERROR,
        message : `Wrong configuration, change mode configuration to picktolightonion or compatible`
      }
    }

    return await executionMode.process(ControlPTL.ModeState, null, 'getMovementsReceivedFromOnion', {
      numMovs: numMovs, 
      page: page
    });
  }

  /**
   * Adds a movement to the queue and sends a message to PTL is needed
   * @param {*} movement : JSON object {
   *   ptl
   *   externalId,
   *   userId,
   *   color,
   *   locationCode, 
   *   display,
   *   quantity
   * }
   */
  async addMovement(movement) {
    // Check if configured mode "picktolightonion", if not return error
    if (config.mode.name !== "pick2lightonion") {
      logger.error(`ControlPTL : addMovement : Wrong configuration, change mode configuration to picktolightonion or compatible`);
      return {
        result: constantsPTL.RETURN_ERROR,
        message : `Wrong configuration, change mode configuration to picktolightonion or compatible`
      }
    }

    return await executionMode.process(ControlPTL.ModeState, null, 'addMovement', {
      movement: movement, 
      saveMovsIntoDB: 0
    });
  }

  /**
   * Adds a movement to the queue and sends a message to PTL is needed
   * @param {*} movement : JSON object {
   *   id,          // optional
   *   externalId,  // optional
   * }
   */
  async delMovement(movement, result) {
    // Check if configured mode "picktolightonion", if not return error
    if (config.mode.name !== "pick2lightonion") {
      logger.error(`ControlPTL : addMovement : Wrong configuration, change mode configuration to picktolightonion or compatible`);
      return {
        result: constantsPTL.RETURN_ERROR,
        message : `Wrong configuration, change mode configuration to picktolightonion or compatible`
      }
    }

    return await executionMode.process(ControlPTL.ModeState, null, 'delMovement', {
      movement: movement, 
      result: result
    });
  }

  /**
   * S'indica el id de la configuració i el missatge que es vol enviar
   * @param {*} dpiId : id del DPI, necessari per tots els missatges excepte 
   *                    ELECTROTEC_MSGTYPE_DISPLAY
   *                    Si es vol fer un broadcast s'ha de passar el DPI
   * @param {*} ptlId : id del PTL, necessari només el missatge 
   *                    ELECTROTEC_MSGTYPE_DISPLAY
   *                    Si es vol fer un broadcast es pot posar a null
   * @param {*} message : objecte json. 
   *  Quan el missatge és per activar displays de PTL ha de tenir els camps:
   *  - type: string "display"
   *  - display: string
   *  - ledLight: string
   *  - ledBlinkMode: string
   *  - arrows: string
   *  - keySound: string
   *  - makeBeep: string
   *  Quan el missatge és per obtenir la versió ha de tenir els camps:
   *  - type: string "version"
   *  Quan el missatge és per obrir la connexió ha de tenir els camps:
   *  - type: string "open"
   *  Quan el missatge és per obtenir la configuració de la xarxa de PTL ha de tenir els camps:
   *  - type: string "network"
   *  Quan el missatge és per activar relés de PTL ha de tenir els camps:
   *  - type: string "relay"
   *  - rele: [0,0,0]  //array de 0 o 1
   */
  send(dpiId, ptlId, message) {
      logger.info(`ControlPTL : send : Sending to ptl.id [${ptlId}] message [${JSON.stringify(message)}]`);

      // Recuperem el PTL si s'ha proporcionat com a paràmetre
      let ptlFound = null;
      if (ptlId) {
          // Atenció: Podem comparar strings '1' amb enterns 1
          ptlFound = this.configuration.find(o => (o.id == ptlId));
      }

      // Recuperem el DPI a partir del ptl trobat, o del dpi passat com a paràmetrte
      let dpiFound = null;
      if (ptlFound) {
          // Busquem el DPI a partir del PTL
          dpiFound = ControlPTL.DPI.find(o => (o.ip === ptlFound.dpi.ip && o.port === ptlFound.dpi.port));
      } else {
          // Busquem el DPI a partir del dpi passat com a parámetre
          /// Nota cpomparem amb == ja que el dpiId pot ser un string i el .id és un enter
          dpiFound = ControlPTL.DPI.find(o => (o.id == dpiId));
      }

      // Tant si es passa DPI com PTL he d'acabar tenint el DPi pel que haurem d'enviar
      if (dpiFound === null || dpiFound === undefined) {
          logger.error(`ControlPTL : send : Error DPI or PTL not found`);
          return {
              result: constantsPTL.RETURN_NOT_SENT,
              message: `PTL or DPI not found`
          }
      }

      // Enviem el missatge
      let result = null;
      switch (message.type) {
          case constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY:
              if (ptlFound === null || ptlFound === undefined) {
                  return {
                      result: constantsPTL.RETURN_NOT_SENT,
                      message: `To send the message ${message.type} is required a PTL valid`
                  }
              }
              result = dpiFound.send(electrotecDPI.buildMsgDisplayPrint(
                  ptlFound.internal_id, 
                  ptlFound.channel_id, 
                  message.display, 
                  message.ledLight, 
                  message.ledBlinkMode, 
                  message.arrows,
                  message.keySound,
                  message.makeBeep));
              break;
          case constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK:
              if (ptlFound === null || ptlFound === undefined) {
                  return {
                      result: constantsPTL.RETURN_NOT_SENT,
                      message: `To send the message ${message.type} is required a PTL valid`
                  }
              }
              
              result = dpiFound.send(electrotecDPI.buildMsgDisplayPrintAnswered(
                  dpiFound.NewMessageId,
                  ptlFound.internal_id, 
                  ptlFound.channel_id, 
                  message.display, 
                  message.ledLight, 
                  message.ledBlinkMode, 
                  message.arrows,
                  message.keySound,
                  message.makeBeep));
              break;
          case constantsPTL.ELECTROTEC_MSGTYPE_BROADCAST_DISPLAY:
            // Broadcast for channel 1
            result = dpiFound.send(electrotecDPI.buildMsgDisplayPrint(
              '252', 
              '1', 
              message.display, 
              message.ledLight, 
              message.ledBlinkMode, 
              message.arrows,
              message.keySound,
              message.makeBeep));
            // Broadcast for channel 2
            result = dpiFound.send(electrotecDPI.buildMsgDisplayPrint(
              '252', 
              '2', 
              message.display, 
              message.ledLight, 
              message.ledBlinkMode, 
              message.arrows,
              message.keySound,
              message.makeBeep));
            break;
          case constantsPTL.ELECTROTEC_MSGTYPE_OPEN:
              result = dpiFound.send(electrotecDPI.buildMsgOpenSession());
              break;
          case constantsPTL.ELECTROTEC_MSGTYPE_VERSION:
              result = dpiFound.send(electrotecDPI.buildMsgVersionRequest());
              break;
          case constantsPTL.ELECTROTEC_MSGTYPE_NETWORK:
              result = dpiFound.send(electrotecDPI.buildMsgGetNetworkDistribution());
              break; 
          case constantsPTL.ELECTROTEC_MSGTYPE_RELAY:
              result = dpiFound.send(electrotecDPI.buildMsgRelayOutput(message.relay));
              break;
          default:
              logger.error(`ControlPTL : send : Error sending to dpi.id [${dpiId}] or ptl.id [${ptlId}] message [${JSON.stringify(message)}], message.type not implemented`);
              break;
      }

      if (result.result === constantsPTL.RETURN_OK) {
        // Save message sent to the end of the array
        ControlPTL.SaveMessageSent(message, dpiFound, ptlFound, result.dataSent);
        //console.info(`ControlPTL : send : message ${JSON.stringify(message)} sent successfully`);
      } else {
        console.error(`ControlPTL : send : message ${JSON.stringify(message)} ${result.result === constantsPTL.RETURN_EXCEPTION ? 'exception' : 'not sent'} with error ${JSON.stringify(result)}`);
      }

      return result;
  }

  /**
   * 
   * @param {*} ptlId : Id del PTL
   * @param {*} message : string amb el missatge que s'ha de reenviar
   * @returns 
   */
  resend(ptlId, type, message) {
    logger.info(`ControlPTL : resend : Sending to ptl.id [${ptlId}] message [${JSON.stringify(message)}]`);

    // Recuperem el PTL si s'ha proporcionat com a paràmetre
    let ptlFound = null;
    if (ptlId) {
        // Atenció: Podem comparar strings '1' amb enterns 1
        ptlFound = this.configuration.find(o => (o.id == ptlId));
    }

    // Recuperem el DPI a partir del ptl trobat, o del dpi passat com a paràmetrte
    let dpiFound = null;
    if (ptlFound) {
        // Busquem el DPI a partir del PTL
        dpiFound = ControlPTL.DPI.find(o => (o.ip === ptlFound.dpi.ip && o.port === ptlFound.dpi.port));
    }

    // Tant si es passa DPI com PTL he d'acabar tenint el DPi pel que haurem d'enviar
    if (dpiFound === null || dpiFound === undefined) {
      logger.error(`ControlPTL : resend : Error DPI or PTL not found`);
      return {
          result: constantsPTL.RETURN_NOT_SENT,
          message: `PTL or DPI not found`
      }
    }

    // Enviem el missatge
    let result = null;
    switch (type) {
        case constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY:
            result = dpiFound.send(message);
            break;
        case constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK:
            result = dpiFound.send(message);
            break;
        case constantsPTL.ELECTROTEC_MSGTYPE_BROADCAST_DISPLAY:
          // Broadcast for channel 1
          result = dpiFound.send(message);
          // Broadcast for channel 2
          result = dpiFound.send(message);
          break;
        case constantsPTL.ELECTROTEC_MSGTYPE_OPEN:
            result = dpiFound.send(message);
            break;
        case constantsPTL.ELECTROTEC_MSGTYPE_VERSION:
            result = dpiFound.send(message);
            break;
        case constantsPTL.ELECTROTEC_MSGTYPE_NETWORK:
            result = dpiFound.send(message);
            break; 
        case constantsPTL.ELECTROTEC_MSGTYPE_RELAY:
            result = dpiFound.send(message);
            break;
        default:
            logger.error(`ControlPTL : resend : Error sending to dpi.id [${dpiId}] or ptl.id [${ptlId}] message [${JSON.stringify(message)}], message.type not implemented`);
            break;
    }

    if (result.result === constantsPTL.RETURN_OK) {
      // Save message sent to the end of the array
      ControlPTL.SaveMessageSent(message, dpiFound, ptlFound, result.dataSent);
      //console.info(`ControlPTL : send : message ${JSON.stringify(message)} sent successfully`);
    } else {
      console.error(`ControlPTL : resend : message ${JSON.stringify(message)} ${result.result === constantsPTL.RETURN_EXCEPTION ? 'exception' : 'not sent'} with error ${JSON.stringify(result)}`);
    }

    return result;
}

  /**
   * Funció cridada per l'objecte DPI amb les dades rebudes i parsejades
   * Guarda el missatge en la llista de missatges rebuts
   * Processa el missatge rebit contra el PTL (es comprova si està esperant una resposta de l'operari
   * i s'executa l'acció que correspongui)
   * @param {*} dataReceived : missatge enviat pel PTL sense el camp d'inici \x02 i el de fi \x03
   */
  receive(dataReceived, msgParsed, msgKeyPressed) {
    logger.info(`ControlPTL : receive : Data received from dpi {${this.dpi.id}, ${this.dpi.ip}, ${this.dpi.port}} : ${JSON.stringify(dataReceived)}`);

    // Posem la data de recepció del missatge
    if (msgParsed) {
        msgParsed.date = new Date();
    }
    
    // Guardem el missatge en els missatges rebuts
    ControlPTL.SaveMessageReceived(msgParsed, dataReceived);
    
    // Processem el missatge contra el PTL
    if (msgKeyPressed) {
      // Busquem a quin PTL va dirigit
      let ptlFound = ControlPTL.findPTL(msgKeyPressed);
      if (ptlFound) {
        //ControlPTL.processReceivedMsg(ptlFound, msgKeyPressed);
        let data = {
          ptl: ptlFound,
          key: msgKeyPressed
        }
        executionMode.process(ControlPTL.ModeState, ControlPTL.PTL, 'processKeyPessed', data);
      } else {
          logger.error(`ControlPTL : receive : dataReceived received keyPress but no PTL is configured ${JSON.stringify(msgKeyPressed)}`);
      }
    }
  };

  receiveEvent(event) {
    logger.info(`ControlPTL : receiveEvent : ${event}`);

    // TODO: Save event into ReceivedAlarms

    if (event === 0) {
      // Quan connectem, el primer que fem és enviar un opensesion
      let sendResult = ControlPTL.controlPTLReference.send(
        this.dpi.id,
        null,
        { type: constantsPTL.ELECTROTEC_MSGTYPE_OPEN }
      );
      if (sendResult.result !== constantsPTL.RETURN_OK) {
        logger.error(`ControlPTL : receiveEvent : OpenSession Error ${JSON.stringify(sendResult)}`);
        return;
      }

      // Send broadcast to shutdown all PTLs
      sendResult = ControlPTL.controlPTLReference.send(
        this.dpi.id,
        null,
        { 
          type: constantsPTL.ELECTROTEC_MSGTYPE_BROADCAST_DISPLAY,
          display: ' ',
          ledLight: '0,0,0',
          ledBlinkMode: constantsPTL.ELECTROTEC_NO_BLINK,
          arrows: '0',
          keySound: '0',
          makeBeep: '0', 
        }
      );
      if (sendResult.result !== constantsPTL.RETURN_OK) {
        logger.error(`ControlPTL : receiveEvent : Broadcast display Error ${JSON.stringify(sendResult)}`);
        return;
      }

      logger.info(`ControlPTL : receiveEvent : DPI connection successfully`);
    }
  }

  static SaveMessageReceived(msgParsed, dataReceived) {
    // Save message sent to the end of the array
    ControlPTL.ReceivedMessages.push({
      date: new Date(),
      type: (msgParsed && msgParsed.type ? msgParsed.type : '?'),
      dpi: (msgParsed && msgParsed.dpi ? msgParsed.dpi : null),
      ptl: null,
      messageId: 0,
      message: dataReceived,
      value: (msgParsed && msgParsed.value ? msgParsed.value : ''),
      msgParsed : msgParsed
    });
    // Eliminem el primer element de l'array si excedim del límit
    if (ControlPTL.ReceivedMessages.length > RECV_MESSAGES_MAX_LENGTH) {
      ControlPTL.ReceivedMessages.shift();
    }

    // Si el missatge és un ACK busquem a dins dels missatges pendents i el confirmem
    if (msgParsed && msgParsed.ackType && msgParsed.ackType === constantsPTL.ELECTROTEC_ACK_OK) {
      // Busquem el missatge a dins dels enviats i el marquem com a rebut
      let msgAckFound = ControlPTL.SentMessages.find(m => m.messageId === parseInt(msgParsed.messageId) 
                                                             && m.ackRecevied === false
                                                             && m.dpi.id === msgParsed.dpi.id);
      if (msgAckFound) {
        msgAckFound.ackRecevied = true;
      }

      // Treiem el missatge de la llista de missatges pendents
      let msgAckIndexFound = ControlPTL.SentMessagesPendingAck.findIndex(m => m.messageId === parseInt(msgParsed.messageId) 
                                                             && m.ackRecevied === false
                                                             && m.dpi.id === msgParsed.dpi.id);
      if (msgAckIndexFound >= 0) {
        ControlPTL.SentMessagesPendingAck.splice(msgAckIndexFound, 1);
      }
    }
  }

  static SaveAlarmsReceived(msgParsed, dataReceived) {
    // Save message sent to the end of the array
    ControlPTL.ReceivedAlarms.push({
      date: new Date(),
      type: (msgParsed && msgParsed.type ? msgParsed.type : '?'),
      dpi: (msgParsed && msgParsed.dpi ? msgParsed.dpi : null),
      ptl: null,
      messageId: 0,
      message: dataReceived,
      value: (msgParsed && msgParsed.value ? msgParsed.value : ''),
      msgParsed : msgParsed
    });
    // Eliminem el primer element de l'array si excedim del límit
    if (ControlPTL.ReceivedAlarms.length > RECV_ALARMS_MAX_LENGTH) {
      ControlPTL.ReceivedAlarms.shift();
    }
  }

  static SaveMessageSent(message, dpiFound, ptlFound, dataSent) {
    ControlPTL.SentMessages.push({
      date: new Date(),
      type: (message && message.type ? message.type : 0),
      dpi: (dpiFound ? dpiFound : 0),
      ptl: (ptlFound ? ptlFound : 0),
      messageId: (dpiFound ? dpiFound.messageId : 0),
      message: dataSent,
      ackRecevied: false
    });

    // Eliminem el primer element de l'array si excedim del límit
    if (ControlPTL.SentMessages.length > SENT_MESSAGES_MAX_LENGTH) {
      ControlPTL.SentMessages.shift();
    }

    // Missatges pendents de confirmar
    if (message.type === constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK) {
      ControlPTL.SentMessagesPendingAck.push({
        date: new Date(),
        type: (message && message.type ? message.type : 0),
        dpi: (dpiFound ? dpiFound : 0),
        ptl: (ptlFound ? ptlFound : 0),
        messageId: (dpiFound ? dpiFound.messageId : 0),
        message: dataSent,
        ackRecevied: false
      });
    }

    // Si superem el màxim permès deixem errors
    if (ControlPTL.SentMessagesPendingAck.length > SENT_MESSAGES_PENDING_ACK_MAX_LENGTH ) {
      logger.error(`ControlPTL : SentMessagesPendingAck length ${ControlPTL.SentMessagesPendingAck.length} is greater than maximum ${SENT_MESSAGES_PENDING_ACK_MAX_LENGTH}`);
    }
  }


  /**
   * Funció que a partir de la configuració de xarxa obtenida del DPI
   * la parseja per emmagatzemar-la a la BD en format:
   * [ 
   *   { location:"A1", shelf:"", shelf_type:"", id:1, internal_id:"001", channel_id:"1", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
   * ]
   * @param {*} dpiNetworkConfiguration 
   */
  parseNetworConfiguration(dpiNetworkConfiguration) {
      return electrotecDPI.parseNetworkDistributionToConfiguration(dpiNetworkConfiguration, 'SHELF', constantsPTL.SHELF_PICK_TO_LIGHT);
  };

  /**
   * Carrega la configuració i crea els objectes DPI
   * @param {*} configuration : array del tipus
   * [
   *    { "location":"A1", shelf:"", shelf_type:"", "id":1, "internal_id":"001", "channel_id":"1", type: '1', "dpi":{"ip":"192.168.1.222","port":16,"id":1} },
   *    { "location":"A2", shelf:"", shelf_type:"", "id":2, "internal_id":"002", "channel_id":"1", type: '1', "dpi":{"ip":"192.168.1.222","port":16,"id":1} }
   * ]
   */
  reloadConfigurationAndConnect(configuration) {
      logger.info(`ControlPTL : reloadConfigurationAndConnect : Reloading configuration and connecting to PTL`);

      // Desconnectem per si estem connectats
      this.disconnect();

      this.configuration = configuration;
      ControlPTL.DPI = [];
      ControlPTL.PTL = [];

      // Configurem els nous DPIs
      for (let i=0; i<configuration.length; i++) {
          //if (ControlPTL.DPI.find(o => (o.ip === configuration[i].dpi.ip && o.port === configuration[i].dpi.port)) === undefined) {
          if (ControlPTL.DPI.find(o => (o.ip === configuration[i].dpi.ip && o.port === configuration[i].dpi.port)) === undefined) {
              logger.info(`ControlPTL : reloadConfigurationAndConnect : creating DPI and conneting to ${configuration[i].dpi.ip}:${configuration[i].dpi.port}`);
              // Creem i connectem amb el DPI
              let dpi = new electrotecDPI(configuration[i].dpi,
                  TIMEOUT_RETRY,
                  //INTERVAL_ALIVE,
                  this.receive,
                  this.receiveEvent);
              //ControlPTL.DPI.push({ id:i, ip:configuration[i].dpi.ip, port:configuration[i].dpi.port, dpi: client });
              ControlPTL.DPI.push(dpi);
          }

          // Afegim els ptl, cda ptl té l'id del DPI al que està connectat
          // { location:"A1", shelf:"", shelf_type:"", id:1, internal_id:1, channel_id:"1", type: constantsPTL.ELECTROTEC_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} }
          ControlPTL.PTL.push({
              location: configuration[i].location,
              shelf: configuration[i].shelf,
              shelf_type: configuration[i].shelf_type,
              id: configuration[i].id,
              internal_id: configuration[i].internal_id,
              channel_id: configuration[i].channel_id,
              type: configuration[i].type,
              typeName: electrotecDPI.getNameFromNodeType(configuration[i].type),
              typeDesc: electrotecDPI.getDescFromNodeType(configuration[i].type),
              dpi: {
                  ip: configuration[i].dpi.ip,
                  port: configuration[i].dpi.port,
                  id: configuration[i].dpi.id
              }
          });
      }
  };

  reconnect() {
      logger.info(`ControlPTL : reloadConfigurationAndConnect : Reconnecting`);

      for (let i=0; i<ControlPTL.DPI.length; i++) {
          //logger.info(`ControlPTL Reconnecting ${JSON.stringify(this.DPI[i])}`);
          logger.info(`ControlPTL : reloadConfigurationAndConnect : Reconnecting to DPI server ${ControlPTL.DPI[i].ip}:${ControlPTL.DPI[i].port}`);
          ControlPTL.DPI[i].dpi.connect();
      }
  };

  disconnect() {
      logger.info(`ControlPTL : Disconnecting`);

      for (let i=0; i<ControlPTL.DPI.length; i++) {
          if (ControlPTL.DPI[i].dpi) {
              logger.info(`ControlPTL : Disconnect : Disconnecting from DPI server ${ControlPTL.DPI[i].ip}`);
              ControlPTL.DPI[i].dpi.disconnect();
          }
      }
  };
}
  
const singletonInstance = new ControlPTL();
  
// The Object.freeze() method prevents modification to properties and values 
// of an object. So applying Object.freeze() to singletonInstance means you 
// will not be able to change any of its properties or values later on in your 
// code.
//Object.freeze(singletonInstance);

// The important part is the last line where we don’t export the class but we 
// export the instance of the class instead. Node.JS will cache and reuse the 
// same object each time it’s required.
module.exports = singletonInstance;