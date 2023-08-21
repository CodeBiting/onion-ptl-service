/**
 * To test:
 * npm test test/api/modes/pickfighter.js
 * or
 * mocha test/api/modes/pickfighter.js
 */
// global variable to use in require
const assert = require('assert');
const { expect } = require('chai');
// const controlPTL = require('');
const p2lGame = require('../../../api/modes/pickfighter');
const constantsPTL = require('../../../api/constantsPTL');
const configuration = require('../../../config/simulator.json');

describe('pickfighter', function () {
  describe('getInitialState()', function () {
    it('should initialize pickfighter state to default', async function () {
      let stateExpected = {
        currentState: 'waitForBegin' /*STATE_WAIT_BEGIN*/,
        numPlayers: 0,
        players: [],    // guardem objectes per player amb el color, l'hora inici, l'hora fi i el temps dedicat
        controlPTL: null,
        currentPlayer: 0
      }
      
      let state = await p2lGame.getInitialState(null, null, null, null);

      // Com que comparem objectes hem de fer servir deepEqual i no equal
      assert.deepEqual(stateExpected, state);
    });
  });

  /*
  describe('process()', function () {
    it('should initialize pick2lightgame state to default', async function () {
      let controlPTLMocked = {
        getConfiguredPTLZoneDevice: function () {
          return {
            location:"L", 
            id:1, 
            dpi:{ ip:"192.168.1.200",port:3030,id:1}
          };
        },
        send: function (dpiId, ptlId, message) {
          console.log(message);
          return {
            message: message,
            ptlIdTo: ptlId.id
          };
        }
      }

      let messageToSendExpected = {
        ptlIdTo: 1,
        message: {
          type: 'display_ack', // constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY,
          display: 'Players 1-4',
          ledLight: '1,1,1',
          ledBlinkMOde: '0',
          arrows: '0',
          keySound: '0',
          makeBeep: '0',
          rele: ''
        }
      };
      let stateExpected = {
        currentState: 'waitForPlayers' // STATE_WAIT_NPLAYERS,
        numPlayers: 0,
        players: [],    // guardem objectes per player amb el color, l'hora inici, l'hora fi i el temps dedicat
        controlPTL: controlPTLMocked,
        currentPlayer: 0
      }

      // let state = {
      //  currentState: 'waitForBegin',
      //  numPlayers: 0,
      //  players: [],    // guardem objectes per player amb el color, l'hora inici, l'hora fi i el temps dedicat
      //  controlPTL: null,
      // }

      let state = await p2lGame.getInitialState(controlPTLMocked, null, null, null);
      // At the begining is not necessary a ptl and a key pressed
      let message = p2lGame.process(state, configuration, null, null);

      console.log(message);

      assert.deepEqual(stateExpected, state);
      assert.equal(messageToSendExpected.message, message);
    });
  });
  */
});
