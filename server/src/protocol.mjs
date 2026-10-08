export const SDK_VERSION = "54.0.0";
export const RUNTIME_VERSION = `exposdk:${SDK_VERSION}`;

const HERMES_MAGIC = Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f]);

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ttf: "font/ttf",
  otf: "font/otf",
  js: "application/javascript",
};

export function contentTypeForExtension(ext) {
  return MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

export function isHermesBytecode(bytes) {
  const head = Buffer.isBuffer(bytes) ? bytes.subarray(0, 8) : Buffer.from(bytes).subarray(0, 8);
  return head.length >= 8 && head.equals(HERMES_MAGIC);
}

export function isSupportedRuntime(value) {
  if (!value) return true;
  return value === RUNTIME_VERSION || value === SDK_VERSION || value === "UNVERSIONED" || value === "exposdk:UNVERSIONED";
}

export function prefersMultipart(accept) {
  if (!accept) return true;
  return accept.includes("multipart/mixed") || accept.includes("*/*");
}

/**
 * Expo Go's exported bundle has no absolute asset URL. Inside Expo Go it would
 * otherwise ask classic-assets.eascdn.net, which does not have this app's files.
 * Point each packed asset at /assets/<hash>.<ext> on the same host.
 */
export function addAssetUris(source) {
  return source.replace(/registerAsset\(\{([^{}]*)\}\)/g, (full, body) => {
    if (body.includes("fileUris:")) return full;
    const fileHashes = body.match(/fileHashes:\[([^\]]*)\]/);
    const hashes = fileHashes
      ? [...fileHashes[1].matchAll(/"([0-9a-fA-F]{32})"/g)].map((match) => match[1])
      : [...body.matchAll(/hash:"([0-9a-fA-F]{32})"/g)].map((match) => match[1]);
    if (hashes.length === 0) return full;
    const type = body.match(/type:"([^"]+)"/)?.[1] ?? "bin";
    const uris = hashes.map((hash) => `"/assets/${hash}.${type}"`).join(",");
    return `registerAsset({${body},fileUris:[${uris}]})`;
  });
}

export function buildManifest({ release, platform, origin }) {
  const spec = release.platforms[platform];
  if (!spec) {
    throw new Error(`No ${platform} bundle in this release`);
  }
  const absolute = (path) => new URL(path, origin.endsWith("/") ? origin : `${origin}/`).href;
  return {
    id: release.id,
    createdAt: release.createdAt,
    runtimeVersion: release.runtimeVersion,
    launchAsset: {
      hash: spec.launchAsset.hash,
      key: spec.launchAsset.key,
      contentType: "application/javascript",
      fileExtension: ".js",
      url: absolute(spec.launchAsset.path),
    },
    assets: spec.assets.map((asset) => ({
      hash: asset.hash,
      key: asset.key,
      contentType: asset.contentType,
      fileExtension: asset.fileExtension,
      url: absolute(asset.path),
    })),
    metadata: {},
    extra: {
      expoClient: {
        name: "Okorema!",
        slug: "okorema",
        version: "1.0.0",
        sdkVersion: release.sdkVersion,
        platforms: ["ios", "android"],
        orientation: "portrait",
        hostUri: new URL(origin).host,
      },
      expoGo: {},
      scopeKey: "@anonymous/okorema",
    },
  };
}

export function encodeMultipart(json) {
  const boundary = "okorema-manifest";
  const body = [
    `--${boundary}`,
    `content-disposition: form-data; name="manifest"`,
    `content-type: application/json; charset=utf-8`,
    "",
    json,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return { body, contentType: `multipart/mixed; boundary=${boundary}` };
}

export function readMultipartManifest(body, contentType) {
  const boundary = /boundary=([^;\s]+)/.exec(contentType)?.[1];
  if (!boundary) throw new Error("multipart response has no boundary");
  const marker = `--${boundary}`;
  const parts = body.split(marker).slice(1, -1);
  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, "");
    const splitAt = trimmed.indexOf("\r\n\r\n");
    if (splitAt < 0) continue;
    const headers = trimmed.slice(0, splitAt).toLowerCase();
    if (!headers.includes('name="manifest"')) continue;
    const json = trimmed.slice(splitAt + 4).replace(/\r\n$/, "");
    return JSON.parse(json);
  }
  throw new Error("multipart response has no manifest part");
}
