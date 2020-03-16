const rp = require('request-promise');
const analyticsRequest = require('./analyticsRequest');
const config = require('../config/config');

module.exports = (botId, text, conversation) => {
  const NLP_URL = conversation.variable('isLiveBot')
    ? config.NLP_URL_PROD
    : config.NLP_URL_TEST;

  return rp({
    uri: NLP_URL,
    method: 'POST',
    json: true,
    body: {
      query: text,
      botId: botId,
      token: 'TOKEN'
    }
  })
    .then(result => {
      conversation
        .logger()
        .log('NLPAPI got result:' + JSON.stringify(result, null, '\t'));

      if (conversation) {
        analyticsRequest.saveNLPRequest(conversation, result);
      }

      return result.result;
    })
    .catch(err => {
      conversation.logger().error('ERROR:' + err);

      return err;
    });
};
