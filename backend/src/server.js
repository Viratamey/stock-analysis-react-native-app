const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const requireApiKey = require('./middleware/apiKey');
const watchlistRouter = require('./routes/watchlist');
const devicesRouter = require('./routes/devices');
const alertsRouter = require('./routes/alerts');
const screenerRouter = require('./routes/screener');
const { startScheduler } = require('./scheduler');
const { warmScreener } = require('./screener');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, time: Date.now() }));

app.use('/watchlist', requireApiKey, watchlistRouter);
app.use('/devices', requireApiKey, devicesRouter);
app.use('/alerts', requireApiKey, alertsRouter);
app.use('/screener', requireApiKey, screenerRouter);

app.listen(PORT, () => {
  console.log(`Stock alert backend running on port ${PORT}`);
  startScheduler();
  warmScreener();
});