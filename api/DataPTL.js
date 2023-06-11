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

// const mysql = require('mysql2');
const logger = require('./logger');
const constantsPTL = require('./constantsPTL');

/**
 * Objecte Singleton per comunicar amb la BD
 *
 * Per fer-lo servir, importar el fitxer i ja es pot cridar a les funcions
 *   import database from './DataPTL.js';
 *   database.getConfiguration(databaseConnection);
 */
class DataPTL {
  /**
   * Constructor de la classe
   */
  constructor() {
    logger.info(`DataPTL : constructor`);
  }

  static extractDpiAndShelf(configuration) {
    let dpi = [];
    let shelf = [];

    for (let i = 0; i < configuration.length; i++) {
      let dpiFound = dpi.find(o => (o.ip == configuration[i].dpi.ip && o.port == configuration[i].dpi.port));
      if (dpiFound === undefined || dpiFound === null) {
        // Afegim el dpi
        dpi.push({
          code: configuration[i].dpi.id,
          ip: configuration[i].dpi.ip,
          port: configuration[i].dpi.port,
        });
      }

      let shelfFound = shelf.find(o => (o.code == configuration[i].shelf.code));
      if (shelfFound) {
        // Actualitzemn les columnes de l'estanteria (fem 1 fila amb 1 PTL a cada columna)
        shelfFound.columns += 1;
      } else {
        // Afegim el shelf
        shelf.push({
          code: configuration[i].shelf.code,
          rows: 1,
          columns: 1,
          type_id: configuration[i].shelf.type_id,
          max_concurrent_orders: 1,
          max_concurrent_users: 1,
          max_concurrent_movs: 1,
          autologouit: 0,
        });
      }
    }

    return [dpi, shelf];
  }

  static dpiToSqlInsert(dpi) {
    let sql = 'INSERT INTO dpi (code, ip, port) VALUES ';
    for (let i = 0; i < dpi.length; i++) {
      if (i > 0) sql += ',';
      sql += `('${dpi[i].code}', '${dpi[i].ip}', ${dpi[i].port})`;
    }
    return sql;
  }

  static shelfToSqlInsert(shelf) {
    let sql = 'INSERT INTO shelf (code, `rows`, `columns`, type_id) VALUES ';
    for (let i = 0; i < shelf.length; i++) {
      if (i > 0) sql += ',';
      sql += `('${shelf[i].code}', ${shelf[i].rows}, ${shelf[i].columns}, ${shelf[i].type_id})`;
    }
    return sql;
  }

  /*
  static messageToSqlInsert(message) {
    let sql = 'INSERT INTO `message` (`origin`, `destiny`, `message`, `ptl_id`, `status_id`, `order_id`, `order_line_id`, `version`, `created_at`, `queued_at`, `updated_at`) VALUES ';
    sql += `('${message.origin}', 
              ${message.destiny}, 
              ${message.message}, 
              ${message.ptl_id},
              ${message.status_id},
              ${message.order_id},
              ${message.order_line_id},
              ${message.version},
              now(),
              null,
              null)`;

    return sql;
  }*/

  static configurationToSqlInsertPtl(configuration) {
    let sql = 'INSERT INTO ptl (code, type_id, internal_id, channel_id, dpi_id) VALUES ';
    for (let i = 0; i < configuration.length; i++) {
      if (i > 0) sql += ',';
      sql += `('${configuration[i].id}', ${configuration[i].type}, '${configuration[i].internal_id}', ${configuration[i].channel_id}, (SELECT id FROM dpi WHERE code = '${configuration[i].dpi.id}'))`;
    }
    return sql;
  }

  static configurationToInsertSqlLocation(configuration) {
    let sql = 'INSERT INTO location (code, shelf_id, ptl_id) VALUES ';
    for (let i = 0; i < configuration.length; i++) {
      if (i > 0) sql += ',';
      sql += `('${configuration[i].location}', (SELECT id FROM shelf WHERE code = '${configuration[i].shelf.code}'), (SELECT id FROM ptl WHERE code = '${configuration[i].id}'))`;
    }
    return sql;
  }

