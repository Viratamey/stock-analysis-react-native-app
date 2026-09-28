const axios = require('axios');

// Unofficial Yahoo Finance chart endpoint. No API key needed, but it can be
// rate-limited or changed without notice - see README "Limitations".
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';

async function getQuote(symbol) {
  const { data } = await axios.get(`${YAHOO_CHART_URL}${symbol}`, {
    params: { interval: '1m', range: '1d' },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 8000,
  });

  const result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result) throw new Error(`No quote data for ${symbol}`);

  const meta = result.meta;
  return {
    symbol,
    price: meta.regularMarketPrice,
    previousClose: meta.previousClose,
    currency: meta.currency,
    timestamp: Date.now(),
  };
}

async function getHistoricalCloses(symbol, days = 30) {
  const { data } = await axios.get(`${YAHOO_CHART_URL}${symbol}`, {
    params: { interval: '1d', range: `${Math.ceil(days / 21)}mo` },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 8000,
  });

  const result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result) throw new Error(`No historical data for ${symbol}`);

  const quote0 = result.indicators && result.indicators.quote && result.indicators.quote[0];
  const closes = (quote0 && quote0.close) || [];
  return closes.filter((c) => typeof c === 'number').slice(-days);
}

// Daily closes WITH timestamps over a long range (Yahoo range: 1y, 2y, 5y, 10y).
// Uses adjusted close (splits + dividends) when available so a split or a
// dividend payout is not mistaken for a price crash.
async function getHistoricalSeries(symbol, range = '5y') {
  const { data } = await axios.get(`${YAHOO_CHART_URL}${symbol}`, {
    params: { interval: '1d', range },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });

  const result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result) throw new Error(`No historical data for ${symbol}`);

  const times = result.timestamp || [];
  const ind = result.indicators || {};
  const adj = ind.adjclose && ind.adjclose[0] && ind.adjclose[0].adjclose;
  const raw = ind.quote && ind.quote[0] && ind.quote[0].close;
  const closes = adj || raw || [];

  const series = [];
  for (let i = 0; i < times.length; i++) {
    if (typeof closes[i] === 'number') series.push({ t: times[i] * 1000, close: closes[i] });
  }
  return series;
}

module.exports = { getQuote, getHistoricalCloses, getHistoricalSeries };
