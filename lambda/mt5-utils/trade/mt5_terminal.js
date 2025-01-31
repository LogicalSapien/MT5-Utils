const { chromium } = require('playwright'); // or use the full Playwright if running locally
const playwrightAwsLambda = require('playwright-aws-lambda');
const logger = require("../logger");
const config = require('../config');
const { sendMessage } = require('../telegram/telegram_utils');

/**
 * Extracts Balance and Margin from the MT5 Web UI.
 */
async function getAccountBalanceAndMargin(page) {
    console.log("Fetching Balance and Margin...");

    const balanceSectionSelector = 'div.td.svelte-1vus4dn div.layout.svelte-pu03bn';
    try {
        await page.waitForSelector(balanceSectionSelector, { timeout: 5000 });

        const balanceText = await page.textContent(balanceSectionSelector);
        console.log("Extracted balance info:", balanceText);

        const balanceMatch = balanceText.match(/Balance:\s*([\d.,]+)/);
        const equityMatch = balanceText.match(/Equity:\s*([\d.,]+)/);        
        const marginMatch = balanceText.match(/Margin:\s*([\d.,]+)/);
        const freeMarginMatch = balanceText.match(/Free margin:\s*([\d.,]+)/);

        const balance = balanceMatch ? parseFloat(balanceMatch[1].replace(',', '')) : null;
        const equity = equityMatch ? parseFloat(equityMatch[1].replace(',', '')) : null;
        const margin = marginMatch ? parseFloat(marginMatch[1].replace(',', '')) : null;
        const freeMargin = freeMarginMatch ? parseFloat(freeMarginMatch[1].replace(',', '')) : null;

        console.log(`✅ Extracted Balance: ${balance}, Margin: ${margin}, Free margin: ${freeMargin}`);
        return { balance, equity, margin , freeMargin};
    } catch (error) {
        console.error("❌ Error extracting balance/equity/margin:", error);
        throw new Error("Failed to extract Balance, Equity and Margin.");
    }
}

/**
 * Logs into MT5 Web Terminal (adjust selectors/text to new UI).
 */
async function loginToMT5(page) {
    console.log("Navigating to MT5 Web Terminal...");
    await page.goto('https://mt5-2.pepperstone.com/terminal', { waitUntil: 'domcontentloaded' });

    await acceptDisclaimer(page);

    const username = config.MT5_USER;
    const password = config.MT5_PASSWORD;

    if (!username || !password) {
        throw new Error("MT5 username or password is missing in the config.");
    }

    console.log("Entering credentials...");
    await page.fill('input[placeholder="Enter Login"]', username);
    await page.fill('input[placeholder="Enter Password"]', password);
    await page.click('button:has-text("Connect to account")');

    console.log("Waiting for login completion...");
    await page.waitForTimeout(5000); // Allow UI to load
    console.log("Login successful.");
}

/**
 * Accepts disclaimer if required.
 */
async function acceptDisclaimer(page) {
    console.log("Checking for disclaimer/cookie acceptance...");
    const disclaimerButtonSelector = 'button:has-text("Accept")';
    try {
        await page.waitForSelector(disclaimerButtonSelector, { timeout: 5000 });
        await page.click(disclaimerButtonSelector);
        console.log("Disclaimer accepted.");
    } catch (error) {
        console.log("No disclaimer/cookie button found or already accepted.");
    }
}

/**
 * Selects a trading symbol.
 */
async function selectSymbol(page, symbol) {
    console.log(`Searching for symbol: ${symbol}`);
    if (!symbol) throw new Error("Trading symbol is missing.");

    const searchInputSelector = 'label.search input[placeholder="Search symbol"]';

    await page.waitForSelector(searchInputSelector, { timeout: 5000 });
    await page.click(searchInputSelector);
    await page.fill(searchInputSelector, symbol);
    await page.waitForTimeout(500); // Allow search results to appear

    const symbolSpanSelector = `span.symbol.svelte-15ov7ck:has-text("${symbol}")`;
    try {
        await page.waitForSelector(symbolSpanSelector, { timeout: 5000 });
        await page.click(symbolSpanSelector);
        console.log(`Symbol "${symbol}" selected.`);

        // Close the trade panel before pressing F9
        console.log(`❌ Clicking Close (X) button to close trade panel...`);
        const closeButtonSelector = 'button.close.svelte-1039c56';
        
        if (await page.isVisible(closeButtonSelector)) {
            await page.click(closeButtonSelector);
            console.log(`📊 Trade panel closed.`);
            await page.waitForTimeout(500);
        } else {
            console.log(`⚠️ Close button not found, proceeding anyway.`);
        }
        
    } catch (error) {
        console.log(`Symbol "${symbol}" not found. Taking screenshot...`);
        await page.screenshot({ path: 'search-symbol-error.png' });
        throw new Error(`Symbol "${symbol}" not found.`);
    }
}

