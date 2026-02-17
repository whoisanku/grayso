import { getValidHttpUrl } from "@/lib/mediaUrl";

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*]\(((?:\\.|[^)])+)\)/g;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(((?:\\.|[^)])+)\)/g;
const HTML_IMAGE_TAG_REGEX =
  /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^>\s]+))[^>]*>/gi;
const MARKDOWN_ESCAPED_CHAR_REGEX = /\\([\\`*_{}()[\]#+\-.!~|&<>])/g;
const HTML_ENTITY_REGEX = /&(amp|lt|gt|quot|#39);/gi;

type ParseRichTextInput = {
  body?: string | null;
  imageUrls?: (string | null | undefined)[] | null;
};

type ParsedRichTextContent = {
  text: string;
  imageUrls: string[];
};

function decodeMarkdownEscapes(value: string): string {
  return value.replace(MARKDOWN_ESCAPED_CHAR_REGEX, "$1");
}

function decodeHtmlEntities(value: string): string {
  return value.replace(HTML_ENTITY_REGEX, (_match, entity) => {
    const key = String(entity).toLowerCase();
    if (key === "amp") return "&";
    if (key === "lt") return "<";
    if (key === "gt") return ">";
    if (key === "quot") return '"';
    if (key === "#39") return "'";
    return _match;
  });
}

function splitMarkdownDestination(markdownDestinationWithTitle: string): string {
  const trimmed = markdownDestinationWithTitle.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("<")) {
    const endIndex = trimmed.indexOf(">");
    if (endIndex > 1) {
      return trimmed.slice(1, endIndex).trim();
    }
  }

  let destination = "";
  let isEscaped = false;
  let nestedParentheses = 0;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (isEscaped) {
      destination += char;
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      destination += char;
      isEscaped = true;
      continue;
    }

    if (char === "(") {
      nestedParentheses += 1;
      destination += char;
      continue;
    }

    if (char === ")" && nestedParentheses > 0) {
      nestedParentheses -= 1;
      destination += char;
      continue;
    }

    if (/\s/.test(char) && nestedParentheses === 0) {
      break;
    }

    destination += char;
  }

  return destination.trim();
}

function normalizeExtractedUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().replace(/^<|>$/g, "");
  if (!trimmed) {
    return null;
  }

  const decoded = decodeHtmlEntities(decodeMarkdownEscapes(trimmed)).trim();
  return getValidHttpUrl(decoded);
}

function uniqueUrls(values: (string | null)[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    urls.push(value);
  }

  return urls;
}

export function parseRichTextContent({
  body,
  imageUrls,
}: ParseRichTextInput): ParsedRichTextContent {
  const rawBody = typeof body === "string" ? body : "";
  const htmlImageUrls: string[] = [];
  const markdownImageUrls: string[] = [];

  const bodyWithoutHtmlImages = rawBody.replace(
    HTML_IMAGE_TAG_REGEX,
    (_match, doubleQuoted, singleQuoted, unquoted) => {
      const rawUrl = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
      const url = normalizeExtractedUrl(rawUrl);
      if (url) {
        htmlImageUrls.push(url);
      }
      return "";
    },
  );

  const bodyWithoutImages = bodyWithoutHtmlImages.replace(
    MARKDOWN_IMAGE_REGEX,
    (_match, rawDestination) => {
      const url = normalizeExtractedUrl(
        splitMarkdownDestination(typeof rawDestination === "string" ? rawDestination : ""),
      );
      if (url) {
        markdownImageUrls.push(url);
      }
      return "";
    },
  );

  const bodyWithLinkLabels = bodyWithoutImages.replace(
    MARKDOWN_LINK_REGEX,
    (_match, label, rawDestination) => {
      const decodedLabel = decodeHtmlEntities(
        decodeMarkdownEscapes(typeof label === "string" ? label : ""),
      ).trim();

      if (decodedLabel) {
        return decodedLabel;
      }

      const safeUrl = normalizeExtractedUrl(
        splitMarkdownDestination(typeof rawDestination === "string" ? rawDestination : ""),
      );
      return safeUrl ?? "";
    },
  );

  const normalizedText = bodyWithLinkLabels
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const explicitImageUrls = (imageUrls ?? [])
    .map((value) => normalizeExtractedUrl(value))
    .filter((value): value is string => Boolean(value));

  return {
    text: normalizedText,
    imageUrls: uniqueUrls([
      ...explicitImageUrls,
      ...markdownImageUrls,
      ...htmlImageUrls,
    ]),
  };
}
