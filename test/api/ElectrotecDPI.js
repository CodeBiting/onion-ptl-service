/**
 * To test:
 * npm test test/api/ElectrotecDPI.js
 * or
 * mocha test/api/ElectrotecDPI.js
 */
const assert = require('assert');
const { expect } = require('chai');
const { copyFileSync } = require('fs');
const electrotecDPI = require('../../api/ElectrotecDPI');
const constantsPTL = require('../../api/constantsPTL');

const TEST_DPI = {
  id: 1,
  ip: '192.168.1.222',
  port: 16,
};

describe('ElectrotecDPI', function() {
  describe('buildMsgVersionRequest()', function () {
    it('should return correct message', function () {
      let msgExpected = '\x02\x31\x05\x03'.toString('hex');
      let msg = electrotecDPI.buildMsgVersionRequest();
      assert.equal(msgExpected, msg);
    });
  });

  describe('buildMsgOpenSession()', function () {
    it('should return correct message', function () {
      let msgExpected = '\x02\x32\x05\x03'.toString('hex');
      let msg = electrotecDPI.buildMsgOpenSession();
      assert.equal(msgExpected, msg);
    });
  });

  describe('buildMsgDisplayPrint()', function () {
      it('should return correct message with parameters ok with node 001', function () {
          let msgExpected = '\x02\x34\x05001\x05\x31\x05 ,0,0,0,0,0,0,0\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrint(
              '001', 
              constantsPTL.ELECTROTEC_CHANNEL_1, 
              ' ', 
              '0,0,0', 
              constantsPTL.ELECTROTEC_NO_BLINK,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_NO_SOUND,
              constantsPTL.ELECTROTEC_NO_BEEP);
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with parameters ok with node 255 and channel2', function () {
          let msgExpected = '\x02\x34\x05255\x05\x32\x05 ,0,0,0,0,0,0,0\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrint(
              '255', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              ' ', 
              '0,0,0', 
              constantsPTL.ELECTROTEC_NO_BLINK,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_NO_SOUND,
              constantsPTL.ELECTROTEC_NO_BEEP);
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with parameters ok with node 255, RGB 111, channel1, blink 0,25s, sound, one beep', function () {
          let msgExpected = '\x02\x34\x05255\x05\x31\x05PRODUCT A 45,1,1,1,1,1,1,1\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrint(
              '255', 
              constantsPTL.ELECTROTEC_CHANNEL_1, 
              'PRODUCT A 45', 
              '1,1,1', 
              constantsPTL.ELECTROTEC_BLINK_0250,
              constantsPTL.ELECTROTEC_ARROWS_LEFTUP,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_ONE_BEEP);
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with parameters ok with node 128, RGB 101, channel1, blink 0,5s, sound, beep short short', function () {
          let msgExpected = '\x02\x34\x05128\x05\x31\x05                               ,1,0,1,2,0,1,2\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrint(
              '128', 
              constantsPTL.ELECTROTEC_CHANNEL_1, 
              '                               ', 
              '1,0,1', 
              constantsPTL.ELECTROTEC_BLINK_0500,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_SHORT);
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with parameters ok with node 128, RGB 101, channel2, blink 1s, sound, beep short long', function () {
          let msgExpected = '\x02\x34\x05128\x05\x32\x05                               ,1,0,1,4,0,1,4\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrint(
              '128', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              '                               ', 
              '1,0,1', 
              constantsPTL.ELECTROTEC_BLINK_1000,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_LONG);
          assert.equal(msgExpected, msg);
      });
      it('should fail if ptl id is larger than 255', function () {
          let msgExpected = 'Error: nodeId 256 is invalid';
          let msg = electrotecDPI.buildMsgDisplayPrint(
              '256', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              '                               ', 
              '1,0,1', 
              constantsPTL.ELECTROTEC_BLINK_1000,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_LONG);
          assert.equal(msgExpected, msg);
      });
      it('should fail if display data is larger than 31 characters', function () {
          let msgExpected = 'Error: displayData 0123456789012345678901234567890123456789 is invalid, must have less than 31 characters';
          let msg = electrotecDPI.buildMsgDisplayPrint(
              '128', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              '0123456789012345678901234567890123456789', 
              '1,0,1', 
              constantsPTL.ELECTROTEC_BLINK_1000,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_LONG);
          assert.equal(msgExpected, msg);
      });
      it('should fail if RGB has invalid format', function () {
          let msgExpected = 'Error: ledLight 1,2,1 is invalid';
          let msg = electrotecDPI.buildMsgDisplayPrint(
              '128', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              '                               ', 
              '1,2,1', 
              constantsPTL.ELECTROTEC_BLINK_1000,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_LONG);
          assert.equal(msgExpected, msg);
      });
  });

  describe('buildMsgDisplayPrintAnswered()', function () {
      it('should return correct message with parameters ok with node 001', function () {
          let msgExpected = '\x02\x42\x05101\x05001\x05\x31\x05 ,0,0,0,0,8,0,0\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrintAnswered(
              '101',
              '001', 
              constantsPTL.ELECTROTEC_CHANNEL_1, 
              ' ', 
              '0,0,0', 
              constantsPTL.ELECTROTEC_NO_BLINK,
              constantsPTL.ELECTROTEC_ARROWS_DOWN,
              constantsPTL.ELECTROTEC_NO_SOUND,
              constantsPTL.ELECTROTEC_NO_BEEP);
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with parameters ok with node 255 and channel2', function () {
          let msgExpected = '\x02\x42\x05001\x05255\x05\x32\x05 ,0,0,0,0,0,0,0\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrintAnswered(
              '001',
              '255', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              ' ', 
              '0,0,0', 
              constantsPTL.ELECTROTEC_NO_BLINK,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_NO_SOUND,
              constantsPTL.ELECTROTEC_NO_BEEP);
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with parameters ok with node 255, RGB 111, channel1, blink 0,25s, sound, one beep', function () {
          let msgExpected = '\x02\x42\x05255\x05255\x05\x31\x05PRODUCT A 45,1,1,1,1,0,1,1\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrintAnswered(
              '255', 
              '255', 
              constantsPTL.ELECTROTEC_CHANNEL_1, 
              'PRODUCT A 45', 
              '1,1,1', 
              constantsPTL.ELECTROTEC_BLINK_0250,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_ONE_BEEP);
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with parameters ok with node 128, RGB 101, channel1, blink 0,5s, sound, beep short short', function () {
          let msgExpected = '\x02\x42\x05255\x05128\x05\x31\x05                               ,1,0,1,2,0,1,2\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrintAnswered(
              '255', 
              '128', 
              constantsPTL.ELECTROTEC_CHANNEL_1, 
              '                               ', 
              '1,0,1', 
              constantsPTL.ELECTROTEC_BLINK_0500,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_SHORT);
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with parameters ok with node 128, RGB 101, channel2, blink 1s, sound, beep short long', function () {
          let msgExpected = '\x02\x42\x05255\x05128\x05\x32\x05                               ,1,0,1,4,0,1,4\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgDisplayPrintAnswered(
              '255', 
              '128', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              '                               ', 
              '1,0,1', 
              constantsPTL.ELECTROTEC_BLINK_1000,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_LONG);
          assert.equal(msgExpected, msg);
      });
      it('should fail if message id is larger than 255', function () {
          let msgExpected = 'Error: messageId 256 is invalid';
          let msg = electrotecDPI.buildMsgDisplayPrintAnswered(
              '256',
              '255', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              '                               ', 
              '1,0,1', 
              constantsPTL.ELECTROTEC_BLINK_1000,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_LONG);
          assert.equal(msgExpected, msg);
      });
      it('should fail if ptl id is larger than 255', function () {
          let msgExpected = 'Error: nodeId 256 is invalid';
          let msg = electrotecDPI.buildMsgDisplayPrintAnswered(
              '001',
              '256', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              '                               ', 
              '1,0,1', 
              constantsPTL.ELECTROTEC_BLINK_1000,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_LONG);
          assert.equal(msgExpected, msg);
      });
      it('should fail if display data is larger than 31 characters', function () {
          let msgExpected = 'Error: displayData 0123456789012345678901234567890123456789 is invalid, must have less than 31 characters';
          let msg = electrotecDPI.buildMsgDisplayPrintAnswered(
              '001',
              '128', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              '0123456789012345678901234567890123456789',
              '1,0,1', 
              constantsPTL.ELECTROTEC_BLINK_1000,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_LONG);
          assert.equal(msgExpected, msg);
      });
      it('should fail if RGB has invalid format', function () {
          let msgExpected = 'Error: ledLight 1,2,1 is invalid';
          let msg = electrotecDPI.buildMsgDisplayPrintAnswered(
              '001',
              '128', 
              constantsPTL.ELECTROTEC_CHANNEL_2, 
              '                               ', 
              '1,2,1', 
              constantsPTL.ELECTROTEC_BLINK_1000,
              constantsPTL.ELECTROTEC_ARROWS_NONE,
              constantsPTL.ELECTROTEC_SOUND,
              constantsPTL.ELECTROTEC_BEEP_SHORT_LONG);
          assert.equal(msgExpected, msg);
      });
  });

  describe('buildMsgRelayOutput()', function () {
      it('should return correct message with output 0,0,0', function () {
          let msgExpected = '\x02\x35\x05\x30\x2c\x30\x2c\x30\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgRelayOutput('0,0,0');
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with output 0,0,1', function () {
          let msgExpected = '\x02\x35\x05\x30\x2c\x30\x2c\x31\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgRelayOutput('0,0,1');
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with output 0,1,0', function () {
          let msgExpected = '\x02\x35\x05\x30\x2c\x31\x2c\x30\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgRelayOutput('0,1,0');
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with output 0,1,1', function () {
          let msgExpected = '\x02\x35\x05\x30\x2c\x31\x2c\x31\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgRelayOutput('0,1,1');
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with output 1,0,0', function () {
          let msgExpected = '\x02\x35\x05\x31\x2c\x30\x2c\x30\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgRelayOutput('1,0,0');
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with output 1,0,1', function () {
          let msgExpected = '\x02\x35\x05\x31\x2c\x30\x2c\x31\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgRelayOutput('1,0,1');
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with output 1,1,0', function () {
          let msgExpected = '\x02\x35\x05\x31\x2c\x31\x2c\x30\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgRelayOutput('1,1,0');
          assert.equal(msgExpected, msg);
      });
      it('should return correct message with output 1,1,1', function () {
          let msgExpected = '\x02\x35\x05\x31\x2c\x31\x2c\x31\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgRelayOutput('1,1,1');
          assert.equal(msgExpected, msg);
      });
      it('should return error message with output 2,1,1', function () {
          let msgExpected = 'Error: output 2,1,1 is invalid';
          let msg = electrotecDPI.buildMsgRelayOutput('2,1,1');
          assert.equal(msgExpected, msg);
      });
      it('should return error message with output 0,0,0,0', function () {
          let msgExpected = 'Error: output 0,0,0,0 is invalid';
          let msg = electrotecDPI.buildMsgRelayOutput('0,0,0,0');
          assert.equal(msgExpected, msg);
      });
      it('should return error message with output 0,00,0', function () {
          let msgExpected = 'Error: output 0,00,0 is invalid';
          let msg = electrotecDPI.buildMsgRelayOutput('0,00,0');
          assert.equal(msgExpected, msg);
      });
      it('should return error message with output 00000', function () {
          let msgExpected = 'Error: output 000000 is invalid';
          let msg = electrotecDPI.buildMsgRelayOutput('000000');
          assert.equal(msgExpected, msg);
      });
  });

  describe('buildMsgGetNetworkDistribution()', function () {
      it('should return correct message', function () {
          let msgExpected = '\x02\x39\x05\x03'.toString('hex');
          let msg = electrotecDPI.buildMsgGetNetworkDistribution();
          assert.equal(msgExpected, msg);
      });
  });

  describe('parseReceivedData()', function () {
      it('should parse ok when received 1 version response', function () {
          let dataReceived = '\x02\x31\x051.0\x03';
          let msgExpected = ['\x31\x051.0'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse ok when received 1 open session response', function () {
          let dataReceived = '\x02\x32\x051\x03';
          let msgExpected = ['\x32\x051'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse ok when received 1 alarm', function () {
          let dataReceived = '\x02\x33\x05001\x051\x051\x03';
          let msgExpected = ['\x33\x05001\x051\x051'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse ok when received 1 ptl display response', function () {
          let dataReceived = '\x02\x33\x05001\x05001\x051\x051\x03';
          let msgExpected = ['\x33\x05001\x05001\x051\x051'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse ok when received 1 key pressed', function () {
          let dataReceived = '\x02\x36\x05001\x051\x051,2,V\x03';
          let msgExpected = ['\x36\x05001\x051\x051,2,V'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse ok when received 2 version responses', function () {
          let dataReceived = '\x02\x31\x051.0\x03\x02\x31\x051.0\x03';
          let msgExpected = ['\x31\x051.0', '\x31\x051.0'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse ok when received 1 version and 1 open session responses', function () {
          let dataReceived = '\x02\x31\x051.0\x03\x02\x32\x051\x03';
          let msgExpected = ['\x31\x051.0', '\x32\x051'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse ok when received 1 version, 1 open session and 1 key pressed responses', function () {
          let dataReceived = '\x02\x31\x051.0\x03\x02\x32\x051\x03\x02\x36\x05001\x051\x051,2,V\x03';
          let msgExpected = ['\x31\x051.0', '\x32\x051', '\x36\x05001\x051\x051,2,V'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should not parse when received 1 version whithout end field', function () {
          let dataReceived = '\x02\x31\x051.0';
          let msgExpected = [];
          let remainderExpected = '\x02\x31\x051.0';
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal(remainderExpected);
      });
      it('should not parse last message when has not end field', function () {
          let dataReceived = '\x02\x31\x051.0\x03\x02\x32\x051\x03\x02\x36\x05001\x051\x051,2,V';
          let msgExpected = ['\x31\x051.0', '\x32\x051'];
          let remainderExpected = '\x02\x36\x05001\x051\x051,2,V';
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal(remainderExpected);
      });

      it('should parse ok when received 1 version whithout start field, when the start field of the first message is missing works well', function () {
          let dataReceived = '\x31\x051.0\x03';
          let msgExpected = ['\x31\x051.0'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse 1st and 2nd messages ok, the 3rd can not be parsed because has not start field', function () {
          let dataReceived = '\x02\x31\x051.0\x03\x02\x32\x051\x03\x36\x05001\x051\x051,2,V\x03';
          let msgExpected = ['\x31\x051.0', '\x32\x051'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('\x36\x05001\x051\x051,2,V\x03');
      });
      it('should parse 1st and 3rd messages ok, the 2nd can not be parsed because has not start field', function () {
          let dataReceived = '\x02\x31\x051.0\x03\x32\x051\x03\x02\x36\x05001\x051\x051,2,V\x03';
          let msgExpected = ['\x31\x051.0', '\x36\x05001\x051\x051,2,V'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      
      it('should parse ok when received 1 message with garbage data first', function () {
          let dataReceived = '1341342fgsdrfgs\x02\x36\x05001\x051\x051,2,V\x03';
          let msgExpected = ['\x36\x05001\x051\x051,2,V'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse ok when received 2 messages and the first has not the initial field', function () {
          let dataReceived = '\x36\x05001\x051\x051,2,V\x031341342fgsdrfgs\x02\x36\x05001\x051\x051,2,V\x03';
          let msgExpected = ['\x36\x05001\x051\x051,2,V', '\x36\x05001\x051\x051,2,V'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
      });
      it('should parse ok when received 1 message with garbage data last', function () {
          let dataReceived = '\x02\x36\x05001\x051\x051,2,V\x031341342fgsdrfgs';
          let msgExpected = ['\x36\x05001\x051\x051,2,V'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('1341342fgsdrfgs');
      });
  });


  describe('parseVersionResponse()', function () {
      it('should parse ok when the data received is correct', function () {
          let dataReceived = '\x02\x31\x051.0\x03';
          let msgExpected = ['\x31\x051.0'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          let msgVersion = electrotecDPI.parseVersionResponse(msg.msgParsed[0], TEST_DPI);

          //console.log(msgVersion);
          
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
          expect(msgVersion).deep.to.equal({type: 'version', value:'1.0', error:null, dpi: TEST_DPI});
      });
  });
  
  describe('parseOpenSessionResponse()', function () {
      it('should parse ok when the data received is correct', function () {
          let dataReceived = '\x02\x32\x054\x03';
          let msgExpected = ['\x32\x054'];
          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          let msgSessions = electrotecDPI.parseOpenSessionResponse(msg.msgParsed[0], TEST_DPI);
          
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
          expect(msgSessions).deep.to.equal({type: 'sessions', value: '4', error: null, dpi: TEST_DPI});
      });
  });

  describe('parseAlarm()', function () {
      it('should parse ok when the data received is correct', function () {
          let dataReceived = '\x02\x33\x05003\x051\x052\x03';
          let msgExpected = ['\x33\x05003\x051\x052'];
          let alarmParsed = {
              type: 'alarm',
              value: `Node 003, channel 1, alarm code 2, Node 003 detected as disconnected`,
              nodeId: '003', 
              channel: '1', 
              alarmCode: '2', 
              alarmMessage: 'Node 003 detected as disconnected', 
              error: null,
              dpi: TEST_DPI
          };

          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          let msgAlarm = electrotecDPI.parseAlarm(msg.msgParsed[0], TEST_DPI);
          
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
          expect(msgAlarm).deep.to.equal(alarmParsed);
      });
  });

  describe('parsePrintResponse()', function () {
      it('should parse ok when the data received is correct', function () {
          let dataReceived = '\x02\x42\x05250\x05001\x052\x059\x03';
          let msgExpected = ['\x42\x05250\x05001\x052\x059'];
          let printParsed = {
              type: 'print',
              value: 'Message 250, Node 001, channel 2, ack type 9,  Transmission ok',
              messageId: '250',
              nodeId: '001', 
              channel: '2', 
              ackType: '9',
              ackMessage: 'Transmission ok', 
              error: null,
              dpi: TEST_DPI
          };

          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          let msgAlarm = electrotecDPI.parsePrintResponse(msg.msgParsed[0], TEST_DPI);
          
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
          expect(msgAlarm).deep.to.equal(printParsed);
      });
  });

  describe('parseKeyPressed()', function () {
      it('should parse ok when the data received is correct', function () {
          let dataReceived = '\x02\x36\x05001\x052\x051,2,V\x03';
          let msgExpected = ['\x36\x05001\x052\x051,2,V'];
          let keyParsed = {
              type: 'key',
              value: 'Node 001, channel 2, keys 1,2,V, key V',
              nodeId: '001', 
              channel: '2', 
              keys: '1,2,V',
              key: 'V',
              error: null,
              dpi: TEST_DPI
          };

          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          let msgAlarm = electrotecDPI.parseKeyPressed(msg.msgParsed[0], TEST_DPI);
          
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
          expect(msgAlarm).deep.to.equal(keyParsed);
      });

      it('should parse ok when the data received is correct and the legnth of the data is the maximum, 7bytes', function () {
          let dataReceived = '\x02\x36\x05001\x052\x051,2,V,+\x03';
          let msgExpected = ['\x36\x05001\x052\x051,2,V,+'];
          let keyParsed = {
              type: 'key',
              value: 'Node 001, channel 2, keys 1,2,V,+, key V',
              nodeId: '001', 
              channel: '2', 
              keys: '1,2,V,+',
              key: 'V',
              error: null,
              dpi: TEST_DPI
          };

          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          let msgAlarm = electrotecDPI.parseKeyPressed(msg.msgParsed[0], TEST_DPI);
          
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
          expect(msgAlarm).deep.to.equal(keyParsed);
      });
  });

  describe('parseNetworkDistributionResponse()', function () {
      it('should parse ok when the data received is correct', function () {
          // DPI with channel 1 with 4 PTLs (nodes) DPA1 (node type = 1) in status normal mode (3)
          let dataReceived = '\x02\x39\x051,4\x051,3,1\x052,3,1\x053,3,1\x054,3,1\x052,2\x05001,3,1\x05002,3,1\x05\x03';
          let msgExpected = ['\x39\x051,4\x051,3,1\x052,3,1\x053,3,1\x054,3,1\x052,2\x05001,3,1\x05002,3,1\x05'];
          let networkParsed = {
              type: 'network',
              value: '',
              dpi: TEST_DPI,
              channels: [ {
                  channel: '1',
                  numNodes: 4,
                  nodes: [
                      { nodeId: '1', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                      { nodeId: '2', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                      { nodeId: '3', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                      { nodeId: '4', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                  ]
              },
              {
                  channel: '2',
                  numNodes: 2,
                  nodes: [
                      { nodeId: '001', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                      { nodeId: '002', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                  ]
              }], 
              error: null
          };

          let msg = electrotecDPI.parseReceivedData(TEST_DPI, dataReceived);
          let msgAlarm = electrotecDPI.parseNetworkDistributionResponse(msg.msgParsed[0], TEST_DPI);
          
          expect(msg.msgParsed).deep.to.equal(msgExpected);
          expect(msg.dataRemainder).equal('');
          expect(msgAlarm).deep.to.equal(networkParsed);
      });
  });

  describe('parseNetworkDistributionToConfiguration()', function () {
      it('should parse ok when the data received is correct', function () {
          let networkDistribution = {
              dpi: TEST_DPI,
              channels: [ {
                  channel: '1',
                  numNodes: 4,
                  nodes: [
                      { nodeId: '001', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                      { nodeId: '002', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                      { nodeId: '003', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                      { nodeId: '004', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                  ]
              },
              {
                  channel: '2',
                  numNodes: 2,
                  nodes: [
                      { nodeId: '001', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                      { nodeId: '002', status: constantsPTL.ELECTROTEC_NODE_STATE_NORMAL, statusDesc: 'Node in normal state', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, typeDesc: 'DPA1: Display 4 digits 14seg' },
                  ]
              }]
          };
          let configurationExpected = {
              error: null,
              configuration: [
                  { location:"L000000", shelf: { id:0, code:'S1', type_id:constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code:''}, id:1, internal_id:"001", channel_id:"1", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
                  { location:"L000001", shelf: { id:0, code:'S1', type_id:constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code:''}, id:2, internal_id:"002", channel_id:"1", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
                  { location:"L000002", shelf: { id:0, code:'S1', type_id:constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code:''}, id:3, internal_id:"003", channel_id:"1", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
                  { location:"L000003", shelf: { id:0, code:'S1', type_id:constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code:''}, id:4, internal_id:"004", channel_id:"1", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
                  { location:"L001000", shelf: { id:0, code:'S1', type_id:constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code:''}, id:5, internal_id:"001", channel_id:"2", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
                  { location:"L001001", shelf: { id:0, code:'S1', type_id:constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code:''}, id:6, internal_id:"002", channel_id:"2", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
              ]
          };

          let configuration = electrotecDPI.parseNetworkDistributionToConfiguration(networkDistribution, 'S1', constantsPTL.SHELF_TYPE_PICK_TO_LIGHT);

          //console.log(JSON.stringify(configuration));
          
          expect(configuration).deep.to.equal(configurationExpected);
      });
  });

  describe('convertASCIItoHex', function () {
    it('should parse ok when the data received is correct', function () {
      let dataToParse = '\x02\x36\x05001\x052\x051,2,V\x03';
      let dataExpected = '\\x02,\\x36,\\x05,\\x30,\\x30,\\x31,\\x05,\\x32,\\x05,\\x31,\\x2c,\\x32,\\x2c,\\x56,\\x03';

      let dataParsed = electrotecDPI.convertASCIItoHex(dataToParse);

      console.log(dataParsed);
      
      expect(dataParsed).to.equal(dataExpected);
    });
  });
});
