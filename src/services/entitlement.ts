import { EXPO_GO_IAP, isExpoGo } from "@/runtime/expoGo";

export const PRO_PRODUCT_ID = "okorema_pro_unlock";

type IapModule = typeof import("expo-iap");

function loadIap(): IapModule {
  if (isExpoGo()) {
    throw new Error(EXPO_GO_IAP);
  }
  // expo-iap is not in the Expo Go binary. Require it only in a dev or store build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-iap") as IapModule;
}

function ownsPro(purchases: { productId?: string | null; id?: string | null }[] | null | undefined): boolean {
  return Boolean(purchases?.some((purchase) => purchase.productId === PRO_PRODUCT_ID || purchase.id === PRO_PRODUCT_ID));
}

export async function restoreProPurchase(): Promise<boolean> {
  const iap = loadIap();
  await iap.initConnection();
  const purchases = await iap.getAvailablePurchases();
  return ownsPro(purchases);
}

export async function purchasePro(): Promise<boolean> {
  const iap = loadIap();
  await iap.initConnection();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean, error?: Error) => {
      if (settled) return;
      settled = true;
      updated.remove();
      failed.remove();
      if (error) reject(error);
      else resolve(ok);
    };
    const updated = iap.purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== PRO_PRODUCT_ID && purchase.id !== PRO_PRODUCT_ID) {
        return;
      }
      try {
        await iap.finishTransaction({ purchase, isConsumable: false });
        finish(true);
      } catch (error) {
        finish(false, error instanceof Error ? error : new Error("finish-failed"));
      }
    });
    const failed = iap.purchaseErrorListener((error) => {
      finish(false, new Error(error.message));
    });
    iap.requestPurchase({
      type: "in-app",
      request: {
        apple: { sku: PRO_PRODUCT_ID },
        google: { skus: [PRO_PRODUCT_ID] },
      },
    }).catch((error: unknown) => {
      finish(false, error instanceof Error ? error : new Error("purchase-failed"));
    });
  });
}
