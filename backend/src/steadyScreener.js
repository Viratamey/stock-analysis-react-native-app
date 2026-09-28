const { getHistoricalSeries } = require('./priceFeed');
const { UNIVERSE } = require('./universe');
const { computeAnnualizedVolatilityPercent } = require('./volatilityScreener');
const {
  STEADY_MAX_FALL_PERCENT,
  STEADY_WINDOW_MONTHS,
  STEADY_LOOKBACK_YEARS,
} = require('./config');

const CACHE_MS = 6 * 60 * 60 * 1000; // history barely changes intraday
const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new Map();
const inflight = new Map();
const r2 = (n) => Number(n.toFixed(2));

// Pure function (no network) so it can be unit-tested.
//
// For every trading day in the last `years` years, look at the window of
// `windowMonths` months ending that day and measure:
//   - windowReturn: price at window end vs price at window start
//   - windowDrawdown: worst peak-to-trough fall INSIDE the window
// then keep the worst of each across all windows.
function analyzeSteadiness(series, { years, windowMonths, maxFallPercent, mode = 'drawdown' }) {
  const windowMs = windowMonths * 30.4375 * DAY_MS;
  const lastT = series[series.length - 1].t;
  const evalFrom = lastT - years * 365.25 * DAY_MS;

  // Need history reaching back a full window before the first window we test.
  if (series[0].t > evalFrom - windowMs + 10 * DAY_MS) return { insufficientHistory: true };

  let worstReturn = Infinity;
  let bestReturn = -Infinity;
  let worstDrawdown = 0;
  let worstWindowEnd = null;
  let windows = 0;
  let start = 0; // left edge of the window, moves forward as end moves forward

  for (let end = 0; end < series.length; end++) {
    if (series[end].t < evalFrom) continue;
    while (series[start].t < series[end].t - windowMs) start++;

    // return over the window
    const ret = ((series[end].close - series[start].close) / series[start].close) * 100;

    // worst peak-to-trough inside [start, end]
    let peak = series[start].close;
    let dd = 0;
    for (let k = start; k <= end; k++) {
      if (series[k].close > peak) peak = series[k].close;
      const d = ((series[k].close - peak) / peak) * 100;
      if (d < dd) dd = d;
    }

    windows++;
    if (ret < worstReturn) worstReturn = ret;
    if (ret > bestReturn) bestReturn = ret;
    if (dd < worstDrawdown) {
      worstDrawdown = dd;
      worstWindowEnd = series[end].t;
    }
  }

  if (windows === 0) return { insufficientHistory: true };

  let steady;
  // Only FALLS are limited. Rises of any size are welcome.
  if (mode === 'return') steady = worstReturn >= -maxFallPercent;
  else steady = worstDrawdown >= -maxFallPercent;

  return {
    steady,
    windows,
    worstDrawdownPercent: r2(worstDrawdown),
    worstReturnPercent: r2(worstReturn),
    bestReturnPercent: r2(bestReturn),
    worstWindowEnd,
  };
}


const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
const pct = (a, b) => ((a - b) / b) * 100;

function roundToTick(price, market) {
  const tick = market === 'IN' ? 0.05 : 0.01;
  return Number((Math.round(price / tick) * tick).toFixed(2));
}

