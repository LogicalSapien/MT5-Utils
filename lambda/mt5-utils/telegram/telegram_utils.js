const axios = require('axios');
const logger = require('../logger');
const config = require('../config');

async function sendMessage(chatId, text, parseAsHtml = false) {
  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const data = {
    chat_id: chatId,
    text: text,
    parse_mode: parseAsHtml ? 'HTML' : 'Markdown' // Choose parse mode based on parseAsHtml flag
  };

  try {
    await axios.post(url, data);
  } catch (error) {
    logger.error(`Error sending message: ${error.message}`);
  }
}

module.exports = { sendMessage };
