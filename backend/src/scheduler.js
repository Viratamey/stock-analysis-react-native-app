const db = require("./db");
const { getQuote } = require("./priceFeed");
const { checkStability } = require("./volatilityScreener");
const { checkGrowthTrend } = require("./trendScreener");
const { recordTick, checkQuickMove, setLatestPrice } = require("./alertEngine");
const { sendPushNotification } = require("./pushService");
const {
  POLL_INTERVAL_SECONDS,
  MARKET_OPEN,
  MARKET_CLOSE,
  ALERT_COOLDOWN_MINUTES,
} = require("./config");

const CLOSED_MARKET_REFRESH_MS = 5 * 60 * 1000;
let lastClosedFetchAt = 0;

function isMarketOpen() {
  const now = new Date();
  const istOffsetMinutes = 330;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMinutes = (utcMinutes + istOffsetMinutes) % (24 * 60);
  const istDay = new Date(now.getTime() + istOffsetMinutes * 60000).getUTCDay();

  if (istDay === 0 || istDay === 6) return false;

  const [openH, openM] = MARKET_OPEN.split(":").map(Number);
  const [closeH, closeM] = MARKET_CLOSE.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return istMinutes >= openMinutes && istMinutes <= closeMinutes;
}

async function refreshScreening() {
  const watchlist = db.get("watchlist").value();
  for (const entry of watchlist) {
    try {
      const { stable, volatilityPercent } = await checkStability(entry.symbol);
      const { growing, longTermReturnPercent, smaPrice } = await checkGrowthTrend(entry.symbol);
      db.get("watchlist")
        .find({ symbol: entry.symbol })
        .assign({
          stable,
          volatilityPercent,
          growing,
          longTermReturnPercent,
          smaPrice,
          lastCheckedStableAt: Date.now(),
        })
        .write();
    } catch (err) {
      console.error(`Screening failed for ${entry.symbol}:`, err.message);
    }
  }
}

async function pollOnce() {
  const marketOpen = isMarketOpen();

  if (!marketOpen) {
    const now = Date.now();
    if (now - lastClosedFetchAt < CLOSED_MARKET_REFRESH_MS) return;
    lastClosedFetchAt = now;
  }

  const watchlist = db.get("watchlist").value();
  const devices = db.get("devices").map("expoPushToken").value();

  for (const entry of watchlist) {
    try {
      const quote = await getQuote(entry.symbol);
      setLatestPrice(entry.symbol, quote);

      if (!marketOpen) continue;

      recordTick(entry.symbol, quote.price, entry.windowMinutes);

      const result = checkQuickMove(
        entry.symbol,
        entry.windowMinutes,
        entry.thresholdPercent,
        ALERT_COOLDOWN_MINUTES
      );

      // Only alert on a short-term move when the stock has passed BOTH
      // screens: low long-run volatility (stable) and a confirmed long-term
      // uptrend (growing). A dip on a quality uptrend reads as a possible
      // buy; a spike on one reads as a possible take-profit moment.
      const isQualityStock = entry.stable === true && entry.growing === true;

      if (result.triggered && isQualityStock) {
        const signal = result.direction === "FALL" ? "BUY_DIP" : "TAKE_PROFIT";
        const alert = {
          id: `${entry.symbol}-${Date.now()}`,
          symbol: entry.symbol,
          signal,
          direction: result.direction,
          pctChange: result.pctChange,
          price: result.price,
          windowMinutes: entry.windowMinutes,
          longTermReturnPercent: entry.longTermReturnPercent,
          volatilityPercent: entry.volatilityPercent,
          timestamp: Date.now(),
        };
        db.get("alerts").push(alert).write();

        const arrow = signal === "BUY_DIP" ? "🟢" : "🔴";
        const label = signal === "BUY_DIP" ? "Possible buy-the-dip" : "Possible take-profit";
        const title = `${arrow} ${entry.symbol}: ${label}`;
        const body = `${result.pctChange}% in ${entry.windowMinutes} min · ₹${result.price} · long-term +${entry.longTermReturnPercent}%, ${entry.volatilityPercent}% volatility`;

        for (const token of devices) {
          await sendPushNotification(token, title, body, alert);
        }
      }
    } catch (err) {
      console.error(`Poll failed for ${entry.symbol}:`, err.message);
    }
  }
}

function startScheduler() {
  refreshScreening();
  setInterval(refreshScreening, 24 * 60 * 60 * 1000);
  setInterval(pollOnce, POLL_INTERVAL_SECONDS * 1000);
  console.log(`Scheduler started: polling every ${POLL_INTERVAL_SECONDS}s, alerts gated on stable+growing`);
}

module.exports = { startScheduler, isMarketOpen };