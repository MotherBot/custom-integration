const rp = require('request-promise');
const config = require('../config/config');

module.exports = (botId, msg) => {
  rp({
    uri: config.SEND_LOG_URL,
    method: 'POST',
    headers: {
      Authorization: 'TOKEN'
    },
    body: { serviceId: botId, msg: '```' + msg + '```' },
    json: true
  }).catch(err => {
    console.log('[ERROR] Sending log error : ' + err);
  });
};
