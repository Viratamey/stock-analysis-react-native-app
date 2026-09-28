import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

const STATUS_COLORS = { DIP: '#0a7d33', SPIKE: '#b26a00', NORMAL: '#888' };
const fmt = (n) => Number(n).toFixed(2);
const signed = (n) => `${n > 0 ? '+' : ''}${fmt(n)}%`;
const shortName = (s) => s.replace(/\.(NS|BO)$/, '');

// Embedded in the Dashboard as its default section: stocks whose price never fell
// more than 12% in any 12-month window over the last 3-4 years (rises can be any size),
// each with GTT-style buy / profit-booking levels.
export default function SteadyScreen({ gttMode = false }) {
  const { ready, watchlist, addSymbol } = useApp();
  const [market, setMarket] = useState('IN');
  const [years, setYears] = useState(4);
  const [mode, setMode] = useState('drawdown');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [onlyDips, setOnlyDips] = useState(false);
  const reqRef = useRef('');
  const key = `${market}-${years}-${mode}`; // same key in both views, so the server cache is shared
  reqRef.current = key;

  const load = useCallback(async (force = false) => {
    const requested = key;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/screener/steady', {
        params: { market, years, mode, maxFall: 12, refresh: force ? 1 : 0 },
        timeout: 90000,
      });
      if (reqRef.current === requested) setData(res.data);
    } catch (e) {
      if (reqRef.current === requested) setError(e.response?.data?.error || e.message);
    } finally {
      if (reqRef.current === requested) setLoading(false);
    }
  }, [key, market, years, mode]);

  useEffect(() => {
    if (!ready) return;
    setData(null);
    setExpanded(null);
    load(false);
  }, [ready, load]);

  const onAdd = async (symbol) => {
    try {
      await addSymbol(symbol);
      Alert.alert('Added', `${shortName(symbol)} is on your watchlist.`);
    } catch (e) {
      Alert.alert('Could not add', e.response?.data?.error || e.message);
    }
  };

  const all = (data && data.items) || [];
  const steadyCount = all.filter((i) => i.steady).length;
  let items = showAll && !gttMode ? all : all.filter((i) => i.steady);
  if (gttMode && onlyDips) items = items.filter((i) => i.status === 'DIP');

  const Seg = ({ options, value, onChange }) => (
    <View style={styles.segment}>
      {options.map(([k, label]) => (
        <TouchableOpacity key={String(k)} style={[styles.segBtn, value === k && styles.segBtnActive]} onPress={() => onChange(k)}>
          <Text style={[styles.segText, value === k && styles.segTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const header = (
    <View>
      <Seg options={[['IN', 'India'], ['US', 'US']]} value={market} onChange={setMarket} />
      <Seg options={[[3, 'Last 3 yrs'], [4, 'Last 4 yrs']]} value={years} onChange={setYears} />
      <Seg options={[['drawdown', 'Strict: max fall'], ['return', 'Lenient: 12m return']]} value={mode} onChange={setMode} />
      {gttMode ? (
        <TouchableOpacity onPress={() => setOnlyDips(!onlyDips)}>
          <Text style={styles.toggle}>
            {onlyDips ? 'Showing only stocks dipping now - tap to show all steady stocks' : 'Showing all steady stocks (dips first) - tap to show only dips'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => setShowAll(!showAll)}>
          <Text style={styles.toggle}>{showAll ? 'Showing all checked - tap for steady only' : 'Showing steady only - tap to show all'}</Text>
        </TouchableOpacity>
      )}
      {data ? (
        <Text style={styles.summary}>
          {all.length} checked · {steadyCount} never fell more than 12% in a 12-month window
          {data.tooNew && data.tooNew.length ? ` · ${data.tooNew.length} too new` : ''}
          {data.failed && data.failed.length ? ` · ${data.failed.length} failed to load` : ''}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  const renderItem = ({ item }) => {
    const isOpen = gttMode || expanded === item.symbol;
    const onWatchlist = watchlist.some((w) => w.symbol === item.symbol);
    const cur = item.currency;
    const g = item.gtt;

    return (
      <TouchableOpacity activeOpacity={0.85} style={styles.card} onPress={() => !gttMode && setExpanded(isOpen ? null : item.symbol)}>
        <View style={styles.row}>
          <View>
            <Text style={styles.symbol}>{shortName(item.symbol)}</Text>
            <Text style={styles.sub}>Worst fall in any 12m window: {signed(item.worstDrawdownPercent)}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.price}>{cur}{fmt(item.price)}</Text>
            <Text style={[styles.badge, { backgroundColor: item.steady ? STATUS_COLORS[item.status] || '#888' : '#b0b0b0' }]}>
              {item.steady ? item.status : 'NOT STEADY'}
            </Text>
          </View>
        </View>
        <Text style={styles.meta}>
          12m return ranged {signed(item.worstReturnPercent)} to {signed(item.bestReturnPercent)}
          {g ? ` · 5d ${signed(g.change5dPercent)}` : ''}
        </Text>

        {isOpen && (
          <View style={styles.detail}>
            {g ? (
              <>
                <View style={styles.idea}>
                  <Text style={styles.ideaTitle}>
                    {g.buy.type === 'BUY_NOW' ? 'GTT idea: buy the dip' : 'GTT idea: buy on pullback'}
                  </Text>
                  <Text style={styles.ideaLine}>Buy trigger: {cur}{fmt(g.buy.trigger)}</Text>
                  <Text style={styles.ideaLine}>Stop-loss: {cur}{fmt(g.buy.stop)} (-{fmt(g.buy.stopPercent)}%)</Text>
                  <Text style={styles.ideaLine}>Profit target 1: {cur}{fmt(g.buy.target1)} ({signed(g.buy.target1Percent)})</Text>
                  {g.buy.target2 ? (
                    <Text style={styles.ideaLine}>Profit target 2: {cur}{fmt(g.buy.target2)} ({signed(g.buy.target2Percent)})</Text>
                  ) : null}
                </View>

                <View style={[styles.idea, styles.holdBox]}>
                  <Text style={styles.ideaTitle}>Already hold it? Book profit</Text>
                  <Text style={styles.ideaLine}>Sell trigger 1: {cur}{fmt(g.hold.target1)} ({signed(g.hold.target1Percent)})</Text>
                  {g.hold.target2 ? (
                    <Text style={styles.ideaLine}>Sell trigger 2: {cur}{fmt(g.hold.target2)} ({signed(g.hold.target2Percent)})</Text>
                  ) : null}
                  <Text style={styles.ideaLine}>Protective stop-loss: {cur}{fmt(g.hold.stop)}</Text>
                </View>

                <Text style={styles.note}>
                  {g.buy.type === 'WAIT_FOR_PULLBACK'
                    ? 'Price has not dipped, so the buy trigger sits at the 20-day average and may never fill. '
                    : ''}
                  Stop = 3 daily standard deviations below entry (min 2%). Target 1 = recent 20-day high or 1.5x the risk, whichever is
                  higher. Target 2 = 52-week high or 3x the risk. On India brokers, a two-leg (OCO) GTT can hold the stop and target 1 together.
                </Text>
              </>
            ) : (
              <Text style={styles.note}>Does not pass the steady screen, so no GTT levels are generated.</Text>
            )}

            {item.market === 'IN' && (
              <TouchableOpacity style={[styles.addBtn, onWatchlist && styles.addBtnDisabled]} disabled={onWatchlist} onPress={() => onAdd(item.symbol)}>
                <Text style={styles.addText}>{onWatchlist ? 'On watchlist' : '+ Add to watchlist'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator size="large" style={{ marginTop: 24 }} />
        <Text style={styles.sub}>Checking {years} years of history - the first load can take a minute.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(i) => i.symbol}
      renderItem={renderItem}
      refreshing={loading}
      onRefresh={() => load(true)}
      ListHeaderComponent={header}
      ListEmptyComponent={!loading ? <Text style={styles.sub}>{gttMode && onlyDips ? 'No steady stock is dipping right now. Switch off "only dips" to see all steady stocks with their pullback levels.' : 'No stocks passed. Try 3 years or the lenient mode.'}</Text> : null}
      ListFooterComponent={
        <Text style={styles.footer}>
          Strict = worst peak-to-trough drop inside any rolling 12-month window stays within 12%. Lenient = worst 12-month
          point-to-point return stays above -12%. Rises are not limited. Uses adjusted daily closes from an unofficial free feed.
          Levels are calculated from past prices, not predictions or advice - past stability does not guarantee future stability.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  center: { flex: 1, padding: 12 },
  segment: { flexDirection: 'row', backgroundColor: '#e6e6ea', borderRadius: 10, padding: 3, marginBottom: 8 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#fff' },
  segText: { fontWeight: '600', color: '#666', fontSize: 13 },
  segTextActive: { color: '#111' },
  toggle: { color: '#1a56db', marginBottom: 6, fontSize: 12 },
  summary: { color: '#555', marginBottom: 8 },
  error: { color: '#c62828', marginBottom: 8 },
  card: { backgroundColor: '#f5f5f7', borderRadius: 12, padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  right: { alignItems: 'flex-end' },
  symbol: { fontSize: 17, fontWeight: '700' },
  sub: { color: '#666', marginTop: 2 },
  price: { fontSize: 16, fontWeight: '600' },
  badge: { color: '#fff', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4, overflow: 'hidden' },
  meta: { color: '#555', marginTop: 8, fontSize: 12 },
  detail: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ccc', paddingTop: 10 },
  idea: { backgroundColor: '#eaf4ec', borderRadius: 8, padding: 10, marginBottom: 8 },
  holdBox: { backgroundColor: '#fdf3e3' },
  ideaTitle: { fontWeight: '700', marginBottom: 6 },
  ideaLine: { marginBottom: 2 },
  note: { color: '#666', fontSize: 12, marginTop: 4 },
  addBtn: { marginTop: 10, backgroundColor: '#1a56db', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  addBtnDisabled: { backgroundColor: '#9aa5b1' },
  addText: { color: '#fff', fontWeight: '600' },
  footer: { color: '#888', fontSize: 11, marginVertical: 16 },
});
