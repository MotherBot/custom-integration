const rp = require('request-promise');

const analyticsURL = 'ANALYTICS_URL';

module.exports = {
  saveMessage: conversation => {
    if (!analyticsURL || !conversation || !conversation.channelType) {
      return;
    }

    let botName = conversation.properties().botName;

    if (botName) {
      let channelType = conversation.channelType();
      let firstName = conversation.variable('profile.firstName');
      let lastName = conversation.variable('profile.lastName');
      let oracleBotId = conversation.request().botId;

      if (channelType == 'web') {
        firstName = 'Webchat';
        lastName = 'User';
      } else if (channelType == 'webhook') {
        firstName = 'Webhook';
        lastName = 'User';
      }

      let text = '';
      let type = 'text';

      // Check if payload is postback
      if (conversation.postback()) {
        let postback = conversation.postback();
        if (postback.action) {
          payload = postback.action;
        } else {
          text = postback;
        }
        type = 'postback';
      } else if (conversation.messagePayload()) {
        text = conversation.messagePayload().text;
      }

      console.log('firstName:', firstName);
      console.log('lastName:', lastName);

      rp({
        url: 'URL',
        method: 'POST',
        body: {
          type: type,
          externalBotId: oracleBotId,
          botName: botName,
          externalUserId: conversation.userId(),
          firstName: firstName,
          lastName: lastName,
          text: text,
          payload: conversation.messagePayload(),
          channelType: channelType
        },
        json: true
      }).catch(err => {
        console.log(err);
      });
    }
  },
  saveMessageCustom: (conversation, data) => {
    if (!analyticsURL || !conversation || !conversation.channelType) {
      return;
    }

    let channelType = conversation.channelType();
    let oracleBotId = conversation.request().botId;
    let text = data.text;
    let type = data.type;
    let byBot = data.byBot;

    rp({
      url: 'URL',
      method: 'POST',
      body: {
        type: type,
        externalBotId: oracleBotId,
        externalUserId: conversation.userId(),
        text: text,
        payload: data.payload,
        channelType: channelType,
        byBot: byBot
      },
      json: true
    }).catch(err => {
      console.log(err);
    });
  },
  saveNLPRequest: (conversation, nlpResponse) => {
    nlpResponse = nlpResponse.result;

    if (!analyticsURL || !conversation || !conversation.channelType) {
      return;
    }

    if (!nlpResponse || !nlpResponse.intent) {
      return;
    }

    let channelType = conversation.channelType();
    let oracleBotId = conversation.request().botId;

    rp({
      url: 'URL',
      method: 'POST',
      body: {
        externalUserId: conversation.userId(),
        externalBotId: oracleBotId,
        channelType: channelType,
        requestText: conversation.messagePayload().text,
        responseText: nlpResponse.intent.name,
        entities: nlpResponse.entities,
        confidence: nlpResponse.intent.confidence
      },
      json: true
    }).catch(err => {
      console.log(err);
    });
  }
};
