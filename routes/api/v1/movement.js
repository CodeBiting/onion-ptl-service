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
const API_NAME = 'movement';

/**
 * @swagger
 *   definitions:
 *   Movement:
 *     type: object
 *     properties:
 *       id:
 *         type: integer
 *         description: internal identifier, generated when the movement is created inside this app
 *       externalId:
 *         type: integer
 *         description: external movement identifier
 *       locationCode:
 *         type: string
 *         description: location code where the PTL is attached, it must be configured previous to call with this app
 *       display:
 *         type: string
 *         description: display is an optional parameter, if not exists it uses quantity to display into the PTL
 *       quantity:
 *         type: integer
 *         description: quantity to pick or put, upon app configuration it must be modified or not with the PTLs '+' and '-' keys
 *       userId:
 *         type: integer
 *         description: userId is an optional parameter, user identifier that will confirm the movement into the PTL, at the current time is not used
 *       color:
 *         type: integer
 *         description: identifier of the color to display into the PTL (for Electrotec devices the colors are 0-black, 1-blue, 2-green, 3-cyan, 4-red, 5-magenta, 6-yellow, 7-white)
 *     required: ["id", "externalId", "locationCode", "quantity", "color"]
 */

/**
 * @swagger 
 * /api/v1/movement:
 *   get:
 *     summary: Returns all movements
 *     description: Returns all active movements
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: ApiResult object with all movements found in data attribute
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/definitions/ApiResult'
 */
router.get('/', async function(req, res, next) {
  let errors = [];
  let status = 200;
  let movements = null;
  try {
    movements = await controlPTL.getMovements();
  } catch (ex) {
    logger.error(`${API_NAME}: [${req.method}] ${req.originalUrl}: ${ex}`);
    status = 500;
    errors.push(new ApiError('MOVEMENT-001', 
      'Internal server error',
      `An error occurred while retrieving the movement: ${ex.message}`, 
      `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-001`));
  }

  res.status(status).json(new ApiResult((status === 200 ? "OK" : "ERROR"), movements, errors));
});

/**
 * @swagger 
 * /api/v1/movement/{id}:
 *   get:
 *     summary: Returns one movement
 *     description: Returns the movement specified with the id
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID of the movement
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: ApiResult object with the movement requested
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/definitions/ApiResult'
 */
router.get('/:id', async function(req, res, next) {
  let errors = [];
  let status = 200;
  let movement = null;
  try {
    movement = await controlPTL.getMovement(req.params.id);
    if (movement === undefined) {
      logger.error(`${API_NAME}: [${req.method}] ${req.originalUrl}: Client not found`);
      status = 404;
      errors.push(new ApiError('MOVEMENT-002', 
      'Incorrect Id, this id does not exist', 
      'Ensure that the Id included in the request are correct', 
      `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-002`));
    }
  } catch (ex) {
    logger.error(`${API_NAME}: [${req.method}] ${req.originalUrl}: ${ex}`)
    status = 500;
    errors.push(new ApiError('MOVEMENT-001', 
      'Internal server error',
      `An error occurred while retrieving the movement: ${ex.message}`, 
      `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-001`));
  }

  res.status(status).json(new ApiResult((status === 200 ? "OK" : "ERROR"), movement, errors));
});

/**
 * @swagger 
 * /api/v1/movement:
 *   post:
 *     summary: Creates a new movement
 *     description: Create a new movement to display into PTL immediatly
 *     produces:
 *       - application/json
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/definitions/Movement'
 *     responses:
 *       200:
 *         description: ApiResult object with created movement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/definitions/ApiResult'
 */
router.post('/', async function(req, res, next) {
  let errors = [];
  let movementCreated = null;
  let status = 201;
  try {
    // Parse params:
    //   externalId,
    //   locationCode, 
    //   display,
    //   quantity,
    //   userId,
    //   color,
    let movement = req.body;

    if (!movement.hasOwnProperty("externalId") || 
        typeof movement.externalId !== "number") {
      status = 400;
      errors.push(new ApiError('MOVEMENT-002',
        'Missing or invalid request body, error in "externalId"',
        `Ensure that "externalId" is not empty and is a valid number`,
        `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-002`));
      return res.status(400).json(new ApiResult("ERROR", null, errors));
    }
    if (!movement.hasOwnProperty("locationCode") || 
        typeof movement.locationCode !== "string") {
      status = 400;
      errors.push(new ApiError('MOVEMENT-002',
        'Missing or invalid request body, error in "locationCode"',
        `Ensure that "locationCode" is not empty and is a valid string`,
        `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-002`));
      return res.status(400).json(new ApiResult("ERROR", null, errors));
    }
    if (!movement.hasOwnProperty("quantity") ||
        typeof movement.quantity !== "number") {
      status = 400;
      errors.push(new ApiError('MOVEMENT-002',
        'Missing or invalid request body, error in "quantity"',
        `Ensure that "quantity" is not empty and is a valid number`,
        `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-002`));
      return res.status(400).json(new ApiResult("ERROR", null, errors));
    }
    if (!movement.hasOwnProperty("color") ||
        typeof movement.color !== "number" ||
        movement.color < 0 ||
        movement.color > 7) {
      status = 400;
      errors.push(new ApiError('MOVEMENT-002',
        'Missing or invalid request body, error in "color"',
        `Ensure that "color" is not empty and is a valid string`,
        `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-002`));
      return res.status(400).json(new ApiResult("ERROR", null, errors));
    }

    // display is an optional parámeter, if not exists it usese quantity to display into the PTL

    // Get the ptl from the location code
    let ptlFound = controlPTL.getConfiguredPTLFromLocation(movement.locationCode);
    if (ptlFound === undefined || ptlFound === null) {
      status = 400;
      errors.push(new ApiError('MOVEMENT-002',
        'LocationCode not configured',
        `Ensure that "locationCode" is not empty and is a valid location string code`,
        `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-002`));
      return res.status(400).json(new ApiResult("ERROR", null, errors));
    }

    movement.ptl =  ptlFound;
    let result = await controlPTL.addMovement(movement);
    if (result.result === constantsPTL.RETURN_OK) {
      movementCreated = result.data;
    } else {
      status = 500;
      errors.push(new ApiError('MOVEMENT-003',
        'Internal server error', 
        `An error occurred while creating the movement: ${result.message}`, 
        `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-003`));
    }
    //return res.status(status).json(new ApiResult((status === 201 ? "OK" : "ERROR"), movementCreated, errors));

  } catch (ex) {
    status = 500;
    errors.push(new ApiError('MOVEMENT-001',
      'Internal server error', 
      `An error occurred while creating the movement: ${ex.message}`, 
      `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-001`));
  }

  return res.status(status).json(new ApiResult((status === 201 ? "OK" : "ERROR"), movementCreated, errors));
});

