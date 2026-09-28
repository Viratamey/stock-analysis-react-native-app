const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushNotification(expoPushToken, title, body, data = {}) {
  try {
    await axios.post(
      EXPO_PUSH_URL,
      { to: expoPushToken, sound: 'default', title, body, data, priority: 'high' },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`Failed to send push to ${expoPushToken}:`, err.message);
  }
}

module.exports = { sendPushNotification };
