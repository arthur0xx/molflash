/* eslint-disable @next/next/no-img-element -- صور Markdown قد تأتي من مصادر HTTPS آمنة متعددة ولا تُضبط مضيفاتها مسبقًا. */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function safeHref(value?: string) {
  if (!value) return "#";
  if (value.startsWith("#") || value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "#";
  } catch {
    return "#";
  }
}

export function BlogMarkdown({ markdown }: { markdown: string }) {
  return <div className="blog-markdown" dir="rtl"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ href, children }) => <a href={safeHref(href)} target={href?.startsWith("https://") ? "_blank" : undefined} rel={href?.startsWith("https://") ? "noopener noreferrer" : undefined}>{children}</a>,
    img: ({ src, alt }) => {
      const sourceUrl = typeof src === "string" ? src : "";
      const safeSource = /^https:\/\//.test(sourceUrl) ? sourceUrl : "";
      return safeSource ? <img src={safeSource} alt={alt || "صورة توضيحية للمقال"} loading="lazy" /> : null;
    },
    table: ({ children }) => <div className="blog-table-wrap"><table>{children}</table></div>,
  }}>{markdown}</ReactMarkdown></div>;
}