  /**
   * Guarda l'array de PTL en BD, no esborra res
   * [ 
   *   { location:"A1", shelf:"", shelf_type:"", id:1, internal_id:"001", channel_id:"1", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
   *   ...
   * ]
   * A les taules:
   * - dpi
   * - shelf
   * - ptl
   * - location
   * @param {*} connection : objecte de connexió amb la BD
   * @param {*} configuration : configuració de PTLs que es vol guardar
   * [ { location:"A1", shelf:"", shelf_type:"", id:1, internal_id:"001", channel_id:"1", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} } ]
   */
  async saveConfiguration(connection, configuration) {
    let result = {
      error: null,
      rowsInserted: 0,
    };

    logger.info(`DataPTL : getConfiguration`);

    let dpi = [];
    let shelf = [];
    let sql = '';

    try {
      logger.info(`DataPTL : getConfiguration : extracting dpi and shelves from configuration`);
      [dpi, shelf] = DataPTL.extractDpiAndShelf(configuration);

      if (dpi.length === 0 || shelf.length === 0) {
        logger.error(`saveConfiguration : Not found dpi or shelf in configuration`);
        return {
          error: `Not found dpi or shelf in configuration`,
          rowsInserted: 0,
        };
      }
    } catch (e) {
      logger.error(`saveConfiguration : Exception extracting dpi and shelves from configuration with error ${e.message}`);
      return {
        error: `Exception extracting dpi and shelves from configuration with error ${e.message}`,
        rowsInserted: 0,
      };
    }

    // https://dev.mysql.com/doc/refman/8.0/en/glossary.html#glos_isolation_level
    // From highest amount of consistency and protection to the least, the isolation levels supported by InnoDB are: 
    // SERIALIZABLE 
    // REPEATABLE READ (default)
    // - All queries within a transaction see data from the same snapshot, that is, the data as it was at the time the transaction started
    // - When a transaction with this isolation level performs UPDATE ... WHERE, DELETE ... WHERE, SELECT ... FOR UPDATE, and LOCK IN SHARE MODE operations, other transactions might have to wait.
    // READ COMMITTED
    // - Transactions cannot see uncommitted data from other transactions, but they can see data that is committed by another transaction after the current transaction started
    // - When a transaction with this isolation level performs UPDATE ... WHERE or DELETE ... WHERE operations, other transactions might have to wait. The transaction can perform SELECT ... FOR UPDATE, and LOCK IN SHARE MODE operations without making other transactions wait.
    // READ UNCOMMITTED
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.query('START TRANSACTION');
    try {
      logger.info(`DataPTL : getConfiguration : saving dpi`);
      sql = DataPTL.dpiToSqlInsert(dpi);
      let insertRes = await connection.query(sql);
      result.rowsInserted += insertRes[0].affectedRows;

      // Recuperem els dpi per afegir els ptl amb el id de dpi quye tiqui
      logger.info(`DataPTL : getConfiguration : saving shelf`);
      sql = DataPTL.shelfToSqlInsert(shelf);
      insertRes = await connection.query(sql);
      result.rowsInserted += insertRes[0].affectedRows;

      logger.info(`DataPTL : getConfiguration : saving ptls`);
      sql = DataPTL.configurationToSqlInsertPtl(configuration);
      insertRes = await connection.query(sql);
      result.rowsInserted += insertRes[0].affectedRows;

      logger.info(`DataPTL : getConfiguration : saving locations`);
      sql = DataPTL.configurationToInsertSqlLocation(configuration);
      insertRes = await connection.query(sql);
      result.rowsInserted += insertRes[0].affectedRows;

      await connection.query('COMMIT');
    } catch (e) {
      await connection.query('ROLLBACK');
      logger.error(`saveConfiguration : Exception running sql ${sql} with error ${e.message}`);
      result.error = `Exception running sql ${sql} with error ${e.message}`;
    }

    return result;
  }

