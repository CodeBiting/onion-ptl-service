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

/**
 * Note:
 * - If you call pool.getConnection(), you must call connection.release() when you are done using the connection. Otherwise, you application will get stuck waiting forever for connections to be returned to the pool once you hit the connection limit.
 * - For simple queries, you can use pool.query(). This shorthand will automatically call connection.release() for you—even in error conditions.
 */

/*
 https://www.terlici.com/2015/08/13/mysql-node-express.html
 */
const config = require('../config/config');
//const logger = require('../api/logger');
var mysql = require('mysql2');
//var async = require('async');

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

class poolMySql {
    
    state = {
        pool: null,
        promisePool: null
    };

    constructor(db) {
        this.state.pool = mysql.createPool({
            host: db.host,
            port: db.port,
            user: db.user,
            password: db.password,
            database: db.database,
            connectionLimit: db.connectionLimit
        });
    
        this.state.promisePool = this.state.pool.promise();
    }
  
    get = function() {
        return this.state.pool;
    };
    
    getPromise = function() {
        return this.state.promisePool;
    };
}
  
const singletonInstance = new poolMySql(config.db);
  
// The Object.freeze() method prevents modification to properties and values 
// of an object. So applying Object.freeze() to singletonInstance means you 
// will not be able to change any of its properties or values later on in your 
// code.
//Object.freeze(singletonInstance);

// The important part is the last line where we don’t export the class but we 
// export the instance of the class instead. Node.JS will cache and reuse the 
// same object each time it’s required.
module.exports = singletonInstance;