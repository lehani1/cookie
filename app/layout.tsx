import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "cookie — Your reading room",
  description:
    "A quiet home for your books. Your personal PDF and EPUB library.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { const saved = localStorage.getItem("cookie-theme"); document.documentElement.dataset.theme = saved === "dark" || saved === "light" ? saved : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch {}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
