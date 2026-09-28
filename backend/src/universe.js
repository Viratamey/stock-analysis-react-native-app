// Candidate pool only - the screener decides which are stable/growing today.
// Edit freely (NSE = .NS, BSE = .BO, US = plain ticker).
const UNIVERSE = {
  IN: [
    'HDFCBANK.NS', 'ICICIBANK.NS', 'TCS.NS', 'INFY.NS', 'RELIANCE.NS', 'HINDUNILVR.NS',
    'ITC.NS', 'ASIANPAINT.NS', 'NESTLEIND.NS', 'TITAN.NS', 'LT.NS', 'KOTAKBANK.NS',
    'MARUTI.NS', 'SBIN.NS', 'SUNPHARMA.NS', 'BRITANNIA.NS', 'POWERGRID.NS', 'ULTRACEMCO.NS',
  ],
  US: [
    'AAPL', 'MSFT', 'GOOGL', 'JNJ', 'PG', 'KO', 'PEP', 'WMT', 'COST',
    'V', 'MA', 'HD', 'MCD', 'JPM', 'UNH', 'ABBV', 'LIN', 'BRK-B',
  ],
};

module.exports = { UNIVERSE };