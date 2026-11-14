import { appendFile, readFile, writeFile } from "node:fs/promises";

const manifestUrl = new URL("../package.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const command = process.argv[2] || "check";
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

if (!versionPattern.test(manifest.version)) {
  throw new Error("package.json version must be a stable version such as 1.0.0.");
}

if (command === "check") {
  if (
    process.env.GITHUB_REF_TYPE === "tag" &&
    process.env.GITHUB_REF_NAME !== `v${manifest.version}`
  ) {
    throw new Error(`Release tag must match package.json: v${manifest.version}`);
  }
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `version=${manifest.version}\n`);
  }
  console.log(manifest.version);
} else {
  let nextVersion = command;
  if (["major", "minor", "patch"].includes(command)) {
    const [major, minor, patch] = manifest.version.split(".").map(Number);
    nextVersion = command === "major"
      ? `${major + 1}.0.0`
      : command === "minor"
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`;
  }
  if (!versionPattern.test(nextVersion)) {
    throw new Error("Use check, major, minor, patch, or an explicit version such as 1.2.3.");
  }
  manifest.version = nextVersion;
  await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Version set to ${nextVersion}. Commit it and tag the commit v${nextVersion}.`);
}
