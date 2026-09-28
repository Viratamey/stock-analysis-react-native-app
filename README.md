# Stock Quick-Move Alert App

A React Native app + Node.js backend that watches a list of stocks you consider
"stable" (blue-chip / low-volatility) and pushes a phone notification the moment
one of them makes an unusually fast move - so you can jump into your broker app
and place or adjust a GTT order while the move is still fresh.

**This app only alerts you. It never places, modifies, or cancels a trade.**
The actual GTT order still happens in your existing broker app (Zerodha,
Upstox, Groww, etc.) - by design, since order placement touches real money and
deserves a human decision each time.

---

## 1. Why a backend at all (not just the phone app)?

The instinct is "just poll prices on the phone." Two problems with that:

- **iOS and Android both throttle background work.** A backgrounded app
  might only get a background-fetch tick every 15-30 minutes on iOS - useless
  for catching a move that happens over 5 minutes.
- **If the phone is asleep, locked, or the app is killed, on-device polling
  stops entirely.**

So the architecture puts the always-on polling loop on a small server
(something you can run on a free-tier host, a $5 VPS, or even an EC2 t3.micro
you already know how to manage). The server does the watching and pushes a
notification through Expo's push service the instant a threshold is crossed.
The phone app itself is mostly a control panel: manage your watchlist, view
live prices, and receive the push.

```
 Yahoo Finance          Node.js backend             Expo Push Service        Your phone
 (price data)   ----->  (polls every 15-30s,  ----> (delivers the      ----> (React Native
                        computes % moves,           notification even         app - shows
                        applies volatility           if your app is           dashboard,
                        filter, stores alerts)       closed)                  watchlist,
                              ^                                               alert history)
                              |                                                    |
                              +-------------- REST API (watchlist, alerts) <-------+
```

---

## 2. How "quick move" detection works

For every symbol in your watchlist, the backend keeps a rolling buffer of
recent prices (pruned to your configured window, e.g. the last 5 minutes).

On every poll tick it compares the **current price** to the **price at the
start of that window**:

```
% change = (current_price - price_at_window_start) / price_at_window_start * 100
```

If `abs(% change) >= your threshold` (e.g. 1.5%), it fires an alert - subject
to a cooldown (default 10 minutes) so you don't get spammed by the same symbol
oscillating around the threshold.

Both the threshold % and the window (minutes) are configurable **per stock**
from the Watchlist screen, so you can be tighter on a large-cap you watch
closely and looser on others.

## 3. How "stable" is decided

"Stable" is approximated with a standard volatility heuristic, computed once a
day from the last 30 daily closes:

```
daily_return[i] = (close[i] - close[i-1]) / close[i-1]
annualized_volatility % = stdev(daily_returns) * sqrt(252) * 100
```

A stock is flagged **stable** if that number is at or below a cutoff (default
25%). Alerts are suppressed for stocks the screen flags as **not** stable, so
a penny stock or a stock mid-crisis doesn't flood you with "quick move" pings
that are really just its normal noise.

This is a heuristic, not a guarantee - a "stable" large-cap can still gap
violently on real news (an earnings miss, a regulatory action, etc.). Treat
every alert as "go look at the chart," not as a buy/sell signal by itself.

---

## 4. Project structure

```
stock-alert-app/
├── README.md              <- this file
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js          Express app entrypoint
│       ├── config.js          env-driven settings
│       ├── db.js              lowdb (flat-file JSON) persistence
│       ├── priceFeed.js       Yahoo Finance quote + history fetch
│       ├── volatilityScreener.js   "stable" classification
│       ├── alertEngine.js     rolling-window % change + cooldown logic
│       ├── pushService.js     Expo push notification sender
│       ├── scheduler.js       market-hours polling loop
│       ├── middleware/apiKey.js
│       └── routes/{watchlist,devices,alerts}.js
└── mobile/
    ├── App.js
    └── src/
        ├── api/client.js              axios client + stored backend URL/key
        ├── context/AppContext.js      watchlist/alerts state
        ├── notifications/pushSetup.js Expo push token registration
        └── screens/{Dashboard,Watchlist,Alerts,Settings}Screen.js
```

The mobile side doesn't ship a `package.json` - Step 6 below has you scaffold
a fresh Expo project (so you always get dependency versions matched to the
current Expo SDK) and drop these files in.

---

## 5. Step-by-step setup

### Step 1 - Prerequisites
- Node.js 18+ and npm on your dev machine
- The **Expo Go** app installed on your phone (App Store / Play Store) - you
  need a physical device, since push notifications don't work in a simulator
- A free account on a host that can run a small always-on Node service, e.g.
  Render, Railway, or Fly.io - or, given you already work with AWS, an EC2
  t3.micro / a small always-on Lambda + EventBridge schedule works just as
  well and keeps everything in infra you already know

