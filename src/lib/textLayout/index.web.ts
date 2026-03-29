const pretext = require("@chenglou/pretext") as {
  clearCache: () => void;
  layout: (
    prepared: unknown,
    width: number,
    lineHeight: number,
  ) => { height: number; lineCount: number };
  layoutWithLines: (
    prepared: unknown,
    width: number,
    lineHeight: number,
  ) => { height: number; lineCount: number; lines: Array<unknown> };
  prepare: (
    text: string,
    font: string,
    options: { whiteSpace: WhiteSpaceMode },
  ) => unknown;
  prepareWithSegments: (
    text: string,
    font: string,
    options: { whiteSpace: WhiteSpaceMode },
  ) => unknown;
  setLocale: (locale?: string) => void;
};

export {
  getFontTokenDefinition,
  TEXT_FONT_TOKENS,
  type TextFontToken,
} from "./fontTokens";

type WhiteSpaceMode = "normal" | "pre-wrap";

export type PreparedTextHandle = {
  key: string;
  text: string;
  font: string;
  whiteSpace: WhiteSpaceMode;
};

type PreparedCacheEntry = {
  prepared: unknown;
  preparedWithSegments?: unknown;
};

type LayoutSummary = {
  height: number;
  lineCount: number;
};

type LayoutLines = {
  height: number;
  lineCount: number;
  lines: Array<unknown>;
};

const MAX_CACHE_ENTRIES = 500;
const preparedCache = new Map<string, PreparedCacheEntry>();
const layoutCache = new Map<string, LayoutSummary>();
const lineLayoutCache = new Map<string, LayoutLines>();

function getPreparedCacheEntry(key: string, text: string, font: string, whiteSpace: WhiteSpaceMode) {
  const cached = preparedCache.get(key);
  if (cached) {
    return cached;
  }

  const nextEntry: PreparedCacheEntry = {
    prepared: pretext.prepare(text, font, { whiteSpace }),
  };
  preparedCache.set(key, nextEntry);

  if (preparedCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = preparedCache.keys().next().value;
    if (firstKey) {
      preparedCache.delete(firstKey);
    }
  }

  return nextEntry;
}

function getPreparedSegmentsEntry(handle: PreparedTextHandle) {
  const existing = getPreparedCacheEntry(
    handle.key,
    handle.text,
    handle.font,
    handle.whiteSpace,
  );
  if (existing.preparedWithSegments) {
    return existing.preparedWithSegments;
  }

  existing.preparedWithSegments = pretext.prepareWithSegments(handle.text, handle.font, {
    whiteSpace: handle.whiteSpace,
  });
  return existing.preparedWithSegments;
}

function createLayoutKey(handle: PreparedTextHandle, width: number, lineHeight: number) {
  return `${handle.key}::${width.toFixed(2)}::${lineHeight}`;
}

export function prepareText(
  text: string,
  font: string,
  options?: { whiteSpace?: WhiteSpaceMode },
): PreparedTextHandle {
  const normalizedText = text ?? "";
  const whiteSpace = options?.whiteSpace ?? "normal";
  const key = `${font}::${whiteSpace}::${normalizedText}`;
  getPreparedCacheEntry(key, normalizedText, font, whiteSpace);

  return {
    key,
    text: normalizedText,
    font,
    whiteSpace,
  };
}

export function measureTextHeight(
  prepared: PreparedTextHandle,
  width: number,
  lineHeight: number,
) {
  const safeWidth = Math.max(1, width);
  const cacheKey = createLayoutKey(prepared, safeWidth, lineHeight);
  const cached = layoutCache.get(cacheKey);
  if (cached) {
    return cached.height;
  }

  const preparedEntry = getPreparedCacheEntry(
    prepared.key,
    prepared.text,
    prepared.font,
    prepared.whiteSpace,
  );
  const result = pretext.layout(preparedEntry.prepared, safeWidth, lineHeight);
  layoutCache.set(cacheKey, result);

  return result.height;
}

export function measureLineCount(
  prepared: PreparedTextHandle,
  width: number,
  lineHeight: number,
) {
  const safeWidth = Math.max(1, width);
  const cacheKey = createLayoutKey(prepared, safeWidth, lineHeight);
  const cached = layoutCache.get(cacheKey);
  if (cached) {
    return cached.lineCount;
  }

  const preparedEntry = getPreparedCacheEntry(
    prepared.key,
    prepared.text,
    prepared.font,
    prepared.whiteSpace,
  );
  const result = pretext.layout(preparedEntry.prepared, safeWidth, lineHeight);
  layoutCache.set(cacheKey, result);

  return result.lineCount;
}

export function layoutTextLines(
  prepared: PreparedTextHandle,
  width: number,
  lineHeight: number,
) {
  const safeWidth = Math.max(1, width);
  const cacheKey = createLayoutKey(prepared, safeWidth, lineHeight);
  const cached = lineLayoutCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const result = pretext.layoutWithLines(
    getPreparedSegmentsEntry(prepared),
    safeWidth,
    lineHeight,
  );
  lineLayoutCache.set(cacheKey, result);

  return result;
}

export function clearTextLayoutCache() {
  preparedCache.clear();
  layoutCache.clear();
  lineLayoutCache.clear();
  pretext.clearCache();
}

export function setTextLayoutLocale(locale?: string) {
  pretext.setLocale(locale);
  clearTextLayoutCache();
}
