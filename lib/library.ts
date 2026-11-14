import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import type { Book } from "./types";
// Library files are runtime user data, not build assets.
export const directory = path.resolve(
  /* turbopackIgnore: true */
  process.env.LIBRARY_DATA_DIR || path.join(process.cwd(), "data"),
);
export async function books(): Promise<Book[]> {
  try {
    return JSON.parse(
      await readFile(path.join(directory, "library.json"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
let queue = Promise.resolve();
export function updateLibrary(fn: (items: Book[]) => Book[]) {
  const operation = queue.then(async () => {
    await mkdir(directory, { recursive: true });
    const items = fn(await books());
    await writeFile(
      path.join(directory, "library.tmp"),
      JSON.stringify(items, null, 2),
    );
    await rename(
      path.join(directory, "library.tmp"),
      path.join(directory, "library.json"),
    );
  });
  queue = operation.catch(() => {});
  return operation;
}
export function metadata(input: Record<string, unknown>) {
  return Object.fromEntries(
    ["title", "author", "collection", "series"]
      .filter((k) => typeof input[k] === "string")
      .map((k) => [k, (input[k] as string).trim().slice(0, 300)]),
  );
}
