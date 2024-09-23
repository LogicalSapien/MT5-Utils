// config.js
module.exports = {
  META_API_KEY: process.env.META_API_KEY || '',
  META_ACCOUNT_ID: process.env.META_ACCOUNT_ID || '',
  RISK_FACTOR: process.env.RISK_FACTOR || '',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  DYNAMODB_CHAT_MESSAGES_TABLE_NAME: process.env.DYNAMODB_CHAT_MESSAGES_TABLE_NAME || 'mt5-utils-chat-messages',
  DYNAMODB_TRADE_TABLE_NAME: process.env.DYNAMODB_TRADE_TABLE_NAME || 'mt5-utils-trades',
  AUTHORIZED_TELEGRAM_USER: process.env.AUTHORIZED_TELEGRAM_USER || '',
  PIP_VALUE: process.env.PIP_VALUE || 1,
  MIN_POSITION_SIZE: process.env.MIN_POSITION_SIZE || 0.1,
  ROUND_POSITION_SIZE: process.env.ROUND_POSITION_SIZE || true, // Set this to true if you want to round the position size
  ROUND_POSITION_SIZE_FACTOR: process.env.ROUND_POSITION_SIZE_FACTOR || 0.1, // Set the rounding factor (e.g., 0.1, 1, etc.),
  MAX_POSITION_SIZE: process.env.MAX_POSITION_SIZE || 1, // The maximum position size allowed
  CURRENCY_NAME: process.env.CURRENCY_NAME || 'GBP',
  CURRENCY_SYMBOL: process.env.CURRENCY_SYMBOL || '£',
  ENABLE_TRADE_EXECUTION: process.env.ENABLE_TRADE_EXECUTION || false, // New flag to enable or disable trade execution
  TRADE_SYMBOL_SUFFIX: process.env.TRADE_SYMBOL_SUFFIX || '_SB', // suffix for special symbols
  SIGNAL_PROVIDERS: process.env.SIGNAL_PROVIDERS || '',
  ENABLE_TRAILING_STOP_POSITION: process.env.ENABLE_TRAILING_STOP_POSITION || null,
  TRAILING_STOP_DISTANCE: process.env.TRAILING_STOP_DISTANCE || 10,
  TRAILING_STOP_UNITS: process.env.TRAILING_STOP_UNITS || 'RELATIVE_PIPS',
  CLOSE_TRAILING_TRADE_ON_SL_ONLY: process.env.CLOSE_TRAILING_TRADE_ON_SL_ONLY || false,
  ALLOWED_SYMBOLS: process.env.ALLOWED_SYMBOLS || [
    "AUDCAD", "AUDCHF", "AUDJPY", "AUDNZD", "AUDUSD",
    "CADCHF", "CADJPY", "CHFJPY", "EURAUD", "EURCAD",
    "EURCHF", "EURGBP", "EURJPY", "EURNZD", "EURUSD",
    "GBPAUD", "GBPCAD", "GBPCHF", "GBPJPY", "GBPNZD",
    "GBPUSD", "NZDCAD", "NZDCHF", "NZDJPY", "NZDUSD",
    "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD"
  ]
};
