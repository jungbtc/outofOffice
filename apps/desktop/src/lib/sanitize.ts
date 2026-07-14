import DOMPurify from "dompurify";

const options = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onfocus", "onmouseenter"],
};

export function sanitizeDocumentHtml(html: string): string {
  return DOMPurify.sanitize(html, options);
}

export function sanitizePastedHtml(html: string): string {
  return DOMPurify.sanitize(html, options);
}
