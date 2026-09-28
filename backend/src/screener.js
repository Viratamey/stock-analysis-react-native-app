const { getHistoricalCloses } = require('./priceFeed');
const { computeAnnualizedVolatilityPercent } = require('./volatilityScreener');
const { UNIVERSE } = require('./universe');
const {
  VOLATILITY_LOOKBACK_DAYS,
  VOLATILITY_STABLE_CUTOFF,
  GROWTH_LOOKBACK_DAYS,
  GROWTH_MIN_RETURN_PERCENT,
} = require('./config');

const CACHE_MS = 15 * 60 * 1000;
const DIP_5D_PERCENT = 3;
const SPIKE_5D_PERCENT = 3;
const DIP_FROM_HIGH_PERCENT = 5;
const RANK = { DIP: 0, SPIKE: 1, NORMAL: 2 };

const cache = new Map();
const inflight = new Map();

const pct = (a, b) => ((a - b) / b) * 100;
const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
const r2 = (n) => Number(n.toFixed(2));

function roundToTick(price, market) {
  const tick = market === 'IN' ? 0.05 : 0.01;
  return Number((Math.round(price / tick) * tick).toFixed(2));
}

function buildIdea(status, m, market) {
  const stopPct = Math.max(3 * m.dailySigma, 0.02);
  let entry, target, type, note;

  if (status === 'DIP') {
    entry = m.last;
    target = m.sma20 > m.last * 1.01 ? m.sma20 : m.high20;
    type = 'BUY_DIP';
    note = 'Entry near the current price after the pullback. Target is the 20-day average (or the 20-day high if price is still above it). Stop is 3 daily standard deviations below entry, minimum 2%.';
  } else {
    entry = Math.min(m.sma20, m.last);
    target = Math.max(m.last, m.high20);
    type = 'WAIT_FOR_PULLBACK';
    note = 'Price has run up, so this waits for a pullback to the 20-day average instead of chasing. Target is the recent high. If you already hold it, the recent high is where a sell trigger would sit.';
  }

  const stop = entry * (1 - stopPct);
  const riskReward = (target - entry) / (entry - stop);

  return {
    type,
    entry: roundToTick(entry, market),
    stop: roundToTick(stop, market),
    target: roundToTick(target, market),
    riskPercent: r2(stopPct * 100),
    rewardPercent: r2(pct(target, entry)),
    riskReward: r2(riskReward),
    worthwhile: riskReward >= 1.5,
    note,
  };
}

async function analyze(symbol, market) {
  const closes = await getHistoricalCloses(symbol, GROWTH_LOOKBACK_DAYS);
  if (closes.length < 30) throw new Error('not enough history');

  const last = closes[closes.length - 1];
  const volatilityPercent = computeAnnualizedVolatilityPercent(closes.slice(-VOLATILITY_LOOKBACK_DAYS));
  if (volatilityPercent === null) throw new Error('could not compute volatility');

  const stable = volatilityPercent <= VOLATILITY_STABLE_CUTOFF;
  const dailySigma = volatilityPercent / 100 / Math.sqrt(252);

  const longTermReturnPercent = pct(last, closes[0]);
  const growing = longTermReturnPercent >= GROWTH_MIN_RETURN_PERCENT && last >= avg(closes);

  const last20 = closes.slice(-20);
  const high20 = Math.max(...last20);
  const sma20 = avg(last20);
  const change1dPercent = pct(last, closes[closes.length - 2]);
  const change5dPercent = pct(last, closes[closes.length - 6]);
  const fromHigh20Percent = pct(last, high20);

  let status = 'NORMAL';
  if (change5dPercent <= -DIP_5D_PERCENT || fromHigh20Percent <= -DIP_FROM_HIGH_PERCENT) status = 'DIP';
  else if (change5dPercent >= SPIKE_5D_PERCENT) status = 'SPIKE';

  const quality = stable && growing;
  const idea = quality && status !== 'NORMAL'
    ? buildIdea(status, { last, sma20, high20, dailySigma }, market)
    : null;

  return {
    symbol,
    market,
    currency: market === 'IN' ? '₹' : '$',
    price: r2(last),
    change1dPercent: r2(change1dPercent),
    change5dPercent: r2(change5dPercent),
    fromHigh20Percent: r2(fromHigh20Percent),
    volatilityPercent,
    longTermReturnPercent: r2(longTermReturnPercent),
    stable,
    growing,
    quality,
    status,
    idea,
  };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const idx = next++;
        results[idx] = await fn(items[idx]).catch((err) => ({ symbol: items[idx], error: err.message }));
      }
    })
  );
  return results;
}

async function scanMarket(market, force = false) {
  const cached = cache.get(market);
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  if (inflight.has(market)) return inflight.get(market);

  const job = (async () => {
    const results = await mapLimit(UNIVERSE[market], 4, (s) => analyze(s, market));
    const items = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error).map((r) => r.symbol);

    items.sort(
      (a, b) =>
        Number(b.quality) - Number(a.quality) ||
        RANK[a.status] - RANK[b.status] ||
        Math.abs(b.change5dPercent) - Math.abs(a.change5dPercent)
    );

    const data = { market, generatedAt: Date.now(), items, failed };
    if (items.length > 0) cache.set(market, { at: Date.now(), data });
    return data;
  })().finally(() => inflight.delete(market));

  inflight.set(market, job);
  return job;
}

function warmScreener() {
  ['IN', 'US'].forEach((m, i) => {
    setTimeout(() => scanMarket(m).catch(() => {}), 3000 + i * 20000);
  });
}

module.exports = { scanMarket, warmScreener };