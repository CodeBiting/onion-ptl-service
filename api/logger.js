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

var config = require('../config/config.js');

/**
 * Module to log to console to pm2 saves as json anf can send to ELK
 * https://medium.com/phablecare/elk-elastic-logstash-kibana-e60707aeaa3a
 * https://gist.github.com/Xeoncross/b8a735626559059353f21a000f7faa4b
 * 
 * Morgan log formats:
 * combined   :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
 * dev        :method :url :status :response-time ms - :res[content-length]
 * common     :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]
 * short      :remote-addr :remote-user :method :url HTTP/:http-version :status :res[content-length] - :response-time ms
 * tiny       :method :url :status :res[content-length] - :response-time ms
 */

 const { createLogger, format, transports } = require("winston");

 // https://github.com/winstonjs/winston#logging
 // { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
 const level = process.env.LOG_LEVEL || "debug";
 
 function formatParams(info) {
   const { timestamp, level, message, ...args } = info;
   //const ts = timestamp.slice(0, 19).replace("T", " ");
 
   return `${timestamp} ${level}: ${message} ${Object.keys(args).length
     ? JSON.stringify(args, "", "")
     : ""}`;
 }
 
 // https://github.com/winstonjs/winston/issues/1135
 const developmentFormat = format.combine(
   format.colorize(),   // Indiquem que volem colors
   format.timestamp(),
   format.align(),
   format.printf(formatParams)
 );
 
 const productionFormat = format.combine(
   format.timestamp(),
   format.align(),
   format.printf(formatParams),
   //format.colorize(),  No volem colors en producció ja que sinó es passaran cràcters estranys amb ELK
   format.json()
 );
 
 let logger;

// Define which transports the logger must use to print out messages.
// In this example, we are using three different transports
const transportsCustom = [
    // Allow the use the console to print the messages => PM2 and Docker saves to file
    new transports.Console(),
    // Allow to print all the error level messages inside the error.log file
    //new transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Allow to print all the error message inside the all.log file
    // (also the error log that are also printed inside the error.log(
    //new transports.File({ filename: 'logs/all.log' }),
]
 

if (process.env.NODE_ENV !== "production") {
  logger = createLogger({
     level: level,
     format: developmentFormat,
     //transports: [new transports.Console()]
     transports: transportsCustom
  });
 
} else {
  logger = createLogger({
     level: level,
     format: productionFormat,
     // En entorn de producció indiquem el servei i el client
     defaultMeta: {
        service: config.service,
        client: config.client,
      },
     /*transports: [
       new transports.File({ filename: "logs/error.log", level: "error" }),
       new transports.File({ filename: "logs/combined.log" })
     ]*/
     transports: transportsCustom
  });
}
 
module.exports = logger;