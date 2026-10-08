import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import QRCode from "qrcode";

import { RUNTIME_VERSION, SDK_VERSION, addAssetUris, contentTypeForExtension, isHermesBytecode } from "../src/protocol.mjs";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(serverRoot, "..");
const exportDir = path.join(serverRoot, ".export");
const publicDir = path.join(serverRoot, "public");
const distDir = path.join(serverRoot, "dist");

function sha256Base64Url(bytes) {
  return createHash("sha256").update(bytes).digest("base64url");
}

function md5Hex(bytes) {
  return createHash("md5").update(bytes).digest("hex");
}

async function exportApp() {
  await fs.rm(exportDir, { recursive: true, force: true });
  const result = spawnSync(
    "npx",
    ["expo", "export", "--platform", "ios", "--platform", "android", "--no-bytecode", "--output-dir", exportDir],
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error("expo export failed");
  }
}

async function assetRecord(bytes, key, ext) {
  return {
    hash: sha256Base64Url(bytes),
    key,
    contentType: contentTypeForExtension(ext),
    fileExtension: `.${ext}`,
    path: `/assets/${key}.${ext}`,
  };
}

async function publishFiles() {
  const metadata = JSON.parse(await fs.readFile(path.join(exportDir, "metadata.json"), "utf8"));
  await fs.rm(publicDir, { recursive: true, force: true });
  await fs.mkdir(path.join(publicDir, "assets"), { recursive: true });
  await fs.mkdir(path.join(publicDir, "bundles"), { recursive: true });
  await fs.writeFile(path.join(publicDir, ".gitkeep"), "");
  await fs.mkdir(distDir, { recursive: true });

  const platforms = {};
  for (const platform of ["ios", "android"]) {
    const fileMeta = metadata.fileMetadata?.[platform];
    if (!fileMeta?.bundle) throw new Error(`metadata.json has no ${platform} bundle`);
    const bundlePath = path.join(exportDir, fileMeta.bundle);
    const original = await fs.readFile(bundlePath);
    if (isHermesBytecode(original)) {
      throw new Error(`${platform} bundle is Hermes bytecode. Expo Go rejects that from hosts other than u.expo.dev. Re-export with --no-bytecode.`);
    }
    const rewritten = Buffer.from(addAssetUris(original.toString("utf8")), "utf8");
    if (isHermesBytecode(rewritten)) throw new Error(`${platform} bundle became Hermes bytecode`);
    const key = md5Hex(rewritten);
    const filename = `${platform}-${key}.js`;
    await fs.writeFile(path.join(publicDir, "bundles", filename), rewritten);
    const seen = new Set();
    const assets = [];
    for (const asset of fileMeta.assets ?? []) {
      if (seen.has(asset.path)) continue;
      seen.add(asset.path);
      const bytes = await fs.readFile(path.join(exportDir, asset.path));
      const metroKey = path.basename(asset.path);
      const record = await assetRecord(bytes, metroKey, asset.ext);
      await fs.writeFile(path.join(publicDir, record.path.slice(1)), bytes);
      assets.push(record);
    }
    platforms[platform] = {
      launchAsset: {
        hash: sha256Base64Url(rewritten),
        key,
        contentType: "application/javascript",
        fileExtension: ".js",
        path: `/bundles/${filename}`,
      },
      assets,
    };
  }

  const release = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    runtimeVersion: RUNTIME_VERSION,
    sdkVersion: SDK_VERSION,
    platforms,
  };
  await fs.writeFile(path.join(publicDir, "release.json"), JSON.stringify(release));
  await fs.writeFile(
    path.join(publicDir, "_headers"),
    ["/assets/*", "  Cache-Control: public, max-age=31536000, immutable", "/bundles/*", "  Cache-Control: public, max-age=31536000, immutable", ""].join("\n"),
  );
  return release;
}

function expoGoUrl() {
  const host = process.env.WORKER_HOST?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return host ? `exps://${host}` : "exps://127.0.0.1:8791";
}

async function writeQr(url) {
  const png = await QRCode.toBuffer(url, { type: "png", width: 512, margin: 1 });
  await fs.writeFile(path.join(publicDir, "expo-go-qr.png"), png);
  await fs.writeFile(path.join(distDir, "expo-go-qr.png"), png);
  await fs.writeFile(path.join(distDir, "expo-go-url.txt"), `${url}\n`);
}

function deploy() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) {
    console.log("CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is not set. Skipped wrangler deploy.");
    console.log("The files in server/public are ready. Set both variables, then run npm run publish:worker again.");
    return;
  }
  const result = spawnSync("npx", ["wrangler", "deploy"], {
    cwd: serverRoot,
    stdio: "inherit",
    env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account },
  });
  if (result.status !== 0) {
    throw new Error("wrangler deploy failed");
  }
}

const url = expoGoUrl();
await exportApp();
await publishFiles();
await writeQr(url);
console.log(`Expo Go URL: ${url}`);
console.log(`QR: ${path.join(distDir, "expo-go-qr.png")}`);
if (!process.env.WORKER_HOST) {
  console.log("WORKER_HOST is unset, so the QR points at local wrangler dev (127.0.0.1:8791).");
  console.log("After the first deploy, set WORKER_HOST to the workers.dev hostname and run this again to refresh the QR.");
}
deploy();
