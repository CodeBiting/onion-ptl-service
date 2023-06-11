/**
 * To test:
 * npm test test/api/DataPTL.js
 * or
 * mocha test/api/DataPTL.js
 */
const assert = require('assert');
const mysql = require('mysql2');
const expect = require('chai').expect;
const constantsPTL = require('../../api/constantsPTL');
const DataPTL = require('../../api/DataPTL');

const CONFIG_DB = {
  host: 'localhost',
  port: 3306,
  user: 'cbwms',
  password: '1qaz2wsx',
  database: 'onion_ptl',
  connectionLimit: 100,
};

const TEST_CONFIG_1DPI_2CHAN = [
  { location: 'L000000', shelf: {id: 1, code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 1, internal_id: '001', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L000001', shelf: {id: 1, code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 2, internal_id: '002', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L000002', shelf: {id: 1, code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 3, internal_id: '003', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L000003', shelf: {id: 1, code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 4, internal_id: '004', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L001000', shelf: {id: 1, code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 5, internal_id: '001', channel_id: '2', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L001001', shelf: {id: 1, code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 6, internal_id: '002', channel_id: '2', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } }
];

// Igual que TEST_CONFIG_1DPI_2CHAN però sense shelf.id ja que canvia cada vegada
const TEST_CONFIG_1DPI_2CHAN_REAL_DB = [
  { location: 'L000000', shelf: {code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 1, internal_id: '001', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L000001', shelf: {code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 2, internal_id: '002', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L000002', shelf: {code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 3, internal_id: '003', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L000003', shelf: {code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 4, internal_id: '004', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L001000', shelf: {code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 5, internal_id: '001', channel_id: '2', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } },
  { location: 'L001001', shelf: {code: 'S1', type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, type_code: 'pick-to-light'}, id: 6, internal_id: '002', channel_id: '2', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi: { ip: '192.168.1.222', port: 16, id: 1 } }
];

const TEST_CONFIG_1DPI_2CHAN_SQL = [
  "SET TRANSACTION ISOLATION LEVEL READ COMMITTED",
  "START TRANSACTION",
  "INSERT INTO dpi (code, ip, port) VALUES ('1', '192.168.1.222', 16)",
  "INSERT INTO shelf (code, `rows`, `columns`, type_id) VALUES ('S1', 1, 6, 1)",
  "INSERT INTO ptl (code, type_id, internal_id, channel_id, dpi_id) VALUES ('1', 1, '001', 1, (SELECT id FROM dpi WHERE code = '1')),('2', 1, '002', 1, (SELECT id FROM dpi WHERE code = '1')),('3', 1, '003', 1, (SELECT id FROM dpi WHERE code = '1')),('4', 1, '004', 1, (SELECT id FROM dpi WHERE code = '1')),('5', 1, '001', 2, (SELECT id FROM dpi WHERE code = '1')),('6', 1, '002', 2, (SELECT id FROM dpi WHERE code = '1'))",
  "INSERT INTO location (code, shelf_id, ptl_id) VALUES ('L000000', (SELECT id FROM shelf WHERE code = 'S1'), (SELECT id FROM ptl WHERE code = '1')),('L000001', (SELECT id FROM shelf WHERE code = 'S1'), (SELECT id FROM ptl WHERE code = '2')),('L000002', (SELECT id FROM shelf WHERE code = 'S1'), (SELECT id FROM ptl WHERE code = '3')),('L000003', (SELECT id FROM shelf WHERE code = 'S1'), (SELECT id FROM ptl WHERE code = '4')),('L001000', (SELECT id FROM shelf WHERE code = 'S1'), (SELECT id FROM ptl WHERE code = '5')),('L001001', (SELECT id FROM shelf WHERE code = 'S1'), (SELECT id FROM ptl WHERE code = '6'))",
  "COMMIT"
];

describe('DataPTL', function () {
  describe('clearConfiguration()', function () {
    it('should delete all rows from tables location, ptl, shelf dpi in a mocked database', async function () {
      let msgExpected = { error: null };
      let connectionMocked = {
        query: function(sql) {
          this.executedQueries.push(sql);
          return [{ 'fieldCount': 0, 'affectedRows': 0, 'insertId': 0, 'info': '', 'serverStatus': 34, 'warningStatus': 0 }, null];
        },
        executedQueries: []
      };
      
      //let msg = await DataPTL.clearConfiguration(poolMySql.getPromise());
      let msg = await DataPTL.clearConfiguration(connectionMocked);
      //console.log(connectionMocked.executedQueries.length);

      // Com que comparem objectes hem de fer servir deepEqual i no equal
      assert.deepEqual(msgExpected, msg);
      // Comprovem les consultes executades (7 = 3 per transacció + 4 inserts)
      assert.deepEqual(7, connectionMocked.executedQueries.length);
      assert.equal("SET TRANSACTION ISOLATION LEVEL READ COMMITTED", connectionMocked.executedQueries[0]);
      assert.equal("START TRANSACTION", connectionMocked.executedQueries[1]);
      assert.equal("DELETE FROM location;", connectionMocked.executedQueries[2]);
      assert.equal("DELETE FROM ptl;", connectionMocked.executedQueries[3]);
      assert.equal("DELETE FROM shelf;", connectionMocked.executedQueries[4]);
      assert.equal("DELETE FROM dpi;", connectionMocked.executedQueries[5]);
      assert.equal("COMMIT", connectionMocked.executedQueries[6]);
    });

    it('should delete all rows from tables location, ptl, shelf dpi with a test database', async function () {
        let msgExpected = { error: null };

        // Connectem amb la BD de test per esborrar les taules
        let connection = mysql.createConnection(CONFIG_DB);
        
        let msg = await DataPTL.clearConfiguration(connection.promise());
        //let msg = await DataPTL.clearConfiguration(connectionMocked);
        //console.log(connectionMocked.executedQueries.length);

        // Com que comparem objectes hem de fer servir deepEqual i no equal
        assert.deepEqual(msgExpected, msg);

        // Tanquem la connexió, sinó el test es queda obert
        connection.end();
    });
  });

  describe('getConfiguration()', function () {
    it('should delete the database tables, save a configuration and get the configuration successfully in a mocked database', async function () {
      let msgExpectedClear = { 
          error: null
      };
      let msgExpectedSave = { 
          error: null,
          rowsInserted: 4 // 1 per cada insert (són els affectedRows retornat al fer query())
      };
      let msgExpectedGet = {
          error: null,
          configuration: TEST_CONFIG_1DPI_2CHAN
      }

      let connectionMocked = {
          query: function(sql) {
              this.executedQueries.push(sql);
              return [{"fieldCount":0,"affectedRows":1,"insertId":0,"info":"","serverStatus":34,"warningStatus":0},null];
          },
          executedQueries: []
      };

      // PAS1: Esborrem les taules
      let res = await DataPTL.clearConfiguration(connectionMocked);
      // Comprobem que no hi ha hagut errors. Com que comparem objectes hem de fer servir deepEqual i no equal
      assert.deepEqual(msgExpectedClear, res);

      // PAS2: Guardem la configuració
      connectionMocked.executedQueries = [];  // Reiniciem l'array de  sql executades
      res = await DataPTL.saveConfiguration(connectionMocked, TEST_CONFIG_1DPI_2CHAN);
      // Comprobem que no hi ha hagut errors. Com que comparem objectes hem de fer servir deepEqual i no equal
      assert.deepEqual(msgExpectedSave, res);
      // Comprovem les consultes executades (7 = 3 per transacció + 4 inserts)
      assert.deepEqual(7, connectionMocked.executedQueries.length);
      assert.equal(TEST_CONFIG_1DPI_2CHAN_SQL[0], connectionMocked.executedQueries[0]);
      assert.equal(TEST_CONFIG_1DPI_2CHAN_SQL[1], connectionMocked.executedQueries[1]);
      assert.equal(TEST_CONFIG_1DPI_2CHAN_SQL[2], connectionMocked.executedQueries[2]);
      assert.equal(TEST_CONFIG_1DPI_2CHAN_SQL[3], connectionMocked.executedQueries[3]);
      assert.equal(TEST_CONFIG_1DPI_2CHAN_SQL[4], connectionMocked.executedQueries[4]);
      assert.equal(TEST_CONFIG_1DPI_2CHAN_SQL[5], connectionMocked.executedQueries[5]);
      assert.equal(TEST_CONFIG_1DPI_2CHAN_SQL[6], connectionMocked.executedQueries[6]);

      // PAS3: recuperem la configuració
      let connectionMocked2 = {
          query: function(sql) {
            // Dades retornades per la sql que consulta la configuració a la BD
            return [
                [
                  { location_code: 'L000000', shelf_id: 1, shelf_code: 'S1', shelf_type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, shelf_type_code: 'pick-to-light', id: 1, internal_id: '001', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, ptl_code:'1', ptl_type_id: 1, ip: '192.168.1.222', port: 16, dpi_code: '1' },
                  { location_code: 'L000001', shelf_id: 1, shelf_code: 'S1', shelf_type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, shelf_type_code: 'pick-to-light', id: 2, internal_id: '002', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, ptl_code:'2', ptl_type_id: 1, ip: '192.168.1.222', port: 16, dpi_code: '1' },
                  { location_code: 'L000002', shelf_id: 1, shelf_code: 'S1', shelf_type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, shelf_type_code: 'pick-to-light', id: 3, internal_id: '003', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, ptl_code:'3', ptl_type_id: 1, ip: '192.168.1.222', port: 16, dpi_code: '1' },
                  { location_code: 'L000003', shelf_id: 1, shelf_code: 'S1', shelf_type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, shelf_type_code: 'pick-to-light', id: 4, internal_id: '004', channel_id: '1', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, ptl_code:'4', ptl_type_id: 1, ip: '192.168.1.222', port: 16, dpi_code: '1' },
                  { location_code: 'L001000', shelf_id: 1, shelf_code: 'S1', shelf_type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, shelf_type_code: 'pick-to-light', id: 5, internal_id: '001', channel_id: '2', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, ptl_code:'5', ptl_type_id: 1, ip: '192.168.1.222', port: 16, dpi_code: '1' },
                  { location_code: 'L001001', shelf_id: 1, shelf_code: 'S1', shelf_type_id: constantsPTL.SHELF_TYPE_PICK_TO_LIGHT, shelf_type_code: 'pick-to-light', id: 6, internal_id: '002', channel_id: '2', type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, ptl_code:'6', ptl_type_id: 1, ip: '192.168.1.222', port: 16, dpi_code: '1' }
                ],
                null
            ];
          }
      };
      res = await DataPTL.getConfiguration(connectionMocked2);

      assert.deepEqual(msgExpectedGet, res);
    });

    it('should delete the database tables, save a configuration and get the configuration successfully in a test database', async function () {
      let msgExpected = { error: null };
      let msgExpectedSave = { 
        error: null,
        rowsInserted: 14    // 1 DPI + 1 SHELF + 6 PTL + 6 LOCATIONS
      };
      let msgExpectedGet = {
        error: null,
        configuration: TEST_CONFIG_1DPI_2CHAN_REAL_DB
      }

      // Connectem amb la BD de test per esborrar les taules
      let connection = mysql.createConnection(CONFIG_DB);

      // PAS1: Esborrem les taules
      let res = await DataPTL.clearConfiguration(connection.promise());
      // Comprobem que no hi ha hagut errors. Com que comparem objectes hem de fer servir deepEqual i no equal
      assert.deepEqual(msgExpected, res);

      // PAS2: Guardem la configuració
      res = await DataPTL.saveConfiguration(connection.promise(), TEST_CONFIG_1DPI_2CHAN);
      // Comprobem que no hi ha hagut errors. Com que comparem objectes hem de fer servir deepEqual i no equal
      assert.deepEqual(msgExpectedSave, res);

      // PAS3: recuperem la configuració
      res = await DataPTL.getConfiguration(connection.promise());
      // Recuperem l'id del shelf
      let shelfId = res.configuration[0].shelf.id;
      // Canviem l'id del shelf al missatge esperat
      msgExpectedGet.configuration = msgExpectedGet.configuration.map((c) => { 
        c.shelf.id = shelfId ;
        return c;
      });
      expect(res).to.deep.equal(msgExpectedGet);

      // Tanquem la connexió, sinó el test es queda obert
      connection.end();
    });
  });
});
