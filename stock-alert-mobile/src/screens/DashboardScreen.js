import React from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import SteadyScreen from './SteadyScreen';
import { useApp } from '../context/AppContext';

export default function DashboardScreen() {
  const { watchlist, refreshWatchlist } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);
  const [section, setSection] = React.useState('steady'); // steady stocks are the default view

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshWatchlist();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => {
    const latest = item.latest;
    const changeFromPrevClose = latest
      ? (((latest.price - latest.previousClose) / latest.previousClose) * 100).toFixed(2)
      : null;
    const isUp = changeFromPrevClose !== null && Number(changeFromPrevClose) >= 0;

    return (
      <View style={styles.card}>
        <View>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.meta}>
            {item.stable === true ? 'Stable' : item.stable === false ? 'Volatile' : 'Checking…'}
            {item.volatilityPercent != null ? ` · ${item.volatilityPercent}% vol` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.price}>{latest ? `₹${latest.price}` : '—'}</Text>
          {changeFromPrevClose !== null && (
            <Text style={[styles.change, { color: isUp ? '#0a7d33' : '#c62828' }]}>
              {isUp ? '▲' : '▼'} {changeFromPrevClose}%
            </Text>
          )}
        </View>
      </View>
    );
  };

  const tabs = (
    <View style={styles.segment}>
      {[['steady', 'Steady'], ['gtt', 'GTT ideas'], ['watchlist', 'Watchlist']].map(([k, label]) => (
        <TouchableOpacity key={k} style={[styles.segBtn, section === k && styles.segBtnActive]} onPress={() => setSection(k)}>
          <Text style={[styles.segText, section === k && styles.segTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (section === 'steady' || section === 'gtt') {
    return (
      <View style={styles.container}>
        {tabs}
        <SteadyScreen key={section} gttMode={section === 'gtt'} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {tabs}
      <FlatList
        data={watchlist}
        keyExtractor={(item) => item.symbol}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Add stocks in the Watchlist tab to get started.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#fff' },
  segment: { flexDirection: 'row', backgroundColor: '#e6e6ea', borderRadius: 10, padding: 3, marginBottom: 10 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#fff' },
  segText: { fontWeight: '600', color: '#666' },
  segTextActive: { color: '#111' },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f5f5f7',
    marginBottom: 10,
  },
  symbol: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, color: '#666', marginTop: 2 },
  price: { fontSize: 16, fontWeight: '700' },
  change: { fontSize: 13, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
});