### Step 2 - Run the backend locally first
```bash
cd stock-alert-app/backend
npm install
cp .env.example .env
# edit .env: set API_KEY to something private, adjust thresholds if you like
npm start
```
Check it's alive:
```bash
curl http://localhost:4000/health
```
Add a test symbol (NSE symbols need the `.NS` suffix, BSE uses `.BO`):
```bash
curl -X POST http://localhost:4000/watchlist \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your API_KEY>" \
  -d '{"symbol":"RELIANCE.NS","thresholdPercent":1.5,"windowMinutes":5}'
```

### Step 3 - Deploy the backend so it runs even when your laptop is off
Push the `backend/` folder to a GitHub repo, then either:
- **Render/Railway**: connect the repo, set the same env vars from `.env`,
  deploy as a "Web Service." Note free tiers on some hosts sleep after
  inactivity - fine for testing, not ideal for continuous market-hours
  monitoring, so a small paid instance (or your own EC2 box) is more reliable
  long-term.
- **AWS EC2**: a t3.micro running `pm2 start src/server.js` behind your
  existing ALB/NLB setup works well and matches infra you already run.

Note the deployed base URL (e.g. `https://your-app.onrender.com`).

### Step 4 - Scaffold the Expo app
```bash
npx create-expo-app stock-alert-mobile
cd stock-alert-mobile
```
Copy the provided `mobile/App.js` and the whole `mobile/src/` folder into this
new project, overwriting the default `App.js`.

### Step 5 - Install the mobile dependencies
```bash
npx expo install @react-navigation/native @react-navigation/bottom-tabs \
  react-native-screens react-native-safe-area-context \
  expo-notifications expo-device \
  @react-native-async-storage/async-storage axios @expo/vector-icons
```
`expo install` (rather than plain `npm install`) picks versions that match
your Expo SDK, which avoids a whole category of native-module version
mismatches.

### Step 6 - Run it
```bash
npx expo start
```
Scan the QR code with Expo Go on your phone.

### Step 7 - Connect the app to your backend
Open the **Settings** tab, enter your deployed backend URL and the API key
you set in `.env`, tap Save. This registers your phone's push token with the
backend.

### Step 8 - Build your watchlist
In the **Watchlist** tab, add symbols (e.g. `RELIANCE.NS`, `TCS.NS`,
`HDFCBANK.NS`) with the threshold % and window (minutes) you want for each.

### Step 9 - Let it run
During NSE market hours (9:15 AM-3:30 PM IST, Mon-Fri) the backend polls,
screens for stability once a day, and pushes a notification the moment a
stable stock on your list clears its threshold. That notification is your cue
to open your broker app and act.

### Step 10 - Test the alert loop end-to-end
Real "quick moves" that clear a sensible threshold don't happen on demand, so
to verify wiring: temporarily set a symbol's threshold very low (e.g. 0.1%)
and window to 2 minutes during market hours - ordinary tick noise should
trigger a push within a couple of minutes. Revert the threshold afterward.

---

## 6. Optional next step: auto-placing the GTT order

You asked for alerts so *you* can act via GTT - that's what's built here. If
you later want the backend to place the GTT order automatically the moment it
fires, both **Upstox** and **Zerodha (Kite Connect)** expose order-placement
APIs that support GTT. That's a meaningful step up in scope and risk (broker
developer registration, daily access-token refresh, and code that can move
real money without you in the loop), so it's deliberately left out of this
build - happy to add it as a follow-up once you've trusted the alerts for a
while.

---

## 7. Limitations

- **The Yahoo Finance endpoint used here is unofficial and undocumented.**
  It's widely used for hobby projects but can be rate-limited or changed
  without notice. For production-grade reliability, swap `priceFeed.js` for
  Upstox's API (free for personal use) or Zerodha Kite Connect (paid, market
  data add-on).
- Prices are polled every 15-30 seconds by default, not tick-by-tick.
- "Stable" is a volatility heuristic, not a guarantee against a sudden
  news-driven move.
- A fast % move is not automatically a profitable trade once brokerage,
  slippage, and taxes are counted - the app's job is to get your attention,
  not to make the call for you.
- If the backend host is asleep or down, you won't get alerts during that
  time - worth an uptime check (e.g. a free UptimeRobot ping to `/health`).

## 8. Troubleshooting

- **No push notification arrives**: confirm you're on a physical device (not
  a simulator), that notification permission was granted, and that
  `POST /devices` succeeded (check backend logs).
- **"No quote data for X" errors**: check the symbol suffix - NSE is `.NS`,
  BSE is `.BO`.
- **Mobile app can't reach the backend**: double-check the Backend URL in
  Settings is the exact deployed URL (https, no trailing slash) and the API
  key matches `.env` on the server.
