const config = require('../config');

const signalProviders = config.SIGNAL_PROVIDERS ? config.SIGNAL_PROVIDERS.split(',') : [];

/**
 * Parses a trade signal from the given text.
 * @param {string} signal - The trade signal text.
 * @param signalDateStr - Signal date in ISO String format
 * @returns {Object|null} - The parsed trade object or null if invalid.
 */
function parseTradeSignal(signal, signalDateStr) {
  const lines = signal.split('\n').map(line => line.trim());
  let trade = null;
  let signalSource = null;

  // Extract Source from the signal
  const sourceLine = lines.find(line => line.toUpperCase().startsWith('SOURCE:'));
  if (sourceLine) {
    const sourceMatch = sourceLine.match(/Source:\s*(.+)/i);
    if (sourceMatch && sourceMatch[1]) {
      signalSource = sourceMatch[1];
    }
  }

  // Define provider-specific parsers
  const parsers = [
    { parser: parseProvider1, source: signalProviders[0] || 'Unknown' },
    { parser: parseProvider2, source: signalProviders[1] || 'Unknown' },
    { parser: parseProvider3, source: signalProviders[2] || 'Unknown' }
  ];

  // Try parsing with each provider-specific parser
  for (const { parser, source } of parsers) {
    trade = parser(lines);
    if (trade) {
      trade.signalSource = signalSource || source;
      break;
    }
  }

  // Add signalReceivedTime, riskFactor, maxRisk, and lotSize if provided
  if (trade) {
    trade.signalReceivedTime = signalDateStr;
    trade.riskFactor = parseFloat(config.RISK_FACTOR);

    // Optionally parse maxRisk or lotSize from the signal text
    const maxRiskLine = lines.find(line => line.toUpperCase().startsWith('MAXRISK:'));
    if (maxRiskLine) {
      const maxRiskMatch = maxRiskLine.match(/MaxRisk:\s*([\d.]+)/i);
      if (maxRiskMatch && maxRiskMatch[1]) {
        trade.maxRisk = parseFloat(maxRiskMatch[1]);
      }
    }

    const lotSizeLine = lines.find(line => line.toUpperCase().startsWith('LOTSIZE:'));
    if (lotSizeLine) {
      const lotSizeMatch = lotSizeLine.match(/LotSize:\s*([\d.]+)/i);
      if (lotSizeMatch && lotSizeMatch[1]) {
        trade.lotSize = parseFloat(lotSizeMatch[1]);
      }
    }
  }

  return trade;
}

/**
 * Parser for the  format:
 * BUY/SELL SYMBOL @ EntryPrice
 * TP1: TakeProfit1
 * TP2: TakeProfit2
 * TP3: TakeProfit3
 * SL: StopLoss
 * MaxRisk: MaximumRiskAmount (Optional)
 * LotSize: LotSizeValue (Optional)
 */
function parseProvider3(lines) {
  const trade = {};

  // Determine the order type and symbol
  const firstLine = lines[1].toUpperCase(); // Start parsing from the second line (ignoring 'Source' line)
  if (firstLine.includes('BUY')) {
    trade.orderType = 'Buy';
  } else if (firstLine.includes('SELL')) {
    trade.orderType = 'Sell';
  } else {
    return null;
  }

  // Extract symbol
  const symbolMatch = firstLine.match(/[A-Z]{6}/);
  if (!symbolMatch) return null;
  trade.symbol = symbolMatch[0];
  if (!config.ALLOWED_SYMBOLS.includes(trade.symbol.toUpperCase())) return null;

  // Extract entry price
  const entryMatch = firstLine.match(/@[\s]*([\d.]+)/);
  if (entryMatch) {
    trade.entry = parseFloat(entryMatch[1]);
  } else {
    trade.entry = 'NOW'; // Default if not specified
  }

  // Extract take profit and stop loss values
  trade.takeProfits = [];
  for (let i = 2; i < lines.length; i++) {
    const upperLine = lines[i].toUpperCase();
    if (upperLine.includes('TP')) {
      const tpValue = parseFloat(lines[i].split(':')[1].trim());
      if (isNaN(tpValue)) return null;
      trade.takeProfits.push(tpValue);
    } else if (upperLine.includes('SL')) {
      const slValue = parseFloat(lines[i].split(':')[1].trim());
      if (isNaN(slValue)) return null;
      trade.stopLoss = slValue;
    }
  }

  if (!trade.takeProfits.length || isNaN(trade.stopLoss)) return null;

  return trade;
}

