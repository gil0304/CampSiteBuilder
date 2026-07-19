import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("https://camp-site-builder.test/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Camp Site Builder metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Camp Site Builder/);
  assert.match(html, /3Dキャンプサイト設計/);
  assert.match(html, /<meta property="og:image" content="https?:\/\/[^"<]+\/og\.png"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the editor and removes the disposable starter", async () => {
  const [page, css, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<Canvas shadows/);
  assert.match(page, /createStore<EditorStore>/);
  assert.match(page, /localStorage\.setItem\("camp-site-autosave"/);
  assert.match(page, /getCollisions|getSafetyWarnings|scoreSite/);
  assert.match(page, /downloadJson|importJson|exportImage/);
  assert.match(css, /\.app-shell/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(layout, /og\.png/);
  assert.match(packageJson, /"@react-three\/fiber"/);
  assert.match(packageJson, /"zustand"/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", templateRoot)));
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
