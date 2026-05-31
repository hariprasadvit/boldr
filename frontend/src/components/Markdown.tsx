import { marked } from "marked";

// Faithful to web/: render markdown into the .prose container from globals.css.
export function Markdown({ md }: { md: string }) {
  const html = marked.parse(md, { gfm: true, breaks: false }) as string;
  return <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
