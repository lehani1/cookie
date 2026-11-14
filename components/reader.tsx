"use client";
import { useEffect, useRef, useState } from "react";
import type { Book as EpubBook, Rendition } from "epubjs";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import PdfPages, { type SelectionDraft } from "./pdf-pages";
import type Contents from "epubjs/types/contents";
import type { Annotation, Book, Reading } from "@/lib/types";
type PdfOutline = NonNullable<
  Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>
>;
type ContentsEntry = {
  title: string;
  href?: string;
  dest?: PdfOutline[number]["dest"];
  children: ContentsEntry[];
};
function ContentsList({
  entries,
  navigate,
}: {
  entries: ContentsEntry[];
  navigate: (entry: ContentsEntry) => void;
}) {
  return (
    <ul className="contents-list">
      {entries.map((entry, index) => (
        <li key={index}>
          {entry.href || entry.dest ? (
            <button onClick={() => navigate(entry)}>{entry.title}</button>
          ) : (
            <span className="contents-label">{entry.title}</span>
          )}
          {entry.children.length > 0 && (
            <ContentsList entries={entry.children} navigate={navigate} />
          )}
        </li>
      ))}
    </ul>
  );
}
const palettes = {
  light: { background: "#ffffff", color: "#242424" },
  dark: { background: "#202322", color: "#e5e5df" },
  sepia: { background: "#f2e7d1", color: "#69523b" },
  "sepia-contrast": { background: "#ead4a9", color: "#281b0c" },
};
export default function Reader({
  book,
  reading,
  update,
  close,
}: {
  book: Book;
  reading: Reading;
  update: (changes: Partial<Reading>) => void;
  close: () => void;
}) {
  const [mode, setMode] = useState<keyof typeof palettes>("light"),
    [page, setPage] = useState(
      Number(book.format === "pdf" ? reading.location || 1 : 1),
    ),
    [total, setTotal] = useState(0),
    [location, setLocation] = useState(reading.location || ""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [marks, setMarks] = useState(false),
    [contentsOpen, setContentsOpen] = useState(false),
    [contents, setContents] = useState<ContentsEntry[]>([]),
    [contentsLoading, setContentsLoading] = useState(true),
    [contentsError, setContentsError] = useState("");
  const [font, setFont] = useState(100);
  const [zoom, setZoom] = useState(100),
    [scrolling, setScrolling] = useState(false),
    [jump, setJump] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false),
    [draft, setDraft] = useState<SelectionDraft | null>(null),
    [note, setNote] = useState(""),
    [kind, setKind] = useState<"highlight" | "underline">("highlight"),
    [editingId, setEditingId] = useState<string | null>(null);
  const annotations = reading.annotations || [];
  const appliedAnnotations = useRef<Annotation[]>([]);
  const currentLocation = useRef(reading.location);
  currentLocation.current = location || reading.location;
  function changePage(n: number) {
    setPage(n);
    setLocation(String(n));
    updater.current({ location: String(n), progress: n / total });
  }
  function jumpToPage(n: number) {
    changePage(n);
    setJump((v) => v + 1);
  }
  function beginNote(selection?: SelectionDraft) {
    setDraft(selection || { location: location || String(page), quote: "" });
    setNote("");
    setEditingId(null);
    setNotesOpen(true);
    setMarks(false);
    setContentsOpen(false);
  }
  function saveNote() {
    if (!draft || (!draft.quote && !note.trim())) return;
    const entry: Annotation = {
      id: editingId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      location: draft.location,
      label: book.format === "pdf" ? `Page ${draft.location}` : "EPUB passage",
      quote: draft.quote,
      note: note.trim(),
      kind,
      rects: draft.rects,
    };
    update({
      annotations: editingId
        ? annotations.map((a) => (a.id === editingId ? entry : a))
        : [...annotations, entry],
    });
    setDraft(null);
    setNote("");
    setEditingId(null);
    window.getSelection()?.removeAllRanges();
    for (const frame of viewer.current?.querySelectorAll("iframe") || [])
      frame.contentWindow?.getSelection()?.removeAllRanges();
  }

  const viewer = useRef<HTMLDivElement>(null),
    pdf = useRef<PDFDocumentProxy | null>(null),
    epub = useRef<EpubBook | null>(null),
    rendition = useRef<Rendition | null>(null),
    updater = useRef(update);
  updater.current = update;
  useEffect(() => {
    const saved = localStorage.getItem("folio-mode");
    if (saved && saved in palettes) setMode(saved as keyof typeof palettes);
  }, []);
  useEffect(() => {
    let canceled = false;
    let destroy: (() => void) | undefined;
    async function load() {
      try {
        if (book.format === "pdf") {
          const engine = await import("pdfjs-dist");
          engine.GlobalWorkerOptions.workerSrc = "/cookie/pdf.worker.min.mjs";
          const task = engine.getDocument(`/cookie/api/books/${book.id}/file`);
          destroy = () => {
            void task.destroy();
          };
          const doc = await task.promise;
          if (canceled) return;
          pdf.current = doc;
          doc
            .getOutline()
            .then((outline) => {
              const convert = (items: PdfOutline): ContentsEntry[] =>
                items.map((item) => ({
                  title: item.title || "Untitled section",
                  dest: item.dest,
                  children: convert(item.items || []),
                }));
              if (!canceled) setContents(convert(outline || []));
            })
            .catch(() => {
              if (!canceled)
                setContentsError(
                  "This document’s contents could not be loaded.",
                );
            })
            .finally(() => {
              if (!canceled) setContentsLoading(false);
            });
          setTotal(doc.numPages);
          const restored = Math.max(
            1,
            Math.min(doc.numPages, Number(currentLocation.current) || 1),
          );
          setPage(restored);
          setLocation(String(restored));
          setLoading(false);
        } else {
          const { default: ePub } = await import("epubjs");
          const r = await fetch(`/cookie/api/books/${book.id}/file`);
          if (!r.ok) throw Error("File unavailable");
          const bytes = await r.arrayBuffer();
          if (canceled) return;
          const doc = ePub(bytes);
          epub.current = doc;
          doc.loaded.navigation
            .then((navigation) => {
              const convert = (items: typeof navigation.toc): ContentsEntry[] =>
                items.map((item) => ({
                  title: item.label.trim() || "Untitled section",
                  href: item.href,
                  children: convert(item.subitems || []),
                }));
              if (!canceled) setContents(convert(navigation.toc));
            })
            .catch(() => {
              if (!canceled)
                setContentsError(
                  "This document’s contents could not be loaded.",
                );
            })
            .finally(() => {
              if (!canceled) setContentsLoading(false);
            });
          destroy = () => doc.destroy();
          const host = viewer.current!;
          const view = doc.renderTo(host, {
            width: host.clientWidth,
            height: host.clientHeight,
            spread: "none",
            manager: scrolling ? "continuous" : "default",
            flow: scrolling ? "scrolled-doc" : "paginated",
            allowScriptedContent: false,
          });
          rendition.current = view;
          view.on("selected", (cfi: string, contents: Contents) => {
            const quote = contents.window.getSelection()?.toString().trim();
            if (quote) {
              setDraft({ location: cfi, quote });
              setNote("");
              setEditingId(null);
              setNotesOpen(true);
              setMarks(false);
              setContentsOpen(false);
            }
          });
          const observer = new ResizeObserver(() => {
            if (!canceled && host.clientWidth && host.clientHeight)
              view.resize(host.clientWidth, host.clientHeight);
          });
          destroy = () => {
            observer.disconnect();
            doc.destroy();
          };
          view.on(
            "relocated",
            (loc: {
              start: {
                cfi: string;
                displayed: { page: number; total: number };
              };
            }) => {
              if (canceled) return;
              setLocation(loc.start.cfi);
              updater.current({ location: loc.start.cfi });
              setPage(loc.start.displayed.page);
              setTotal(loc.start.displayed.total);
            },
          );
          await view.display(currentLocation.current || undefined);
          if (canceled) return;
          observer.observe(host);
          setLoading(false);
        }
      } catch (e) {
        if (!canceled) {
          setError(`Unable to open this book. ${(e as Error).message}`);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      canceled = true;
      destroy?.();
      pdf.current = null;
      rendition.current = null;
    };
  }, [book.id, book.format, scrolling]);
  useEffect(() => {
    const view = rendition.current;
    if (!view || loading) return;
    for (const a of appliedAnnotations.current) {
      if (a.quote) view.annotations.remove(a.location, a.kind);
    }
    const applied = new Set<string>();
    for (const a of annotations) {
      const key = `${a.kind}:${a.location}`;
      if (applied.has(key)) continue;
      applied.add(key);
      if (a.quote)
        view.annotations.add(
          a.kind,
          a.location,
          {},
          undefined,
          "cookie-annotation",
          a.kind === "highlight"
            ? {
                fill: "#f4ce48",
                "fill-opacity": "0.35",
                "mix-blend-mode": "multiply",
              }
            : { stroke: "#cf8b1f", "stroke-width": "2" },
        );
    }
    appliedAnnotations.current = annotations;
  }, [reading.annotations, loading, scrolling]);
  useEffect(() => {
    try {
      localStorage.setItem("folio-mode", mode);
    } catch {}
    const view = rendition.current;
    if (view) {
      view.themes.default({
        body: {
          background: `${palettes[mode].background} !important`,
          color: `${palettes[mode].color} !important`,
        },
        "p, span, div, h1, h2, h3, a": {
          color: "inherit !important",
          background: "transparent !important",
        },
      });
      view.themes.fontSize(`${(font * zoom) / 100}%`);
    }
  }, [mode, font, zoom, loading, scrolling]);
  function move(delta: number) {
    if (book.format === "pdf")
      jumpToPage(Math.max(1, Math.min(total, page + delta)));
    else {
      const action =
        delta > 0 ? rendition.current?.next() : rendition.current?.prev();
      action?.catch(() => setError("Could not turn the page."));
    }
  }
  function go(loc: string) {
    if (book.format === "pdf") jumpToPage(Number(loc));
    else
      rendition.current
        ?.display(loc)
        .catch(() => setError("Bookmark could not be opened."));
    setMarks(false);
  }
  async function navigateContents(entry: ContentsEntry) {
    try {
      if (book.format === "pdf") {
        const doc = pdf.current;
        if (!doc || !entry.dest) return;
        const destination =
          typeof entry.dest === "string"
            ? await doc.getDestination(entry.dest)
            : entry.dest;
        if (!destination) throw Error();
        const reference = destination[0];
        const index =
          typeof reference === "number"
            ? reference
            : await doc.getPageIndex(reference);
        if (index < 0 || index >= doc.numPages) throw Error();
        jumpToPage(index + 1);
      } else if (entry.href) {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(entry.href)) throw Error();
        await rendition.current?.display(entry.href);
      }
      setContentsOpen(false);
    } catch {
      setContentsError("This section could not be opened.");
    }
  }
  const marked = reading.bookmarks.some((b) => b.location === location);
  return (
    <div className={`reader mode-${mode}`} style={palettes[mode]}>
      <header className="reader-toolbar">
        <button onClick={close}>
          <ArrowLeft size={18} />
          <span>Library</span>
        </button>
        <div className="reader-title">
          <strong>{book.title}</strong>
          <small>{book.author}</small>
        </div>
        <select
          aria-label="Reading color mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as keyof typeof palettes)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="sepia">Sepia</option>
          <option value="sepia-contrast">Sepia contrast</option>
        </select>
        {book.format === "epub" && (
          <select
            aria-label="Text size"
            value={font}
            onChange={(e) => setFont(Number(e.target.value))}
          >
            <option value={85}>Small text</option>
            <option value={100}>Medium text</option>
            <option value={125}>Large text</option>
            <option value={150}>Extra large</option>
          </select>
        )}
        <button
          aria-label={marked ? "Remove bookmark" : "Bookmark this page"}
          disabled={!location || loading}
          onClick={() =>
            update({
              bookmarks: marked
                ? reading.bookmarks.filter((b) => b.location !== location)
                : [
                    ...reading.bookmarks,
                    {
                      location,
                      label:
                        book.format === "pdf"
                          ? `Page ${page}`
                          : `Bookmark ${reading.bookmarks.length + 1}`,
                    },
                  ],
            })
          }
        >
          <Bookmark size={19} fill={marked ? "currentColor" : "none"} />
        </button>
        <button
          aria-expanded={contentsOpen}
          onClick={() => {
            setNotesOpen(false);
            setContentsOpen(!contentsOpen);
            setMarks(false);
          }}
        >
          Contents
        </button>
        <button
          onClick={() => {
            setNotesOpen(false);
            setMarks(!marks);
            setContentsOpen(false);
          }}
        >
          Bookmarks ({reading.bookmarks.length})
        </button>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading && <p className="reader-loading">Opening your book…</p>}
      <div className="reader-controls">
        <div className="zoom-controls">
          <button
            aria-label="Zoom out"
            disabled={zoom <= 50}
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
          >
            −
          </button>
          <output aria-label="Zoom level">{zoom}%</output>
          <button
            aria-label="Zoom in"
            disabled={zoom >= 250}
            onClick={() => setZoom((z) => Math.min(250, z + 25))}
          >
            +
          </button>
          <button onClick={() => setZoom(100)}>Reset zoom</button>
        </div>
        <select
          aria-label="Reading layout"
          value={scrolling ? "scroll" : "pages"}
          onChange={(e) => {
            setLoading(true);
            setScrolling(e.target.value === "scroll");
          }}
        >
          <option value="pages">Paged view</option>
          <option value="scroll">Vertical scrolling</option>
        </select>
        <button disabled={loading || !location} onClick={() => beginNote()}>
          Add page note
        </button>
        <button
          onClick={() => {
            setNotesOpen(!notesOpen);
            setMarks(false);
            setContentsOpen(false);
          }}
        >
          Notes & highlights ({annotations.length})
        </button>
      </div>
      <div className="reader-body">
        {book.format === "pdf" ? (
          !loading &&
          pdf.current && (
            <PdfPages
              doc={pdf.current}
              page={page}
              zoom={zoom}
              scrolling={scrolling}
              jump={jump}
              annotations={annotations}
              onPage={changePage}
              onSelect={(selection) => beginNote(selection)}
            />
          )
        ) : (
          <div className="epub-host" ref={viewer} />
        )}
      </div>
      <div className="reader-bottom">
        <button
          aria-label="Previous page"
          disabled={loading || (book.format === "pdf" && page <= 1)}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={20} /> Previous
        </button>
        <span>
          {book.format === "pdf" ? "Page" : "Chapter page"} {page} of{" "}
          {total || "…"}
        </span>
        <button
          aria-label="Next page"
          disabled={loading || (book.format === "pdf" && page >= total)}
          onClick={() => move(1)}
        >
          Next <ChevronRight size={20} />
        </button>
      </div>
      {notesOpen && (
        <aside
          className="bookmarks-panel notes-panel"
          aria-label="Notes and highlights"
        >
          <div className="modal-heading">
            <h2>Notes & highlights</h2>
            <button
              aria-label="Close notes"
              onClick={() => setNotesOpen(false)}
            >
              <X />
            </button>
          </div>
          <p className="hint">
            Select text to highlight or underline. Notes are saved in this
            browser.
          </p>
          {draft && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveNote();
              }}
              className="note-editor"
            >
              <strong>
                {book.format === "pdf"
                  ? `Page ${draft.location}`
                  : "Selected EPUB location"}
              </strong>
              {draft.quote && (
                <>
                  <blockquote>{draft.quote}</blockquote>
                  <select
                    aria-label="Annotation style"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as typeof kind)}
                  >
                    <option value="highlight">Highlight</option>
                    <option value="underline">Underline</option>
                  </select>
                </>
              )}
              <label className="form-field">
                Note
                <textarea
                  aria-label="Page note"
                  value={note}
                  maxLength={10000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Write your thoughts…"
                  rows={4}
                />
              </label>
              <button
                className="primary"
                disabled={!draft.quote && !note.trim()}
              >
                Save annotation
              </button>
              <button type="button" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </form>
          )}
          {!annotations.length && !draft && (
            <p>No notes yet. Add a page note or select text in the book.</p>
          )}
          {annotations.map((a) => (
            <article className="saved-note" key={a.id}>
              <button className="text-button" onClick={() => go(a.location)}>
                {a.label} ↗
              </button>
              {a.quote && <blockquote>{a.quote}</blockquote>}
              {a.note && <p>{a.note}</p>}
              <div>
                <button
                  onClick={() => {
                    setDraft(a);
                    setNote(a.note);
                    setKind(a.kind);
                    setEditingId(a.id);
                  }}
                >
                  Edit note
                </button>
                <button
                  onClick={() => {
                    update({
                      annotations: annotations.filter((n) => n.id !== a.id),
                    });
                    if (editingId === a.id) setDraft(null);
                  }}
                >
                  Delete annotation
                </button>
              </div>
            </article>
          ))}
        </aside>
      )}
      {contentsOpen && (
        <aside
          className="bookmarks-panel contents-panel"
          aria-label="Document contents"
        >
          <div className="modal-heading">
            <h2>Contents</h2>
            <button
              aria-label="Close contents"
              onClick={() => setContentsOpen(false)}
            >
              <X />
            </button>
          </div>
          {contentsLoading ? (
            <p>Loading contents…</p>
          ) : contentsError ? (
            <p role="alert" className="error">
              {contentsError}
            </p>
          ) : !contents.length ? (
            <p>This document has no embedded table of contents.</p>
          ) : null}
          <ContentsList entries={contents} navigate={navigateContents} />
        </aside>
      )}
      {marks && (
        <aside className="bookmarks-panel">
          <div className="modal-heading">
            <h2>Bookmarks</h2>
            <button
              aria-label="Close bookmarks"
              onClick={() => setMarks(false)}
            >
              <X />
            </button>
          </div>
          {!reading.bookmarks.length && (
            <p>Save a page to come back to it later.</p>
          )}
          {reading.bookmarks.map((m) => (
            <div className="bookmark-row" key={m.location}>
              <button onClick={() => go(m.location)}>{m.label}</button>
              <button
                aria-label={`Remove ${m.label}`}
                onClick={() =>
                  update({
                    bookmarks: reading.bookmarks.filter(
                      (b) => b.location !== m.location,
                    ),
                  })
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}
