import { books, directory } from "@/lib/library";
import { readFile } from "node:fs/promises";
import path from "node:path";
export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const book = (await books()).find((b) => b.id === id);
  if (!book) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(
      /* turbopackIgnore: true */
      path.join(
        /* turbopackIgnore: true */ directory,
        `${book.id}.${book.format}`,
      ),
    );
    return new Response(bytes, {
      headers: {
        "Content-Type":
          book.format === "pdf" ? "application/pdf" : "application/epub+zip",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("File unavailable", { status: 404 });
  }
}