  /**
   * Recupera la configuració de les següents taules de la BD:
   * - dpi
   * - shelf
   * - ptl
   * - location
   * I la retorna en un array amb el següent format:
   * [ 
   *   { location:"A1", shelf:"", shelf_type:"", id:1, internal_id:"001", channel_id:"1", type: constantsPTL.ELECTROTEC_NODE_TYPE_DPA1, dpi:{ip:"192.168.1.222",port:16,id:1} },
   *   ...
   * ]
   * @param {*} connection : connexió a la BD
   * @returns : objecte amb error i array amb les ubicacions
   */
  async getConfiguration(connection) {
    let result = {
      error: null,
      configuration: [],
    };
    let sql = '';

    logger.info(`DataPTL : getConfiguration`);

    try {
      sql = `SELECT l.code as location_code, 
          s.id as shelf_id, s.code as shelf_code, s.type_id as shelf_type_id, st.code as shelf_type_code, 
          p.id,  p.code as ptl_code, p.internal_id, p.channel_id, 
          p.type_id as ptl_type_id, pt.code as typeName,
          d.code as dpi_code, d.ip, d.port
      FROM ptl p inner join location l on p.id = l.ptl_id
            inner join shelf s on s.id = l.shelf_id
            inner join shelf_type st on s.type_id = st.id
            inner join dpi d on d.id = p.dpi_id
            inner join ptl_type pt on pt.id = p.type_id`;            
      let [rows, fields] = await connection.query(sql);

      result.configuration = rows.map((o) => {
        //console.log(`id: ${o.shelf_id}, code: ${o.shelf_code},  type_id: ${o.shelf_type_id}, type_code: ${o.shelf_type_code}`);
        return {
          location: o.location_code,
          shelf: {
            id: o.shelf_id,
            code: o.shelf_code, 
            type_id: o.shelf_type_id,
            type_code: o.shelf_type_code,
          },
          id: parseInt(o.ptl_code), 
          internal_id: o.internal_id, 
          channel_id: o.channel_id.toString(),
          type: o.ptl_type_id,
          dpi:{
            ip: o.ip,
            port: o.port,
            id: parseInt(o.dpi_code)
          }
        };
      });
    } catch (e) {
      logger.error(`getConfiguration : Exception running sql ${sql} with error ${e.message}`);
      result.error = `Exception running sql ${sql} with error ${e.message}`;
    }

    return result;
  }

  /**
   * Esborrem les dades (no truqnquem ja que dona error per claus forànies) de les taules següents:
   * - dpi
   * - shelf
   * - ptl
   * - location
   * @param {*} connection 
   * @returns objecte amb error = null si tot va bé
   */    
  async clearConfiguration(connection) {
    let sql = null;
    let truncateResult = null;
    let error = null;

    logger.info(`DataPTL : clearConfiguration`);

    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.query('START TRANSACTION');
    try {
      logger.info(`DataPTL : clearConfiguration : delete location`);
      sql = `DELETE FROM location;`
      truncateResult = await connection.query(sql);

      //console.log(JSON.stringify(truncateResult));    // [{"fieldCount":0,"affectedRows":0,"insertId":0,"info":"","serverStatus":34,"warningStatus":0},null]
      // Per saber els codis del serverStatus: https://dev.mysql.com/doc/dev/mysql-server/8.0.29/mysql__com_8h_source.html
      // 34 =  SERVER_STATUS_AUTOCOMMIT (2)   
      //                Server in auto_commit mode
      //       + 
      //       SERVER_QUERY_NO_INDEX_USED = 32   
      //                The server was able to fulfill the clients request and opened a
      //                read-only non-scrollable cursor for a query. This flag comes
      //                in reply to COM_STMT_EXECUTE and COM_STMT_FETCH commands.
      //                Used by Binary Protocol Resultset to signal that COM_STMT_FETCH
      //                must be used to fetch the row-data.
      //                @todo Refify "Binary Protocol Resultset" and "COM_STMT_FETCH".

      logger.info(`DataPTL : clearConfiguration : delete ptl`);
      sql = `DELETE FROM ptl;`
      truncateResult = await connection.query(sql);

      // console.log(JSON.stringify(truncateResult));

      logger.info(`DataPTL : clearConfiguration : delete shelf`);
      sql = `DELETE FROM shelf;`
      truncateResult = await connection.query(sql);

      // console.log(JSON.stringify(truncateResult));

      logger.info(`DataPTL : clearConfiguration : delete dpi`);
      sql = `DELETE FROM dpi;`
      truncateResult = await connection.query(sql);

      // console.log(JSON.stringify(truncateResult));

      await connection.query('COMMIT');
    } catch (e) {
      await connection.query('ROLLBACK');
      error = `Exception running sql ${sql} with error ${e.message}`;
    }

    return {
      error: error
    };
  }

