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

 * State machine that implements the control of movement pickings
 * originated in Onion so that when in the RF screen of pickings
 * an operator selects the orders he wants to prepare, Onion will send
 * the movements you have to prepare and the corresponding PTLs will be activated,
 * each operator will have a different color,
 * if the PTL has only one movement pending, the led will be fixed, but
 * if you have more than one, it will blink and with the F key the operator can choose
 * which of the movements wants to perform.
 * If a different amount than the initial one is to be taken, the operator, with the
 * keys + and - will be able to modify the amount.
 * Movements can be canceled from Onion.
 *
 * V1: 03/04/2023
 */
const logger = require('../../api/logger');
const constantsPTL = require('../../api/constantsPTL');
const axios = require('axios');
// import axios from 'axios';

const SAVE_MOVS_INTO_DB = 1;

/**
 * Function that returns the initial state needed by this module
 * @returns : the initial state needed by this module
 */
function getInitialState (controlPTL, dataPTL, connection, config) {
    const state = {
        pickers: [], // guardem objectes per player amb el color, l'hora inici, l'hora fi i el temps dedicat
        // cada player té un objecte amb els camps:
        // { ledLightColor, ptlSequence, currentSeq, beginDateTime, endDateTime }
        controlPTL,
        dataPTL,
        connection,

        // Llista amb els moviments enviats des de Onion i pendents de ser confirmats per part dels operais mitjançant els PTL o Onion
        // Cada element és un objecte JSON del tipus: {
        //   ptl,
        //   externalId,
        //   userId,
        //   color,
        //   locationCode,
        //   display,
        //   quantity,
        //   quantityPTL,
        //   active
        // }
        movements: [],

        // Llista amb les respostes dels moviments pendents d'entregar a Onion
        movements2Onion: [],

        // Configuració per comunicar amb Onion
        onionConfig: config.onion,

        // Configuration parámeters for this mode
        // Expected: {
        //   enableAddKey: true,     // if enabled the operator can press + key to increase quantity
        //   enableSubkey: true,     // if enabled the operator can press - key to decrease quantity
        //   enableFunctionKey: true // if enabled the operator cak press F key to switch between movements if there are more than once on a PTL
        // }
        modeConfig: config.mode.configuration
    };

    return state;
};

/**
 * Function to load all movements in the table 'msg_received' in memory and sento to PTL
 * This function is made to be called when the app starts and has movements pending to execute.
 * @param {*} state
 */
async function reloadMovements (state) {
    // Recuperem els moviments guardats a BD pendents de processar
    const movsReceived = await state.dataPTL.getMovementsReceivedFromOnion(state.connection, 1000, 0);
    logger.info(`pick2lightonion : reloadMovements : found ${(movsReceived && movsReceived.movements && movsReceived.movements.length ? movsReceived.movements.length : '0')} movements to send to PTLs`);
    if (movsReceived && movsReceived.status === 'OK') {
        movsReceived.movements.forEach(m => {
            // state.movements.push(m.message);
            addMovement(state, m.message, SAVE_MOVS_INTO_DB);
        });
    }
}

/**
 * Adds a movement to the queue and sends a message to PTL is needed
 * @param {*} movement : JSON object {
 *   ptl
 *   externalId,
 *   userId,
 *   color,
 *   locationCode,
 *   display,
 *   quantity
 * }
 */
async function addMovement (state, movement, saveMovsIntoDB) {
    // Check if the externalId is repeated inside the queue
    const movementFound = state.movements.find(m => m.externalId === movement.externalId);
    if (movementFound) {
        logger.error(`pick2lightonion : addMovement : Cannot send the movement beacuse it exists with the same externalId ${movement.externalId}`);
        return {
            result: constantsPTL.RETURN_ERROR,
            message: `Cannot send the movement beacuse it exists with the same externalId ${movement.externalId}`
        };
    }

    // Save the movement into de queue
    movement.active = 0; // Set to inactive by default

    // Set the movement.id value
    if (movement.id === undefined || movement.id === null) {
        movement.id = movement.externalId;
    }

    state.movements.push(movement);

    if (saveMovsIntoDB === 0) {
    // On startup we load the movements from the database but don't save into the DB
        await state.dataPTL.saveMovementReceivedFromOnion(state.connection, movement);
    }

    // Check if must send a message to the PTL:
    // - If the PTL has not any message => Error
    // - If the PTL has one message => send the new message
    // - If the PTL has two or more messages => send the first message blinking
    const messagesToPTL = state.movements.filter(m => m.ptl.id === movement.ptl.id);
    if (messagesToPTL.length === 0) {
        logger.error(`pick2lightonion : addMovement : Error sending message to PTL ${JSON.stringify(movement.ptl)}, not found in queue "Movements"`);
        return {
            result: constantsPTL.RETURN_ERROR,
            message: `Error sending message to PTL ${JSON.stringify(movement.ptl)}, not found in queue "Movements"`
        };
    }

    // Get the message active
    let activeMessage = messagesToPTL.find(m => m.active === 1);
    if (activeMessage === undefined) {
        activeMessage = messagesToPTL[0];
        // Set active = 1 to the message displayed, inf no one is active active the first
        activeMessage.active = 1;
    }

    // Build the message to send to the PTL
    const blinking = getBlinkMode(messagesToPTL);
    const display = getDisplayFromMessage(activeMessage);

    const result = state.controlPTL.send(null, activeMessage.ptl.id, {
        type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK,
        display,
        ledLight: getElectrotecColorFromInteger(activeMessage.color), // Convertim el color Onion a color Electrotec
        ledBlinkMode: blinking,
        arrows: constantsPTL.ELECTROTEC_ARROWS_NONE,
        keySound: constantsPTL.ELECTROTEC_NO_SOUND,
        makeBeep: constantsPTL.ELECTROTEC_NO_BEEP
    });

    result.data = movement;

    return result;
};

