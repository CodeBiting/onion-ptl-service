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

var express = require('express');
var router = express.Router();
const constantsPTL = require(`${global.__base}api/constantsPTL`);
const DataPTL = require(`${global.__base}api/DataPTL`);
const controlPTL = require(`${global.__base}api/ControlPTL`);
const logger = require(`${global.__base}api/logger`);
const poolMySql = require(`${global.__base}api/poolMySql`);
//const pick2lightGame = require(`${global.__base}api/modes/pickfighter`);

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Onion Device Client - PTL Control' });
});

router.get('/hardware', function(req, res, next) {
  res.render('hardware', {
    title: 'Onion Device Client - PTL Control - Hardware',
    messagesSent: controlPTL.SentMessages,
    messagesReceived: controlPTL.ReceivedMessages,
    alarmsReceived: controlPTL.ReceivedAlarms,
    configuration: controlPTL.Configuration,
    configuredDPI: controlPTL.ConfiguredDPIs,
    configuredPTL: controlPTL.ConfiguredPTLs,
  });
});

router.post('/hardware', async (req, res) => {
  try {
    logger.info(`[POST]/hardcore received ${JSON.stringify(req.body)}`);

    let sendResult = null;

    let message = {
      type: 'ok',
      text: 'ok',
    };

    // Busquem un missatge amb la network distribution per mostrar-lo en la web i 
    // per guardar-lo a la BD si així s'ha triat
    let networkMsgFound = controlPTL.ReceivedMessages.find(m => m.type === constantsPTL.ELECTROTEC_MSGTYPE_NETWORK);

    switch(req.body.submit) {
      case 'Get Version':
        // Per demanar la versió necessitem el DPI però no el PTL
        sendResult = controlPTL.send(
          req.body.fDpi,
          null,
          { type: constantsPTL.ELECTROTEC_MSGTYPE_VERSION },
        );
        break;
      case 'Get Network Distribution from DPI':
        // Per demanar la distribució de xarxa necessitem el DPI però no el PTL
        sendResult = controlPTL.send(
          req.body.fDpi,
          null,
          { type: constantsPTL.ELECTROTEC_MSGTYPE_NETWORK },
        );
        break;
      case 'Save Network Distribution to DB':
        if (networkMsgFound) {
          // Recuperem la configuració de xarxa passada pel DPI i la guardem a la BD
          let configurationParsed = controlPTL.parseNetworConfiguration(networkMsgFound.msgParsed);

          if (configurationParsed.error) {
            message.type = 'error';
            message.text = 'Network distribution not found';
          } else {
            // Esborrem el contingut de la BD
            await DataPTL.clearConfiguration(poolMySql.getPromise());

            // La guardem a la BD
            await DataPTL.saveConfiguration(poolMySql.getPromise(), configurationParsed.configuration);
          }
        } else {
          message.type = 'error';
          message.text = 'Network distribution not found';
        }
        break;
      case 'Load Network Distribution from DB':
        // Recuperem la configuració de la BD
        let configuration = await DataPTL.getConfiguration(poolMySql.getPromise());
        if (configuration.error) {
          message.type = 'error';
          message.text = configuration.error;
        } else {
          // Recarreguem la configuració
          controlPTL.reloadConfigurationAndConnect(configuration.configuration);
        }
        break;
      case 'Open Session':
        // Per obrir sessió necessitem el DPI però no el PTL
        sendResult = controlPTL.send(
          req.body.fDpi,
          null,
          { type: constantsPTL.ELECTROTEC_MSGTYPE_OPEN }
        );
        break;
      case 'PTL Display':
        // Per demanar la distribució de xarxa necessitem el PTL però no el DPI
        //
        // message to PTL:
        // - displayData : 1 to 31 bytes
        // - ledLight : 5 bytes with RGB separated with commas, ex: "0,1,0"
        // - ledBlinkMode : "0" no blink, "1" blink every 0,25 seconds, "2" blink every 0,5 seconds, "4" blink every second
        // - arrows : string "0"-"8"
        // - keySound : "0" deactivate, "1" activate
        // - makeBeep : "0" no beep, "1" single beep, "2" double beep (short-short), "4" double beep (short-long)
        sendResult = controlPTL.send(
          null,
          req.body.fPtl, // hem d'enviar un PTL que existeixi a la configuració per fer servir el dpi que tingui configurat
          {
            type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY,
            display: (req.body.fPtlDisplay.length <= 0 ? ' ' : req.body.fPtlDisplay),
            ledLight: req.body.fPtlRGB,
            ledBlinkMOde: req.body.fPtlBlink,
            arrows: req.body.fPtlArrows,
            keySound: req.body.fPtlSound,
            makeBeep: req.body.fPtlBeep,
          },
        );
        break;
      case 'PTL Display Ack':
        // Per demanar la distribució de xarxa necessitem el PTL però no el DPI
        //
        // message to PTL:
        // - displayData : 1 to 31 bytes
        // - ledLight : 5 bytes with RGB separated with commas, ex: "0,1,0"
        // - ledBlinkMode : "0" no blink, "1" blink every 0,25 seconds, "2" blink every 0,5 seconds, "4" blink every second
        // - arrows : string "0"-"8"
        // - keySound : "0" deactivate, "1" activate
        // - makeBeep : "0" no beep, "1" single beep, "2" double beep (short-short), "4" double beep (short-long)
        sendResult = controlPTL.send(
          null,
          req.body.fPtl, // hem d'enviar un PTL que existeixi a la configuració per fer servir el dpi que tingui configurat
          {
            type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK,
            display: (req.body.fPtlDisplay.length <= 0 ? ' ' : req.body.fPtlDisplay),
            ledLight: req.body.fPtlRGB,
            ledBlinkMOde: req.body.fPtlBlink,
            arrows: req.body.fPtlArrows,
            keySound: req.body.fPtlSound,
            makeBeep: req.body.fPtlBeep,
          },
        );
        break;
      case 'PTL Off':
        // Per demanar la distribució de xarxa necessitem el PTL però no el DPI
        //
        // message to PTL:
        // - displayData : 1 to 31 bytes
        // - ledLight : 5 bytes with RGB separated with commas, ex: "0,1,0"
        // - ledBlinkMode : "0" no blink, "1" blink every 0,25 seconds, "2" blink every 0,5 seconds, "4" blink every second
        // - arrows : string "0"-"8"
        // - keySound : "0" deactivate, "1" activate
        // - makeBeep : "0" no beep, "1" single beep, "2" double beep (short-short), "4" double beep (short-long)
        sendResult = controlPTL.send(
          null,
          req.body.fPtl, // hem d'enviar un PTL que existeixi a la configuració per fer servir el dpi que tingui configurat
          {
            type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY,
            display: ' ',
            ledLight: constantsPTL.ELECTROTEC_COLOR_BLACK,
            ledBlinkMOde: constantsPTL.ELECTROTEC_NO_BLINK,
            arrows: constantsPTL.ELECTROTEC_ARROWS_NONE,
            keySound: constantsPTL.ELECTROTEC_NO_SOUND,
            makeBeep: constantsPTL.ELECTROTEC_NO_BEEP,
          },
        );
        break;
      case 'PTL Off Ack':
        // Per demanar la distribució de xarxa necessitem el PTL però no el DPI
        //
        // message to PTL:
        // - displayData : 1 to 31 bytes
        // - ledLight : 5 bytes with RGB separated with commas, ex: "0,1,0"
        // - ledBlinkMode : "0" no blink, "1" blink every 0,25 seconds, "2" blink every 0,5 seconds, "4" blink every second
        // - arrows : string "0"-"8"
        // - keySound : "0" deactivate, "1" activate
        // - makeBeep : "0" no beep, "1" single beep, "2" double beep (short-short), "4" double beep (short-long)
        sendResult = controlPTL.send(
          null,
          req.body.fPtl, // hem d'enviar un PTL que existeixi a la configuració per fer servir el dpi que tingui configurat
          {
            type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK,
            display: ' ',
            ledLight: constantsPTL.ELECTROTEC_COLOR_BLACK,
            ledBlinkMOde: constantsPTL.ELECTROTEC_NO_BLINK,
            arrows: constantsPTL.ELECTROTEC_ARROWS_NONE,
            keySound: constantsPTL.ELECTROTEC_NO_SOUND,
            makeBeep: constantsPTL.ELECTROTEC_NO_BEEP,
          },
        );
        break;
      case 'Relay':
        // Per demanar la distribució de xarxa necessitem el DPI però no el PTL
        sendResult = controlPTL.send(
          req.body.fDpi,
          null,
          {
            type: constantsPTL.ELECTROTEC_MSGTYPE_RELAY,
            relay: req.body.fPtlRelay,
          },
        );
        break;
      default:
        break;
    }

    /*
      // { "location":"A1", "id":1, "dpi":{"ip":"192.168.1.222","port":16,"id":1} }
  let ptl = {
    id: 1,
    type_id : constantsPTL.ELECTROTEC_DPA1,
    internal_id : 1,
    channel_id : constantsPTL.ELECTROTEC_CHANNEL_1,
    dpi: {ip:"192.168.1.222",port:16,id:1}
  };

  //*  Quan el missatge és per activar displays de PTL ha de tenir els camps:
  //*  - type: string "display"
  //*  - display: string
  //*  - ledLight: string
  //*  - ledBlinkMode: string
  //*  - keySound: string
  //*  - makeBeep: string
  //*  Quan el missatge és per obtenir la versió ha de tenir els camps:
  //*  - type: string "version"
  //*  Quan el missatge és per obrir la connexió ha de tenir els camps:
  //*  - type: string "open"
  //*  Quan el missatge és per obtenir la configuració de la xarxa de PTL ha de tenir els camps:
  //*  - type: string "network"
  //*  Quan el missatge és per activar relés de PTL ha de tenir els camps:
  //*  - type: string "relay"
  //*  - rele: [0,0,0]  //array de 0 o 1
  let message_version = {
    type: constantsPTL.ELECTROTEC_MSGTYPE_VERSION
  };

  electrotec.send(ptl, message_version);
    */

    if (sendResult !== undefined && sendResult !== null) {
      message.text = sendResult.message;
      if (sendResult.result !== constantsPTL.RETURN_OK) {
        message.type = 'error';
      }
    }

    return res.render('hardware', {
      message,
      title: 'Hardware',
      messagesSent: controlPTL.SentMessages,
      messagesReceived: controlPTL.ReceivedMessages,
      dpiIp: req.body.fDpiIp,
      dpiPort: req.body.fDpiPort,
      network: (networkMsgFound && networkMsgFound.msgParsed ? networkMsgFound.msgParsed : null),
      configuration: controlPTL.Configuration,
      configuredDPI: controlPTL.ConfiguredDPIs,
      configuredPTL: controlPTL.ConfiguredPTLs,
    });
  } catch (e) {
    console.error(`${(new Date()).toISOString()} - [POST]/hardware ${e.message}`);
    return res.render('hardware', {
      message: { type: 'error', text: e.message },
      title: 'Onion Device Client - PTL Control - Hardware',
      messagesSent: [],
      messagesReceived: [],
      dpiIp: req.body.fDpiIp,
      dpiPort: req.body.fDpiPort,
      configuredDPI: [],
      configuredPTL: [],
    });
  }
});

