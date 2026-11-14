import { NextResponse } from "next/server";
import { books } from "@/lib/library";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await books());
}

export async function POST(request: Request) {
  const { mkdir, writeFile, unlink } = await import("node:fs/promises");
  const { randomUUID } = await import("node:crypto");
  const { directory, updateLibrary } = await import("@/lib/library");
  const path = await import("node:path");
  try {
    if (Number(request.headers.get("content-length") || 0) > 101 * 1024 * 1024)
      return NextResponse.json(
        { error: "Maximum file size is 100 MB." },
        { status: 413 },
      );
    const data = await request.formData();
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      file.size < 4 ||
      file.size > 100 * 1024 * 1024
    )
      return NextResponse.json(
        { error: "Choose a PDF or EPUB up to 100 MB." },
        { status: 400 },
      );
    const format = file.name.split(".").pop()?.toLowerCase();
    if (format !== "pdf" && format !== "epub")
      return NextResponse.json(
        { error: "Only PDF and EPUB files are supported." },
        { status: 400 },
      );
    const bytes = Buffer.from(await file.arrayBuffer());
    if (
      format === "pdf"
        ? !bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))
        : bytes.readUInt16LE(0) !== 0x4b50
    )
      return NextResponse.json(
        { error: "File contents do not match the selected format." },
        { status: 400 },
      );
    const book = {
      id: randomUUID(),
      title:
        path
          .basename(file.name)
          .replace(/\.[^.]+$/, "")
          .slice(0, 300) || "Untitled",
      author: "Unknown author",
      collection: "",
      series: "",
      format,
      size: file.size,
      added: new Date().toISOString(),
    } as import("@/lib/types").Book;
    await mkdir(directory, { recursive: true });
    const destination = path.join(
      /* turbopackIgnore: true */ directory,
      `${book.id}.${format}`,
    );
    await writeFile(destination, bytes);
    try {
      await updateLibrary((items) => [...items, book]);
    } catch (e) {
      await unlink(destination);
      throw e;
    }
    return NextResponse.json(book, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
