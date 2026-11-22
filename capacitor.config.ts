import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Must match the App Store bundle ID and the Google Play package name.
  // Changing it after the first store upload creates a different app.
  appId: "com.anchormate.app",
  appName: "Anchor Mate",
  webDir: "dist-mobile",
  android: {
    allowMixedContent: false,
    // Required by @capacitor-community/background-geolocation: without it,
    // location updates stop after about five minutes in the background.
    useLegacyBridge: true,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_anchor",
      iconColor: "#3EE0C0",
    },
  },
};

export default config;