router.get('/onion', async function(req, res, next) {
  let movArchResult = await controlPTL.getMovementsPendingToSendArch(100, 0);
  let movsToSend = await controlPTL.getMovementsPendingToSend(100, 0, 0);
  let movsReceived = await controlPTL.getMovementsReceivedFromOnion(100, 0);

  return res.render('onion', {
    title: 'Onion Device Client - PTL Control - Communication with Onion',
    messagesReceived: movsReceived.movements,
    messagesPendingToSend: movsToSend.movements,
    messagesSent: movArchResult.movements
  });
});

router.post('/onion', async (req, res) => {
  let message = {
    type: 'ok',
    text: 'ok',
  };

  try {
    logger.info(`[POST]/onion received ${JSON.stringify(req.body)}`);

    switch(req.body.submit) {
      case 'Reload Movements':
        await controlPTL.reloadMovements();
        break;
      default:
        break;
    }
  } catch (e) {
    console.error(`${(new Date()).toISOString()} - [POST]/hardware ${e.message}`);
    message = { type: 'error', text: e.message };
  }

  let movArchResult = await controlPTL.getMovementsPendingToSendArch(100, 0);
  let movsToSend = await controlPTL.getMovementsPendingToSend(100, 0, 0);
  let movsReceived = await controlPTL.getMovementsReceivedFromOnion(100, 0);

  return res.render('onion', {
    title: 'Onion Device Client - PTL Control - Communication with Onion',
    message: message,
    messagesReceived: movsReceived.movements,
    messagesPendingToSend: movsToSend.movements,
    messagesSent: movArchResult.movements
  });
});

module.exports = router;

function getShelves(configuration) {
  let shelves = [];

  for (let i = 0; i < configuration.length; i++) {
    let shelfAllreadyInserted = shelves.find(s => (s.id === configuration[i].shelf.id));
    if (shelfAllreadyInserted === undefined) {
      shelves.push({
        id: configuration[i].shelf.id,
        code: configuration[i].shelf.code,
        type_id: configuration[i].shelf.type_id,
        type_code: configuration[i].shelf.type_code,
      });
    }
  }

  return shelves;
}
