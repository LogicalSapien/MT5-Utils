const {
  handleMessage,
  handleStart,
  handleHelp,
  handleTrade,
  handleCalculate,
  handleCancel,
  handleTradeLast,
  handleCalculateLast,
  handleFetchConfig,
  handleFetchMT5Details
} = require('./handle_message');

const {
  saveChatMessageIfNotDuplicate,
  getLastMessages,
  markTradeExecuted
} = require('./db/dynamo_db');
const { parseTradeSignal, getIsoDateStr } = require('./trade/trade_utils');
const { handleMetaTraderTrade, fetchMT5Details } = require('./trade/mt5_utils');
const { sendMessage } = require('./telegram/telegram_utils');
const logger = require('./logger');
const config = require('./config');

// Mocking dependencies
jest.mock('./db/dynamo_db');
jest.mock('./trade/trade_utils');
jest.mock('./trade/mt5_utils');
jest.mock('./telegram/telegram_utils');
jest.mock('./logger');
jest.mock('./config');

describe('handle_message module', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    config.AUTHORIZED_TELEGRAM_USER = 'authorizedUser';
    config.SIGNAL_PROVIDERS = 'provider1';
  });

  describe('handleMessage', () => {
    it('should send an unauthorized message if the user is not authorized', async () => {
      const message = {
        chat: { id: 1 },
        from: { username: 'unauthorizedUser' },
        text: 'some text'
      };

      await handleMessage(message);

      expect(sendMessage).toHaveBeenCalledWith(1, 'You are not authorized to use this bot!');
    });

    xit('should save the message and handle new signal if no last state', async () => {
      const message = {
        chat: { id: 1 },
        from: { username: 'authorizedUser' },
        text: 'BUY EURUSD @ 1.1000\nTP1: 1.1100\nTP2: 1.1200\nSL: 1.0900',
        date: new Date()
      };
      const trade = {
        orderType: 'Buy',
        symbol: 'EURUSD',
        entry: 1.1,
        takeProfits: [1.11, 1.12],
        stopLoss: 1.09,
        signalSource: 'provider1'
      };

      saveChatMessageIfNotDuplicate.mockResolvedValue(true);
      getLastMessages.mockResolvedValue([]);
      parseTradeSignal.mockReturnValue(trade);

      await handleMessage(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(getLastMessages).toHaveBeenCalledWith('authorizedUser', 5);
      expect(parseTradeSignal).toHaveBeenCalledWith(message.text, expect.any(String));
      expect(sendMessage).toHaveBeenCalledWith(1, "Do you want to trade this signal or calculate it? Use /tradelast to trade or /calculatelast to calculate.");
    });

    xit('should send an invalid trade format message if trade signal is invalid', async () => {
      const message = {
        chat: { id: 1 },
        from: { username: 'authorizedUser' },
        text: 'invalid signal',
        date: new Date()
      };

      saveChatMessageIfNotDuplicate.mockResolvedValue(true);
      getLastMessages.mockResolvedValue([]);
      parseTradeSignal.mockReturnValue(null);

      await handleMessage(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(getLastMessages).toHaveBeenCalledWith('authorizedUser', 5);
      expect(sendMessage).toHaveBeenCalledWith(1, "Invalid trade format. Please use the correct format.");
    });

    it('should process the last state if there is one', async () => {
      const message = {
        chat: { id: 1 },
        from: { username: 'authorizedUser' },
        text: 'some text',
        date: new Date()
      };

      saveChatMessageIfNotDuplicate.mockResolvedValue(true);
      getLastMessages.mockResolvedValue([{ message: '/trade' }]);

      await handleMessage(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(getLastMessages).toHaveBeenCalledWith('authorizedUser', 5);
      expect(sendMessage).toHaveBeenCalledWith(1, "Invalid trade format. Please use the correct format.");
    });
  });

  describe('handleStart', () => {
    it('should save the message and send a welcome message', async () => {
      const message = { chat: { id: 1 } };

      await handleStart(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(sendMessage).toHaveBeenCalledWith(1, "Welcome to the SignalSorcerer, the Signal to MT5 Automator Telegram Bot! Use /help for instructions.");
    });
  });

  describe('handleHelp', () => {
    it('should save the message and send a help message', async () => {
      const message = { chat: { id: 1 } };
      const helpMessage = `This bot is used to automatically enter trades onto your MetaTrader account directly from Telegram. Use the following commands:
    /start - Displays welcome message
    /help - Displays help message
    /trade - Enter a trade
    /calculate - Calculate trade information without entering it
    /cancel - Cancel the current operation
    /tradelast - Trade the last calculated signal
    /calculatelast - Calculate the last trade signal
    /fetchconfig - Fetch the current configuration (except API keys and tokens)`;

      await handleHelp(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(sendMessage).toHaveBeenCalledWith(1, helpMessage);
    });
  });

  describe('handleTrade', () => {
    it('should save the message and send a trade message', async () => {
      const message = { chat: { id: 1 } };

      await handleTrade(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(sendMessage).toHaveBeenCalledWith(1, `Please enter the trade you would like to place in the following format:\n\n
📈 BUY/SELL SYMBOL @ EntryPrice\n
✅ TP1: TakeProfit1 ✅\n
✅ TP2: TakeProfit2 ✅\n
✅ TP3: TakeProfit3 ✅\n
❌ SL: StopLoss ❌`);
    });
  });

  describe('handleCalculate', () => {
    it('should save the message and send a calculate message', async () => {
      const message = { chat: { id: 1 } };

      await handleCalculate(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(sendMessage).toHaveBeenCalledWith(1, `Please enter the trade you would like to place in the following format:\n\n
📈 BUY/SELL SYMBOL @ EntryPrice\n
✅ TP1: TakeProfit1 ✅\n
✅ TP2: TakeProfit2 ✅\n
✅ TP3: TakeProfit3 ✅\n
❌ SL: StopLoss ❌`);
    });
  });

  describe('handleCancel', () => {
    it('should save the message and send a cancel message', async () => {
      const message = { chat: { id: 1 } };

      await handleCancel(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(sendMessage).toHaveBeenCalledWith(1, 'Operation cancelled.');
    });
  });

  describe('handleTradeLast', () => {
    it('should handle the last trade signal', async () => {
      const message = { chat: { id: 1 }, from: { username: 'user' } };
      const lastMessages = [
        { message: 'BUY EURUSD @ 1.2000', tradeExecuted: false, messageId: 123, date: new Date() }
      ];

      saveChatMessageIfNotDuplicate.mockResolvedValue(true);
      getLastMessages.mockResolvedValue(lastMessages);
      parseTradeSignal.mockReturnValue({ symbol: 'EURUSD', entry: 1.2 });

      await handleTradeLast(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(getLastMessages).toHaveBeenCalledWith('user');
      expect(handleMetaTraderTrade).toHaveBeenCalledWith(1, { symbol: 'EURUSD', entry: 1.2 }, true, 123);
      expect(markTradeExecuted).toHaveBeenCalledWith(123);
    });

    it('should send a message if the last trade signal is already executed', async () => {
      const message = { chat: { id: 1 }, from: { username: 'user' } };
      const lastMessages = [
        { message: 'BUY EURUSD @ 1.2000', tradeExecuted: true, messageId: 123, date: new Date() }
      ];

      saveChatMessageIfNotDuplicate.mockResolvedValue(true);
      getLastMessages.mockResolvedValue(lastMessages);

      await handleTradeLast(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(getLastMessages).toHaveBeenCalledWith('user');
      expect(sendMessage).toHaveBeenCalledWith(1, "The last trade signal has already been executed.");
    });
  });

  describe('handleCalculateLast', () => {
    it('should handle the last calculation', async () => {
      const message = { chat: { id: 1 }, from: { username: 'user' } };
      const lastMessages = [
        { message: 'BUY EURUSD @ 1.2000', tradeExecuted: false, messageId: 123, date: new Date() }
      ];

      saveChatMessageIfNotDuplicate.mockResolvedValue(true);
      getLastMessages.mockResolvedValue(lastMessages);
      parseTradeSignal.mockReturnValue({ symbol: 'EURUSD', entry: 1.2 });

      await handleCalculateLast(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(getLastMessages).toHaveBeenCalledWith('user');
      expect(handleMetaTraderTrade).toHaveBeenCalledWith(1, { symbol: 'EURUSD', entry: 1.2 }, false, 123);
      expect(sendMessage).toHaveBeenCalledWith(1, 'Do you want to trade this signal? Use /tradelast to confirm.');
    });

    it('should send a message if no trade signal is found', async () => {
      const message = { chat: { id: 1 }, from: { username: 'user' } };
      const lastMessages = [];

      saveChatMessageIfNotDuplicate.mockResolvedValue(true);
      getLastMessages.mockResolvedValue(lastMessages);

      await handleCalculateLast(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(getLastMessages).toHaveBeenCalledWith('user');
      expect(sendMessage).toHaveBeenCalledWith(1, "No trade signal found. Please send a trade signal first.");
    });
  });

  describe('handleFetchConfig', () => {
    it('should fetch and send the current configuration', async () => {
      const message = { chat: { id: 1 } };
      config.RISK_FACTOR = 1;
      config.PIP_VALUE = 0.0001;
      config.MIN_POSITION_SIZE = 0.01;
      config.ROUND_POSITION_SIZE = true;
      config.ROUND_POSITION_SIZE_FACTOR = 0.01;
      config.MAX_POSITION_SIZE = 1;
      config.CURRENCY_NAME = 'USD';
      config.CURRENCY_SYMBOL = '$';
      config.ENABLE_TRADE_EXECUTION = true;
      config.TRADE_SYMBOL_SUFFIX = '';
      config.SIGNAL_PROVIDERS = 'provider1';
      config.ALLOWED_SYMBOLS = ['EURUSD', 'GBPUSD'];

      const configMessage = `
Current Configuration:
======================
- RISK_FACTOR: 1
- PIP_VALUE: 0.0001
- MIN_POSITION_SIZE: 0.01
- ROUND_POSITION_SIZE: true
- ROUND_POSITION_SIZE_FACTOR: 0.01
- MAX_POSITION_SIZE: 1
- CURRENCY_NAME: USD
- CURRENCY_SYMBOL: $
- ENABLE_TRADE_EXECUTION: true
- TRADE_SYMBOL_SUFFIX: 
- SIGNAL_PROVIDERS: provider1
- ALLOWED_SYMBOLS: EURUSD, GBPUSD
`;

      await handleFetchConfig(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(sendMessage).toHaveBeenCalledWith(1, `<pre>${configMessage}</pre>`, true);
    });
  });

  describe('handleFetchMT5Details', () => {
    it('should fetch and send the MT5 details', async () => {
      const message = { chat: { id: 1 } };
      const detailsMessage = 'MT5 account details here';

      saveChatMessageIfNotDuplicate.mockResolvedValue(true);
      fetchMT5Details.mockResolvedValue(detailsMessage);

      await handleFetchMT5Details(message);

      expect(saveChatMessageIfNotDuplicate).toHaveBeenCalledWith(message);
      expect(fetchMT5Details).toHaveBeenCalledWith(1);
      expect(sendMessage).toHaveBeenCalledWith(1, `<pre>${detailsMessage}</pre>`, true);
    });
  });
});
