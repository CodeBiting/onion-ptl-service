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

const express = require('express');
const router = express.Router();

const logger = require('../../../api/logger');
const ApiResult = require('../../../api/ApiResult');
const ApiError = require('../../../api/ApiError');
const helpData = require('../../../api/v1/help.json');

// Constants to structure logs
const API_NAME = 'help';

/**
 * @swagger
 *   definitions:
 *   Error:
 *     type: object
 *     properties:
 *       id:
 *         type: integer
 *       code:
 *         type: string
 *       message:
 *         type: string
 *       detail:
 *         type: string
 */

/**
 * @swagger
 * /api/v1/help/error:
 *   get:
 *     summary: Returns all error helps
 *     description: Returns all error helps
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: ApiResult object with all error helps
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/definitions/ApiResult'
 */
router.get('/error/', function (req, res, next) {
    res.status(200).json(new ApiResult('OK', helpData, []));
});

/**
 * @swagger
 * /api/v1/help/error/code:
 *   get:
 *     summary: Returns one error helps
 *     description: Returns one error helps
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: code
 *         description: CODE of the herror to obtain help
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: ApiResult object with help
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/definitions/ApiResult'
 */
router.get('/error/:code', function (req, res, next) {
    const errors = [];
    let status = 200;
    let helpFound = null;

    try {
        helpFound = helpData.find(h => h.code === req.params.code);
        if (helpFound === undefined) {
            logger.error(`${API_NAME}: [${req.method}] ${req.originalUrl}: Help not found`);
            status = 404;
            errors.push(new ApiError('HELP-001',
                'Incorrect code, this code does not exist',
                'Ensure that the code included in the request are correct',
                ''));
        }
    } catch (ex) {
        logger.error(`${API_NAME}: [${req.method}] ${req.originalUrl}: ${ex}`);
        status = 500;
        errors.push(new ApiError('HELP-002',
            'Internal server error',
            'Server has an internal error with the request',
            ''));
    }

    res.status(status).json(new ApiResult((status === 200 ? 'OK' : 'ERROR'), helpFound, errors));
});

module.exports = router;
