import assert from "node:assert/strict";
import test from "node:test";

import {
  RUNTIME_VERSION,
  addAssetUris,
  buildManifest,
  encodeMultipart,
  isHermesBytecode,
  isSupportedRuntime,
  readMultipartManifest,
} from "../src/protocol.mjs";

test("rewrites packed assets onto this host and does not repeat itself", () => {
  const a = "a".repeat(32);
  const b = "b".repeat(32);
  const source = `registerAsset({__packager_asset:!0,httpServerLocation:"/assets/fonts",scales:[1,2],hash:"${a}",name:"Icon",type:"png",fileHashes:["${a}","${b}"]})`;
  const once = addAssetUris(source);
  assert.match(once, new RegExp(`fileUris:\\["/assets/${a}\\.png","/assets/${b}\\.png"\\]`));
  assert.equal(addAssetUris(once), once);
});

test("manifest matches the fields Expo Go reads", () => {
  const release = {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-10-08T00:00:00.000Z",
    runtimeVersion: RUNTIME_VERSION,
    sdkVersion: "54.0.0",
    platforms: {
      ios: {
        launchAsset: { hash: "abc", key: "def", path: "/bundles/ios-def.js" },
        assets: [{ hash: "h", key: "k", contentType: "font/ttf", fileExtension: ".ttf", path: "/assets/k.ttf" }],
      },
    },
  };
  const manifest = buildManifest({ release, platform: "ios", origin: "https://okorema.example" });
  assert.equal(manifest.runtimeVersion, "exposdk:54.0.0");
  assert.equal(manifest.extra.expoClient.sdkVersion, "54.0.0");
  assert.equal(manifest.extra.scopeKey, "@anonymous/okorema");
  assert.equal(manifest.extra.expoGo.developer, undefined);
  assert.equal(manifest.launchAsset.url, "https://okorema.example/bundles/ios-def.js");
  assert.equal(manifest.launchAsset.contentType, "application/javascript");
  assert.equal(manifest.assets[0].url, "https://okorema.example/assets/k.ttf");
  const encoded = encodeMultipart(JSON.stringify(manifest));
  const parsed = readMultipartManifest(encoded.body, encoded.contentType);
  assert.equal(parsed.id, manifest.id);
});

test("rejects Hermes bytecode and unrelated runtimes", () => {
  const magic = Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f, 0, 0]);
  assert.equal(isHermesBytecode(magic), true);
  assert.equal(isHermesBytecode(Buffer.from("var app=1")), false);
  assert.equal(isSupportedRuntime("exposdk:54.0.0"), true);
  assert.equal(isSupportedRuntime("exposdk:57.0.0"), false);
  assert.equal(isSupportedRuntime(null), true);
});
