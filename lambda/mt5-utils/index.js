const {processUpdate} = require('./process_update');
const logger = require('./logger');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    await processUpdate(body);

    return {
      statusCode: 200,
      body: JSON.stringify({message: 'Update processed'})
    };
  } catch (error) {
    logger.error('Error processing update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify(
          {message: 'Internal server error', error: error.message})
    };
  }
};
