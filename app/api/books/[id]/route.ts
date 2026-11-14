import { NextResponse } from "next/server";
import { books, metadata, updateLibrary } from "@/lib/library";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!(await books()).some((b) => b.id === id))
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  try {
    const changes = metadata(await request.json());
    if ("title" in changes && !changes.title)
      return NextResponse.json(
        { error: "A title is required." },
        { status: 400 },
      );
    await updateLibrary((items) =>
      items.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    );
    return NextResponse.json((await books()).find((b) => b.id === id));
  } catch {
    return NextResponse.json(
      { error: "Could not save changes." },
      { status: 400 },
    );
  }
}
