import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api, loadApiConfig } from "../api/client";

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return null;
  }

  if (Constants.appOwnership === "expo") {
    console.warn("Push notifications are not supported in Expo Go. Use a development build to test them.");
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("Push notification permission not granted.");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    const expoPushToken = tokenData.data;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    await loadApiConfig();
    await api.post("/devices", { expoPushToken });
    return expoPushToken;
  } catch (err) {
    console.warn("Push notification setup failed:", err.message);
    return null;
  }
}