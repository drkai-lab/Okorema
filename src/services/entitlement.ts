import { EXPO_GO_IAP } from "@/runtime/expoGo";

export const PRO_PRODUCT_ID = "okorema_pro_unlock";

export async function restoreProPurchase(): Promise<boolean> {
  throw new Error(EXPO_GO_IAP);
}

export async function purchasePro(): Promise<boolean> {
  throw new Error(EXPO_GO_IAP);
}
