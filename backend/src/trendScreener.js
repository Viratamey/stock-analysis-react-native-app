const { getHistoricalCloses } = require("./priceFeed");
const { GROWTH_LOOKBACK_DAYS, GROWTH_MIN_RETURN_PERCENT } = require("./config");

// "Growing" = up over the long run AND still trading above its own average
// for that period right now - a stock that was up big six months ago but has
// since rolled over and sits below its average doesn't count.
async function checkGrowthTrend(symbol) {
  const closes = await getHistoricalCloses(symbol, GROWTH_LOOKBACK_DAYS);
  if (closes.length < 10) return { growing: null, longTermReturnPercent: null };

  const first = closes[0];
  const last = closes[closes.length - 1];
  const longTermReturnPercent = Number((((last - first) / first) * 100).toFixed(2));

  const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
  const growing = longTermReturnPercent >= GROWTH_MIN_RETURN_PERCENT && last >= sma;

  return { growing, longTermReturnPercent, smaPrice: Number(sma.toFixed(2)) };
}

module.exports = { checkGrowthTrend };