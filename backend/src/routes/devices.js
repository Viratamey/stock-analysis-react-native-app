const express = require('express');
const db = require('../db');

const router = express.Router();

router.post('/', (req, res) => {
  const { expoPushToken } = req.body;
  if (!expoPushToken) return res.status(400).json({ error: 'expoPushToken is required' });

  const exists = db.get('devices').find({ expoPushToken }).value();
  if (!exists) {
    db.get('devices').push({ expoPushToken, registeredAt: Date.now() }).write();
  }
  res.status(200).json({ ok: true });
});

module.exports = router;
