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

  function extractSource(line) {
    const sourceMatch = line.match(/Source:\s*(\w+)/i);
    return sourceMatch ? sourceMatch[1] : null;
  }

  // Check the first line and the last line for source
  signalSource = extractSource(lines[0]);
  if (signalSource) {
    lines.shift(); // Remove the first line if it contains the source
  } else {
    signalSource = extractSource(lines[lines.length - 1]);
    if (signalSource) {
      lines.pop(); // Remove the last line if it contains the source
    }
  }

  // Define provider-specific parsers with their corresponding signal source names
  const parsers = [
    { parser: parseProvider1, source: signalProviders[0] || 'Unknown' },
    { parser: parseProvider2, source: signalProviders[1] || 'Unknown' }
    // Add more providers as needed
  ];

  // Try parsing with each provider-specific parser
  for (const { parser, source } of parsers) {
    trade = parser(lines);
    if (trade) {
      trade.signalSource = signalSource || source;
      break;
    }
  }

  // Add signalReceivedTime and riskFactor if parsing was successful
  if (trade) {
    trade.signalReceivedTime = signalDateStr;
    trade.riskFactor = parseFloat(config.RISK_FACTOR);
  }

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
  // Implement similar logic for another provider
  // This function can have a different format parsing logic
  // Return null if parsing fails
  return null;
}

function getIsoDateStr(date) {
  const dateInMillis = new Date(date * 1000); // Multiply by 1000 to convert seconds to milliseconds
  return dateInMillis.toISOString();
}

module.exports = { parseTradeSignal, getIsoDateStr };
