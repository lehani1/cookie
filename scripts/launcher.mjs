import path from "node:path";

const directory = path.dirname(process.execPath);
const server = path.join(directory, "app", "server.js");

process.env.NODE_ENV = "production";
process.env.HOSTNAME = process.env.COOKIE_HOST || "0.0.0.0";
process.env.LIBRARY_DATA_DIR = path.resolve(
  process.env.LIBRARY_DATA_DIR || path.join(directory, "data"),
);

const child = Bun.spawn([process.execPath, server], {
  env: { ...process.env, BUN_BE_BUN: "1" },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.exit(await child.exited);
