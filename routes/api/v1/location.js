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
const constantsPTL = require('../../../api/constantsPTL');
var router = express.Router();

const controlPTL = require(`${global.__base}api/ControlPTL`);
const logger = require(`${global.__base}api/logger`);
const ApiResult = require(`${global.__base}api/ApiResult`);
const ApiError = require(`${global.__base}api/ApiError`);

const HELP_BASE_URL = '/v1/help/error';

/**
 * ONION API : API to be called by Onion or other WMS
 */

// Constants to structure logs
const API_NAME = 'location';

/**
 * @swagger
 *   definitions:
 *   Location:
 *     type: object
 *     properties:
 *       id:
 *         type: integer
 *       location:
 *         type: string
 *       shelf:
 *         type: object
 *       shelf_type:
 *         type: string
 *       internal_id:
 *         type: integer
 *       channel_id:
 *         type: integer
 *       type:
 *         type: string
 *       dpi: object
 */

/**
 * @swagger 
 * /api/v1/location:
 *   get:
 *     summary: Returns all locations
 *     description: Returns all locations configured
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: ApiResult object with all locations found in data attribute
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/definitions/ApiResult'
 */
router.get('/', function(req, res, next) {
  let errors = [];
  let status = 200;
  let locations = null;
  try {
    locations = controlPTL.ConfiguredPTLs;
  } catch (ex) {
    logger.error(`${API_NAME}: [${req.method}] ${req.originalUrl}: ${ex}`);
    status = 500;
    errors.push(new ApiError('LOCATION-001', 
      'Internal server error',
      `An error occurred while retrieving locations: ${ex.message}`, 
      `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/LOCATION-001`));
  }

  res.status(status).json(new ApiResult((status === 200 ? "OK" : "ERROR"), locations, errors));
});

module.exports = router;
