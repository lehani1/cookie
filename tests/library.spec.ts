import { test, expect } from "@playwright/test";
import { rm } from "node:fs/promises";
test.beforeAll(async () => {
  await rm(".test-data", { recursive: true, force: true });
});
test("host import, organization, PDF and EPUB reading, and persistence", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const outside = await request.get("/cookie/api/host?path=../../");
  expect(outside.status()).toBe(400);
  await page.goto("/cookie");
  await expect(page).toHaveTitle("cookie — Your reading room");
  await expect(page.getByText("Your next chapter starts here.")).toHaveCount(0);
  await expect(page.getByText("On your local network")).toHaveCount(0);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(25, 31, 28)",
  );
  await page.getByRole("button", { name: "Add books", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText("Reading sample.pdf", { exact: true }).click();
  await page.getByText("Reading sample.epub", { exact: true }).click();
  await page.getByRole("button", { name: "Add selected books" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const cards = page.locator(".book-card");
  await expect(cards).toHaveCount(2);
  const pdf = cards.filter({
    has: page.locator(".format-tag", { hasText: "PDF" }),
  });
  await pdf.getByRole("button", { name: "Favorite Reading sample" }).click();
  await pdf.getByRole("button", { name: "Edit Reading sample" }).click();
  await page.getByLabel("author", { exact: true }).fill("Folio Author");
  await page.getByLabel("collection", { exact: true }).fill("Weekend reads");
  await page.getByLabel("series", { exact: true }).fill("Quiet chapters");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await pdf.locator(".book-cover").click();
  await expect(page.locator(".pdf-page canvas")).toBeVisible();
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Contents", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "First chapter", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Second chapter", exact: true })
    .click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Bookmark this page", exact: true })
    .click();
  for (const mode of ["dark", "sepia", "sepia-contrast", "light"]) {
    await page.getByLabel("Reading color mode").selectOption(mode);
    await expect(page.locator(".reader")).toHaveClass(`reader mode-${mode}`);
  }
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.reload();
  await pdf.locator(".book-cover").click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await page.getByRole("button", { name: "Weekend reads 1 books" }).click();
  await expect(cards).toHaveCount(1);
  await page
    .getByRole("button", { name: "All books", exact: false })
    .first()
    .click();
  const epub = cards.filter({
    has: page.locator(".format-tag", { hasText: "EPUB" }),
  });
  await epub.locator(".book-cover").click();
  await expect(
    page
      .frameLocator(".epub-host iframe")
      .getByText("A quiet chapter", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Contents", exact: true }).click();
  await page
    .getByRole("button", { name: "A quiet chapter", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Document contents" }),
  ).toHaveCount(0);
  await page.getByLabel("Reading color mode").selectOption("sepia-contrast");
  await expect(
    page.frameLocator(".epub-host iframe").locator("body"),
  ).toHaveCSS("background-color", "rgb(234, 212, 169)");
  await page
    .getByRole("button", { name: "Bookmark this page", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bookmarks (1)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const books = await (await request.get("/cookie/api/books")).json();
  await request.patch(`/cookie/api/books/${books[0].id}`, {
    data: {
      title:
        "Arun Sharma - How to Prepare for DATA INTERPRETATION for CAT - averylongunbrokenfilename.pdf",
    },
  });
  await page.reload();
  await expect(cards).toHaveCount(2);
  for (const cover of await page.locator(".book-cover").all()) {
    expect(
      await cover.evaluate((el) => {
        const title = el.querySelector("strong")!;
        const a = el.getBoundingClientRect(),
          b = title.getBoundingClientRect();
        return (
          b.left >= a.left &&
          b.right <= a.right &&
          title.scrollWidth <= title.clientWidth
        );
      }),
    ).toBeTruthy();
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("client uploads, PDF scrolling and zoom, notes and text annotations persist under /cookie", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  expect((await request.get("/")).status()).toBe(404);
  const invalid = await request.post("/cookie/api/books", {
    multipart: {
      file: {
        name: "bad.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("not a pdf"),
      },
    },
  });
  expect(invalid.status()).toBe(400);
  await page.goto("/cookie");
  await page.getByRole("button", { name: "Add books", exact: true }).click();
  await page.getByRole("button", { name: "This device", exact: true }).click();
  await page
    .getByLabel("Upload books")
    .setInputFiles("tests/fixtures/Reading sample.pdf");
  await page
    .getByRole("button", { name: "Upload selected books", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const card = page
    .locator(".book-card")
    .filter({ has: page.locator(".format-tag", { hasText: "PDF" }) })
    .filter({ has: page.locator(".book-title", { hasText: "Reading sample" }) })
    .first();
  await card.locator(".book-cover").click();
  const text = page
    .locator(".textLayer span")
    .filter({ hasText: "Folio test page 1" });
  await expect(text).toBeVisible();
  const before = (await page.locator(".pdf-page").boundingBox())!.width;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Zoom level")).toHaveText("125%");
  expect((await page.locator(".pdf-page").boundingBox())!.width).toBeCloseTo(
    before * 1.25,
    0,
  );
  await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
  await page
    .getByRole("button", { name: "Add page note", exact: true })
    .click();
  await page.getByLabel("Page note").fill("A page-one thought");
  await page
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await expect(page.locator(".saved-note")).toContainText("A page-one thought");
  await page.getByRole("button", { name: "Close notes", exact: true }).click();
  await text.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(r);
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await expect(page.getByLabel("Page note")).toBeVisible();
  await page.getByLabel("Page note").fill("Important line");
  await page
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await expect(page.locator(".pdf-mark").first()).toBeVisible();
  await page.getByRole("button", { name: "Close notes", exact: true }).click();
  await page.getByLabel("Reading layout").selectOption("scroll");
  await expect(page.locator(".pdf-page")).toHaveCount(2);
  await page.locator(".pdf-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Add page note", exact: true })
    .click();
  await page.getByLabel("Page note").fill("A page-two thought");
  await page
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await page.getByRole("button", { name: "Close notes", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.reload();
  await card.locator(".book-cover").click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Notes & highlights (3)", exact: true })
    .click();
  await expect(page.locator(".saved-note")).toHaveCount(3);
  await page
    .locator(".saved-note")
    .filter({ hasText: "Important line" })
    .getByRole("button", { name: "Page 1 ↗" })
    .click();
  await page.getByRole("button", { name: "Close notes", exact: true }).click();
  await expect(page.locator(".pdf-mark").first()).toBeVisible();
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("EPUB highlights and vertical layout", async ({ page, request }) => {
  await request.post("/cookie/api/host", {
    data: { paths: ["Reading sample.epub"] },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/cookie");
  const card = page
    .locator(".book-card")
    .filter({ has: page.locator(".format-tag", { hasText: "EPUB" }) })
    .first();
  await card.locator(".book-cover").click();
  const paragraph = page.frameLocator(".epub-host iframe").locator("p").first();
  await expect(paragraph).toBeVisible();
  await paragraph.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(r);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await expect(page.getByLabel("Page note")).toBeVisible();
  await page.getByLabel("Annotation style").selectOption("underline");
  await page.getByLabel("Page note").fill("Remember this EPUB passage");
  await page
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await page.getByRole("button", { name: "Close notes", exact: true }).click();
  await expect(page.locator(".epub-host .cookie-annotation")).toHaveCount(1);
  await page.getByLabel("Reading layout").selectOption("scroll");
  await expect(paragraph).toBeVisible();
  await expect(page.locator(".epub-host .cookie-annotation")).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator(".epub-container")
        .evaluate((el) => el.scrollHeight > el.clientHeight),
    )
    .toBeTruthy();
  await page.locator(".epub-container").evaluate((el) => {
    el.scrollTop = 600;
  });
  await expect
    .poll(() => page.locator(".epub-container").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Zoom level")).toHaveText("125%");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.reload();
  await card.locator(".book-cover").click();
  await expect(page.locator(".epub-host .cookie-annotation")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Notes & highlights (1)", exact: true })
    .click();
  await expect(page.locator(".saved-note")).toContainText(
    "Remember this EPUB passage",
  );
  await page
    .getByRole("button", { name: "Delete annotation", exact: true })
    .click();
  await expect(page.locator(".epub-host .cookie-annotation")).toHaveCount(0);
  expect(errors).toEqual([]);
});