/**
 * Opens the order window, fetches (sell/buy) price from the DOM.
 * (Adjust if the new UI text changed from "New Order" to something else.)
 */
async function openOrderWindowAndGetPrices(page) {
    // console.log("Opening order window...");

    await openNewOrderUsingShortcut(page);
  
    // Wait for the "Sell by Market" or "Buy by Market" buttons to appear.
    // Update these selectors to match your new UI's trade window.
    try {
      await page.waitForSelector('button:has-text("Sell by Market")', { timeout: 10000 });
      await page.waitForSelector('button:has-text("Buy by Market")', { timeout: 10000 });
      console.log("Trade window detected.");
    } catch (error) {
      console.log("Trade window did not open properly.");
      await page.screenshot({ path: 'trade-window-error.png' });
      throw new Error("Failed to open trade window.");
    }
  
    console.log("Fetching bid (sell) and ask (buy) prices...");
  
    // Example: If your new UI has these data-test attributes:
    let sellPrice = null;
    let buyPrice = null;
  
    // fallback scanning approach
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const allDivs = await page.$$('div');
      const foundPrices = [];
      for (const div of allDivs) {
        const text = await div.textContent();
        if (text && text.trim() && !isNaN(text.trim())) {
          foundPrices.push(text.trim());
        }
      }

      if (foundPrices.length >= 2) {
        sellPrice = foundPrices[0];
        buyPrice = foundPrices[1];
        console.log(`Sell: ${sellPrice}, Buy: ${buyPrice}`);
        break;
      }
      await page.waitForTimeout(100);
    }

    if (!sellPrice || !buyPrice) {
      await page.screenshot({ path: 'price-error.png' });
      throw new Error("Could not find both Sell and Buy prices!");
    }

    return { sellPrice, buyPrice, bid: sellPrice, ask: buyPrice };
}

async function openNewOrderUsingShortcut(page) {
    console.log("🖥️ Pressing F9 to open 'New Order' window...");
    await page.keyboard.press('F9');
    await page.waitForTimeout(1000); // Allow UI time to open order window
    console.log("📑 New Order window should be open.");
}

/**
 * Fills in the order form.
 */
/**
 * Fills in the order form with volume, stop loss, take profit, and comment.
 */
async function fillOrderForm(page, volume, stopLoss, takeProfit, comment) {
    console.log("Filling order form...");

    // Selectors for input fields inside the order window
    const volumeInputSelector = '.volume.svelte-qglay6 input[type="text"]';
    const stopLossInputSelector = '.sl.svelte-qglay6 input[type="text"]';
    const takeProfitInputSelector = '.tp.svelte-qglay6 input[type="text"]';
    const commentInputSelector = '.comment .value input[type="text"]';

    // Wait for inputs to appear
    await page.waitForSelector(volumeInputSelector, { timeout: 5000 });
    await page.waitForSelector(stopLossInputSelector, { timeout: 5000 });
    await page.waitForSelector(takeProfitInputSelector, { timeout: 5000 });
    await page.waitForSelector(commentInputSelector, { timeout: 5000 });

    // Fill the form fields
    await page.fill(volumeInputSelector, volume.toString());
    await page.fill(stopLossInputSelector, stopLoss.toString());
    await page.fill(takeProfitInputSelector, takeProfit.toString());
    await page.fill(commentInputSelector, comment);

    console.log("✅ Order details filled.");
}

/**
 * Places an order by clicking Buy/Sell.
 */
async function placeOrder(page, orderType) {
    console.log(`Placing a ${orderType} order...`);

    // Use button text to identify Buy/Sell buttons
    const buyButtonSelector = 'button:has-text("Buy by Market")';
    const sellButtonSelector = 'button:has-text("Sell by Market")';
    const okButtonSelector = 'button:has-text("OK")'; // Confirmation button


    try {
        if (orderType.toLowerCase() === 'buy') {
            await page.waitForSelector(buyButtonSelector, { timeout: 5000 });
            await page.click(buyButtonSelector);
        } else if (orderType.toLowerCase() === 'sell') {
            await page.waitForSelector(sellButtonSelector, { timeout: 5000 });
            await page.click(sellButtonSelector);
        } else {
            throw new Error("Invalid order type. Must be 'buy' or 'sell'.");
        }

        console.log(`💲 ${orderType} order placed. Waiting for confirmation...`);

        // Wait for "OK" confirmation button and click it
        await page.waitForSelector(okButtonSelector, { timeout: 5000 });
        await page.click(okButtonSelector);
        console.log(`📊 Trade confirmed. Clicked "OK".`);
        
    } catch (error) {
        console.error(`❌ Error placing ${orderType} order: ${error.message}`);
        throw new Error(`Failed to place ${orderType} order.`);
    }
}