function parseProvider1(lines) {
  const trade = {};

  // Determine the order type and symbol
  const firstLine = lines[0].toUpperCase();
  if (firstLine.includes('BUY')) {
    trade.orderType = 'Buy';
  } else if (firstLine.includes('SELL')) {
    trade.orderType = 'Sell';
  } else {
    return null;
  }

  // Extract symbol
  const symbolMatch = firstLine.match(/[A-Z]{6}/);
  if (!symbolMatch) return null;
  trade.symbol = symbolMatch[0];
  if (!config.ALLOWED_SYMBOLS.includes(trade.symbol.toUpperCase())) return null;

  // Extract entry price
  const entryMatch = firstLine.match(/@[\s]*([\d.]+)/);
  if (entryMatch) {
    trade.entry = parseFloat(entryMatch[1]);
  } else {
    trade.entry = 'NOW'; // Default if not specified
  }

  // Extract take profit and stop loss values
  trade.takeProfits = [];
  for (let i = 1; i < lines.length; i++) {
    const upperLine = lines[i].toUpperCase();
    if (upperLine.includes('TP')) {
      const tpValue = parseFloat(lines[i].split(':')[1].trim());
      if (isNaN(tpValue)) return null;
      trade.takeProfits.push(tpValue);
    } else if (upperLine.includes('SL')) {
      const slValue = parseFloat(lines[i].split(':')[1].trim());
      if (isNaN(slValue)) return null;
      trade.stopLoss = slValue;
    }
  }

  if (!trade.takeProfits.length || isNaN(trade.stopLoss)) return null;

  return trade;
}

function parseProvider2(lines) {
  const trade = {};

  // Determine the order type and symbol
  const firstLine = lines[0].toUpperCase();
  if (firstLine.includes('LONG')) {
    trade.orderType = 'Buy';
  } else if (firstLine.includes('SHORT')) {
    trade.orderType = 'Sell';
  } else {
    return null;
  }

  // Extract symbol
  const symbolMatch = firstLine.match(/[A-Z]{6}/);
  if (!symbolMatch) return null;
  trade.symbol = symbolMatch[0];
  if (!config.ALLOWED_SYMBOLS.includes(trade.symbol.toUpperCase())) return null;

  // Extract entry price
  const entryLine = lines.find(line => line.toUpperCase().startsWith('OPEN PRICE:'));
  if (!entryLine) return null;
  const entryMatch = entryLine.match(/Open Price:\s*([\d.]+)/i);
  if (!entryMatch) return null;
  trade.entry = parseFloat(entryMatch[1]);

  // Extract stop loss value
  const slLine = lines.find(line => line.toUpperCase().startsWith('SL:'));
  if (!slLine) return null;
  const slMatch = slLine.match(/SL:\s*([\d.]+)/i);
  if (!slMatch) return null;
  trade.stopLoss = parseFloat(slMatch[1]);

  // Initialize takeProfits array
  trade.takeProfits = [];

  // Extract take profit values
  lines.forEach(line => {
    let tpMatch = null;

    if (line.match(/Start Exit Zone TP:/i)) {
      tpMatch = line.match(/Start Exit Zone TP:\s*([\d.]+)/i);
    } else if (line.match(/1:1 Risk:Reward TP:/i)) {
      tpMatch = line.match(/1:1 Risk:Reward TP:\s*([\d.]+)/i);
    } else if (line.match(/End Exit Zone TP:/i)) {
      tpMatch = line.match(/End Exit Zone TP:\s*([\d.]+)/i);
    }

    if (tpMatch) {
      const tpValue = parseFloat(tpMatch[1]);
      if (!isNaN(tpValue)) {
        trade.takeProfits.push(tpValue);
      }
    }
  });

  if (!trade.takeProfits.length) return null;

  return trade;
}

/**
 * Converts a Unix timestamp to ISO Date string.
 * @param {number} date - Unix timestamp in seconds.
 * @returns {string} - ISO formatted date string.
 */
function getIsoDateStr(date) {
  const dateInMillis = new Date(date * 1000); // Multiply by 1000 to convert seconds to milliseconds
  return dateInMillis.toISOString();
}

module.exports = { parseTradeSignal, getIsoDateStr };