  /**
   * Inserts a movement to table msg_received
   * @param {*} connection 
   * @param {*} movement : movement data with atributes externalId
   * @returns 
   */
  async saveMovementReceivedFromOnion(connection, movement) {
    let sql = null;
    let movementFound = null;
    let updateResult = null;
    let insertResult = null;
    let error = null;
    let status = "OK";

    // Convert JavaScript Date to ISO (UTC timezone) and Format date for MySQL insertion
    let now = (new Date()).toISOString().slice(0, 19).replace('T', ' ');

    //await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    //await connection.query('START TRANSACTION');
    try {
      sql = `SELECT * FROM msg_received WHERE external_id=${movement.externalId}`;
      let [rows, fields] = await connection.query(sql);
      movementFound = (rows && rows.length > 0 ? rows[0] : {});  // Agafem el primer objecte de les files

      if (movementFound && movementFound.id) {
        sql = `UPDATE msg_received ` +
              `   SET retries=retries+1, updated_at='${now}' `+
              ` WHERE id=${movementFound.id}`;
        updateResult = await connection.query(sql);

        sql = `INSERT INTO msg_received_arch (msg_received_id, external_id, \`from\`, \`to\`, message, created_at, updated_at, retries, result) ` +
              `SELECT id, external_id, \`from\`, \`to\`, message, created_at, updated_at, retries, result ` +
              `  FROM msg_pending_to_send ` +
              ` WHERE id=${movementFound.id}`;
        //let createdAt = (new Date(movementFound.created_at)).toISOString().slice(0, 19).replace('T', ' ');
        //let updatedAt = (new Date(movementFound.updated_at)).toISOString().slice(0, 19).replace('T', ' ');
        //sql = `INSERT INTO msg_received_arch (msg_received_id, external_id, \`from\`, \`to\`, message, created_at, updated_at, sent_at, retries, result) ` +
        //      `VALUES (${movementFound.id}, ${movementFound.external_id}, '${movementFound.from}', '${movementFound.to}', '${JSON.stringify(movement)}', '${createdAt}', '${updatedAt}', null, ${movementFound.retries}, '${JSON.stringify(result)}')`;
        insertResult = await connection.query(sql);
      } else {
        sql = `INSERT INTO msg_received (external_id, \`from\`, \`to\`, message, created_at, retries) ` +
              `VALUES (${movement.externalId}, '${constantsPTL.MESSAGE_ACTOR_ONION}', '${constantsPTL.MESSAGE_ACTOR_PTL}', '${JSON.stringify(movement)}', '${now}', 0)`;
        insertResult = await connection.query(sql);
      }

      //await connection.query('COMMIT');
    } catch (e) {
      //await connection.query('ROLLBACK');
      status = "ERROR";
      error = `Exception running sql ${sql} with error ${e.message}`;
      logger.error(`DataPTL : saveMovementReceivedFromOnion: Exception running sql ${sql} with error ${e.message}`);
    }

    return {
      status,
      error
    };
  }

