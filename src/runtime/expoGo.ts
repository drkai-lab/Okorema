import Constants, { ExecutionEnvironment } from "expo-constants";

export const EXPO_GO_GOOGLE = "expo-go-google";
export const EXPO_GO_IAP = "expo-go-iap";

/**
 * This branch is the App Store Expo Go build (SDK 54). Native modules are not dependencies.
 * The flag stays true even if Constants has not reported the store client yet.
 */
export const SDK54_EXPO_GO_BUILD = true;

export function isExpoGo(): boolean {
  return (
    SDK54_EXPO_GO_BUILD ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === "expo"
  );
}
