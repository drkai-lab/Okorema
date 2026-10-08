import {
  RUNTIME_VERSION,
  buildManifest,
  encodeMultipart,
  isSupportedRuntime,
  prefersMultipart,
} from "./protocol.mjs";

interface Env {
  ASSETS: Fetcher;
}

type Release = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  sdkVersion: string;
  platforms: Record<string, { launchAsset: { hash: string; key: string; path: string }; assets: { hash: string; key: string; contentType: string; fileExtension: string; path: string }[] }>;
};

function htmlPage(host: string): string {
  const url = `exps://${host}`;
  return `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Okorema! を Expo Go で開く</title>
<body style="font-family: sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5">
<h1>Okorema!</h1>
<p>App Store の Expo Go（SDK 54）で、次の URL を開いてください。PC で開発サーバーを動かす必要はありません。</p>
<p><code id="url">${url}</code></p>
<p><img alt="Expo Go 用の QR" src="/expo-go-qr.png" width="240" height="240"></p>
<p>QR は公開時のホスト向けです。表示中の URL と違うときは、上の文字列を Expo Go の検索欄に貼ってください。</p>
<script>document.getElementById("url").textContent = "exps://" + location.host;</script>
</body>
</html>`;
}

async function loadRelease(request: Request, env: Env): Promise<Release | null> {
  const response = await env.ASSETS.fetch(new URL("/release.json", request.url));
  if (!response.ok) return null;
  return (await response.json()) as Release;
}

function manifestResponse(manifest: unknown, request: Request): Response {
  const json = JSON.stringify(manifest);
  const protocol = request.headers.get("expo-protocol-version") === "0" ? "0" : "1";
  const headers = new Headers({
    "expo-protocol-version": protocol,
    "expo-sfv-version": "0",
    "cache-control": "private, max-age=0",
  });
  if (prefersMultipart(request.headers.get("accept"))) {
    const encoded = encodeMultipart(json);
    headers.set("content-type", encoded.contentType);
    return new Response(encoded.body, { status: 200, headers });
  }
  headers.set("content-type", "application/expo+json; charset=utf-8");
  return new Response(json, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const platform = request.headers.get("expo-platform") ?? url.searchParams.get("platform");
    const wantsManifest = url.pathname === "/" || url.pathname === "/manifest";

    if (!wantsManifest || !platform) {
      if (url.pathname === "/" && !platform) {
        return new Response(htmlPage(url.host), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, max-age=0" },
        });
      }
      return env.ASSETS.fetch(request);
    }

    if (platform !== "ios" && platform !== "android") {
      return Response.json({ error: "expo-platform must be ios or android" }, { status: 400 });
    }

    const runtime = request.headers.get("expo-runtime-version");
    if (!isSupportedRuntime(runtime)) {
      return Response.json(
        { error: `This host serves ${RUNTIME_VERSION} for App Store Expo Go.`, runtimeVersion: runtime },
        { status: 404 },
      );
    }

    const release = await loadRelease(request, env);
    if (!release?.platforms?.[platform]) {
      return Response.json({ error: "No update has been published yet. Run npm run publish:worker." }, { status: 404 });
    }

    const manifest = buildManifest({ release, platform, origin: url.origin });
    return manifestResponse(manifest, request);
  },
};
