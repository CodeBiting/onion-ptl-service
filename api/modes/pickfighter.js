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
 
 * State machine that implements a competitive game between 1 and 4 players
 * with PTLs so each player has to squeeze the PTLs that activate
 * sequentially to get them off in the minimum time.
 * 
 * V1: 03/04/2023
 */

const logger = require(`../logger`);
const constantsPTL = require(`../constantsPTL`);

// States constants
const STATE_WAIT_BEGIN = 'waitForBegin';
const STATE_WAIT_NPLAYERS = 'waitForPlayers';
const STATE_WAIT_START = 'waitForStart';
const STATE_WAIT_V = 'waitForKeyV';

const MIN_NUM_PLAYERS = 1;
const MAX_NUM_PLAYERS = 4;

const NUM_PICKS_FOR_PLAYER = 8;

const LED_LIGHT_COLOR_SEQ = [
  constantsPTL.ELECTROTEC_COLOR_RED,
  constantsPTL.ELECTROTEC_COLOR_BLUE,
  constantsPTL.ELECTROTEC_COLOR_GREEN,
  constantsPTL.ELECTROTEC_COLOR_YELLOW,
  constantsPTL.ELECTROTEC_COLOR_MAGENTA,
  constantsPTL.ELECTROTEC_COLOR_CYAN,
  constantsPTL.ELECTROTEC_COLOR_WHITE,
];

const INITIAL_STATE = {
  currentState: STATE_WAIT_BEGIN,
  numPlayers: 0,
  players: [],    // guardem objectes per player amb el color, l'hora inici, l'hora fi i el temps dedicat
                  // cada player té un objecte amb els camps: 
                  // { ledLightColor, ptlSequence, currentSeq, beginDateTime, endDateTime }
  controlPTL: null,
  currentPlayer: 0
};

/**
 * Function that returns the initial state needed by this module
 * @returns : the initial state needed by this module
 */
function getInitialState(controlPTL, dataPTL, connection, config) {
  let state = {
    currentState: STATE_WAIT_BEGIN,
    numPlayers: 0,
    players: [],    // guardem objectes per player amb el color, l'hora inici, l'hora fi i el temps dedicat
                    // cada player té un objecte amb els camps: 
                    // { ledLightColor, ptlSequence, currentSeq, beginDateTime, endDateTime }
    controlPTL: controlPTL,
    currentPlayer: 0
  };

  return state;
};

/**
 * Function that from a key pressed changes the internal state
 * @param {*} state : 
 * @param {*} configuration : ptl shelf configuration
 * @param {*} ptl : ptl that has emited the message
 * @param {*} keyPressed : key pressed (V, F, +, -)
 * 
 */
