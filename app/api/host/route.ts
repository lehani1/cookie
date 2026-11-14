import { NextResponse } from "next/server";
import {
  readdir,
  realpath,
  stat,
  readFile,
  mkdir,
  copyFile,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { directory, updateLibrary } from "@/lib/library";
import type { Book } from "@/lib/types";
const root = path.resolve(process.env.LIBRARY_ROOT || os.homedir());
async function resolvePath(relative: string) {
  const base = await realpath(root);
  const result = await realpath(path.resolve(base, relative));
  if (result !== base && !result.startsWith(base + path.sep))
    throw new Error("Outside library root");
  return result;
}
export async function GET(request: Request) {
  try {
    const relative = new URL(request.url).searchParams.get("path") || "";
    const folder = await resolvePath(relative);
    const entries = (await readdir(folder, { withFileTypes: true }))
      .filter(
        (e) =>
          !e.name.startsWith(".") &&
          (e.isDirectory() || (e.isFile() && /\.(pdf|epub)$/i.test(e.name))),
      )
      .map((e) => ({
        name: e.name,
        directory: e.isDirectory(),
        path: path.relative(root, path.join(folder, e.name)),
      }))
      .sort(
        (a, b) =>
          Number(b.directory) - Number(a.directory) ||
          a.name.localeCompare(b.name),
      );
    return NextResponse.json({
      root,
      path: path.relative(root, folder),
      entries,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "This folder is unavailable or outside the configured library folder.",
      },
      { status: 400 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const { paths } = await request.json();
    if (
      !Array.isArray(paths) ||
      paths.length < 1 ||
      paths.length > 50 ||
      paths.some((p) => typeof p !== "string")
    )
      return NextResponse.json(
        { error: "Select between 1 and 50 books." },
        { status: 400 },
      );
    const imported: Book[] = [];
    for (const relative of paths) {
      const source = await resolvePath(relative);
      const format = path.extname(source).slice(1).toLowerCase();
      const info = await stat(source);
      if (
        !info.isFile() ||
        !["pdf", "epub"].includes(format) ||
        info.size < 4 ||
        info.size > 100 * 1024 * 1024
      )
        throw new Error("Invalid file");
      const bytes = await readFile(source);
      if (
        format === "pdf"
          ? !bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))
          : bytes.readUInt16LE(0) !== 0x4b50
      )
        throw new Error("Invalid format");
      imported.push({
        id: randomUUID(),
        title: path.basename(source, path.extname(source)),
        author: "Unknown author",
        collection: "",
        series: "",
        format: format as Book["format"],
        size: info.size,
        added: new Date().toISOString(),
      });
    }
    await mkdir(directory, { recursive: true });
    const copied: string[] = [];
    try {
      for (let i = 0; i < imported.length; i++) {
        const dest = path.join(
          /* turbopackIgnore: true */
          directory,
          `${imported[i].id}.${imported[i].format}`,
        );
        await copyFile(await resolvePath(paths[i]), dest);
        copied.push(dest);
      }
      await updateLibrary((items) => [...items, ...imported]);
    } catch (e) {
      await Promise.all(copied.map((f) => unlink(f).catch(() => {})));
      throw e;
    }
    return NextResponse.json(imported, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        error:
          "Import failed. Select valid PDF or EPUB files under 100 MB in the host library folder.",
      },
      { status: 400 },
    );
  }
}