  async delMovementReceivedFromOnion(connection, movement, result) {
    let sql = null;
    let movementFound = null;
    let deleteResult = null;
    let insertResult = null;
    let error = null;
    let status = "OK";

    // Convert JavaScript Date to ISO (UTC timezone) and Format date for MySQL insertion
    let now = (new Date()).toISOString().slice(0, 19).replace('T', ' ');

    //await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    //await connection.query('START TRANSACTION');
    try {
      sql = `SELECT * FROM msg_received WHERE external_id=${movement.externalId}`;
      let [rows, fields] = await connection.query(sql);
      movementFound = (rows && rows.length > 0 ? rows[0] : {});  // Agafem el primer objecte de les files

      if (movementFound && movementFound.id) {
        sql = `INSERT INTO msg_received_arch (msg_received_id, external_id, \`from\`, \`to\`, message, created_at, updated_at, processed_at, retries, result) ` +
              `SELECT id, external_id, \`from\`, \`to\`, message, created_at, updated_at, '${now}', retries, '${JSON.stringify(result)}' ` +
              `  FROM msg_received ` +
              ` WHERE id=${movementFound.id}`;
        insertResult = await connection.query(sql);

        sql = `DELETE FROM msg_received ` +
              ` WHERE id=${movementFound.id}`;
        deleteResult = await connection.query(sql);
      }

      //await connection.query('COMMIT');
    } catch (e) {
      //await connection.query('ROLLBACK');
      status = "ERROR";
      error = `Exception running sql ${sql} with error ${e.message}`;
      logger.error(`DataPTL : delMovementReceivedFromOnion: Exception running sql ${sql} with error ${e.message}`);
    }

    return {
      status,
      error
    };
  }

  async getMovementsReceivedFromOnion(connection, numMovs, page) {
    let sql = null;
    let rows = null;
    let fields = null;
    let error = null;
    let status = "OK";

    try {
      sql = `SELECT id, external_id as externalId, \`from\`, \`to\`, message, CONVERT_TZ(created_at, '+00:00', @@session.time_zone) as created_at, CONVERT_TZ(updated_at, '+00:00', @@session.time_zone) as updated_at, CONVERT_TZ(processed_at, '+00:00', @@session.time_zone) as processed_at, retries, result ` +
            `FROM msg_received
             WHERE \`from\` = '${constantsPTL.MESSAGE_ACTOR_ONION}' 
               AND \`to\` = '${constantsPTL.MESSAGE_ACTOR_PTL}'
             ORDER BY updated_at DESC
             LIMIT ${page*numMovs},${numMovs}`;
      [rows, fields] = await connection.query(sql);
    } catch (e) {
      status = "ERROR";
      error = `Exception running sql ${sql} with error ${e.message}`;
      logger.error(`DataPTL : getMovementsReceivedFromOnion: Exception running sql ${sql} with error ${e.message}`);
    }

    return {
      status,
      error,
      movements: rows
    };
  }