function process(state, configuration, ptl, keyPressed) {

  // Control que l'estat estigui establert, sinío l'inicialitzem
  if (state === undefined || state === null) {
    //state = INITIAL_STATE;
    //state.controlPTL = this;
    logger.error(`pickfighter: process: initial state not initialized`);
    return;
  }

  let newState = state.currentState;
  let ptlToSendMsg = null;
  let textToShowInPtl = '';
  let ledLightColor = '';

  // Use a object literal's function insterad a switch tio reduce read complexity
  let actions = {
    'waitForBegin': function () {
      sendMessageToThePTLZone(state, configuration, 'Players 1-4', constantsPTL.ELECTROTEC_COLOR_WHITE);
      newState = 'waitForPlayers'; //waitForBegin(ptl, keyPressed);
    },
    'waitForPlayers': function () {
      [newState, textToShowInPtl, ptlToSendMsg, ledLightColor] = waitForNPlayersAngGenerateGame(state, configuration, ptl, keyPressed);
      if (textToShowInPtl) {
        sendMessageToThePTLZone(state, configuration, textToShowInPtl, constantsPTL.ELECTROTEC_COLOR_WHITE);
      }
    },
    'waitForStart': function  () {
      [newState, textToShowInPtl, ptlToSendMsg, ledLightColor] = waitForStart(state, ptl, keyPressed);
      if (textToShowInPtl.length > 0 && ptlToSendMsg) {
        sendMessageToPTL(state, ptlToSendMsg.id, textToShowInPtl, ledLightColor);
      }

      let ptlZone = state.controlPTL.getConfiguredPTLZoneDevice();
      // Apaguem el ptl de zona, només si és diferent del que hem encès (ja que si enviem 2 missatges 
      // al mateix PTL sense un temps mínim entre mig, es perden missatges i ha d'intervenir el resend, 
      // que és lent)
      if (newState === 'waitForKeyV' && ptlToSendMsg.id !== ptlZone.id) {
        // Apaguem el PTL de Zona
        sendMessageToThePTLZone(state, configuration, ' ', constantsPTL.ELECTROTEC_COLOR_BLACK);
      }
    },
    'waitForKeyV': function () {
      // Apaguem el ptl que s'ha apretat, només si 
      //sendMessageToPTL(state, ptl.id, ' ', constantsPTL.ELECTROTEC_COLOR_BLACK);

      // NOTA: si el ptl apagat i el nou que s'encén és el mateix es perdrà el 
      // segón missatge ja que el PTL no té temps de processar-ho.

      // Processem la tecla
      [newState, textToShowInPtl, ptlToSendMsg, ledLightColor] = waitForPlayerPressV(state, configuration, ptl, keyPressed);
      if (textToShowInPtl && ptlToSendMsg) {
        sendMessageToPTL(state, ptlToSendMsg.id, textToShowInPtl, ledLightColor);
      }

      // Apaguem el ptl que s'ha apretat, només si és diferent del que hem encès (ja que si enviem 2 missatges 
      // al maitex PTL sense un temps mínim entre mig, es perden missatges i ha d'intervenir el resend, que és lent)
      if (ptlToSendMsg.id !== ptl.id) {
        sendMessageToPTL(state, ptl.id, ' ', constantsPTL.ELECTROTEC_COLOR_BLACK);
      }
    }
  };
  actions[state.currentState || 'waitForBegin']();

  state.currentState = newState;
};

/**
 * Funció que espera que l'usuari estableixi el número de jugadors i quan confirma
 * genera la seqüència de PTLs que s'ha d'activar perquè cada jugador pugui demostrar
 * la seva rapidesa apretant el botó.
 * @param {*} state
 * @param {*} ptl
 * @param {*} ptlKeyPressed
 * @returns: array amb 2 objectes: [ nestState, textToShowInPtl ]
 * - nextstate: nou estat de la màquina d'estats
 * - textToShowInPtl: missatge per mostrar enviat al PTL
 */
function waitForNPlayersAngGenerateGame(state, configuration, ptl, ptlKeyPressed) {
  let nextState = STATE_WAIT_NPLAYERS;
  let textToShowInPtl = '';

  if (!isPTLZone(ptl)) {
    logger.error(`pickfighter: waitForNPlayersAngGenerateGame: cannot send message to ptl zone because there is not configured`);
    textToShowInPtl = 'Error, press on the PTL Zone';
    return [nextState, textToShowInPtl];
  }

  // Use a object literal's function insterad a switch tio reduce read complexity
  let actions = {
    'V': function () {
      if (state.numPlayers < MIN_NUM_PLAYERS || state.numPlayers > MAX_NUM_PLAYERS) {
        textToShowInPtl = 'Players error 1-4 ...';
      } else {
        generateGame(configuration, state);
        nextState = STATE_WAIT_START;
        textToShowInPtl = `V to start`;
      }
    },
    '+': function () {
      state.numPlayers = (state.numPlayers < MAX_NUM_PLAYERS ? state.numPlayers+1 : MAX_NUM_PLAYERS);
      textToShowInPtl = `Players ${state.numPlayers}`;
    },
    '-': function () {
      state.numPlayers = (state.numPlayers > MIN_NUM_PLAYERS ? state.numPlayers-1 : MIN_NUM_PLAYERS);
      textToShowInPtl = `Players ${state.numPlayers}`;
    }
  };
  actions[ptlKeyPressed.keys[0]]();

  return [nextState, textToShowInPtl];
};

