const { setTelegramWebhook } = require('./webhook_utils');

exports.handler = async (event) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const apiUrl = process.env.API_GATEWAY_URL;

  try {
    const response = await setTelegramWebhook(token, apiUrl);
    return {
      statusCode: 200,
      body: JSON.stringify(response)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
