const { getHistoricalCloses } = require('./priceFeed');
const { VOLATILITY_LOOKBACK_DAYS, VOLATILITY_STABLE_CUTOFF } = require('./config');

// Annualized volatility = stdev(daily returns) * sqrt(252 trading days) * 100.
// This is a standard, simple volatility heuristic - not a guarantee of "safety".
function computeAnnualizedVolatilityPercent(closes) {
  if (closes.length < 2) return null;

  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const dailyStdDev = Math.sqrt(variance);
  const annualized = dailyStdDev * Math.sqrt(252) * 100;

  return Number(annualized.toFixed(2));
}

async function checkStability(symbol) {
  const closes = await getHistoricalCloses(symbol, VOLATILITY_LOOKBACK_DAYS);
  const volatilityPercent = computeAnnualizedVolatilityPercent(closes);
  const stable = volatilityPercent !== null && volatilityPercent <= VOLATILITY_STABLE_CUTOFF;
  return { stable, volatilityPercent };
}

module.exports = { computeAnnualizedVolatilityPercent, checkStability };
