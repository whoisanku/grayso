import { getValidHttpUrl } from "@/lib/mediaUrl";

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*]\(((?:\\.|[^)])+)\)/g;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(((?:\\.|[^)])+)\)/g;
const HTML_IMAGE_TAG_REGEX =
  /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^>\s]+))[^>]*>/gi;
const MARKDOWN_ESCAPED_CHAR_REGEX = /\\([\\`*_{}()[\]#+\-.!~|&<>])/g;
const HTML_ENTITY_REGEX = /&(?:#x([0-9a-fA-F]+)|#(\d+)|(amp|lt|gt|quot|nbsp|apos));/gi;

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

export function decodeHtmlEntities(value: string): string {
  return value.replace(HTML_ENTITY_REGEX, (_match, hex, decimal, named) => {
    // Hex numeric entity: &#xNN;
    if (hex) {
      return String.fromCodePoint(parseInt(hex, 16));
    }
    // Decimal numeric entity: &#NNN;
    if (decimal) {
      return String.fromCodePoint(parseInt(decimal, 10));
    }
    // Named entity
    const key = String(named).toLowerCase();
    if (key === "amp") return "&";
    if (key === "lt") return "<";
    if (key === "gt") return ">";
    if (key === "quot") return '"';
    if (key === "nbsp") return " ";
    if (key === "apos") return "'";
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

export type RichTextSegment =
  | { type: "text"; content: string }
  | { type: "link"; content: string; url: string }
  | { type: "mention"; content: string; username: string }
  | { type: "hashtag"; content: string; tag: string };

const MAX_RICH_TEXT_CACHE_ENTRIES = 500;
const richTextSegmentsCache = new Map<string, RichTextSegment[]>();
const parsedRichTextContentCache = new Map<string, ParsedRichTextContent>();

function rememberCachedValue<T>(cache: Map<string, T>, key: string, value: T) {
  cache.set(key, value);

  if (cache.size > MAX_RICH_TEXT_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }

  return value;
}

const MENTION_REGEX = /@([a-zA-Z0-9_]{1,30})/g;
const HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;
const URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s<]+[^.,;!?:>\s\)]|(?:\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b(?:\/[^\s<]*[^.,;!?:>\s\)])?)/gi;

export function getRichTextSegments(text: string): RichTextSegment[] {
  if (!text) return [];

  const cached = richTextSegmentsCache.get(text);
  if (cached) {
    return cached;
  }

  const segments: RichTextSegment[] = [];
  let lastIndex = 0;

  // Combine regexes for efficiency or just run them sequentially if expected volume is low.
  // For simplicity and correctness with overlapping matches, we'll use a more robust approach.
  const regex = new RegExp(
    `${MENTION_REGEX.source}|${HASHTAG_REGEX.source}|${URL_REGEX.source}`,
    "gi",
  );

  let match;
  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, mentionUsername, hashtagLabel] = match;
    let startIndex = match.index;

    // Add preceding text, stripping trailing `<` if it wraps a URL
    if (startIndex > lastIndex) {
      let preceding = text.slice(lastIndex, startIndex);
      // Strip a trailing `<` that wraps this URL (DeSo post format: <URL>)
      if (preceding.endsWith("<") && !mentionUsername && !hashtagLabel) {
        preceding = preceding.slice(0, -1);
      }
      if (preceding) {
        segments.push({
          type: "text",
          content: preceding,
        });
      }
    }

    if (mentionUsername) {
      segments.push({
        type: "mention",
        content: fullMatch,
        username: mentionUsername,
      });
    } else if (hashtagLabel) {
      segments.push({
        type: "hashtag",
        content: fullMatch,
        tag: hashtagLabel,
      });
    } else {
      let url = fullMatch;
      if (!url.startsWith("http")) {
        url = `https://${url}`;
      }
      segments.push({
        type: "link",
        content: fullMatch,
        url: url,
      });

      // Consume trailing `>` if the URL was wrapped in angle brackets
      if (regex.lastIndex < text.length && text[regex.lastIndex] === ">") {
        regex.lastIndex += 1;
      }
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return rememberCachedValue(richTextSegmentsCache, text, segments);
}

export function parseRichTextContent({
  body,
  imageUrls,
}: ParseRichTextInput): ParsedRichTextContent {
  const rawBody = typeof body === "string" ? body : "";
  const explicitImageUrls = imageUrls ?? [];
  const cacheKey = JSON.stringify([rawBody, explicitImageUrls]);
  const cached = parsedRichTextContentCache.get(cacheKey);
  if (cached) {
    return cached;
  }
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
        splitMarkdownDestination(
          typeof rawDestination === "string" ? rawDestination : "",
        ),
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
        splitMarkdownDestination(
          typeof rawDestination === "string" ? rawDestination : "",
        ),
      );
      return safeUrl ?? "";
    },
  );

  const normalizedText = decodeHtmlEntities(bodyWithLinkLabels)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const normalizedExplicitImageUrls = explicitImageUrls
    .map((value) => normalizeExtractedUrl(value))
    .filter((value): value is string => Boolean(value));

  return rememberCachedValue(parsedRichTextContentCache, cacheKey, {
    text: normalizedText,
    imageUrls: uniqueUrls([
      ...normalizedExplicitImageUrls,
      ...markdownImageUrls,
      ...htmlImageUrls,
    ]),
  });
}