// Pure function: turns a steady stock's daily closes into GTT-style levels.
// Steady stocks rarely fall far, so the plan is "buy the dip / pullback, book profit
// into strength". Levels come from past prices and are not predictions.
function buildGttPlan(closes, market) {
  if (closes.length < 60) return null;
  const last = closes[closes.length - 1];
  const last20 = closes.slice(-20);
  const high20 = Math.max(...last20);
  const sma20 = avg(last20);
  const high52w = Math.max(...closes.slice(-252));
  const vol = computeAnnualizedVolatilityPercent(closes.slice(-30));
  if (vol === null) return null;

  const dailySigma = vol / 100 / Math.sqrt(252);
  const change5dPercent = pct(last, closes[closes.length - 6]);
  const fromHigh20Percent = pct(last, high20);

  let status = 'NORMAL';
  if (change5dPercent <= -3 || fromHigh20Percent <= -5) status = 'DIP';
  else if (change5dPercent >= 3) status = 'SPIKE';

  const stopPct = Math.max(3 * dailySigma, 0.02); // 3 daily std-devs, at least 2%
  const R = (base) => base * stopPct; // 1R in price terms

  // ---- New buy (GTT buy trigger) ----
  const entry = status === 'DIP' ? last : Math.min(sma20, last);
  const stop = entry - R(entry);
  const t1 = Math.max(high20, entry + 1.5 * R(entry)); // recent high, or 1.5x risk if higher
  let t2 = Math.max(high52w, entry + 3 * R(entry)); // 52-week high, or 3x risk if higher
  if (t2 < t1 * 1.01) t2 = null;

  // ---- Already holding (GTT sell triggers / OCO) ----
  const hStop = last - R(last);
  const hT1 = Math.max(high20, last + 1.5 * R(last));
  let hT2 = Math.max(high52w, last + 3 * R(last));
  if (hT2 < hT1 * 1.01) hT2 = null;

  const rt = (n) => (n === null ? null : roundToTick(n, market));
  return {
    status,
    change5dPercent: r2(change5dPercent),
    fromHigh20Percent: r2(fromHigh20Percent),
    volatilityPercent: vol,
    buy: {
      type: entry >= last * 0.995 ? 'BUY_NOW' : 'WAIT_FOR_PULLBACK',
      trigger: rt(entry),
      stop: rt(stop),
      stopPercent: r2(stopPct * 100),
      target1: rt(t1),
      target1Percent: r2(pct(t1, entry)),
      target2: rt(t2),
      target2Percent: t2 === null ? null : r2(pct(t2, entry)),
    },
    hold: {
      stop: rt(hStop),
      target1: rt(hT1),
      target1Percent: r2(pct(hT1, last)),
      target2: rt(hT2),
      target2Percent: hT2 === null ? null : r2(pct(hT2, last)),
    },
  };
}

async function analyze(symbol, market, opts) {
  const series = await getHistoricalSeries(symbol, '5y');
  if (series.length < 200) throw new Error('not enough history');

  const res = analyzeSteadiness(series, opts);
  if (res.insufficientHistory) {
    return { symbol, market, currency: market === 'IN' ? '₹' : '$', steady: false, insufficientHistory: true };
  }

  const closes = series.map((p) => p.close);
  const last = closes[closes.length - 1];
  const first = closes[0];
  const gtt = res.steady ? buildGttPlan(closes, market) : null;
  return {
    symbol,
    market,
    currency: market === 'IN' ? '₹' : '$',
    price: r2(last),
    ...res,
    fiveYearReturnPercent: r2(((last - first) / first) * 100),
    status: gtt ? gtt.status : null,
    change5dPercent: gtt ? gtt.change5dPercent : null,
    gtt,
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]).catch((e) => ({ symbol: items[i], error: e.message }));
      }
    })
  );
  return out;
}

async function scanSteady(market, overrides = {}, force = false) {
  const opts = {
    years: overrides.years || STEADY_LOOKBACK_YEARS,
    windowMonths: STEADY_WINDOW_MONTHS,
    maxFallPercent: overrides.maxFall || STEADY_MAX_FALL_PERCENT,
    mode: overrides.mode || 'drawdown',
  };
  const key = `${market}:${opts.years}:${opts.maxFallPercent}:${opts.mode}`;

  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  if (inflight.has(key)) return inflight.get(key);

  const job = (async () => {
    const results = await mapLimit(UNIVERSE[market], 4, (s) => analyze(s, market, opts));
    const failed = results.filter((r) => r.error).map((r) => r.symbol);
    const items = results.filter((r) => !r.error && !r.insufficientHistory);
    const tooNew = results.filter((r) => r.insufficientHistory).map((r) => r.symbol);

    // Steady first, then dips (best buy setups) before spikes before normal,
    // then the shallowest historical fall on top.
    const RANK = { DIP: 0, SPIKE: 1, NORMAL: 2 };
    items.sort(
      (a, b) =>
        Number(b.steady) - Number(a.steady) ||
        (RANK[a.status] ?? 3) - (RANK[b.status] ?? 3) ||
        b.worstDrawdownPercent - a.worstDrawdownPercent
    );

    const data = { market, criteria: opts, generatedAt: Date.now(), items, failed, tooNew };
    if (items.length > 0) cache.set(key, { at: Date.now(), data });
    return data;
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
}

module.exports = { scanSteady, analyzeSteadiness, buildGttPlan };
