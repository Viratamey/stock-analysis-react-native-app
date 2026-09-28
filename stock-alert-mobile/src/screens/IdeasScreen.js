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

export default function IdeasScreen() {
  const { ready, watchlist, addSymbol } = useApp();
  const [market, setMarket] = useState('IN');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const marketRef = useRef(market);
  marketRef.current = market;

  const load = useCallback(async (force = false) => {
    const requested = market;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/screener', {
        params: { market: requested, refresh: force ? 1 : 0 },
        timeout: 60000,
      });
      if (marketRef.current === requested) setData(res.data);
    } catch (e) {
      if (marketRef.current === requested) setError(e.response?.data?.error || e.message);
    } finally {
      if (marketRef.current === requested) setLoading(false);
    }
  }, [market]);

  useEffect(() => {
    if (!ready) return;
    setData(null);
    setExpanded(null);
    load(false);
  }, [ready, market, load]);

  const onAdd = async (symbol) => {
    try {
      await addSymbol(symbol);
      Alert.alert('Added', `${shortName(symbol)} is on your watchlist.`);
    } catch (e) {
      Alert.alert('Could not add', e.response?.data?.error || e.message);
    }
  };

  const items = (data && data.items) || [];
  const qualityCount = items.filter((i) => i.quality).length;

  const header = (
    <View>
      <View style={styles.segment}>
        {[['IN', 'India'], ['US', 'US']].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.segBtn, market === key && styles.segBtnActive]}
            onPress={() => setMarket(key)}
          >
            <Text style={[styles.segText, market === key && styles.segTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {data ? (
        <Text style={styles.summary}>
          {items.length} scanned · {qualityCount} pass stable + growing
          {data.failed && data.failed.length ? ` · ${data.failed.length} failed to load` : ''}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  const renderItem = ({ item }) => {
    const isOpen = expanded === item.symbol;
    const onWatchlist = watchlist.some((w) => w.symbol === item.symbol);
    const idea = item.idea;
    const cur = item.currency;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() => setExpanded(isOpen ? null : item.symbol)}
      >
        <View style={styles.row}>
          <View>
            <Text style={styles.symbol}>{shortName(item.symbol)}</Text>
            <Text style={styles.sub}>
              1d {signed(item.change1dPercent)} · 5d {signed(item.change5dPercent)}
            </Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.price}>{cur}{fmt(item.price)}</Text>
            <Text style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] }]}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.meta}>
          {item.stable ? 'Stable' : 'Volatile'} ({fmt(item.volatilityPercent)}% vol) ·{' '}
          {item.growing ? 'Growing' : 'Not trending up'} ({signed(item.longTermReturnPercent)} over ~6 months)
        </Text>

        {isOpen && (
          <View style={styles.detail}>
            {idea ? (
              <View style={styles.idea}>
                <Text style={styles.ideaTitle}>
                  {idea.type === 'BUY_DIP'
                    ? (item.market === 'IN' ? 'GTT idea: buy the dip' : 'Order idea: buy the dip')
                    : 'Wait for a pullback'}
                </Text>
                <Text style={styles.ideaLine}>
                  {idea.type === 'BUY_DIP' ? 'Buy trigger' : 'Buy on pullback to'}: {cur}{fmt(idea.entry)}
                </Text>
                <Text style={styles.ideaLine}>Stop-loss: {cur}{fmt(idea.stop)} (-{fmt(idea.riskPercent)}%)</Text>
                <Text style={styles.ideaLine}>Target: {cur}{fmt(idea.target)} (+{fmt(idea.rewardPercent)}%)</Text>
                <Text style={styles.ideaLine}>Reward vs risk: {fmt(idea.riskReward)}x</Text>
                {!idea.worthwhile && (
                  <Text style={styles.warn}>Reward is under 1.5x the risk here, so this setup is weak.</Text>
                )}
                <Text style={styles.note}>{idea.note}</Text>
              </View>
            ) : (
              <Text style={styles.note}>
                {item.quality
                  ? 'Passes the screens but is not dipping or spiking right now, so there is no setup.'
                  : 'Does not pass the stable + growing screen, so no order idea is generated.'}
              </Text>
            )}

            {item.market === 'IN' && (
              <TouchableOpacity
                style={[styles.addBtn, onWatchlist && styles.addBtnDisabled]}
                disabled={onWatchlist}
                onPress={() => onAdd(item.symbol)}
              >
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
        <Text style={styles.sub}>Scanning stocks - the first load can take up to a minute.</Text>
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
      ListEmptyComponent={
        !loading ? <Text style={styles.sub}>No data returned. Pull down to retry.</Text> : null
      }
      ListFooterComponent={
        <Text style={styles.footer}>
          Rule-based screen on daily prices from an unofficial free feed. Levels are calculated from
          past prices, not predictions or advice. Check the chart and your own plan before placing any order.
          {market === 'US' ? ' GTT is an Indian-broker feature; for US stocks use limit and stop orders on your platform.' : ''}
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  center: { flex: 1, padding: 12 },
  segment: { flexDirection: 'row', backgroundColor: '#e6e6ea', borderRadius: 10, padding: 3, marginBottom: 10 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#fff' },
  segText: { fontWeight: '600', color: '#666' },
  segTextActive: { color: '#111' },
  summary: { color: '#555', marginBottom: 8 },
  error: { color: '#c62828', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  right: { alignItems: 'flex-end' },
  symbol: { fontSize: 17, fontWeight: '700' },
  sub: { color: '#666', marginTop: 2 },
  price: { fontSize: 16, fontWeight: '600' },
  badge: { color: '#fff', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4, overflow: 'hidden' },
  meta: { color: '#555', marginTop: 8, fontSize: 12 },
  detail: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ccc', paddingTop: 10 },
  idea: { backgroundColor: '#f3f8f4', borderRadius: 8, padding: 10 },
  ideaTitle: { fontWeight: '700', marginBottom: 6 },
  ideaLine: { marginBottom: 2 },
  warn: { color: '#b26a00', marginTop: 4 },
  note: { color: '#666', fontSize: 12, marginTop: 6 },
  addBtn: { marginTop: 10, backgroundColor: '#1a56db', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  addBtnDisabled: { backgroundColor: '#9aa5b1' },
  addText: { color: '#fff', fontWeight: '600' },
  footer: { color: '#888', fontSize: 11, marginVertical: 16 },
});