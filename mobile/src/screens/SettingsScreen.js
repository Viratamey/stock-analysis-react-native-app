import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { loadApiConfig, saveApiConfig } from '../api/client';
import { registerForPushNotifications } from '../notifications/pushSetup';

export default function SettingsScreen() {
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    loadApiConfig().then((cfg) => {
      setBaseURL(cfg.baseURL);
      setApiKey(cfg.apiKey);
    });
  }, []);

  const handleSave = async () => {
    await saveApiConfig(baseURL.trim(), apiKey.trim());
    await registerForPushNotifications();
    Alert.alert('Saved', 'Backend settings updated and device re-registered.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Backend URL</Text>
      <TextInput
        style={styles.input}
        value={baseURL}
        onChangeText={setBaseURL}
        autoCapitalize="none"
        placeholder="https://your-backend.example.com"
      />

      <Text style={styles.label}>API key</Text>
      <TextInput style={styles.input} value={apiKey} onChangeText={setApiKey} autoCapitalize="none" secureTextEntry />

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save & re-register device</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        The backend polls prices during market hours and pushes a notification here the moment a stock on
        your watchlist moves past its threshold. Use that as the cue to open your broker app and place or
        adjust your GTT order - this app does not place trades for you.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  label: { fontSize: 13, color: '#444', marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 4 },
  button: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 8, marginTop: 20, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  note: { fontSize: 12, color: '#777', marginTop: 24, lineHeight: 18 },
});
