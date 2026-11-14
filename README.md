# cookie

A local-network PDF and EPUB reading room, built with **Bun, Next.js, and React**.

## Run

```bash
bun install
bun run build
bun run start
```

Open `http://localhost:3000/cookie` on the host. Other devices on the same network can open `http://<host-ip>:3000/cookie`. The old root `/` no longer serves the app. On Linux, `hostname -I` displays the host IP. The server binds to `0.0.0.0`; the host must stay running and its firewall must allow TCP port 3000. For development, use `bun run dev`.

## Windows and Linux executables

The **Build executables** GitHub Actions workflow builds Windows x64 and Linux x64
packages on pull requests, pushes to `main` or `master`, and `v*` tags. You can also
run it manually from the repository's **Actions** tab. Download the matching
artifact from a completed run, then extract the archive inside it.

- Windows: extract `cookie-windows-x64.zip` and run `cookie.exe`.
- Linux: extract `cookie-linux-x64.tar.gz` and run `./cookie`.

Open `http://localhost:3000/cookie` after starting the executable. No separate Bun
or Node.js installation is needed. Keep the executable beside its `app` folder;
Next.js assets and server dependencies are shipped in that folder. This is a
portable folder distribution, not a single-file application. Linux packages
target glibc systems such as Ubuntu 22.04 or newer; Alpine is not supported.

Keep the extracted directory writable. Books are stored in `data/` beside the
executable by default. Preserve that directory when upgrading, or set
`LIBRARY_DATA_DIR` to a separate location. `PORT` changes the listening port and
`COOKIE_HOST` changes the bind address (default `0.0.0.0`). `LIBRARY_ROOT` also
works with packaged builds. Keep the terminal open while using the app; press
Ctrl+C to stop it.

To create and check a package locally on Windows x64 or Linux x64:

```bash
bun install --frozen-lockfile
bun run package
bun scripts/smoke-package.mjs
```

Output is written to `dist/cookie-windows-x64/` or `dist/cookie-linux-x64/`.
CI checks the executable, home page, static assets, PDF worker, and book uploads/downloads
before uploading each archive.

## Adding books

Use **Add books → This device** to upload PDFs or EPUBs from any connected phone, tablet, or computer. Uploads are saved on the host and appear in the shared library. Files are uploaded one at a time; successful uploads are kept if a later file fails.

The upload API accepts multipart form data at `POST /cookie/api/books`, using the field `file` (100 MB maximum):

```bash
curl -F "file=@/path/to/book.pdf" http://localhost:3000/cookie/api/books
```

### Host files

Click **Add books** to browse PDF and EPUB files on the server computer, select files, and import them. Files are copied into `data/`; original files are never modified. No client-device upload is required. Each book can be up to 100 MB; import up to 50 at once.

The folder browser defaults to the host user's home folder. Set `LIBRARY_ROOT` to restrict browsing to a specific folder:

```bash
LIBRARY_ROOT=/home/lehani/Books bun run start
```

Only folders and PDF/EPUB files are listed. Hidden entries are omitted and paths outside the configured root are rejected, including symlink escapes. This is a shared, trusted-LAN application without accounts: connected users can browse the configured root, import books, and edit shared metadata. Choose a dedicated books folder when sharing it.

## Reading and organization

- Zoom from 50% to 250%, reset zoom, and paged or continuous vertical scrolling in both formats. EPUB zoom scales reflowable text; PDF zoom scales the page.
- **Add page note** saves a note at the current PDF page or EPUB location. Select document text to highlight or underline it and optionally attach a note. **Notes & highlights** lists annotations, jumps to their locations, and supports editing and deletion. PDF text annotations require a text layer; scanned image-only pages still support page notes. Annotations stay within the app and do not modify the source files.
- PDF reader with previous/next pages, saved position, and clickable embedded outlines.
- EPUB reader with reflowable text, font sizes, saved position, and a nested chapter contents panel.
- Site-wide light/dark toggle, saved per browser and initially following the device theme. Reader color modes remain independent.
- The reader’s **Contents** button displays the document’s embedded index. Documents without one show an empty state; printed or scanned contents pages are not automatically converted into links.
- Light, dark, sepia, and sepia contrast reading modes. PDF colors use a canvas filter (which also affects images); EPUB text and backgrounds are themed.
- Page/location bookmarks, favorites, To read, Reading, and Have read.
- Search and sort, grid/list views, and sections for authors, collections, and series.
- Use each book's **…** button to edit its title, author, collection, and series.

Books and metadata are shared and stored on the host in `data/library.json` and `data/<id>.<format>`. Back up the entire `data/` directory. Set `LIBRARY_DATA_DIR` to relocate it. Run a single server process per data directory.

Reading progress, notes, highlights, bookmarks, favorites, and status are personal to each browser, saved in localStorage. They persist across refreshes but do not sync between devices or browser profiles. Clearing browser storage removes them. DRM-protected ebooks are not supported. Reader libraries and the PDF worker are served locally; the optional Google Fonts stylesheet falls back to system fonts without internet.

## Checks

```bash
bun run typecheck
bun run build
bunx playwright install chromium
bun run test
```

The browser test uses generated two-page PDF and EPUB fixtures, a separate data directory, and port 3001. Stop the development server before running it (Next.js uses a single development build directory). It covers client uploads, zoom, vertical scrolling, persistent notes and text annotations, host imports, path containment, metadata, PDF pagination, bookmarks and reload persistence, all reading modes, EPUB rendering, and a mobile layout check.
