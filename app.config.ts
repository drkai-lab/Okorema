import type { ExpoConfig } from "expo/config";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

const locationCopy =
  "Okorema! uses your location for place reminders you set. 場所リマインダーのために位置情報を使います。";

const config: ExpoConfig = {
  name: "Okorema!",
  slug: "okorema",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "okorema",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "app.okorema.mobile",
    supportsTablet: false,
    icon: "./assets/images/icon.png",
    entitlements: {
      "com.apple.developer.usernotifications.time-sensitive": true,
    },
    infoPlist: {
      NSSupportsLiveActivities: true,
      UIBackgroundModes: ["fetch", "location"],
      NSRemindersUsageDescription:
        "Okorema! reads reminders that have a due date so you can copy them in. 期限のあるリマインダーを読み取り専用で取り込みます。",
      NSRemindersFullAccessUsageDescription:
        "Okorema! reads reminders that have a due date so you can copy them in. Nothing is changed in Reminders. リマインダーは変更しません。",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "app.okorema.mobile",
    adaptiveIcon: {
      backgroundColor: "#F3EEE6",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    permissions: [
      "POST_NOTIFICATIONS",
      "SCHEDULE_EXACT_ALARM",
      "USE_EXACT_ALARM",
      "USE_FULL_SCREEN_INTENT",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "WAKE_LOCK",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
    ],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "expo-secure-store",
    "expo-localization",
    "expo-font",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F3EEE6",
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#C4491D",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission: locationCopy,
        locationAlwaysAndWhenInUsePermission: locationCopy,
        locationAlwaysPermission: locationCopy,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
        motionUsagePermission: false,
      },
    ],
    "@react-native-community/datetimepicker",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    googleWebClientId: webClientId,
    googleIosClientId: iosClientId,
    googleAndroidClientId: androidClientId,
  },
};

export default config;