  /**
   * Guarda o crea el moviment pendent d'enviar i guarda un arxiu del moviment amb el resultat
   * Atenció: Si s'activa la transacció deixa oberts bloqueigs i en futures execucions provoca deadlocks
   * Tested OK
   * @param {*} connection 
   * @param {*} movement 
   * @param {*} result 
   * @returns : {
   *   status: "OK" / "ERROR"
   *   error: ""
   *   
   * }
   */
  async saveErrorInMovementPendingToSendToOnion(connection, movement, result) {
    let sql = null;
    let movementFound = null;
    let updateResult = null;
    let insertResult = null;
    let error = null;
    let status = "OK";

    // Convert JavaScript Date to ISO (UTC timezone) and Format date for MySQL insertion
    let now = (new Date()).toISOString().slice(0, 19).replace('T', ' ');

    //await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    //await connection.query('START TRANSACTION');
    try {
      sql = `SELECT * FROM msg_pending_to_send WHERE external_id=${movement.externalId}`;
      let [rows, fields] = await connection.query(sql);
      movementFound = (rows && rows.length > 0 ? rows[0] : {});  // Agafem el primer objecte de les files

      if (movementFound && movementFound.id) {
        sql = `UPDATE msg_pending_to_send ` +
              `   SET retries=retries+1, result='${JSON.stringify(result)}', updated_at='${now}' `+
              ` WHERE id=${movementFound.id}`;
        updateResult = await connection.query(sql);

        sql = `INSERT INTO msg_pending_to_send_arch (msg_pending_to_send_id, external_id, \`from\`, \`to\`, message, created_at, updated_at, sent_at, retries, result) ` +
              `SELECT id, external_id, \`from\`, \`to\`, message, created_at, updated_at, sent_at, retries, result ` +
              `  FROM msg_pending_to_send ` +
              ` WHERE id=${movementFound.id}`;
        //let createdAt = (new Date(movementFound.created_at)).toISOString().slice(0, 19).replace('T', ' ');
        //let updatedAt = (new Date(movementFound.updated_at)).toISOString().slice(0, 19).replace('T', ' ');
        //sql = `INSERT INTO msg_pending_to_send_arch (msg_pending_to_send_id, external_id, \`from\`, \`to\`, message, created_at, updated_at, sent_at, retries, result) ` +
        //      `VALUES (${movementFound.id}, ${movementFound.external_id}, '${movementFound.from}', '${movementFound.to}', '${JSON.stringify(movement)}', '${createdAt}', '${updatedAt}', null, ${movementFound.retries}, '${JSON.stringify(result)}')`;
        insertResult = await connection.query(sql);
      } else {
        sql = `INSERT INTO msg_pending_to_send (external_id, \`from\`, \`to\`, message, created_at, retries) ` +
              `VALUES (${movement.externalId}, '${constantsPTL.MESSAGE_ACTOR_PTL}', '${constantsPTL.MESSAGE_ACTOR_ONION}', '${JSON.stringify(movement)}', '${now}', 0)`;
        insertResult = await connection.query(sql);
      }

      //await connection.query('COMMIT');
    } catch (e) {
      //await connection.query('ROLLBACK');
      status = "ERROR";
      error = `Exception running sql ${sql} with error ${e.message}`;
      logger.error(`DataPTL : saveErrorInMovementPendingToSendToOnion: Exception running sql ${sql} with error ${e.message}`);
    }

    //connection.end(); // Tanca la connexió

    return {
      status,
      error
    };
  }

