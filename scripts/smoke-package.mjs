import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { version } from "../package.json";

const platform = process.platform === "win32" ? "windows" : "linux";
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "cookie-smoke-"));
const packageDirectory = path.join(temporaryDirectory, "cookie");
await cp(path.resolve(`dist/cookie-${platform}-x64`), packageDirectory, { recursive: true });
const executable = path.join(
  packageDirectory,
  process.platform === "win32" ? "cookie.exe" : "cookie",
);
const versionResult = Bun.spawnSync([executable, "--version"]);
assert.equal(versionResult.exitCode, 0);
assert.equal(versionResult.stdout.toString().trim(), `cookie ${version}`);
const port = "3107";
const baseUrl = `http://127.0.0.1:${port}/cookie`;
const server = Bun.spawn([executable], {
  cwd: temporaryDirectory,
  env: {
    ...process.env,
    PORT: port,
    COOKIE_HOST: "127.0.0.1",
    LIBRARY_DATA_DIR: path.join(temporaryDirectory, "data"),
  },
  stdout: "inherit",
  stderr: "inherit",
});

try {
  let response;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Packaged server exited early.");
    response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) }).catch(() => null);
    if (response?.ok) break;
    await Bun.sleep(500);
  }
  assert.ok(response?.ok, "Packaged app must serve its home page.");
  const html = await response.text();
  const asset = html.match(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/);
  assert.ok(asset, "Home page must reference a static asset.");
  assert.equal((await fetch(new URL(asset[1].replaceAll("&amp;", "&"), baseUrl))).status, 200);
  assert.equal((await fetch(`${baseUrl}/pdf.worker.min.mjs`)).status, 200);
  const library = await fetch(`${baseUrl}/api/books`);
  assert.equal(library.status, 200);
  assert.deepEqual(await library.json(), []);
  const upload = new FormData();
  upload.set("file", Bun.file("tests/fixtures/Reading sample.pdf"), "sample.pdf");
  const uploaded = await fetch(`${baseUrl}/api/books`, { method: "POST", body: upload });
  assert.equal(uploaded.status, 201, "Packaged app must save uploaded books.");
  const book = await uploaded.json();
  const downloaded = await fetch(`${baseUrl}/api/books/${book.id}/file`);
  assert.equal(downloaded.status, 200);
  assert.equal((await downloaded.arrayBuffer()).byteLength, book.size);
  console.log("Packaged app smoke check passed.");
} finally {
  server.kill();
  await server.exited;
  await rm(temporaryDirectory, { recursive: true, force: true });
}
