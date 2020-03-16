"use strict";

const analyticsRequest = require("../helpers/analyticsRequest");
const sendLog = require('../helpers/sendLog');

let defaultState = 'nlp';

const inputVarToState = {
  "variableName": "BLOCK_NAME"
};

const getState = (payload, states = []) => {
  console.log('getState() payload:', payload);
  let ret = defaultState;
  if (states.indexOf(payload) > -1) {
    ret = payload;
  }

  return new Promise((resolve, reject) => {
    resolve(ret)
  })
};

module.exports = {
  metadata: () => ({
    "name": "BotSupplySwitchPayloadTemplate",
    "properties": {
      "switchStates": {"type": "string", "required": false},
      "defaultState": {"type": "string", "required": false},
      "botId": {"type": "string", "required": false},
      "botName": {"type": "string", "required": false}
    },
    "supportedActions": [
      "state1",
      "state2",
      "state3"
    ]
  }),

  invoke: (conversation, done) => {
    const {log} = conversation.logger();
    log(`userId: ${conversation.userId()}`)
    try {
      log("SWITCHPAYLOAD INVOKED -> PAYLOAD: ", conversation.messagePayload());
      let keepTurn = true;
      let payload = '';

      let properties = conversation.properties();
      let type = 'text';

      // Check if payload is postback
      log("conversation.postback():", conversation.postback());
      // Check if payload is postback
      if (conversation.postback()) {
        let postback = conversation.postback();
        payload = postback;

        if (postback.action) {
          payload = postback.action;
        }
        type = 'postback';
      }

      // else, check if payload is text (input)
      else if (conversation.messagePayload()) {
        payload = conversation.messagePayload().text;
      }

      // attempt to log analytics by making request to analytics API
      analyticsRequest.saveMessage(conversation);

      // let switchStates = conversation.properties().switchStates.split(',');
      let switchStatesRaw = conversation.properties().switchStates;
      let switchStates = [];

      if (Array.isArray(switchStatesRaw)) {
        switchStates = switchStatesRaw;
      } else if (switchStatesRaw !== null && typeof switchStatesRaw === 'object') {
        for (let name in switchStatesRaw) {
          if (switchStatesRaw.hasOwnProperty(name)) {
            switchStates.push(switchStatesRaw[name]);
            if (name != switchStatesRaw[name] && switchStates.indexOf(name) == -1) {
              switchStates.push(name);
            }
          }
        }
      } else {
        switchStates = conversation.properties().switchStates.split(',');
      }

      if (conversation.properties().defaultState) {
        defaultState = conversation.properties().defaultState;
      }

      let state = defaultState;

      getState(payload, switchStates)
      .then((_state) => {
        state = _state;
      })
      .then(() => {

        let awaitingInput = conversation.variable("awaitingInput");

        if (awaitingInput && awaitingInput != defaultState) {
          let inputVariable = conversation.variable("inputVariable");

          state = inputVarToState[inputVariable] || state;

          let txt = '';
          if (conversation.postback()) {
            txt = conversation.postback();
            if (conversation.postback().variables && conversation.postback().variables.state) {
              txt = conversation.postback().variables.state;
            }

          } else if (conversation.messagePayload()) {
            let mp = conversation.messagePayload();
            if (mp.text) {
              txt = mp.text;
            }
          }

          if (inputVariable) {
            conversation.variable(inputVariable, txt);
          }

          return state;
        }
        return state;
      })
      .then(() => {
        log('STATE: ', state);
        conversation.keepTurn(keepTurn);
        conversation.transition(state);
        done();
      })
    } catch (e) {
      log(e.stack);
      log("sending log", conversation.variable('user.oracleBotId'));
      sendLog(conversation.variable('user.oracleBotId'), e.stack);
      conversation.reply({text: 'Something bad happened.'});
      done();
    }
  }
};