/**
 * Main handler function for MT5 trades.
 */
async function handleMt5TraderTrade(chatId, trade, executeTrade, messageId) {
    logger.info('handleMt5TraderTrade');
    let browser, context, page;
    
    try {
        await sendMessage(chatId, "Processing...");
        logger.info('Launching browser and logging into MT5...');
        browser = await launchBrowser();
        context = await browser.newContext();
        page = await context.newPage();
        await loginToMT5(page);

        // Get account balance & margin
        logger.info('Fetching account balance and margin...');
        const { balance, equity, margin, freeMargin } = await getAccountBalanceAndMargin(page);
        trade.balance = balance;
        trade.equity = equity;
        trade.margin = margin;
        trade.freeMargin = freeMargin;
        logger.info(`💰 Balance: ${balance}, Equity: ${equity}, Margin: ${margin}, Free margin: ${freeMargin}`);

        // Select symbol & fetch bid/ask prices
        trade.symbol += config.TRADE_SYMBOL_SUFFIX;
        await selectSymbol(page, trade.symbol);
        
        const prices = await openOrderWindowAndGetPrices(page);
        trade.currentEntry = trade.orderType === 'Buy' ? prices.buyPrice : prices.sellPrice;
        logger.info(`💲 Current Entry Price: ${trade.currentEntry}`);

        // Calculate trade parameters based on real-time balance & margin
        logger.info('Calling calculateTradeParameters...');
        const updatedTrade = await calculateTradeParameters(trade, prices, balance);

        await sendMessage(chatId, "Calculating trade risk...");

        // Generate trade info table for confirmation
        logger.info('Creating trade info table...');
        const tradeInfoTable = createTradeInfoTable(updatedTrade, balance);
        await sendMessage(chatId, `<pre>${tradeInfoTable}</pre>`, true);

        // Execute trade if enabled
        if (executeTrade) {
            if (config.ENABLE_TRADE_EXECUTION) {
                logger.info('Executing trade...');
                await executeTradeOrders(page, updatedTrade, chatId, messageId);
            } else {
                await sendMessage(chatId, "Trade execution is currently disabled. No trades have been placed.");
            }
        }

    } catch (error) {
        console.error(`Error handling MetaTrader trade: ${error.message}`);
        await sendMessage(chatId, `There was an issue with the connection: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function calculateTradeParameters(trade, price, balance) {  
    // Determine the current entry price (bid/ask)
    trade.currentEntry = trade.orderType === 'Buy'
      ? parseFloat(price.bid)
      : parseFloat(price.ask);
  
    // Calculate SL pips
    const stopLossPips = Math.abs(
      (trade.stopLoss - trade.currentEntry) / 
      (trade.symbol.includes('JPY') ? 0.01 : 0.0001)
    );
  
    // Calculate total risk amount
    const totalRiskAmount = trade.maxRisk
      ? trade.maxRisk
      : balance * trade.riskFactor;
  
    // Distribute risk across all TPs
    const lastTpRiskProportion = 0.5;
    const remainingRiskProportion = 1 - lastTpRiskProportion;
    const numOtherTPs = trade.takeProfits.length - 1;
    const riskProportions = [];
  
    if (numOtherTPs > 0) {
      const riskPerOtherTP = remainingRiskProportion / numOtherTPs;
      for (let i = 0; i < trade.takeProfits.length; i++) {
        riskProportions[i] = (i === trade.takeProfits.length - 1)
          ? lastTpRiskProportion
          : riskPerOtherTP;
      }
    } else {
      riskProportions[0] = 1;
    }
  
    // Calculate position sizes
    const positionSizePerTP = [];
    let totalPositionSize = 0;
    const potentialLossPerTP = [];
  
    for (let i = 0; i < trade.takeProfits.length; i++) {
      const riskPerTP = totalRiskAmount * riskProportions[i];
      let positionSize;
  
      if (trade.lotSize) {
        // Use specified lot size if provided
        positionSize = trade.lotSize / trade.takeProfits.length;
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
  
      // Potential loss per TP
      potentialLossPerTP[i] = positionSize * config.PIP_VALUE * stopLossPips;
    }
  
    const potentialTotalLoss = potentialLossPerTP.reduce((a, b) => a + b, 0);
  
    // Store results in trade object
    trade.positionSizePerTP = positionSizePerTP;
    trade.potentialLossPerTP = potentialLossPerTP;
    trade.totalPositionSize = Math.round(totalPositionSize * 100) / 100;
    trade.potentialTotalLoss = potentialTotalLoss;
    trade.stopLossPips = stopLossPips;
  
    // Calculate pips for each TP (for display)
    trade.takeProfitPips = trade.takeProfits.map(tp => Math.abs(
      (tp - trade.currentEntry) /
      (trade.symbol.includes('JPY') ? 0.01 : 0.0001)
    ));
  
    // -------------------------
    //  NEW: Approximate Margin
    // -------------------------
    // Example formula: (price * totalPositionSize * contractSize) / leverage
    // Adjust contractSize or leverage to your broker's actual values.
  
    const contractSize = config.CONTRACT_SIZE; // e.g., 1 lot = 100k units
    const leverage = config.LEVERAGE;            // e.g., 1:500 leverage
  
    // The "notional value" of this position:
    const notionalValue = trade.currentEntry * (trade.totalPositionSize * contractSize);
  
    // Estimate margin required for the total position size:
    const marginRequired = notionalValue / leverage;
  
    trade.marginInfo = {
      margin: marginRequired
    };
  
    // If you want to see how this compares to the actual margin or free margin:
    // console.log("trade.margin (from UI)    =>", trade.margin);
    // console.log("trade.freeMargin (from UI) =>", trade.freeMargin);
    // console.log("Calculated marginRequired  =>", marginRequired);
  
    return trade;
  }  


function createTradeInfoTable(trade, balance) {
  let takeProfitsStr = trade.takeProfits.map(
      (tp, index) => `TP${index + 1}: ${tp}`
  ).join('\n');

  let warningMessage;
  if (trade.marginRequired > trade.freeMargin) {
    warningMessage = `❌❌❌❌❌ WARNING: You do NOT have enough free margin to open this trade!❌❌❌❌\n\n`;
  } else {
    warningMessage = "";
  }

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
Equity: ${config.CURRENCY_SYMBOL}${trade.equity}
Margin: ${config.CURRENCY_SYMBOL}${trade.margin}
Free Margin: ${trade.freeMargin}
Margin Required: ${config.CURRENCY_SYMBOL}${trade.marginInfo.margin.toFixed(2)}
${warningMessage}
Total Position Size: ${trade.totalPositionSize.toFixed(2)}

Position Sizes and Potential Loss per TP:
`;

  trade.takeProfits.forEach((tp, index) => {
    table += `TP${index + 1}: Position Size: ${trade.positionSizePerTP[index].toFixed(2)}, Potential Loss: ${config.CURRENCY_SYMBOL}${trade.potentialLossPerTP[index].toFixed(2)}\n`;
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

/**
 * Iterates through all take-profits and places trades accordingly.
 */
async function executeTradeOrders(page, trade, chatId, messageId) {
    await sendMessage(chatId, "Entering trade on MetaTrader Account...");

    // Trailing stop loss is not possible since we are using the web terminal

    for (let i = 0; i < trade.takeProfits.length; i++) {
        const tpPrice = trade.takeProfits[i];
        const volume = trade.positionSizePerTP[i];
        const comment = `${trade.signalSource} TP${i + 1}`.substring(0, 31);

        logger.info(`Placing order for TP${i + 1} => Volume: ${volume}, SL: ${trade.stopLoss}, TP: ${tpPrice}`);

        await sendMessage(chatId, `<pre>Placing trade: ${comment} for TP${i + 1}</pre>`, true);

        try {
            // Fill the order form for this TP
            await fillOrderForm(page, volume, trade.stopLoss, tpPrice, comment);

            // Place the order
            await placeOrder(page, trade.orderType);

            await page.waitForTimeout(500); // Allow UI to update
            await openNewOrderUsingShortcut(page);
            await page.waitForTimeout(1000); // Allow UI to update

        } catch (error) {
            logger.error(`Error placing trade for TP${i + 1}: ${error.message}`);
            await sendMessage(chatId, `Failed to place trade for TP${i + 1}.`);
        }
    }

    await sendMessage(chatId, "<b>Trade entered successfully! ✅</b>", true);
}

/**
 * Launches a browser instance (local or AWS Lambda).
 */
async function launchBrowser() {
    if (process.env.AWS_EXECUTION_ENV) {
        return await playwrightAwsLambda.launchChromium({ headless: true });
    } else {
        // return await chromium.launch({ headless: true });
        return await playwrightAwsLambda.launchChromium({ headless: true });
    }
}

module.exports = { handleMt5TraderTrade };
