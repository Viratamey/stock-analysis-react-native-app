const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const alerts = db.get('alerts').sortBy('timestamp').reverse().take(50).value();
  res.json(alerts);
});

module.exports = router;
