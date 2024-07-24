const axios = require('axios');
const logger = require('./logger');

/**
 * Sets the webhook URL for the Telegram bot.
 *
 * @param {string} token - The Telegram bot token.
 * @param {string} apiUrl - The API Gateway URL.
 * @returns {Promise<object>} - The response from the Telegram API.
 */
async function setTelegramWebhook(token, apiUrl) {
  try {
    const urlWithToken =  `${apiUrl}/webhook?token=${token}`;
    const response = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, { url : urlWithToken });
    return response.data;
  } catch (error) {
    logger.error(`Failed to set webhook: ${error.message}`);
    throw new Error(`Failed to set webhook: ${error.message}`);
  }
}



module.exports = { setTelegramWebhook };
