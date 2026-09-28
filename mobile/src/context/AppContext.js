import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, loadApiConfig } from '../api/client';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadApiConfig().then(() => setReady(true));
  }, []);

  const refreshWatchlist = useCallback(async () => {
    try {
      const { data } = await api.get('/watchlist');
      setWatchlist(data);
    } catch (err) {
      console.warn('Failed to load watchlist:', err.message);
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    try {
      const { data } = await api.get('/alerts');
      setAlerts(data);
    } catch (err) {
      console.warn('Failed to load alerts:', err.message);
    }
  }, []);

  const addSymbol = useCallback(async (symbol, thresholdPercent, windowMinutes) => {
    await api.post('/watchlist', { symbol, thresholdPercent, windowMinutes });
    await refreshWatchlist();
  }, [refreshWatchlist]);

  const removeSymbol = useCallback(async (symbol) => {
    await api.delete(`/watchlist/${symbol}`);
    await refreshWatchlist();
  }, [refreshWatchlist]);

  useEffect(() => {
    if (!ready) return;
    refreshWatchlist();
    refreshAlerts();
    const interval = setInterval(() => {
      refreshWatchlist();
      refreshAlerts();
    }, 15000);
    return () => clearInterval(interval);
  }, [ready, refreshWatchlist, refreshAlerts]);

  return (
    <AppContext.Provider
      value={{ watchlist, alerts, ready, addSymbol, removeSymbol, refreshWatchlist, refreshAlerts }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
