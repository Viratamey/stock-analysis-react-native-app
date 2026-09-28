const express = require("express");
const db = require("../db");
const { getLatestPrice } = require("../alertEngine");
const { getQuote } = require("../priceFeed");
const { DEFAULT_THRESHOLD_PERCENT, DEFAULT_WINDOW_MINUTES } = require("../config");

const router = express.Router();

router.get("/", (req, res) => {
  const watchlist = db.get("watchlist").value();
  const enriched = watchlist.map((entry) => ({
    ...entry,
    latest: getLatestPrice(entry.symbol),
  }));
  res.json(enriched);
});

router.post("/", async (req, res) => {
  const { symbol, thresholdPercent, windowMinutes } = req.body;
  if (!symbol) return res.status(400).json({ error: "symbol is required" });

  const normalized = symbol.trim().toUpperCase();
  const exists = db.get("watchlist").find({ symbol: normalized }).value();
  if (exists) return res.status(409).json({ error: "Symbol already in watchlist" });

  // Validate against the real market feed before accepting it - rejects
  // typos and made-up symbols instead of silently storing them.
  let quote;
  try {
    quote = await getQuote(normalized);
    if (quote.price == null) throw new Error("no price returned");
  } catch (err) {
    return res.status(400).json({
      error: `Could not verify "${normalized}" against live market data. Check the symbol (e.g. RELIANCE.NS for NSE) and try again.`,
    });
  }

  const entry = {
    symbol: normalized,
    thresholdPercent: thresholdPercent || DEFAULT_THRESHOLD_PERCENT,
    windowMinutes: windowMinutes || DEFAULT_WINDOW_MINUTES,
    stable: null,
    volatilityPercent: null,
    addedAt: Date.now(),
  };

  db.get("watchlist").push(entry).write();
  res.status(201).json({ ...entry, latest: quote });
});

router.delete("/:symbol", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  db.get("watchlist").remove({ symbol }).write();
  res.status(204).end();
});

module.exports = router;