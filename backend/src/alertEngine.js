// In-memory state. Fine for a single-user personal tool; restart clears history
// (which just means the rolling window has to refill, nothing is lost).
const priceHistory = new Map(); // symbol -> [{ price, timestamp }]
const lastAlertAt = new Map(); // symbol -> timestamp
const latestPrices = new Map(); // symbol -> quote

function recordTick(symbol, price, windowMinutes) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const history = priceHistory.get(symbol) || [];
  history.push({ price, timestamp: now });
  const pruned = history.filter((t) => now - t.timestamp <= windowMs + 60000);
  priceHistory.set(symbol, pruned);
}

function setLatestPrice(symbol, quote) {
  latestPrices.set(symbol, quote);
}

function getLatestPrice(symbol) {
  return latestPrices.get(symbol) || null;
}

function checkQuickMove(symbol, windowMinutes, thresholdPercent, cooldownMinutes) {
  const history = priceHistory.get(symbol) || [];
  if (history.length < 2) return { triggered: false };

  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStartTick = history.find((t) => now - t.timestamp <= windowMs) || history[0];
  const current = history[history.length - 1];

  const pctChange = ((current.price - windowStartTick.price) / windowStartTick.price) * 100;

  const cooldownMs = cooldownMinutes * 60 * 1000;
  const last = lastAlertAt.get(symbol) || 0;
  if (now - last < cooldownMs) {
    return { triggered: false, pctChange: Number(pctChange.toFixed(2)) };
  }

  if (Math.abs(pctChange) >= thresholdPercent) {
    lastAlertAt.set(symbol, now);
    return {
      triggered: true,
      pctChange: Number(pctChange.toFixed(2)),
      direction: pctChange > 0 ? 'RISE' : 'FALL',
      price: current.price,
    };
  }

  return { triggered: false, pctChange: Number(pctChange.toFixed(2)) };
}

module.exports = { recordTick, checkQuickMove, setLatestPrice, getLatestPrice };
