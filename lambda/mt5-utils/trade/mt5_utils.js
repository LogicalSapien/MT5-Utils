const { sendMessage } = require('../telegram/telegram_utils');
const MetaApi = require('metaapi.cloud-sdk').default;
const MetaStats = require('metaapi.cloud-sdk').MetaStats;
const config = require('../config');
const logger = require("../logger");

async function getMetaTraderApiConnection(chatId, retries = 5, delay = 10000) {
  const api = new MetaApi(config.META_API_KEY);
  const account = await api.metatraderAccountApi.getAccount(config.META_ACCOUNT_ID);
  await deployAccountIfNeeded(account);

  // Retry mechanism with exponential backoff
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sendMessage(chatId, `Connecting to MetaTrader... Attempt ${attempt}...`);
      await account.waitConnected();

      const connection = account.getRPCConnection();
      await connection.connect();
      await connection.waitSynchronized();

      await sendMessage(chatId, "Successfully connected to MetaTrader!");
      return { connection, account };
    } catch (error) {
      if (attempt === retries) {
        await sendMessage(chatId, `Failed to connect after multiple attempts : ${error}`);
        throw error;
      }
      await sendMessage(chatId, `Attempt ${attempt} failed. Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

async function deployAccountIfNeeded(account) {
  if (!['DEPLOYING', 'DEPLOYED'].includes(account.state)) {
    await account.deploy();
  }
}

async function getMetaTraderMetrics(chatId, type, retries = 5, delay = 10000) {
  if (type !== 'concise' && type !== 'detailed') {
    throw new Error("Invalid type. Expected 'concise' or 'detailed'.");
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const metaStats = new MetaStats(config.META_API_KEY);
      let metrics = await metaStats.getMetrics(config.META_ACCOUNT_ID);

      if (type === 'concise') {
        // Extract only the required fields
        metrics = {
          equity: metrics.equity,
          margin: metrics.margin,
          freeMargin: metrics.freeMargin,
          marginLevel: metrics.marginLevel,
          profit: metrics.profit,
          trades: metrics.trades,
          balance: metrics.balance,
          wonTradesPercent: metrics.wonTradesPercent,
          lostTradesPercent: metrics.lostTradesPercent,
          wonTrades: metrics.wonTrades,
          lostTrades: metrics.lostTrades,
          averageWin: metrics.averageWin,
          averageLoss: metrics.averageLoss,
          pips: metrics.pips,
          averageWinPips: metrics.averageWinPips,
          averageLossPips: metrics.averageLossPips,
          bestTrade: metrics.bestTrade,
          worstTrade: metrics.worstTrade,
          bestTradePips: metrics.bestTradePips,
          worstTradePips: metrics.worstTradePips,
          longWonTrades: metrics.longWonTrades,
          shortWonTrades: metrics.shortWonTrades,
          longTrades: metrics.longTrades,
          shortTrades: metrics.shortTrades,
          dailyGain: metrics.dailyGain,
          monthlyGain: metrics.monthlyGain,
          daysSinceTradingStarted: metrics.daysSinceTradingStarted,
          equityPercent: metrics.equityPercent,
          averageTradeLengthInMilliseconds: metrics.averageTradeLengthInMilliseconds,
          lots: metrics.lots,
          deposits: metrics.deposits
        };
      } else {
        const fieldsToDelete = ['currencySummary', 'dailyGrowth',
          'monthlyAnalytics', 'riskOfRuin', 'openTradesByHour',
          'closeTradesByWeekDay', 'tradeDuration', 'tradeDurationDiagram'];

        fieldsToDelete.forEach(field => {
          delete metrics[field];
        });
      }

      return JSON.stringify(metrics, null, 2);
    } catch (error) {
      if (attempt === retries) {
        await sendMessage(chatId,
            `Failed to connect after multiple attempts : ${error}`);
        throw error;
      }
      await sendMessage(chatId,
          `Attempt ${attempt} failed. Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

async function handleMetaTraderTrade(chatId, trade, executeTrade, messageId) {
  logger.info('handleMetaTraderTrade');
  let connection, account;
  try {
    logger.info('calling getMetaTraderApiConnection');
    ({ connection, account } = await getMetaTraderApiConnection(chatId));
    logger.info('calling getAccountInformation');
    const accountInfo = await connection.getAccountInformation();
    const balance = accountInfo.balance;

    logger.info('calling calculateTradeParameters');
    const updatedTrade = await calculateTradeParameters(trade, connection, balance);

    await sendMessage(chatId, "Calculating trade risk...");

    logger.info('calling createTradeInfoTable');
    const tradeInfoTable = createTradeInfoTable(updatedTrade, balance);
    await sendMessage(chatId, `<pre>${tradeInfoTable}</pre>`, true);

    if (executeTrade) {
      if (config.ENABLE_TRADE_EXECUTION) {
        logger.info('calling placeTrade');
        await placeTrade(connection, updatedTrade, chatId, messageId);
      } else {
        await sendMessage(chatId, "Trade execution is currently disabled. No trades have been placed.");
      }
    }

  } catch (error) {
    console.error(`Error handling MetaTrader trade: ${error.message}`);
    await sendMessage(chatId, `There was an issue with the connection: ${error.message}`);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function calculateTradeParameters(trade, connection, balance) {
  trade.symbol += config.TRADE_SYMBOL_SUFFIX;
  const price = await connection.getSymbolPrice(trade.symbol);
  trade.currentEntry = trade.orderType === 'Buy' ? parseFloat(price.bid) : parseFloat(price.ask);

  const stopLossPips = Math.abs(
      (trade.stopLoss - trade.currentEntry) / (trade.symbol.includes('JPY') ? 0.01 : 0.0001)
  );

  // Calculate total risk amount based on balance and riskFactor unless maxRisk is provided
  const totalRiskAmount = trade.maxRisk ? trade.maxRisk : balance * trade.riskFactor;

  // If a lotSize is specified, use it instead of calculating position size
  const lastTpRiskProportion = 0.5;
  const remainingRiskProportion = 1 - lastTpRiskProportion;
  const numOtherTPs = trade.takeProfits.length - 1;

  const riskProportions = [];

  if (numOtherTPs > 0) {
    const riskPerOtherTP = remainingRiskProportion / numOtherTPs;
    for (let i = 0; i < trade.takeProfits.length; i++) {
      if (i === trade.takeProfits.length - 1) {
        riskProportions[i] = lastTpRiskProportion;
      } else {
        riskProportions[i] = riskPerOtherTP;
      }
    }
  } else {
    riskProportions[0] = 1;
  }

  const positionSizePerTP = [];
  let totalPositionSize = 0;
  const potentialLossPerTP = [];

  for (let i = 0; i < trade.takeProfits.length; i++) {
    const riskPerTP = totalRiskAmount * riskProportions[i];
    let positionSize;

    if (trade.lotSize) {
      // Use specified lot size if provided
      positionSize = trade.lotSize / trade.takeProfits.length;  // Equally distribute lot size across TPs
    } else {
      // Calculate position size based on risk
      positionSize = riskPerTP / (stopLossPips * config.PIP_VALUE);
    }

    // Apply rounding and limits
    if (config.ROUND_POSITION_SIZE) {
      if (positionSize < config.MIN_POSITION_SIZE) {
        positionSize = config.MIN_POSITION_SIZE;
      } else {
        const roundingFactor = config.MIN_POSITION_SIZE < 1 ? 0.1 : 1;
        positionSize = Math.floor(positionSize / roundingFactor) * roundingFactor;
      }
    }

    positionSize = Math.min(positionSize, config.MAX_POSITION_SIZE);
    positionSizePerTP[i] = positionSize;
    totalPositionSize += positionSize;

    // Calculate potential loss per TP
    potentialLossPerTP[i] = positionSize * config.PIP_VALUE * stopLossPips;
  }

  const potentialTotalLoss = potentialLossPerTP.reduce((a, b) => a + b, 0);

  trade.positionSizePerTP = positionSizePerTP;
  trade.potentialLossPerTP = potentialLossPerTP;
  trade.totalPositionSize = Math.round(totalPositionSize * 100) / 100;
  trade.potentialTotalLoss = potentialTotalLoss;
  trade.stopLossPips = stopLossPips;

  const takeProfitPips = trade.takeProfits.map(tp => Math.abs(
      (tp - trade.currentEntry) / (trade.symbol.includes('JPY') ? 0.01 : 0.0001)
  ));
  trade.takeProfitPips = takeProfitPips;

  const marginInfo = await connection.calculateMargin({
    symbol: trade.symbol,
    type: trade.orderType === 'Buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
    volume: trade.totalPositionSize,
    openPrice: trade.currentEntry,
  });
  trade.marginInfo = marginInfo;

  return trade;
}

function createTradeInfoTable(trade, balance) {
  let takeProfitsStr = trade.takeProfits.map(
      (tp, index) => `TP${index + 1}: ${tp}`
  ).join('\n');

  let table = `
Signal Details
==============
Source: ${trade.signalSource}
Received Time: ${trade.signalReceivedTime}
Trade Type: ${trade.orderType}
Entry: ${trade.entry}
${takeProfitsStr}
SL: ${trade.stopLoss}

Trade Information
================
Order Type: ${trade.orderType}
Symbol: ${trade.symbol}
Current Entry: ${trade.currentEntry}
Stop Loss: ${trade.stopLossPips.toFixed(2)} pips
Risk Factor: ${(trade.riskFactor * 100).toFixed(2)}%
Balance: ${config.CURRENCY_SYMBOL}${balance.toFixed(2)}
Margin Required: ${config.CURRENCY_SYMBOL}${trade.marginInfo.margin.toFixed(2)}
Total Position Size: ${trade.totalPositionSize}

Position Sizes and Potential Loss per TP:
`;

  trade.takeProfits.forEach((tp, index) => {
    table += `TP${index + 1}: Position Size: ${trade.positionSizePerTP[index]}, Potential Loss: ${config.CURRENCY_SYMBOL}${trade.potentialLossPerTP[index].toFixed(2)}\n`;
  });

  table += `\nTotal Potential Loss: ${config.CURRENCY_SYMBOL}${trade.potentialTotalLoss.toFixed(2)}\n\n`;

  let totalProfit = 0;
  table += `Potential Profit per TP:\n`;
  trade.takeProfits.forEach((tp, index) => {
    const profitPips = trade.takeProfitPips[index];
    const profitValue = trade.positionSizePerTP[index] * config.PIP_VALUE * profitPips;
    totalProfit += profitValue;
    table += `TP${index + 1}: ${profitPips.toFixed(2)} pips, Profit: ${config.CURRENCY_SYMBOL}${profitValue.toFixed(2)}\n`;
  });

  table += `\nTotal Potential Profit: ${config.CURRENCY_SYMBOL}${totalProfit.toFixed(2)}`;

  trade.totalProfit = totalProfit.toFixed(2);

  return table;
}

async function placeTrade(connection, trade, chatId, messageId) {
  logger.info('Entering trade');
  await sendMessage(chatId, "Entering trade on MetaTrader Account...");

  // Define trailing stop loss to be used after the first TP is hit
  let trailingStopLoss = null;
  if (config.ENABLE_TRAILING_STOP_POSITION) {
    let thresholds = [
      {
        threshold: trade.takeProfitPips[0], // Activate trailing stop when price reaches the first TP in pips
        stopLoss: trade.takeProfitPips[0] - 2
      }
    ];

    trailingStopLoss = {
      threshold: {
        thresholds: thresholds,
        units: "RELATIVE_PIPS", // Relative pips for threshold and stop loss
        stopPriceBase: "CURRENT_PRICE"
      }
    };
  }

  for (let i = 0; i < trade.takeProfits.length; i++) {
    let tp = trade.takeProfits[i];
    const positionSize = trade.positionSizePerTP[i];
    const comment = `${trade.signalSource} TP${i + 1}`.substring(0, 31);
    await sendMessage(chatId, `<pre>Placing trade: ${comment} for TP${i + 1}</pre>`, true);

    // Ensure TP1 is always solid, subsequent TPs follow CLOSE_TRADE_ON_SL_ONLY
    const tpValue = (i === 0 || !config.CLOSE_TRAILING_TRADE_ON_SL_ONLY) ? tp : null;

    const orderOptions = {
      comment,
      ...(i > 0 && { trailingStopLoss: trailingStopLoss })
    };

    try {
      let tradeResponse;
      if (trade.orderType === 'Buy') {
        logger.info(messageId + ' calling createMarketBuyOrder ' + comment);
        tradeResponse = await connection.createMarketBuyOrder(trade.symbol,
            positionSize, trade.stopLoss, tpValue, orderOptions);
      } else {
        logger.info(messageId + ' calling createMarketSellOrder ' + comment);
        tradeResponse = await connection.createMarketSellOrder(trade.symbol,
            positionSize, trade.stopLoss, tpValue, orderOptions);
      }
      const position = await getPosition(connection, tradeResponse.positionId);
      // logger.info(`Trade saved to DynamoDB with TradeId: ${tradeId}`);
    } catch (error) {
      logger.error('Error placing trade:', error);
      await sendMessage(chatId, `Failed to place trade for TP${i + 1}.`);
      throw new Error(error);
    }
  }
  await sendMessage(chatId, `<b>Trade entered successfully! ✅</b>`, true);
}

async function getPosition(connection, positionId) {
  // Retry mechanism for getPosition with exponential backoff
  const maxRetries = 5;
  const delay = 2000; // Initial delay in milliseconds
  let attempt = 0;
  let position;

  while (attempt < maxRetries) {
    try {
      console.log(`Attempt ${attempt + 1} to get position...`);
      position = await connection.getPosition(positionId);
      return position;
    } catch (error) {
      attempt++;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt)); // Exponential backoff
      } else {
        throw new Error(`Failed to get position after ${maxRetries} attempts.`);
      }
    }
  }
}

async function fetchMT5Details(chatId) {
  let connection, account;
  try {
    ({ connection, account } = await getMetaTraderApiConnection(chatId));
    const accountInfo = await connection.getAccountInformation();
    const positions = await connection.getPositions();
    const orders = await connection.getOrders();
    const serverTime = await connection.getServerTime();

    const accountDetails = {
      ...accountInfo,
      MetaApiAccountName: account.name,
      MetaApiAccountState: account.state,
      PositionsCount: positions.length,
      OrdersCount: orders.length,
      ServerTime: serverTime.time.toISOString(),
    };

    return formatAccountDetailsMessage(accountDetails);
  } catch (error) {
    console.error('Error fetching MetaTrader account details:', error);
    throw new Error('Failed to fetch MetaTrader account details.');
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

function formatAccountDetailsMessage(details) {
  let message = 'MT5 Account Details\n===================\n';
  for (const [key, value] of Object.entries(details)) {
    message += `${capitalizeFirstLetter(key)}: ${value}\n`;
  }
  return message;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = { handleMetaTraderTrade, fetchMT5Details, getMetaTraderMetrics };
