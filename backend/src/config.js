require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 4000,
  API_KEY: process.env.API_KEY || "changeme",
  POLL_INTERVAL_SECONDS: Number(process.env.POLL_INTERVAL_SECONDS || 20),
  MARKET_OPEN: process.env.MARKET_OPEN || "09:15",
  MARKET_CLOSE: process.env.MARKET_CLOSE || "15:30",
  DEFAULT_THRESHOLD_PERCENT: Number(process.env.DEFAULT_THRESHOLD_PERCENT || 1.5),
  DEFAULT_WINDOW_MINUTES: Number(process.env.DEFAULT_WINDOW_MINUTES || 5),
  ALERT_COOLDOWN_MINUTES: Number(process.env.ALERT_COOLDOWN_MINUTES || 10),
  VOLATILITY_LOOKBACK_DAYS: Number(process.env.VOLATILITY_LOOKBACK_DAYS || 30),
  VOLATILITY_STABLE_CUTOFF: Number(process.env.VOLATILITY_STABLE_CUTOFF || 25),
  GROWTH_LOOKBACK_DAYS: Number(process.env.GROWTH_LOOKBACK_DAYS || 180),
  // "Steady" screen: no 12-month window in the last N years may fall by more than this.
  STEADY_MAX_FALL_PERCENT: Number(process.env.STEADY_MAX_FALL_PERCENT || 12),
  STEADY_WINDOW_MONTHS: Number(process.env.STEADY_WINDOW_MONTHS || 12),
  STEADY_LOOKBACK_YEARS: Number(process.env.STEADY_LOOKBACK_YEARS || 4),
  GROWTH_MIN_RETURN_PERCENT: Number(process.env.GROWTH_MIN_RETURN_PERCENT || 8),
};