function isPTLZone(ptl) {
  return (ptl.type === constantsPTL.ELECTROTEC_NODE_TYPE_DPMZ1 || 
          ptl.type === constantsPTL.ELECTROTEC_NODE_TYPE_DPAZ1);
}

function generateGame(configuration, state) {
  // 1. Recollim tots els ptl que es poden fer servir (el de zona no)
  let ptlsWithLedAndV = configuration.filter(o => o.type !== constantsPTL.ELECTROTEC_NODE_TYPE_DPW1 && o.type !== constantsPTL.ELECTROTEC_NODE_TYPE_LCI2_LCIN1 );

  // Generate messages to send to PTL for each player
  for (let i = 0; i < state.numPlayers; i++) {
    // Aleatòriament generem l'ordre amb que s'enviaran missatges als PTL, 
    // controlem que no s'encengui el mateix dos cops seguits per evitar perdre comunicacions
    let ptlSeq = [];
    for (let j = 0; j < NUM_PICKS_FOR_PLAYER; j++) {
      let indexPtl = Math.floor(Math.random() * ptlsWithLedAndV.length);
      if (j > 0) {
        // Si s'ha generat el mateix ptl que en el pas anterior en generem un altre fins que sigui diferent
        while (ptlSeq[j-1].id === ptlsWithLedAndV[indexPtl].id) {
          indexPtl = Math.floor(Math.random() * ptlsWithLedAndV.length);
        }
      }

      ptlSeq.push(ptlsWithLedAndV[indexPtl]);
    }

    // Guardem la seqüència de ptl quye s'han d'apretar per cada jugador
    state.players[i] = {
      ledLightColor: LED_LIGHT_COLOR_SEQ[i],
      ptlSequence: ptlSeq,
      currentSeq: 0,
      beginDateTime: null,
      endDateTime: null
    };
  }
}

function waitForStart(state, ptl, ptlKeyPressed) {
  let nextState = STATE_WAIT_START;
  let textToShowInPtl = '';
  let ledLightColor = constantsPTL.ELECTROTEC_COLOR_WHITE;
  let ptlToShow = null;

  if (ptlKeyPressed.keys[0] === 'V') {
    nextState = STATE_WAIT_V;

    // Mostrem el primer pick, determinem el següent ptl i el color
    state.currentPlayer = 0;
    ptlToShow = state.players[state.currentPlayer].ptlSequence[state.players[state.currentPlayer].currentSeq];
    ledLightColor = state.players[state.currentPlayer].ledLightColor;
    textToShowInPtl = `P. ${state.players[state.currentPlayer].currentSeq + 1}`;
  } else {
    textToShowInPtl = 'V to start';
    // Recuperem el PTL de Zona
    ptlToShow = state.controlPTL.getConfiguredPTLZoneDevice();
  }

  return [nextState, textToShowInPtl, ptlToShow, ledLightColor];
};

