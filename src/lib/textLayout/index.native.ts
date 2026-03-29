type WhiteSpaceMode = "normal" | "pre-wrap";

export {
  getFontTokenDefinition,
  TEXT_FONT_TOKENS,
  type TextFontToken,
} from "./fontTokens";

export type PreparedTextHandle = {
  text: string;
  font: string;
  whiteSpace: WhiteSpaceMode;
  estimatedFontSize: number;
};

function getFontSize(font: string) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match ? Number(match[1]) : 16;
}

function estimateLineCountFromText(
  text: string,
  width: number,
  estimatedFontSize: number,
  whiteSpace: WhiteSpaceMode,
) {
  if (!text.trim()) {
    return 0;
  }

  const safeWidth = Math.max(1, width);
  const averageGlyphWidth = Math.max(estimatedFontSize * 0.56, 6);
  const maxCharactersPerLine = Math.max(1, Math.floor(safeWidth / averageGlyphWidth));
  const normalizedText =
    whiteSpace === "pre-wrap" ? text : text.replace(/\s+/g, " ").trim();
  const hardBreaks = normalizedText.split("\n");

  return hardBreaks.reduce((total, chunk) => {
    const chunkLength = Array.from(chunk).length;
    return total + Math.max(1, Math.ceil(chunkLength / maxCharactersPerLine));
  }, 0);
}

export function prepareText(
  text: string,
  font: string,
  options?: { whiteSpace?: WhiteSpaceMode },
): PreparedTextHandle {
  return {
    text: text ?? "",
    font,
    whiteSpace: options?.whiteSpace ?? "normal",
    estimatedFontSize: getFontSize(font),
  };
}

export function measureLineCount(
  prepared: PreparedTextHandle,
  width: number,
  lineHeight: number,
) {
  void lineHeight;
  return estimateLineCountFromText(
    prepared.text,
    width,
    prepared.estimatedFontSize,
    prepared.whiteSpace,
  );
}

export function measureTextHeight(
  prepared: PreparedTextHandle,
  width: number,
  lineHeight: number,
) {
  const lineCount = measureLineCount(prepared, width, lineHeight);
  return lineCount * lineHeight;
}

export function layoutTextLines(
  prepared: PreparedTextHandle,
  width: number,
  lineHeight: number,
) {
  return {
    height: measureTextHeight(prepared, width, lineHeight),
    lineCount: measureLineCount(prepared, width, lineHeight),
    lines: [],
  };
}

export function clearTextLayoutCache() {}

export function setTextLayoutLocale(locale?: string) {
  void locale;
}
