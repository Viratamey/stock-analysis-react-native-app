import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import DashboardScreen from './src/screens/DashboardScreen';
import WatchlistScreen from './src/screens/WatchlistScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { AppProvider } from './src/context/AppContext';
import { registerForPushNotifications } from './src/notifications/pushSetup';

const Tab = createBottomTabNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const notificationListener = useRef();

  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
    };
  }, []);

  return (
    <AppProvider>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" color={color} size={size} /> }}
          />
          <Tab.Screen
            name="Watchlist"
            component={WatchlistScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color} size={size} /> }}
          />
          <Tab.Screen
            name="Alerts"
            component={AlertsScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="notifications" color={color} size={size} /> }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} /> }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