/**
 * Adds a movement to the queue and sends a message to PTL is needed
 * @param {*} movement : JSON object {
 *   id,          // optional
 *   externalId,  // optional
 * }
 */
async function delMovement (state, movement, result) {
    // Check if the externalId is repeated inside the queue
    let movementIndexFound = -1;

    if (movement.externalId) {
        movementIndexFound = state.movements.findIndex(m => m.externalId.toString() === movement.externalId.toString());
    } else {
        movementIndexFound = state.movements.findIndex(m => m.id.toString() === movement.id.tostring());
    }
    if (movementIndexFound < 0) {
        logger.error(`pick2lightonion : delMovement : Cannot delete the movement beacuse not found id or externalId ${movement.externalId}`);
        return {
            result: constantsPTL.RETURN_NOT_FOUND,
            message: `Cannot delete the movement beacuse not found id or externalId ${movement.externalId}`,
            data: {}
        };
    }
    const movementFound = state.movements[movementIndexFound];

    // Delete the movement from de queue
    let movementDeleted = state.movements.splice(movementIndexFound, 1);
    // Save the object, not the array
    movementDeleted = (movementDeleted && movementDeleted.length > 0 ? movementDeleted[0] : null);

    await state.dataPTL.delMovementReceivedFromOnion(state.connection, movementDeleted, result);

    // Check if must send a message to the PTL:
    // - If the PTL has not any message => clear the display and led
    // - If the PTL has one message => send the message
    // - If the PTL has two or more messages => send the message blinking
    const messagesToPTL = state.movements.filter(m => m.ptl.id === movementFound.ptl.id);
    let blinking = constantsPTL.ELECTROTEC_NO_BLINK;
    let display = ' ';
    let color = constantsPTL.ELECTROTEC_COLOR_BLACK;

    if (messagesToPTL.length > 0) {
    // Get the message active
        let activeMessage = messagesToPTL.find(m => m.active === 1);
        if (activeMessage === undefined) {
            activeMessage = messagesToPTL[0];
        }
        // Set active = 1 to the message displayed
        activeMessage.active = 1;

        // Build the message to send to the PTL
        blinking = getBlinkMode(messagesToPTL);
        display = getDisplayFromMessage(activeMessage);
        color = getElectrotecColorFromInteger(activeMessage.color);
    }

    const sendResult = state.controlPTL.send(null, movementFound.ptl.id, {
        type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK,
        display,
        ledLight: color,
        ledBlinkMode: blinking,
        arrows: constantsPTL.ELECTROTEC_ARROWS_NONE,
        keySound: constantsPTL.ELECTROTEC_NO_SOUND,
        makeBeep: constantsPTL.ELECTROTEC_NO_BEEP
    });

    sendResult.data = movementFound;

    return sendResult;
};

function getDisplayFromMessage (activeMessage) {
    try {
        let display = (activeMessage.display ? activeMessage.display.trim() : '');
        if (display.length === 0) {
            display = activeMessage.quantity.toString();
        } else {
            display = activeMessage.display;
        }
        return display;
    } catch (ex) {
        logger.error(`pick2lightonion : getDisplayFromMessage : Exception ${ex.message}, input parameter activeMessage ${JSON.stringify(activeMessage)}`);
        throw ex;
    }
}

/**
 * Function that processes an action received form PTLs, WMS, ...
 * @param {*} state : current state, created with the function getInitialState()
 * @param {*} configuration : ptl shelf configuration
 * @param {*} action : action to be processed
 * @param {*} data : data to process the action, who sends the action and with what data
 *                   Who sends the event (a key pressed in a ptl, a message received from a WMS, ...)
 *                   If the sender is from a ptl must have ptl.id
 *                   key pressed (V, F, +, -)
 */
