import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { version } from "../package.json";

if (!["linux", "win32"].includes(process.platform) || process.arch !== "x64") {
  throw new Error("Packaging supports Linux x64 and Windows x64.");
}

const platform = process.platform === "win32" ? "windows" : "linux";
const directory = path.resolve("dist", `cookie-${platform}-x64`);
const standaloneDirectory = path.resolve(".next/standalone");
await rm(directory, { recursive: true, force: true });
await mkdir(directory, { recursive: true });
await cp(standaloneDirectory, path.join(directory, "app"), {
  recursive: true,
  dereference: true,
  filter: (source) => source !== path.join(standaloneDirectory, "data"),
});
await cp(".next/static", path.join(directory, "app/.next/static"), {
  recursive: true,
});
await cp("public", path.join(directory, "app/public"), { recursive: true });
await cp("README.md", path.join(directory, "README.md"));
await cp("LICENSE", path.join(directory, "LICENSE"));
await writeFile(path.join(directory, "VERSION"), `${version}\n`);

const executable = path.join(
  directory,
  process.platform === "win32" ? "cookie.exe" : "cookie",
);
const result = Bun.spawnSync([
  process.execPath,
  "build",
  "--compile",
  "--target",
  `bun-${platform}-x64-baseline`,
  "scripts/launcher.mjs",
  "--outfile",
  executable,
], { stdout: "inherit", stderr: "inherit" });
if (result.exitCode !== 0) process.exit(result.exitCode);

console.log(`Packaged app: ${directory}`);
