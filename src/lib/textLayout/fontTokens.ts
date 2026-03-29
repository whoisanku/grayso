export type TextFontToken =
  | "feedBody"
  | "feedEmbeddedBody"
  | "messageBubble"
  | "expandableBody";

type FontTokenDefinition = {
  font: string;
  lineHeight: number;
  fontSize: number;
};

export const TEXT_FONT_TOKENS: Record<TextFontToken, FontTokenDefinition> = {
  feedBody: {
    font: '400 15px "Sofia-Pro-Regular"',
    lineHeight: 24,
    fontSize: 15,
  },
  feedEmbeddedBody: {
    font: '400 14px "Sofia-Pro-Regular"',
    lineHeight: 20,
    fontSize: 14,
  },
  messageBubble: {
    font: '400 15px "Sofia-Pro-Regular"',
    lineHeight: 21,
    fontSize: 15,
  },
  expandableBody: {
    font: '400 15px "Sofia-Pro-Regular"',
    lineHeight: 24,
    fontSize: 15,
  },
};

export function getFontTokenDefinition(token: TextFontToken) {
  return TEXT_FONT_TOKENS[token];
}