async function process (state, configuration, action, data) {
    // Use a object literal's function insterad a switch tio reduce read complexity
    const actions = {
        processKeyPessed: async function () {
            return await processKeyPressed(state, configuration, data.ptl, data.key);
        },
        reloadMovements: async function () {
            return await reloadMovements(state);
        },
        getMovements: async function () {
            return state.movements;
        },
        getMovementsPendingToSend: async function () {
            return await state.dataPTL.getMovementsToPendingToSendToOnion(state.connection, data.numMovs, data.page, data.onlyPendingToSend);
        },
        getMovementsPendingToSendArch: async function () {
            return await state.dataPTL.getMovementsToPendingToSendArchToOnion(state.connection, data.numMovs, data.page);
        },
        getMovementsReceivedFromOnion: async function () {
            return await state.dataPTL.getMovementsReceivedFromOnion(state.connection, data.numMovs, data.page);
        },
        getMovement: async function () {
            return state.movements.find(m => m.id.toString() === data.id.toString());
        },
        addMovement: async function () {
            return await addMovement(state, data.movement, data.saveMovsIntoDB);
        },
        delMovement: async function () {
            return await delMovement(state, data.movement, data.result);
        },
        sendMovToOnion: async function () {
            return await sendMovToOnion(data.onionConfig, data.movement, state);
        }
    };

    return await actions[action]();
};

async function processKeyPressed (state, configuration, ptl, keyPressed) {
    // Buscar missatges enviats al ptl
    const movements = state.movements.filter(m => m.ptl.id === ptl.id);
    if (movements.length <= 0) {
    // Si no te cap missatge ignorar la tecla
        console.log(`pick2lightonion : process : no messages found for ptl ${ptl.id}`);
        return;
    }

    let currentActiveMov = null;

    // Si té missatges processar la tecla
    switch (keyPressed.keys[0]) {
        case 'V': // Confirmem el missatge, l'apaguem i el confirmem a onion
            currentActiveMov = movements.find(m => m.active === 1);
            await delMovement(state, currentActiveMov, { reason: 'Confirmed in PTL by user', movement: currentActiveMov });

            // Informar a Onion de que s'ha confirmat la tasca
            // Nota: la funció internament té esperes fent el post,
            // però no ens interessa retornar el resultat, deixem log si hi ha error
            await sendMovToOnion(state.onionConfig, currentActiveMov, state);
            break;
        case 'F': // canviem el moviment actiu, si n'hi ha mes d'un
            if (state.modeConfig.enableFunctionKey === true) {
                activeNextMessage(movements, state);
            }
            break;
        case '+': // incrementem la quantitat del missatge actiu
            if (state.modeConfig.enableAddKey === true) {
                changeMessageQuantity(movements, 1, state);
            }
            break;
        case '-': // decrementem la quantitat del missatge actiu
            if (state.modeConfig.enableSubkey === true) {
                changeMessageQuantity(movements, -1, state);
            }
            break;
        default:
            logger.error(`pick2lightonion: process: key ${keyPressed.keys[0]} has not any implementation`);
            break;
    }
}

/**
 * Function that sends PTL confirmation to Onion
 * It does not return the response, if there is an error the message is saved to try again later
 * @param {*} onionConfig : configuration to send the message with an http message
 * @param {*} movement : message to send
 */
async function sendMovToOnion (onionConfig, movement, state) {
    const url = onionConfig.url + 'wfevent/executeEvent';
    const data = {
        wfEvent: onionConfig.wfEvent, // "PickingPTLConfirm", //wfEvent: "DoMovement",
        client: onionConfig.client,
        taskMovementId: movement.externalId,
        quantity: movement.quantity,
        userId: onionConfig.userId, // PTL service user ID, the movement userId is inside movement JSON
        movement
    };
    const config = {
        headers: {
            'Content-Type': 'application/json'
        },
        // httpsAgent: https.Agent({ rejectUnauthorized: false }),
        timeout: onionConfig.timeout
    };

    if (onionConfig.httpUser && onionConfig.httpPassword) {
        config.auth = { username: onionConfig.httpUser, password: onionConfig.httpPassword };
    }

    logger.info(`pick2lightonion: sendMovToOnion: Sending movement ${JSON.stringify(movement)}`);
    await axios.post(url, data, config)
        .then(async function (response) {
            logger.info(`pick2lightonion: sendMovToOnion: ok confirming movement ${JSON.stringify(data)} to onion ${url} with status ${response.status}`);
            await state.dataPTL.saveOkInMovementPendingToSendToOnion(state.connection, movement, {
                code: response.status,
                message: response.statusText
            });
        })
        .catch(async function (error) {
            logger.error(`pick2lightonion: sendMovToOnion: error ${error.message} confirming movement ${JSON.stringify(data)} to onion ${url}`);

            const result = {
                code: error.code,
                message: error.message
            };

            if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
                // "ECONNABORTED" => onion no ha respost amb el temps esperat i ha donat timeout esperant resposta
                // "ECONNREFUSED" => onion està apagat o no s'hi pot accedir
                await state.dataPTL.saveErrorInMovementPendingToSendToOnion(state.connection, movement, result);
                logger.info(`pick2lightonion: sendMovToOnion: ${error.code}, saving movement ${JSON.stringify(data)} to send in the future`);
            } else {
                // "ERR_BAD_RESPONSE" => Onion l'ha rebut però no l'ha processat per error intern, no el tornem a enviar
                await state.dataPTL.saveErrorAndNotResendInMovementPendingToSendToOnion(state.connection, movement, result);
                logger.info(`pick2lightonion: sendMovToOnion: ${error.code}, NO saving movement ${JSON.stringify(data)}`);
            }
        });
}

