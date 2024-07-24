const {DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand, GetCommand
} = require("@aws-sdk/lib-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const logger = require('../logger');
const config = require('../config');
const {getIsoDateStr} = require("../trade/trade_utils");

const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);

async function saveChatMessageIfNotDuplicate(msg, additionalInfo = {}) {
  const paramsToSearch = {
    TableName: config.DYNAMODB_CHAT_MESSAGES_TABLE_NAME,
    Key: {
      messageId: msg.message_id
    }
  };

  // Check if message_id already exists
  const result = await dynamoDb.send(new GetCommand(paramsToSearch));
  if (result.Item) {
    logger.warn(`Message with message_id ${msg.message_id} already exists.`);
    throw new Error(
        `Duplicate request detected for message_id ${msg.message_id}, will be ignored`);
  }

  try {
    const paramsToSave = {
      TableName: config.DYNAMODB_CHAT_MESSAGES_TABLE_NAME,
      Item: {
        messageId: msg.message_id,
        chatId: msg.chat.id,
        username: msg.from.username,
        message: msg.text,
        date: getIsoDateStr(msg.date),
        timestamp: Date.now(),
        tradeExecuted: additionalInfo.tradeExecuted || false,
        ...additionalInfo
      },
      ConditionExpression: 'attribute_not_exists(messageId)' // Prevent overwriting existing records
    };

    await dynamoDb.send(new PutCommand(paramsToSave));
    return true;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error(`Message with message_id ${msg.message_id} already exists.`);
    } else {
      logger.error('Error saving chat message to DynamoDB:', error);
    }
    throw new Error('Failed to process message.');
  }
}

async function getLastMessages(username, limit = 5) {
  const params = {
    TableName: config.DYNAMODB_CHAT_MESSAGES_TABLE_NAME,
    IndexName: 'username-index',
    KeyConditionExpression: 'username = :username',
    ExpressionAttributeValues: {
      ':username': username.toString()
    },
    ExpressionAttributeNames: {
      '#ts': 'timestamp',
      '#dt': 'date'
    },
    ScanIndexForward: false,
    Limit: limit,
    ProjectionExpression: 'messageId, username, message, #dt, #ts, tradeExecuted' // Specify the attributes to retrieve
  };

  try {
    const result = await dynamoDb.send(new QueryCommand(params));
    return result.Items;
  } catch (error) {
    console.error("Error fetching last messages:", error);
    return [];
  }
}

async function markTradeExecuted(messageId) {
  const params = {
    TableName: config.DYNAMODB_CHAT_MESSAGES_TABLE_NAME,
    Key: {
      messageId: messageId
    },
    UpdateExpression: "set tradeExecuted = :tradeExecuted",
    ExpressionAttributeValues: {
      ":tradeExecuted": true
    },
    ReturnValues: "UPDATED_NEW"
  };
  await dynamoDb.send(new UpdateCommand(params));
}

module.exports = {
  saveChatMessageIfNotDuplicate,
  getLastMessages,
  markTradeExecuted
};
