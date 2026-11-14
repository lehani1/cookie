export type Book = {
  id: string;
  title: string;
  author: string;
  collection: string;
  series: string;
  format: "pdf" | "epub";
  size: number;
  added: string;
};
export type Reading = {
  status: "to-read" | "reading" | "read";
  favorite: boolean;
  location?: string;
  progress?: number;
  annotations?: Annotation[];
  bookmarks: { location: string; label: string }[];
};
export const initialReading: Reading = {
  status: "to-read",
  favorite: false,
  bookmarks: [],
};

export type Annotation = {
  id: string;
  location: string;
  label: string;
  quote: string;
  note: string;
  kind: "highlight" | "underline";
  rects?: { x: number; y: number; width: number; height: number }[];
};
