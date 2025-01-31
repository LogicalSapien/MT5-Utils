const { saveChatMessageIfNotDuplicate, getLastMessages, markTradeExecuted } = require('./db/dynamo_db');
const { parseTradeSignal, getIsoDateStr } = require('./trade/trade_utils');
const { handleMt5TraderTrade } = require('./trade/mt5_terminal');
const { sendMessage } = require('./telegram/telegram_utils');
const logger = require('./logger');
const config = require('./config');

const PLACE_TRADE_MESSAGE = `🚀 Please enter the trade you would like to place in the following format:

📊 **Trade Type**: \`BUY/SELL\` 
🔢 **Symbol**: \`SYMBOL\`
💰 **Entry Price**: \`@ EntryPrice\`

🎯 **Take Profit Levels**:
✅ **TP1**: \`TakeProfit1\`
✅ **TP2**: \`TakeProfit2\`
✅ **TP3**: \`TakeProfit3\`

🔻 **Stop Loss**: \`SL: StopLoss\`

💼 **Optional Risk Control**:
🔒 **Max Risk**: \`MaxRisk\` (Specify the maximum amount to risk for this trade)
📏 **Lot Size**: \`LotSize\` (Specify the lot size for the trade)

🆔 **Signal Source**:
📝 **Source**: \`SourceName\`

Example:
\`\`\`
Source: 1000pipBuilder
BUY EURUSD @ 1.1200
TP1: 1.1250
TP2: 1.1300
TP3: 1.1350
SL: 1.1150
MaxRisk: 20
LotSize: 0.5
\`\`\`

📌 **Notes**:
- Use the optional \`MaxRisk\` field to limit your risk on the trade.
- Use the optional \`LotSize\` field to specify the exact lot size you want to trade.
- If no \`MaxRisk\` or \`LotSize\` is provided, default settings will be applied.
- **Source** is required to identify the signal provider.
`;

async function handleMessage(message) {
  logger.info('handleMessage');
  const chatId = message.chat.id;
  const username = message.from.username;
  const text = message.text;

  if (text.startsWith('/')) {
    await sendMessage(chatId, "Invalid command!");
    return;
  }

  try {
    // Check and save the message if not a duplicate
    await saveChatMessageIfNotDuplicate(message);

    const lastMessages = await getLastMessages(username, 5);

    if (lastMessages.length > 0) {
      const previousMessage = lastMessages[0]; // Get the most recent message
      const lastState = determineLastState(previousMessage);

      if (!lastState) {
        await handleNewSignal(chatId, text, message.date, message.message_id);
      } else {
        await processLastState(lastState, text, chatId, lastMessages, message.message_id, message.date);
      }
    }
  } catch (error) {
    logger.error('Error handling message:', error);
    await sendMessage(message.chat.id, `<pre>"An error occurred. "${error}</pre>`, true);
  }
}

function determineLastState(message) {
  switch (message.message.toLowerCase()) {
    case '/trade':
      return 'trade';
    case '/calculate':
      return 'calculate';
    case '/tradelast':
      return 'tradelast';
    case '/calculatelast':
      return 'calculatelast';
    default:
      return null;
  }
}

async function handleNewSignal(chatId, text, signalDate, messageId) {
  const trade = parseTradeSignal(text, getIsoDateStr(signalDate));
  if (!trade) {
    await sendMessage(chatId, "Invalid trade format. Please use the correct format.");
    await sendMessage(chatId, PLACE_TRADE_MESSAGE);
    return;
  }

  // ✅ Check if "/tradethis" is in the message
  if (text.includes("/tradethis")) {
    logger.info("⚡ Trade execution triggered by '/tradethis'");
    
    // ✅ Execute trade immediately
    const executedTrade = await handleMt5TraderTrade(chatId, trade, true, messageId);
    
    if (executedTrade) {
      await markTradeExecuted(messageId);
      await sendMessage(chatId, "✅ Trade executed successfully.");
    } else {
      await sendMessage(chatId, "❌ Trade execution failed.");
    }

    return; // ✅ Do not proceed further (Skip sending /tradelast option)
  }

  // Automatically perform the calculation
  // const updatedTrade = await handleMetaTraderTrade(chatId, trade, false, messageId);
  // switching to new
  const updatedTrade = await handleMt5TraderTrade(chatId, trade, false, messageId);
  
  if (updatedTrade && updatedTrade.totalProfit > updatedTrade.potentialTotalLoss) {
    // Automatically execute the trade if profit is greater than loss
    // await handleMetaTraderTrade(chatId, updatedTrade, true, messageId);
    // switching to new
    await handleMt5TraderTrade(chatId, updatedTrade, true, messageId);
    await markTradeExecuted(messageId);
    await sendMessage(chatId, "Trade executed automatically as the potential profit is greater than the potential loss.");
  } else {
    // Provide the /tradelast option
    await sendMessage(chatId, "Do you want to trade this signal? Use /tradelast to confirm.");
  }
}