/**
 * @swagger 
 * /api/v1/movement/{id}:
 *   delete:
 *     summary: Deletes a movement
 *     description: Cancel a movement to display into PTL immediatly
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID of the movement to delete
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: ApiResult object with deleted movement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/definitions/ApiResult'
 */
router.delete('/:id', async function(req, res, next) {
  //logger.info(`About to delete movement id: ${req.params.id}`);
  let errors = [];
  let status = 200;
  let movementDeleted = null;
  try{
    if (!req.params.hasOwnProperty("id")) {
      status = 400;
      errors.push(new ApiError('MOVEMENT-002',
        'Missing or invalid parameters "id"',
        `Ensure that parameter "id" is a valid number`,
        `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-002`));
      return res.status(400).json(new ApiResult("ERROR", null, errors));
    }

    let result = await controlPTL.delMovement({ id: req.params.id }, { reason: 'Deleted movement by Onion', movement: { id: req.params.id }});

    movementDeleted = result.data;

    if (result.result !== constantsPTL.RETURN_OK) {
      logger.info(`About to client not exist id: ${req.params.id}`);
      status = (result.result != constantsPTL.RETURN_NOT_FOUND ? 500 : 404);
      errors.push(new ApiError('MOVEMENT-003', 
      'Cannot delete the movement', 
      result.message, 
      `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-003`));
    };
  } catch (ex) {
    status = 500;
    errors.push(new ApiError('MOVEMENT-001',
      'Internal server error',
      `An error occurred while deleting the movement: ${ex.message}`, 
      `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-001`));
      return res.status(500).json(new ApiResult("ERROR", null, errors));
  }
  res.status(status).json(new ApiResult((status === 200 ? "OK" : "ERROR"), movementDeleted, errors));
});

/**
 * @swagger 
 * /api/v1/movement/:
 *   delete:
 *     summary: Deletes a movement by externalId
 *     description: Cancel a movement to display into PTL immediatly
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: query
 *         name: externalId
 *         description: External ID of the movement to delete (f.e. taskmovement.id)
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: ApiResult object with deleted movement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/definitions/ApiResult'
 */
router.delete('/', async function(req, res, next) {
  //logger.info(`About to delete movement id: ${req.params.id}`);
  let errors = [];
  let status = 200;
  let movementDeleted = null;
  try{
    if (!req.query.hasOwnProperty("externalId")) {
      status = 400;
      errors.push(new ApiError('MOVEMENT-002',
        'Missing or invalid quary "externalId"',
        `Ensure that "externalId" is a valid number`,
        `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-002`));
      return res.status(400).json(new ApiResult("ERROR", null, errors));
    }

    let result = await controlPTL.delMovement({ externalId: req.query.externalId }, { reason: 'Deleted movement by Onion', movement: { externalId: req.query.externalId }});

    movementDeleted = result.data;

    if (result.result !== constantsPTL.RETURN_OK) {
      logger.info(`About to client not exist id: ${req.query.externalId}`);
      status = (result.result != constantsPTL.RETURN_NOT_FOUND ? 500 : 404);
      errors.push(new ApiError('MOVEMENT-003', 
      'Incorrect Id, this id does not exist', 
      result.message, 
      `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-003`));
    };
  } catch (ex) {
    status = 500;
    errors.push(new ApiError('MOVEMENT-001',
      'Internal server error',
      `An error occurred while deleting the movement: ${ex.message}`, 
      `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/MOVEMENT-001`));
      return res.status(500).json(new ApiResult("ERROR", null, errors));
  }
  res.status(status).json(new ApiResult((status === 200 ? "OK" : "ERROR"), movementDeleted, errors));
});

module.exports = router;
