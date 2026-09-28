import React from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useApp } from '../context/AppContext';

export default function AlertsScreen() {
  const { alerts, refreshAlerts } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAlerts();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.symbol}>
              {item.direction === 'RISE' ? '📈' : '📉'} {item.symbol}
            </Text>
            <Text style={styles.detail}>
              {item.pctChange}% in {item.windowMinutes} min · ₹{item.price}
            </Text>
            <Text style={styles.time}>{new Date(item.timestamp).toLocaleString('en-IN')}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No alerts yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#fff' },
  card: { padding: 14, borderRadius: 10, backgroundColor: '#f5f5f7', marginBottom: 10 },
  symbol: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 13, color: '#333', marginTop: 2 },
  time: { fontSize: 11, color: '#888', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
});
