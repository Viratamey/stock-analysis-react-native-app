import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { useApp } from '../context/AppContext';

export default function WatchlistScreen() {
  const { watchlist, addSymbol, removeSymbol } = useApp();
  const [symbol, setSymbol] = useState('');
  const [threshold, setThreshold] = useState('1.5');
  const [windowMin, setWindowMin] = useState('5');

  const handleAdd = async () => {
    if (!symbol.trim()) return;
    try {
      await addSymbol(symbol.trim().toUpperCase(), Number(threshold), Number(windowMin));
      setSymbol('');
    } catch (err) {
      Alert.alert('Could not add symbol', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Symbol (NSE, e.g. RELIANCE.NS)</Text>
      <TextInput style={styles.input} value={symbol} onChangeText={setSymbol} autoCapitalize="characters" />

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>Alert threshold (%)</Text>
          <TextInput style={styles.input} value={threshold} onChangeText={setThreshold} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Window (minutes)</Text>
          <TextInput style={styles.input} value={windowMin} onChangeText={setWindowMin} keyboardType="numeric" />
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleAdd}>
        <Text style={styles.buttonText}>Add to watchlist</Text>
      </TouchableOpacity>

      <FlatList
        style={{ marginTop: 20 }}
        data={watchlist}
        keyExtractor={(item) => item.symbol}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>
              {item.symbol} · {item.thresholdPercent}% / {item.windowMinutes}min
            </Text>
            <TouchableOpacity onPress={() => removeSymbol(item.symbol)}>
              <Text style={styles.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  label: { fontSize: 13, color: '#444', marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 4 },
  row: { flexDirection: 'row', marginTop: 4 },
  button: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 8, marginTop: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemText: { fontSize: 14 },
  remove: { color: '#c62828', fontWeight: '600' },
});
