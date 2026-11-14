"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, TextLayer } from "pdfjs-dist";
import type { Annotation } from "@/lib/types";
export type SelectionDraft = {
  location: string;
  quote: string;
  rects?: Annotation["rects"];
};
export default function PdfPages({
  doc,
  page,
  zoom,
  scrolling,
  annotations,
  onPage,
  onSelect,
  jump,
}: {
  doc: PDFDocumentProxy;
  page: number;
  zoom: number;
  scrolling: boolean;
  annotations: Annotation[];
  onPage: (page: number) => void;
  onSelect: (draft: SelectionDraft) => void;
  jump: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const node = root.current!;
    const observer = new ResizeObserver(() =>
      setWidth(Math.max(200, Math.min(node.clientWidth - 40, 920))),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (scrolling)
      root.current
        ?.querySelector(`[data-page="${page}"]`)
        ?.scrollIntoView({ block: "start" });
  }, [jump, scrolling]);
  function trackPage() {
    if (!scrolling || !root.current) return;
    const top = root.current.getBoundingClientRect().top + 50;
    let closest = page,
      best = Infinity;
    for (const node of root.current.querySelectorAll<HTMLElement>(
      "[data-page]",
    )) {
      const rect = node.getBoundingClientRect();
      const distance =
        rect.top <= top && rect.bottom > top ? 0 : Math.abs(rect.top - top);
      if (distance < best) {
        best = distance;
        closest = Number(node.dataset.page);
      }
    }
    if (closest !== page) onPage(closest);
  }
  return (
    <div className="pdf-scroll" ref={root} onScroll={trackPage}>
      {(scrolling
        ? Array.from({ length: doc.numPages }, (_, i) => i + 1)
        : [page]
      ).map((n) => (
        <PdfPage
          key={n}
          root={root}
          doc={doc}
          number={n}
          width={(width * zoom) / 100}
          annotations={annotations.filter((a) => a.location === String(n))}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
function PdfPage({
  root,
  doc,
  number,
  width,
  annotations,
  onSelect,
}: {
  root: React.RefObject<HTMLDivElement | null>;
  doc: PDFDocumentProxy;
  number: number;
  width: number;
  annotations: Annotation[];
  onSelect: (draft: SelectionDraft) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    layer = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false),
    [ratio, setRatio] = useState(792 / 612),
    [error, setError] = useState("");
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: root.current, rootMargin: "700px" },
    );
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, [root]);
  useEffect(() => {
    if (!visible) return;
    let canceled = false;
    let render: { cancel: () => void; promise: Promise<void> } | undefined;
    let text: TextLayer | undefined;
    (async () => {
      try {
        const engine = await import("pdfjs-dist");
        const p = await doc.getPage(number);
        if (canceled) return;
        const original = p.getViewport({ scale: 1 });
        setRatio(original.height / original.width);
        const viewport = p.getViewport({ scale: width / original.width });
        const c = canvas.current!,
          target = layer.current!;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        c.width = Math.floor(viewport.width * pixelRatio);
        c.height = Math.floor(viewport.height * pixelRatio);
        c.style.width = `${viewport.width}px`;
        c.style.height = `${viewport.height}px`;
        container.current!.style.setProperty(
          "--total-scale-factor",
          String(viewport.scale),
        );
        render = p.render({
          canvas: c,
          viewport,
          transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await render.promise;
        if (canceled) return;
        target.replaceChildren();
        text = new engine.TextLayer({
          textContentSource: await p.getTextContent(),
          container: target,
          viewport,
        });
        if (canceled) return;
        await text.render();
      } catch (e) {
        if (!canceled && (e as Error).name !== "RenderingCancelledException")
          setError("This page could not be rendered.");
      }
    })();
    return () => {
      canceled = true;
      render?.cancel();
      text?.cancel();
    };
  }, [doc, number, width, visible]);
  function select() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (
      !layer.current?.contains(range.startContainer) ||
      !layer.current.contains(range.endContainer)
    )
      return;
    const quote = selection.toString().trim();
    if (!quote) return;
    const bounds = container.current!.getBoundingClientRect();
    const rects = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        x: (r.left - bounds.left) / bounds.width,
        y: (r.top - bounds.top) / bounds.height,
        width: r.width / bounds.width,
        height: r.height / bounds.height,
      }));
    onSelect({ location: String(number), quote, rects });
  }
  return (
    <div
      className="pdf-page"
      data-page={number}
      ref={container}
      style={{ width, height: width * ratio }}
      onMouseUp={select}
      onTouchEnd={() => setTimeout(select, 100)}
    >
      {visible && (
        <>
          <canvas ref={canvas} />
          <div className="textLayer" ref={layer} />
        </>
      )}
      <div className="annotation-overlay">
        {annotations
          .filter((a) => a.quote)
          .flatMap((a) =>
            (a.rects || []).map((r, i) => (
              <span
                key={`${a.id}-${i}`}
                className={`pdf-mark ${a.kind}`}
                title={a.note || a.quote}
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.width * 100}%`,
                  height: `${r.height * 100}%`,
                }}
              />
            )),
          )}
      </div>
      {error && <p className="error">{error}</p>}
      <span className="pdf-page-number">{number}</span>
    </div>
  );
}
