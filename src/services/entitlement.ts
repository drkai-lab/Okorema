import { finishTransaction, getAvailablePurchases, initConnection, purchaseErrorListener, purchaseUpdatedListener, requestPurchase } from "expo-iap";

export const PRO_PRODUCT_ID = "okorema_pro_unlock";

function ownsPro(purchases: { productId?: string | null; id?: string | null }[] | null | undefined): boolean {
  return Boolean(purchases?.some((purchase) => purchase.productId === PRO_PRODUCT_ID || purchase.id === PRO_PRODUCT_ID));
}

export async function restoreProPurchase(): Promise<boolean> {
  await initConnection();
  const purchases = await getAvailablePurchases();
  return ownsPro(purchases);
}

export async function purchasePro(): Promise<boolean> {
  await initConnection();
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
    const updated = purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== PRO_PRODUCT_ID && purchase.id !== PRO_PRODUCT_ID) {
        return;
      }
      try {
        await finishTransaction({ purchase, isConsumable: false });
        finish(true);
      } catch (error) {
        finish(false, error instanceof Error ? error : new Error("finish-failed"));
      }
    });
    const failed = purchaseErrorListener((error) => {
      finish(false, new Error(error.message));
    });
    requestPurchase({
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
