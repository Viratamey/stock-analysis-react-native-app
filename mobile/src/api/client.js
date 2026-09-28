import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const api = axios.create({ timeout: 10000 });

export async function loadApiConfig() {
  const baseURL = (await AsyncStorage.getItem('baseURL')) || 'http://localhost:4000';
  const apiKey = (await AsyncStorage.getItem('apiKey')) || 'changeme';
  api.defaults.baseURL = baseURL;
  api.defaults.headers.common['x-api-key'] = apiKey;
  return { baseURL, apiKey };
}

export async function saveApiConfig(baseURL, apiKey) {
  await AsyncStorage.setItem('baseURL', baseURL);
  await AsyncStorage.setItem('apiKey', apiKey);
  api.defaults.baseURL = baseURL;
  api.defaults.headers.common['x-api-key'] = apiKey;
}
