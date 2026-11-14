"use client";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Library as LibraryIcon,
  Heart,
  Bookmark,
  CheckCheck,
  Users,
  Layers,
  Folder,
  Plus,
  Search,
  ArrowUpRight,
  X,
  ChevronRight,
  ArrowLeft,
  MoreHorizontal,
  LayoutGrid,
  List,
  Monitor,
  BookMarked,
  Moon,
  Sun,
} from "lucide-react";
import type { Book, Reading } from "@/lib/types";
import { initialReading } from "@/lib/types";
import dynamic from "next/dynamic";
const Reader = dynamic(() => import("./reader"), { ssr: false });
const nav = [
  { name: "All books", icon: LibraryIcon },
  { name: "Favorites", icon: Heart },
  { name: "To read", icon: Bookmark },
  { name: "Have read", icon: CheckCheck },
  { name: "Authors", icon: Users },
  { name: "Collections", icon: Folder },
  { name: "Series", icon: Layers },
];
export default function Library() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "light");
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("cookie-theme", next);
    } catch {}
  }
  const [books, setBooks] = useState<Book[]>([]),
    [states, setStates] = useState<Record<string, Reading>>({}),
    [section, setSection] = useState("All books"),
    [query, setQuery] = useState(""),
    [format, setFormat] = useState("all"),
    [sort, setSort] = useState("recent"),
    [list, setList] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [importing, setImporting] = useState(false),
    [editing, setEditing] = useState<Book | null>(null),
    [active, setActive] = useState<Book | null>(null),
    [group, setGroup] = useState("");
  async function refresh() {
    try {
      const r = await fetch("/cookie/api/books");
      if (!r.ok) throw Error();
      setBooks(await r.json());
    } catch {
      setError("Could not load the library. Please refresh to try again.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    try {
      setStates(JSON.parse(localStorage.getItem("folio-reading") || "{}"));
    } catch {}
  }, []);
  function update(id: string, changes: Partial<Reading>) {
    setStates((previous) => {
      const next = {
        ...previous,
        [id]: { ...initialReading, ...previous[id], ...changes },
      };
      try {
        localStorage.setItem("folio-reading", JSON.stringify(next));
      } catch {
        setError(
          "Browser storage is full or disabled; reading progress cannot be saved.",
        );
      }
      return next;
    });
  }
  const state = (id: string) => states[id] || initialReading;
  const groupKey =
    section === "Authors"
      ? "author"
      : section === "Collections"
        ? "collection"
        : section === "Series"
          ? "series"
          : null;
  const filtered = books
    .filter(
      (b) =>
        (!query ||
          `${b.title} ${b.author} ${b.series} ${b.collection}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (format === "all" || b.format === format) &&
        (section !== "Favorites" || state(b.id).favorite) &&
        (section !== "To read" || state(b.id).status === "to-read") &&
        (section !== "Have read" || state(b.id).status === "read") &&
        (!groupKey || !group || b[groupKey] === group),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "author"
          ? a.author.localeCompare(b.author)
          : b.added.localeCompare(a.added),
    );
  const groups = groupKey
    ? [...new Set(filtered.map((b) => b[groupKey]).filter(Boolean))].sort()
    : [];
  const reading = books.filter((b) => state(b.id).status === "reading");
  function open(b: Book) {
    setActive(b);
    if (state(b.id).status === "to-read") update(b.id, { status: "reading" });
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/cookie">
          <BookOpen size={29} />
          <span>
            cookie<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">C</span>
          <div>
            My reading room<small>Personal library</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className="nav-label">YOUR LIBRARY</div>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={section === name ? "nav-item selected" : "nav-item"}
              onClick={() => {
                setSection(name);
                setGroup("");
              }}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "All books" && (
                <span className="count">{books.length}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Your library <ChevronRight size={14} /> <span>{section}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <button className="primary" onClick={() => setImporting(true)}>
              <Plus size={18} /> Add books
            </button>
          </div>
        </header>
        <main>
          {section === "All books" && (
            <div className="welcome">
              <div className="welcome-copy">
                <span className="eyebrow">
                  {reading.length
                    ? "PICK UP WHERE YOU LEFT OFF"
                    : "MAKE ROOM FOR A GOOD BOOK"}
                </span>
                <h2>
                  {reading.length
                    ? reading[0].title
                    : "A whole world.\nOn your bookshelf."}
                </h2>
                <p>
                  {reading.length
                    ? `By ${reading[0].author} · Your next page is waiting.`
                    : "Bring your favorite PDFs and EPUBs together.\nSettle in, turn a page, and make yourself at home."}
                </p>
                <button
                  className="text-button"
                  onClick={() =>
                    reading.length ? open(reading[0]) : setImporting(true)
                  }
                >
                  {reading.length ? "Continue reading" : "Build your library"}{" "}
                  <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="book-art" aria-hidden="true">
                <div className="art-circle" />
                <div className="art-book book-one">
                  <small>THE ART OF</small>
                  <strong>
                    slow
                    <br />
                    living
                  </strong>
                  <span>FIND YOUR OWN PACE</span>
                </div>
                <div className="art-book book-two">
                  <small>A FIELD GUIDE</small>
                  <strong>
                    Wander
                    <br />& wonder
                  </strong>
                  <div className="sun" />
                  <span>THE EVERYDAY EXPLORER</span>
                </div>
                <div className="art-book book-three">
                  <small>NOTES ON</small>
                  <strong>
                    little
                    <br />
                    things.
                  </strong>
                  <span>A LIFE WELL NOTICED</span>
                </div>
              </div>
            </div>
          )}
          <div className="library-heading">
            <h2>
              {group || (section === "All books" ? "All books" : section)}{" "}
              <span>{filtered.length}</span>
            </h2>
            <div className="view-toggle">
              <button
                aria-label="Grid view"
                className={!list ? "active" : ""}
                onClick={() => setList(false)}
              >
                <LayoutGrid size={17} />
              </button>
              <button
                aria-label="List view"
                className={list ? "active" : ""}
                onClick={() => setList(true)}
              >
                <List size={18} />
              </button>
            </div>
          </div>
          <div className="filters">
            <label className="search">
              <Search size={18} />
              <input
                placeholder="Search books, authors, and more..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="File format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="all">All formats</option>
              <option value="pdf">PDF</option>
              <option value="epub">EPUB</option>
            </select>
            <select
              aria-label="Sort books"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Recently added</option>
              <option value="title">Title: A–Z</option>
              <option value="author">Author: A–Z</option>
            </select>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {group && (
            <button className="text-button" onClick={() => setGroup("")}>
              <ArrowLeft size={16} /> All {section.toLowerCase()}
            </button>
          )}
          {loading ? (
            <div className="empty">Opening your library…</div>
          ) : groupKey && !group ? (
            <div className="groups">
              {groups.map((g) => (
                <button key={g} onClick={() => setGroup(g)}>
                  <Folder size={24} />
                  <strong>{g}</strong>
                  <span>
                    {filtered.filter((b) => b[groupKey] === g).length} books
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
              {!groups.length && (
                <div className="empty">
                  <Folder size={35} />
                  <h3>No {section.toLowerCase()} yet</h3>
                  <p>Edit a book’s details to organize it here.</p>
                </div>
              )}
            </div>
          ) : filtered.length ? (
            <div className={list ? "books list-view" : "books"}>
              {filtered.map((b, i) => (
                <article className="book-card" key={b.id}>
                  <button
                    className={`book-cover cover-${i % 5}`}
                    onClick={() => open(b)}
                  >
                    <span className="cover-author">{b.author}</span>
                    <strong title={b.title}>{b.title}</strong>
                    <BookOpen size={34} strokeWidth={1} />
                    <span className="format-tag">{b.format.toUpperCase()}</span>
                  </button>
                  <div className="book-info">
                    <button className="book-title" onClick={() => open(b)}>
                      {b.title}
                    </button>
                    <p>{b.author}</p>
                    <div className="book-actions">
                      <select
                        aria-label={`Reading status for ${b.title}`}
                        value={state(b.id).status}
                        onChange={(e) =>
                          update(b.id, {
                            status: e.target.value as Reading["status"],
                          })
                        }
                      >
                        <option value="to-read">To read</option>
                        <option value="reading">Reading</option>
                        <option value="read">Have read</option>
                      </select>
                      <button
                        aria-label={`Favorite ${b.title}`}
                        aria-pressed={state(b.id).favorite}
                        onClick={() =>
                          update(b.id, { favorite: !state(b.id).favorite })
                        }
                      >
                        <Heart
                          size={16}
                          fill={state(b.id).favorite ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        aria-label={`Edit ${b.title}`}
                        onClick={() => setEditing(b)}
                      >
                        <MoreHorizontal size={19} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <BookMarked size={31} strokeWidth={1.5} />
              </div>
              <h3>
                {books.length
                  ? "No books on this shelf yet"
                  : "Good stories deserve a home."}
              </h3>
              <p>
                {books.length
                  ? "Try a different search or add books to this section."
                  : "Choose books from your host computer to start your collection."}
              </p>
              {!books.length && (
                <button
                  className="secondary"
                  onClick={() => setImporting(true)}
                >
                  <Plus size={16} /> Add your first book
                </button>
              )}
              <span className="supported">
                PDF & EPUB · Stored on your computer
              </span>
            </div>
          )}
          <footer>
            <span>
              {books.length} {books.length === 1 ? "book" : "books"} in your
              library
            </span>
          </footer>
        </main>
      </div>
      {importing && (
        <HostPicker
          close={() => setImporting(false)}
          done={() => {
            setImporting(false);
            refresh();
          }}
        />
      )}
      {editing && (
        <EditBook
          book={editing}
          close={() => setEditing(null)}
          done={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {active && (
        <Reader
          book={active}
          reading={state(active.id)}
          update={(changes) => update(active.id, changes)}
          close={() => setActive(null)}
        />
      )}
    </div>
  );
}
function HostPicker({ close, done }: { close: () => void; done: () => void }) {
  const [source, setSource] = useState<"host" | "client">("host");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  async function upload() {
    setBusy(true);
    setError("");
    let remaining = [...files];
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${files.length}…`);
        const form = new FormData();
        form.set("file", files[i]);
        const r = await fetch("/cookie/api/books", {
          method: "POST",
          body: form,
        });
        const result = await r.json();
        if (!r.ok) throw Error(`${files[i].name}: ${result.error}`);
        remaining = remaining.slice(1);
        setFiles(remaining);
      }
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setUploadProgress("");
    }
  }
  const [folder, setFolder] = useState(""),
    [root, setRoot] = useState(""),
    [entries, setEntries] = useState<
      { name: string; path: string; directory: boolean }[]
    >([]),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError("");
    fetch(`/cookie/api/host?path=${encodeURIComponent(folder)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!canceled) {
          setRoot(d.root);
          setEntries(d.entries);
        }
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [folder]);
  async function add() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/cookie/api/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: selected }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add books"
      >
        <div className="modal-heading">
          <div>
            <h2>Add to your bookshelf</h2>
            <p>Choose PDF or EPUB files from the host or your device.</p>
          </div>
          <button aria-label="Close" onClick={close} disabled={busy}>
            <X />
          </button>
        </div>
        <div className="import-tabs">
          <button
            disabled={busy}
            aria-pressed={source === "host"}
            onClick={() => setSource("host")}
          >
            Host computer
          </button>
          <button
            disabled={busy}
            aria-pressed={source === "client"}
            onClick={() => setSource("client")}
          >
            This device
          </button>
        </div>
        {source === "host" ? (
          <>
            <div className="host-path">
              <Monitor size={17} />
              <span>
                {root}/{folder}
              </span>
              {folder && (
                <button
                  aria-label="Parent folder"
                  onClick={() =>
                    setFolder(folder.split("/").slice(0, -1).join("/"))
                  }
                >
                  <ArrowLeft size={18} />
                </button>
              )}
            </div>
            <div className="file-list">
              {loading ? (
                <p>Loading folder…</p>
              ) : (
                entries.map((e) =>
                  e.directory ? (
                    <button
                      className="file-row"
                      key={e.path}
                      onClick={() => setFolder(e.path)}
                    >
                      <Folder size={20} />
                      <span>{e.name}</span>
                      <ChevronRight size={17} />
                    </button>
                  ) : (
                    <label className="file-row" key={e.path}>
                      <input
                        type="checkbox"
                        checked={selected.includes(e.path)}
                        disabled={busy}
                        onChange={() =>
                          setSelected((s) =>
                            s.includes(e.path)
                              ? s.filter((p) => p !== e.path)
                              : [...s, e.path],
                          )
                        }
                      />
                      <BookOpen size={19} />
                      <span>{e.name}</span>
                      <small>{e.name.split(".").pop()?.toUpperCase()}</small>
                    </label>
                  ),
                )
              )}
              {!loading && !entries.length && (
                <p>No folders, PDFs, or EPUBs here.</p>
              )}
            </div>
          </>
        ) : (
          <div className="client-upload">
            <label className="form-field">
              Select books
              <input
                aria-label="Upload books"
                type="file"
                accept=".pdf,.epub"
                multiple
                disabled={busy}
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </label>
            <p>
              Upload to the shared library from this phone, tablet, or computer.
            </p>
            {files.map((file, i) => (
              <div key={i}>
                {file.name}{" "}
                <small>({(file.size / 1024 / 1024).toFixed(1)} MB)</small>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <small>
            {source === "host" ? selected.length : files.length} selected · Up
            to 100 MB per book
          </small>
          <button
            className="primary"
            disabled={
              busy ||
              (source === "host"
                ? !selected.length || selected.length > 50
                : !files.length ||
                  files.some((f) => f.size > 100 * 1024 * 1024))
            }
            onClick={source === "host" ? add : upload}
          >
            {busy
              ? uploadProgress || "Importing…"
              : source === "host"
                ? "Add selected books"
                : "Upload selected books"}
          </button>
        </div>
        <p className="hint">
          Books are copied into the library; your originals stay in place.
        </p>
      </section>
    </div>
  );
}
function EditBook({
  book,
  close,
  done,
}: {
  book: Book;
  close: () => void;
  done: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit book details"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch(`/cookie/api/books/${book.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                Object.fromEntries(new FormData(e.currentTarget)),
              ),
            });
            if (!r.ok) throw Error("Unable to save book details.");
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-heading">
          <h2>Book details</h2>
          <button type="button" aria-label="Close" onClick={close}>
            <X />
          </button>
        </div>
        {(["title", "author", "collection", "series"] as const).map((k) => (
          <label className="form-field" key={k}>
            {k}
            <input
              name={k}
              defaultValue={book[k]}
              required={k === "title"}
              maxLength={300}
              placeholder={
                k === "collection"
                  ? "e.g. Weekend reads"
                  : k === "series"
                    ? "e.g. The Earthsea Cycle"
                    : ""
              }
            />
          </label>
        ))}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save details"}
        </button>
      </form>
    </div>
  );
}