  /**
   * Save the movement into table msg_pending_to_send with the error and sent_at with current datetime
   * Atenció: Si s'activa la transacció deixa oberts bloqueigs i en futures execucions provoca deadlocks
   * Tested OK
   * @param {*} connection 
   * @param {*} movement 
   * @param {*} result 
   * @returns 
   */
  async saveErrorAndNotResendInMovementPendingToSendToOnion(connection, movement, result) {
    let sql = null;
    let movementFound = null;
    let updateResult = null;
    let insertResult = null;
    let error = null;
    let status = "OK";

    // Convert JavaScript Date to ISO (UTC timezone) and Format date for MySQL insertion
    let now = (new Date()).toISOString().slice(0, 19).replace('T', ' ');

    //await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    //await connection.query('START TRANSACTION');
    try {
      sql = `SELECT * FROM msg_pending_to_send WHERE external_id=${movement.externalId}`;
      let [rows, fields] = await connection.query(sql);
      movementFound = (rows && rows.length > 0 ? rows[0] : {});  // Agafem el primer objecte de les files

      if (movementFound && movementFound.id) {
        sql = `UPDATE msg_pending_to_send ` +
              `   SET retries=retries+1, result='${JSON.stringify(result)}', updated_at='${now}', sent_at='${now}' `+
              ` WHERE id=${movementFound.id}`;
        updateResult = await connection.query(sql);

        sql = `INSERT INTO msg_pending_to_send_arch (msg_pending_to_send_id, external_id, \`from\`, \`to\`, message, created_at, updated_at, sent_at, retries, result) ` +
              `SELECT id, external_id, \`from\`, \`to\`, message, created_at, updated_at, sent_at, retries, result ` +
              `  FROM msg_pending_to_send ` +
              ` WHERE id=${movementFound.id}`;
        //let createdAt = (new Date(movementFound.created_at)).toISOString().slice(0, 19).replace('T', ' ');
        //let updatedAt = (new Date(movementFound.updated_at)).toISOString().slice(0, 19).replace('T', ' ');
        //sql = `INSERT INTO msg_pending_to_send_arch (msg_pending_to_send_id, external_id, \`from\`, \`to\`, message, created_at, updated_at, sent_at, retries, result) ` +
        //      `VALUES (${movementFound.id}, ${movementFound.external_id}, '${movementFound.from}', '${movementFound.to}', '${JSON.stringify(movement)}', '${createdAt}', '${updatedAt}', null, ${movementFound.retries}, '${JSON.stringify(result)}')`;
        insertResult = await connection.query(sql);
      } else {
        sql = `INSERT INTO msg_pending_to_send (external_id, \`from\`, \`to\`, message, created_at, sent_at, retries) ` +
              `VALUES (${movement.externalId}, '${constantsPTL.MESSAGE_ACTOR_PTL}', '${constantsPTL.MESSAGE_ACTOR_ONION}', '${JSON.stringify(movement)}', '${now}', '${now}', 0)`;
        insertResult = await connection.query(sql);
      }

      //await connection.query('COMMIT');
    } catch (e) {
      //await connection.query('ROLLBACK');
      status = "ERROR";
      error = `Exception running sql ${sql} with error ${e.message}`;
      logger.error(`DataPTL : saveErrorInMovementPendingToSendToOnion: Exception running sql ${sql} with error ${e.message}`);
    }

    return {
      status,
      error
    };
  }

  async saveOkInMovementPendingToSendToOnion(connection, movement, result) {
    let sql = null;
    let movementFound = null;
    let deleteResult = null;
    let insertResult = null;
    let error = null;
    let status = "OK";

    // Convert JavaScript Date to ISO (UTC timezone) and Format date for MySQL insertion
    let now = (new Date()).toISOString().slice(0, 19).replace('T', ' ');

    //await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    //await connection.query('START TRANSACTION');
    try {
      sql = `SELECT * FROM msg_pending_to_send WHERE external_id=${movement.externalId}`;
      let [rows, fields] = await connection.query(sql);
      movementFound = (rows && rows.length > 0 ? rows[0] : {});  // Agafem el primer objecte de les files

      if (movementFound && movementFound.id) {
        sql = `INSERT INTO msg_pending_to_send_arch (msg_pending_to_send_id, external_id, \`from\`, \`to\`, message, created_at, updated_at, sent_at, retries, result)
              SELECT id, external_id, \`from\`, \`to\`, message, created_at, '${now}', '${now}', retries, '${JSON.stringify(result)}' 
              FROM msg_pending_to_send
              WHERE id=${movement.id}`;
        insertResult = await connection.query(sql);

        sql = `DELETE FROM msg_pending_to_send 
              WHERE id=${movement.id}`;
        deleteResult = await connection.query(sql);
      } else {
        sql = `INSERT INTO msg_pending_to_send_arch (msg_pending_to_send_id, external_id, \`from\`, \`to\`, message, created_at, sent_at, retries, result) ` +
              `VALUES (${movement.id}, ${movement.externalId}, '${constantsPTL.MESSAGE_ACTOR_PTL}', '${constantsPTL.MESSAGE_ACTOR_ONION}', '${JSON.stringify(movement)}', '${now}', '${now}', 0, '${JSON.stringify(result)}')`;
        insertResult = await connection.query(sql);
      }
      //await connection.query('COMMIT');
    } catch (e) {
      //await connection.query('ROLLBACK');
      status = "ERROR";
      error = `Exception running sql ${sql} with error ${e.message}`;
      logger.error(`DataPTL : saveOkInMovementPendingToSendToOnion: Exception running sql ${sql} with error ${e.message}`);
    }

    return {
      status,
      error
    };
  }

