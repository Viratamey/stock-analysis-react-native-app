const express = require('express');
const { UNIVERSE } = require('../universe');
const { scanMarket } = require('../screener');
const { scanSteady } = require('../steadyScreener');

const router = express.Router();

router.get('/', async (req, res) => {
  const market = String(req.query.market || 'IN').toUpperCase();
  if (!UNIVERSE[market]) return res.status(400).json({ error: 'market must be IN or US' });
  try {
    res.json(await scanMarket(market, req.query.refresh === '1'));
  } catch (err) {
    res.status(502).json({ error: `Screener failed: ${err.message}` });
  }
});

// GET /screener/steady?market=IN&years=4&maxFall=12&mode=drawdown|return
router.get('/steady', async (req, res) => {
  const market = String(req.query.market || 'IN').toUpperCase();
  if (!UNIVERSE[market]) return res.status(400).json({ error: 'market must be IN or US' });
  const years = Math.min(Math.max(Number(req.query.years) || 4, 1), 4);
  const maxFall = Math.min(Math.max(Number(req.query.maxFall) || 12, 1), 90);
  const mode = ['drawdown', 'return'].includes(req.query.mode) ? req.query.mode : 'drawdown';
  try {
    res.json(await scanSteady(market, { years, maxFall, mode }, req.query.refresh === '1'));
  } catch (err) {
    res.status(502).json({ error: `Steady screener failed: ${err.message}` });
  }
});

module.exports = router;