async function processLastState(lastState, text, chatId, lastMessages, messageId, signalDate) {
  switch (lastState) {
    case 'trade':
      await executeTrade(text, chatId, messageId, signalDate);
      break;
    case 'calculate':
      await calculateTrade(text, chatId, signalDate, messageId);
      break;
    case 'calculatelast':
      await handleCalculateLastFromMessages(lastMessages, chatId);
      break;
    default:
      await handleNewSignal(chatId, text, signalDate, messageId);
      break;
  }
}

async function executeTrade(text, chatId, messageId, signalDate) {
  const trade = parseTradeSignal(text, getIsoDateStr(signalDate));
  if (trade) {
    // await handleMetaTraderTrade(chatId, trade, true, messageId);
    // switching to new
    await handleMt5TraderTrade(chatId, trade, true, messageId);    
    await markTradeExecuted(messageId);
  } else {
    await sendMessage(chatId, "Invalid trade format. Please use the correct format.");
  }
}

async function calculateTrade(text, chatId, signalDate, messageId) {
  const calculation = parseTradeSignal(text, getIsoDateStr(signalDate));
  if (calculation) {
    // const updatedTrade = await handleMetaTraderTrade(chatId, calculation, false, messageId);
    // switching to new
    const updatedTrade = await handleMt5TraderTrade(chatId, calculation, false, messageId);    
    // Only calculate without executing the trade
    if (updatedTrade) {
      await sendMessage(chatId, "Calculation completed. Potential profit and loss have been calculated.");
    } else {
      await sendMessage(chatId, "Invalid trade format. Please use the correct format.");
    }
  } else {
    await sendMessage(chatId, "Invalid trade format. Please use the correct format.");
  }
}

async function handleStart(message) {
  logger.info('handleStart');
  await saveChatMessageIfNotDuplicate(message);
  await sendMessage(message.chat.id, "Welcome to the SignalSorcerer, the Signal to MT5 Automator Telegram Bot! Use /help for instructions.");
}

async function handleHelp(message) {
  logger.info('handleHelp');
  await saveChatMessageIfNotDuplicate(message);
  const helpMessage = `This bot is used to automatically enter trades onto your MetaTrader account directly from Telegram. Use the following commands:
    /start - Displays welcome message
    /help - Displays help message
    /trade - Enter a trade
    /calculate - Calculate trade information without entering it
    /cancel - Cancel the current operation
    /tradelast - Trade the last calculated signal
    /calculatelast - Calculate the last trade signal
    /fetchconfig - Fetch the current configuration (except API keys and tokens)`;
  await sendMessage(message.chat.id, helpMessage);
}

async function handleTrade(message) {
  logger.info('handleTrade');
  await saveChatMessageIfNotDuplicate(message);
  await sendMessage(message.chat.id, PLACE_TRADE_MESSAGE);
}

async function handleCalculate(message) {
  logger.info('handleCalculate');
  await saveChatMessageIfNotDuplicate(message);
  await sendMessage(message.chat.id, PLACE_TRADE_MESSAGE);
}

async function handleCancel(message) {
  logger.info('handleCancel');
  await saveChatMessageIfNotDuplicate(message);
  await sendMessage(message.chat.id, "Operation cancelled.");
}

async function handleTradeLast(message) {
  logger.info('handleTradeLast');
  const username = message.from.username;
  try {
    await saveChatMessageIfNotDuplicate(message);
    const lastMessages = await getLastMessages(username);
    const lastTradeSignal = lastMessages.find(
        (msg) =>
            msg.message.includes('BUY') ||
            msg.message.includes('SELL') ||
            msg.message.includes('Long') ||
            msg.message.includes('Short')
    );

    if (lastTradeSignal) {
      if (lastTradeSignal.tradeExecuted) {
        await sendMessage(message.chat.id, "The last trade signal has already been executed.");
      } else {
        const trade = parseTradeSignal(lastTradeSignal.message, lastTradeSignal.date);
        if (trade) {
          // await handleMetaTraderTrade(message.chat.id, trade, true, lastTradeSignal.messageId);
          // switching to new
          await handleMt5TraderTrade(message.chat.id, trade, true, lastTradeSignal.messageId);          
          await markTradeExecuted(lastTradeSignal.messageId);
        } else {
          await sendMessage(message.chat.id, "Invalid trade format in the last signal.");
          await sendMessage(message.chat.id, PLACE_TRADE_MESSAGE);
        }
      }
    } else {
      await sendMessage(message.chat.id, "No trade signal found. Please send a new trade signal.");
      await sendMessage(message.chat.id, PLACE_TRADE_MESSAGE);
    }
  } catch (error) {
    logger.error('Error fetching previous state:', error);
    await sendMessage(message.chat.id, `<pre>"An error occurred. "${error}</pre>`, true);
  }
}