function activeNextMessage (movements, state) {
    if (movements.length > 0) {
    // Busquem l'índex del moviment actiu, el desactivem i activem el següent
        const currentActiveMov = movements.findIndex(m => m.active === 1);
        let newActiveMov = currentActiveMov + 1;
        if (newActiveMov > movements.length - 1) {
            newActiveMov = 0;
        }

        // Enviem el missatge actiu al PTL
        const blinking = getBlinkMode(movements);
        const result = state.controlPTL.send(null, movements[newActiveMov].ptl.id, {
            type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK,
            display: getDisplayFromMessage(movements[newActiveMov]),
            ledLight: getElectrotecColorFromInteger(movements[newActiveMov].color), // Convertim el color Onion a color Electrotec
            ledBlinkMode: blinking,
            arrows: constantsPTL.ELECTROTEC_ARROWS_NONE,
            keySound: constantsPTL.ELECTROTEC_NO_SOUND,
            makeBeep: constantsPTL.ELECTROTEC_NO_BEEP
        });
        logger.info(`pick2lightonion: activeNextMessage: result sending message to PTL ${JSON.stringify(result)}`);

        // Activem el nou missatge i desactivem l'antic
        movements[currentActiveMov].active = 0;
        movements[newActiveMov].active = 1;
    }
}

function changeMessageQuantity (movements, value, state) {
    if (movements.length > 0) {
    // Busquem l'índex del moviment actiu, el desactivem i activem el següent
        const currentActiveMov = movements.findIndex(m => m.active === 1);

        // Modifiquem la quantitat en base al valor
        let newQuantity = movements[currentActiveMov].quantity + value;
        if (newQuantity < 0) {
            newQuantity = 0;
        }
        movements[currentActiveMov].quantity = newQuantity;

        // Enviem el missatge actiu al PTL
        const blinking = getBlinkMode(movements);
        const result = state.controlPTL.send(null, movements[currentActiveMov].ptl.id, {
            type: constantsPTL.ELECTROTEC_MSGTYPE_DISPLAY_ACK,
            display: getDisplayFromMessage(movements[currentActiveMov]),
            ledLight: getElectrotecColorFromInteger(movements[currentActiveMov].color), // Convertim el color Onion a color Electrotec
            ledBlinkMode: blinking,
            arrows: constantsPTL.ELECTROTEC_ARROWS_NONE,
            keySound: constantsPTL.ELECTROTEC_NO_SOUND,
            makeBeep: constantsPTL.ELECTROTEC_NO_BEEP
        });
        logger.info(`pick2lightonion: changeMessageQuantity: result sending message to PTL ${JSON.stringify(result)}`);

        logger();
    }
}

function getBlinkMode (messagesToPTL) {
    return (messagesToPTL.length === 1 ? constantsPTL.ELECTROTEC_NO_BLINK : constantsPTL.ELECTROTEC_BLINK_0500);
}

/***
 * Converts a integer to Electrotec PTL color
 */
function getElectrotecColorFromInteger (color) {
    switch (color) {
        case 0:
            return constantsPTL.ELECTROTEC_COLOR_BLACK;
        case 1:
            return constantsPTL.ELECTROTEC_COLOR_BLUE;
        case 2:
            return constantsPTL.ELECTROTEC_COLOR_GREEN;
        case 3:
            return constantsPTL.ELECTROTEC_COLOR_CYAN;
        case 4:
            return constantsPTL.ELECTROTEC_COLOR_RED;
        case 5:
            return constantsPTL.ELECTROTEC_COLOR_MAGENTA;
        case 6:
            return constantsPTL.ELECTROTEC_COLOR_YELLOW;
        case 7:
            return constantsPTL.ELECTROTEC_COLOR_WHITE;
        default:
            return constantsPTL.ELECTROTEC_COLOR_BLACK;
    }
};

// Exportem les funcions públiques
module.exports = {
    process,
    getInitialState
};
