const {
  handleMessage,
  handleStart,
  handleHelp,
  handleTrade,
  handleCalculate,
  handleCancel,
  handleTradeLast,
  handleCalculateLast,
  handleFetchConfig,
  handleFetchMT5Details,
  handleFetchAccountMetrics
} = require('./handle_message');
const logger = require('./logger');
const config = require("./config");
const {sendMessage} = require("./telegram/telegram_utils");

async function processUpdate(body) {
  try {
    logger.info('Processing update:', JSON.stringify(body));

    const message = body.message || body.edited_message;

    if (message) {
      if (message.text) {
        const username = message.from.username;
        const chatId = message.chat.id;
        if (username !== config.AUTHORIZED_TELEGRAM_USER) {
          await sendMessage(chatId, "You are not authorized to use this bot!");
        }else if (message.text === '/start') {
          await handleStart(message);
        } else if (message.text === '/help') {
          await handleHelp(message);
        } else if (message.text === '/trade') {
          await handleTrade(message);
        } else if (message.text === '/calculate') {
          await handleCalculate(message);
        } else if (message.text === '/cancel') {
          await handleCancel(message);
        } else if (message.text === '/tradelast') {
          await handleTradeLast(message);
        } else if (message.text === '/calculatelast') {
          await handleCalculateLast(message);
        } else if (message.text === '/fetchconfig') {
          await handleFetchConfig(message);
        } else if (message.text === '/fetchmt5details') {
          await handleFetchMT5Details(message);
        } else if (message.text === '/fetchaccountmetrics') {
          await handleFetchAccountMetrics(message, 'concise');
        } else if (message.text === '/fetchaccountmetricsdetailed') {
          await handleFetchAccountMetrics(message, 'detailed');
        } else {
          await handleMessage(message);
        }
      }
    }

    logger.info('Update processed successfully');
  } catch (error) {
    logger.error('Error processing update:', error);
    throw new Error('Internal server error');
  }
}

module.exports = {processUpdate};
