'use strict';

const MIN_NLP_CONFIDENCE = 0.5;
const NLPAPI = require('../helpers/NLPAPI.js');
const sendLog = require('../helpers/sendLog');


const blockNameToId = {
  "EXAMPLE_BLOCK": "BLOCK_ABCD",
};

const contextualMapping = {
  "EXAMPLE_BLOCK": {
    "CONTEXTUAL_INTENT_1": "BLOCK_X",
    "CONTEXTUAL_INTENT_2": "BLOCK_Y",
    "entities": {
      "ENTITY_1": "BLOCK_A",
      "ENTITY_2": "BLOCK_B"
    },
    "fallback": "EXAMPLE_FALLBACK_BLOCK" // When in 'EXAMPLE_BLOCK' and confidence is low and there's no other block to go to, use this fallback instead of the generic one
  }
};


//custom logic for current state
const processForCurrent = {
  "BLOCK_A": {
    "process": async (conversation) => {
      // perform logic
      // return name of block if transition resolved or return fallback

      let success = true;
      let resolvedState = "BLOCK_B";

      if (success) {
        return resolvedState
      } else {
        return { fallback: "FALLBACK_STATE" };
      }

    }
  }
}

//custom logic for detected state
const processForDetected = {
  "BLOCK_A": {
    "process": async (conversation) => {
      // perform logic
      // return name of block if transition resolved or return fallback

      let success = true;
      let resolvedState = "BLOCK_B";

      if (success) {
        return resolvedState
      } else {
        return { fallback: "FALLBACK_STATE" };
      }

    }
  }
}

function blockIdToName(id) {
  for (let i in blockNameToId)
    if (blockNameToId[i] === id)
      return i;
  return id;
}

module.exports = {
  metadata: () => ({
    name: 'BotSupplyNLPTemplate',
    properties: {
      botId: { type: 'string', required: true },
      minConfidence: { type: 'string' },
      fallbackMessage: { type: 'string' },
      sheetKeyfilePath: { type: 'string' },
      sheetId: { type: 'string' }
    },
    supportedActions: []
  }),

  invoke: async (conversation, done) => {
    const { log } = conversation.logger();

    let properties = conversation.properties();
    let botId = '';
    try {
      botId = properties && properties.botId ? properties.botId : conversation.variable('cmsBotId');
    } catch (e) {
      botId = conversation.variable('cmsBotId');
    }
    log(`botId: ${botId}`);
    let messagePayload = conversation.request().message.messagePayload;
    let text;
    let transitionTo = null;
    let keepTurn = true;
    let currentState = conversation.variable("currentState");
    log("CurrentState: " + currentState);

    if (messagePayload.type == 'text') {
      text = messagePayload.text;
    } else if (messagePayload.type == 'postback') {
      transitionTo = messagePayload.action || messagePayload.postback.action;
      conversation.keepTurn(keepTurn);
      conversation.variable("currentState", transitionTo);
      log('TRANSITIONING TO ' + transitionTo);
      conversation.transition(transitionTo);
      return done();
    }
    NLPAPI(botId, text, conversation).then(async response => {
        let goToTransition = {};

        //convert BLOCK_ to name
        currentState = blockIdToName(currentState)
        log("CurrentState Finally: " + currentState);


        if (processForCurrent[currentState] && processForCurrent[currentState]["process"]) {
          log("Found a process function for current state, using it.");
          goToTransition = await processForCurrent[currentState]["process"](conversation, text, response);
          if (typeof goToTransition !== "object") { // if we get object then there is failure.
            return transitionTo = goToTransition
          }
        }

        let detectedState = blockIdToName(response.intent.name)
        if (processForDetected[detectedState] && processForDetected[detectedState]["process"]) {
          log("Found a process function for detected state, using it.");
          let newTransition = await processForDetected[detectedState]["process"](conversation, text, response);
          if (typeof newTransition !== "object") { // if we get object then there is failure.
            return transitionTo = newTransition
          }
        }
        if (!response)
          return transitionTo = goToTransition.fallback || (contextualMapping[currentState] ? contextualMapping[currentState]["fallback"] : null)
            || "Unresolved";


        if (contextualMapping[currentState]) {
          log("Found contextualMapping entry, for current state, checking contextual dataset");
          let contextualResponse = await NLPAPI(botId + "_contextual", text, conversation);
          let redirect = undefined;
          if (!contextualResponse)
            log("Contextual errored out, skipping it");
          else if (contextualResponse.fsd > MIN_NLP_CONFIDENCE) {
            log(`Contextual intent with >50% Confidence: ${contextualResponse.intent.name}`);
            redirect = contextualMapping[currentState][contextualResponse.intent.name];
          } else if (contextualMapping.entities) {
            response.entities.forEach(e => {
              if (contextualMapping.entities[e.entity] !== undefined) {
                redirect = contextualMapping.entities[e.entity];
              }
            })
          }

          if (redirect) {
            log(`Found redirect: ${redirect}, going to it.`);
            return transitionTo = redirect;
          }
        }
        if (response.fsd < MIN_NLP_CONFIDENCE) {
          return transitionTo = goToTransition.fallback || (contextualMapping[currentState] ? contextualMapping[currentState]["fallback"] : null)
            || "Unresolved";
        }

        transitionTo = response.intent.name;
      }
    )
    .then(() => {
      let transitionToId = transitionTo, transitionToName = null;
      if (blockNameToId[transitionTo]) {
        transitionToId = blockNameToId[transitionTo];
        transitionToName = transitionTo;
      }
      log('NLP TRANSITIONING TO:', (transitionToName ? transitionToName + ", " : "") + transitionToId);
      conversation.keepTurn(keepTurn);
      conversation.variable("currentState", transitionToId);
      conversation.transition(transitionToId);
      done();
    })
    .catch((e) => {
      log('ERROR: ' + e.stack);
      conversation.logger().log(e.stack);
      log("sending log", conversation.variable('user.oracleBotId'));
      sendLog(conversation.variable('user.oracleBotId'), e.stack);
      conversation.reply({ text: 'Something bad happened.' });
      done();
    })
  }
};
