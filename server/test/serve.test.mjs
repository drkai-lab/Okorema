import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_VERSION, isHermesBytecode, readMultipartManifest } from "../src/protocol.mjs";

const serverRoot = path.resolve(import.meta.dirname, "..");

function waitForReady(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`wrangler did not start\n${output}`)), 60000);
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes("Ready on") || output.includes("http://")) {
        clearTimeout(timer);
        resolve(output);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`wrangler exited ${code}\n${output}`));
    });
  });
}

test("wrangler dev serves an Expo Go manifest and a JavaScript bundle", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okorema-worker-"));
  const publicDir = path.join(root, "public");
  await fs.mkdir(path.join(publicDir, "bundles"), { recursive: true });
  const bundle = Buffer.from("var __DEV__=false;globalThis.__okoremaPublished=true;\n");
  assert.equal(isHermesBytecode(bundle), false);
  const key = createHash("md5").update(bundle).digest("hex");
  const filename = `ios-${key}.js`;
  await fs.writeFile(path.join(publicDir, "bundles", filename), bundle);
  const release = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    runtimeVersion: RUNTIME_VERSION,
    sdkVersion: "54.0.0",
    platforms: {
      ios: {
        launchAsset: {
          hash: createHash("sha256").update(bundle).digest("base64url"),
          key,
          contentType: "application/javascript",
          fileExtension: ".js",
          path: `/bundles/${filename}`,
        },
        assets: [],
      },
      android: {
        launchAsset: {
          hash: createHash("sha256").update(bundle).digest("base64url"),
          key,
          contentType: "application/javascript",
          fileExtension: ".js",
          path: `/bundles/${filename}`,
        },
        assets: [],
      },
    },
  };
  await fs.writeFile(path.join(publicDir, "release.json"), JSON.stringify(release));
  const config = `name = "okorema-updates-test"
main = ${JSON.stringify(path.join(serverRoot, "src/index.ts"))}
compatibility_date = "2026-10-01"

[assets]
directory = "./public"
binding = "ASSETS"
run_worker_first = ["/", "/manifest"]
not_found_handling = "none"
`;
  await fs.writeFile(path.join(root, "wrangler.toml"), config);

  const wrangler = path.join(serverRoot, "node_modules", "wrangler", "bin", "wrangler.js");
  const child = spawn(process.execPath, [wrangler, "dev", "--port", "8791", "--local"], {
    cwd: root,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  try {
    await waitForReady(child);
    const headers = {
      accept: "multipart/mixed, application/expo+json, application/json",
      "expo-protocol-version": "1",
      "expo-platform": "ios",
      "expo-runtime-version": "exposdk:54.0.0",
      "expo-expect-signature": 'sig, keyid="expo-root", alg="rsa-v1_5-sha256"',
      "Exponent-SDK-Version": "54.0.0",
      "Exponent-Platform": "ios",
    };
    const manifestResponse = await fetch("http://127.0.0.1:8791/", { headers });
    assert.equal(manifestResponse.status, 200);
    assert.equal(manifestResponse.headers.get("expo-protocol-version"), "1");
    assert.match(manifestResponse.headers.get("content-type") ?? "", /multipart\/mixed/);
    assert.equal(manifestResponse.headers.get("expo-signature"), null);
    const manifest = readMultipartManifest(await manifestResponse.text(), manifestResponse.headers.get("content-type"));
    assert.equal(manifest.runtimeVersion, "exposdk:54.0.0");
    assert.equal(manifest.extra.expoClient.sdkVersion, "54.0.0");
    assert.equal(manifest.extra.scopeKey.startsWith("@anonymous/"), true);
    assert.equal(manifest.launchAsset.contentType, "application/javascript");
    const bundleResponse = await fetch(manifest.launchAsset.url);
    assert.equal(bundleResponse.status, 200);
    const bytes = Buffer.from(await bundleResponse.arrayBuffer());
    assert.equal(isHermesBytecode(bytes), false);
    assert.match(bytes.toString("utf8"), /__okoremaPublished/);

    const mismatch = await fetch("http://127.0.0.1:8791/manifest", {
      headers: { ...headers, "expo-runtime-version": "exposdk:57.0.0" },
    });
    assert.equal(mismatch.status, 404);

    const page = await fetch("http://127.0.0.1:8791/");
    assert.match(await page.text(), /exps:\/\/127\.0\.0\.1:8791/);
  } finally {
    child.kill("SIGTERM");
    await fs.rm(root, { recursive: true, force: true });
  }
});