function waitForPlayerPressV(state, configuration, ptl, ptlKeyPressed) {
  let nextState = STATE_WAIT_V;
  let textToShowInPtl = '';
  let ledLightColor = constantsPTL.ELECTROTEC_COLOR_BLACK;
  let ptlToShow = null;

  // Check that the key is V and pressed in the PTL correct
  if (ptlKeyPressed.keys[0] !== 'V' || 
      state.players[state.currentPlayer].ptlSequence[state.players[state.currentPlayer].currentSeq].id !== ptl.id) {
    return [nextState, 
      `P. ${state.players[state.currentPlayer].currentSeq + 1}`,
      state.players[state.currentPlayer].ptlSequence[state.players[state.currentPlayer].currentSeq],
      state.players[state.currentPlayer].ledLightColor
    ];
  }

  // Detectem quan hem arribat al final
  if (state.currentPlayer >= (state.numPlayers - 1) &&
      state.players[state.currentPlayer].currentSeq >= (NUM_PICKS_FOR_PLAYER - 1) ) {
    // Finalitzem el joc
    state.players[state.numPlayers - 1].endDateTime = new Date();

    let result = [];
    // Per cada jugador calculem el temps i la posició
    for (let i = 0; i < state.numPlayers; i++) {
      result.push({
        player: i+1,
        time: state.players[i].endDateTime.getTime() - state.players[i].beginDateTime.getTime()
      });
    }
    // Ordenem el resultat del que ha trigat menys a més
    result.sort((a,b) => a.time - b.time);

    // Construim el text amb el resultat
    textToShowInPtl = 'Winners ';
    for (let i = 0; i < result.length; i++) {
      textToShowInPtl+= `${result[i].player} `;
    }

    // Fi del joc, presentem resultats en el PTL de zona
    nextState = STATE_WAIT_BEGIN; //STATE_WAIT_END;
    ledLightColor = constantsPTL.ELECTROTEC_COLOR_WHITE;
    ptlToShow = state.controlPTL.getConfiguredPTLZoneDevice();

    return [nextState, textToShowInPtl, ptlToShow, ledLightColor];
  }

  // Incrementem la seqüència de ptls o canviem de jugador (si hem arribat al final)
  if (state.players[state.currentPlayer].currentSeq < (NUM_PICKS_FOR_PLAYER - 1)) {
    if (state.players[state.currentPlayer].currentSeq === 0) {
      // Guardem la data i hora d'inici
      state.players[state.currentPlayer].beginDateTime = new Date();
    }
    state.players[state.currentPlayer].currentSeq++;
  } else {
    // Canviem de jugador
    state.players[state.currentPlayer].endDateTime = new Date();
    if (state.currentPlayer < state.numPlayers) {
      state.currentPlayer++;
      state.players[state.currentPlayer].beginDateTime = new Date();
    }
  }

  // Determinem el següent ptl i el color
  ptlToShow = state.players[state.currentPlayer].ptlSequence[state.players[state.currentPlayer].currentSeq];
  ledLightColor = state.players[state.currentPlayer].ledLightColor;
  textToShowInPtl = `P. ${state.players[state.currentPlayer].currentSeq + 1}`;

  return [nextState, textToShowInPtl, ptlToShow, ledLightColor];
};

/***
 * Send message to ptlzone "Pick fighter! Enter number of players (1-4) ..."
 */
function sendMessageToThePTLZone(state, configuration, textToShowInPtl, ledLightColor) {
  let message = {
    type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK,
    display: textToShowInPtl,
    ledLight: ledLightColor,
    ledBlinkMode: constantsPTL.ELECTROTEC_NO_BLINK,
    arrows: constantsPTL.ELECTROTEC_ARROWS_NONE,
    keySound: constantsPTL.ELECTROTEC_NO_SOUND,
    makeBeep: constantsPTL.ELECTROTEC_NO_BEEP,
    rele: ''
  };

  let ptlZone = state.controlPTL.getConfiguredPTLZoneDevice();

  if (ptlZone === undefined) {
    // TODO: return error
    logger.error(`pickfighter: sendMessageToThePTLZone: cannot send message to ptl zone because there is not configured`);
    return;
  }

  state.controlPTL.send(null, ptlZone.id, message);
};

/***
 * Send message to a ptl
 */
function sendMessageToPTL(state, ptlId, textToShowInPtl, ledLightColor) {
  let message = {
    type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK,
    display: textToShowInPtl,
    ledLight: ledLightColor,
    ledBlinkMode: constantsPTL.ELECTROTEC_NO_BLINK,
    arrows: constantsPTL.ELECTROTEC_ARROWS_NONE,
    keySound: constantsPTL.ELECTROTEC_NO_SOUND,
    makeBeep: constantsPTL.ELECTROTEC_NO_BEEP,
    rele: ''
  };

  state.controlPTL.send(null, ptlId, message);
};

// Exportem les funcions públiques
module.exports = {
  process,
  getInitialState,
};