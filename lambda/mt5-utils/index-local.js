const express = require('express');
const bodyParser = require('body-parser');
const ngrok = require('@ngrok/ngrok');
const logger = require('./logger');
const config = require('./config');
const { processUpdate } = require('./process_update');
const { setTelegramWebhook } = require('../set-webhook-for-telegram-bot/webhook_utils');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.post(`/webhook`, async (req, res) => {

  const token = req.query.token;

  if (token !== config.TELEGRAM_BOT_TOKEN) {
    return res.status(403).send('Unauthorized');
  }

  try {
    await processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    logger.error('Error processing update:', error);
    res.sendStatus(500);
  }
});

app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);

  try {
    const listener = await ngrok.connect({
      authtoken_from_env: true,
      addr: PORT
    });
    logger.info(`Ngrok URL: ${listener.url()}`);
    const response = await setTelegramWebhook(config.TELEGRAM_BOT_TOKEN, listener.url());
    logger.info('Webhook set successfully:', response);
  } catch (error) {
    logger.error('Error setting webhook:', error);
  }
});
