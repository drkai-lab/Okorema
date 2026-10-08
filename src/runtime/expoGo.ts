import Constants, { ExecutionEnvironment } from "expo-constants";

export const EXPO_GO_GOOGLE = "expo-go-google";
export const EXPO_GO_IAP = "expo-go-iap";

/**
 * Expo Go (the store client) cannot load this app's config plugins or local native module.
 * A development build reports `bare` here, so the same checks leave native features on.
 */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.appOwnership === "expo";
}
