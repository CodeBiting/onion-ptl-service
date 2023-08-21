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

// const ApiError = require('../api/ApiError');
const ApiError = require('./ApiError');

/**
 * @swagger
 *   definitions:
 *     ApiResult:
 *       type: "object"
 *       properties:
 *         status:
 *           type: "integer"
 *         data:
 *           type: "array"
 *           items:
 *             type: "object"
 *             description : "array of objects returned"
 *         errors:
 *           type: "array"
 *           items:
 *             type : "object"
 *             description : "name of the object"
 *             properties:
 *               code:
 *                 type: "string"
 *               message:
 *                 type: "string"
 *               detail:
 *                 type: "string"
 *               help:
 *                 type: "string"
 *       required: ["status","data", "errors"]
 */
class ApiResult {
    /**
   *
   * @param {*} status
   * @param {*} data
   * @param {*} error : object from class ApiError
   */
    constructor (status, data, errors) {
        this.status = status;
        this.data = data;
        this.errors = [];

        if (errors && Array.isArray(errors)) {
            for (let i = 0; i < errors.length; i++) {
                this.errors.push(new ApiError(errors[i].code, errors[i].message, errors[i].detail, errors[i].help));
            }
        }
    }
}

module.exports = ApiResult;
