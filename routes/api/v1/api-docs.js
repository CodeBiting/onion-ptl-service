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

"use strict";

const express = require('express');
const app = express();

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'ONION DEVICE CLIENT PTL',
      description: "Service to control PTL devices for Onion WMS",
      //termsOfService: "http://swagger.io/terms/",
      contact: {
        name: "API Support",
        url: "https://www.codebiting.com/support",
        //email: "support@swagger.io"
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/license/mit/"
      },
      servers: ['http://localhost:3000']
    }
  },
  //basePath: `${__base}`,
  // APIs to document
  apis: [
    './routes/api/v1/help.js',
    './routes/api/v1/movement.js',
    './routes/api/v1/location.js',
    './api/ApiResult.js',
  ]
}

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/", swaggerUI.serve, swaggerUI.setup(swaggerDocs));

module.exports = app;