async function handleCalculateLast(message) {
  logger.info('handleCalculateLast');
  const username = message.from.username;

  try {
    await saveChatMessageIfNotDuplicate(message);
    const lastMessages = await getLastMessages(username);
    await handleCalculateLastFromMessages(lastMessages, message.chat.id);
  } catch (error) {
    logger.error('Error fetching previous state:', error);
    await sendMessage(message.chat.id, `<pre>"An error occurred. "${error}</pre>`, true);
  }
}

async function handleCalculateLastFromMessages(lastMessages, chatId) {
  const lastTradeSignal = lastMessages.find(
      (msg) => msg.message.includes('BUY') || msg.message.includes('SELL')  || msg.message.includes('Long')  || msg.message.includes('Short')
  );

  if (lastTradeSignal) {
    const calculation = parseTradeSignal(lastTradeSignal.message, lastTradeSignal.date);
    if (calculation) {
      // const updatedTrade = await handleMetaTraderTrade(chatId, calculation, false, lastTradeSignal.messageId);
      // switching to new
      const updatedTrade = await handleMt5TraderTrade(chatId, calculation, false, lastTradeSignal.messageId);      
      // Only calculate without executing the trade
      if (updatedTrade) {
        await sendMessage(chatId, "Calculation completed. Potential profit and loss have been calculated.");
      } else {
        await sendMessage(chatId, "Invalid trade format in the last signal.");
      }
    } else {
      await sendMessage(chatId, "Invalid trade format in the last signal.");
    }
  } else {
    await sendMessage(chatId, "No trade signal found. Please send a trade signal first.");
  }
}

async function handleFetchConfig(message) {
  logger.info('handleFetchConfig');
  try {
    await saveChatMessageIfNotDuplicate(message);
    const chatId = message.chat.id;
    const configMessage = `
Current Configuration:
======================
- RISK_FACTOR: ${config.RISK_FACTOR}
- PIP_VALUE: ${config.PIP_VALUE}
- MIN_POSITION_SIZE: ${config.MIN_POSITION_SIZE}
- ROUND_POSITION_SIZE: ${config.ROUND_POSITION_SIZE}
- ROUND_POSITION_SIZE_FACTOR: ${config.ROUND_POSITION_SIZE_FACTOR}
- MAX_POSITION_SIZE: ${config.MAX_POSITION_SIZE}
- CURRENCY_NAME: ${config.CURRENCY_NAME}
- CURRENCY_SYMBOL: ${config.CURRENCY_SYMBOL}
- ENABLE_TRADE_EXECUTION: ${config.ENABLE_TRADE_EXECUTION}
- TRADE_SYMBOL_SUFFIX: ${config.TRADE_SYMBOL_SUFFIX}
- SIGNAL_PROVIDERS: ${config.SIGNAL_PROVIDERS}
- ALLOWED_SYMBOLS: ${config.ALLOWED_SYMBOLS.join(', ')}
`;
    await sendMessage(chatId, `<pre>${configMessage}</pre>`, true);
  } catch (error) {
    await sendMessage(message.chat.id, `<pre>"An error occurred. "${error}</pre>`, true);
  }
}

async function handleFetchMT5Details(message) {
  logger.info('handleFetchMT5Details');
  const chatId = message.chat.id;
  try {
    await saveChatMessageIfNotDuplicate(message);
    // Fetch MetaTrader account details
    await sendMessage(chatId, `<pre>Not Confiured</pre>`, true);
  } catch (error) {
    logger.error('Error fetching MetaTrader account details:', error);
    await sendMessage(message.chat.id, `<pre>"An error occurred. "${error}</pre>`, true);
  }
}

async function handleFetchAccountMetrics(message, type) {
  logger.info('handleFetchAccountMetrics');
  const chatId = message.chat.id;
  try {
    await saveChatMessageIfNotDuplicate(message);
    // Fetch MetaTrader account details
    await sendMessage(chatId, `<pre>Not Configured</pre>`, true);
  } catch (error) {
    logger.error('Error fetching MetaTrader account metrics:', error);
    await sendMessage(message.chat.id, `<pre>"An error occurred. "${error}</pre>`, true);
  }
}

module.exports = {
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
};