  async getMovementsToPendingToSendToOnion(connection, numMovs, page, onlyPendingToSend) {
    let sql = null;
    let rows = null;
    let fields = null;
    let error = null;
    let status = "OK";

    try {
      sql = `SELECT id, external_id as externalId, \`from\`, \`to\`, message, CONVERT_TZ(created_at, '+00:00', @@session.time_zone) as created_at, CONVERT_TZ(updated_at, '+00:00', @@session.time_zone) as updated_at, CONVERT_TZ(sent_at, '+00:00', @@session.time_zone) as sent_at, retries, result ` +
            ` FROM msg_pending_to_send ` +
            ` WHERE \`from\` = '${constantsPTL.MESSAGE_ACTOR_PTL}' ` +
            `   AND \`to\` = '${constantsPTL.MESSAGE_ACTOR_ONION}' `;
      if (onlyPendingToSend === 1) {
        sql = sql + ` AND sent_at IS NULL `;
      }
      sql = sql + `ORDER BY id DESC ` + 
                 ` LIMIT ${page*numMovs},${numMovs}`;
      [rows, fields] = await connection.query(sql);
    } catch (e) {
      status = "ERROR";
      error = `Exception running sql ${sql} with error ${e.message}`;
      logger.error(`DataPTL : getMovementsToPendingToSendToOnion: Exception running sql ${sql} with error ${e.message}`);
    }

    return {
      status,
      error,
      movements: rows
    };
  }

  /**
   * 
   * @param {*} connection 
   * @param {*} numMovs : Max number of movements that will be recovered
   * @param {*} page : Page to be recovered (0...N)
   * @returns 
   */
  async getMovementsToPendingToSendArchToOnion(connection, numMovs, page) {
    let sql = null;
    let rows = null;
    let fields = null;
    let error = null;
    let status = "OK";

    try {
      sql = `SELECT id, msg_pending_to_send_id, external_id as externalId, \`from\`, \`to\`, message, CONVERT_TZ(created_at, '+00:00', @@session.time_zone) as created_at, CONVERT_TZ(updated_at, '+00:00', @@session.time_zone) as updated_at, CONVERT_TZ(sent_at, '+00:00', @@session.time_zone) as sent_at, retries, result ` +
            `FROM msg_pending_to_send_arch
             WHERE \`from\` = '${constantsPTL.MESSAGE_ACTOR_PTL}' 
               AND \`to\` = '${constantsPTL.MESSAGE_ACTOR_ONION}'
             ORDER BY id DESC
             LIMIT ${page*numMovs},${numMovs}`;
      [rows, fields] = await connection.query(sql);
    } catch (e) {
      status = "ERROR";
      error = `Exception running sql ${sql} with error ${e.message}`;
      logger.error(`DataPTL : getMovementsToPendingToSendToOnion: Exception running sql ${sql} with error ${e.message}`);
    }

    return {
      status,
      error,
      movements: rows
    };
  }
}

const singletonInstance = new DataPTL();

// The Object.freeze() method prevents modification to properties and values 
// of an object. So applying Object.freeze() to singletonInstance means you 
// will not be able to change any of its properties or values later on in your 
// code.
// Object.freeze(singletonInstance);

// The important part is the last line where we don’t export the class but we 
// export the instance of the class instead. Node.JS will cache and reuse the 
// same object each time it’s required.
module.exports = singletonInstance;
