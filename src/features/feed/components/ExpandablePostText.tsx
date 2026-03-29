import React from "react";
import {
  Platform,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { RichText } from "@/components/ui/RichText";
import { getFontTokenDefinition, measureLineCount, prepareText } from "@/lib/textLayout";

type ExpandablePostTextProps = {
  text: string;
  extraData?: Record<string, any> | null;
  collapsedChars?: number;
  textClassName?: string;
  toggleClassName?: string;
};

function getCollapsedText(text: string, collapsedChars: number): string {
  const characters = Array.from(text.trim());
  if (characters.length <= collapsedChars) {
    return text.trim();
  }

  const nextChar = characters[collapsedChars] ?? "";
  let collapsed = characters.slice(0, collapsedChars).join("").trimEnd();

  // Avoid cutting the final latin word in half.
  if (nextChar && /[A-Za-z0-9]/.test(nextChar)) {
    const wordBoundary = collapsed.lastIndexOf(" ");
    if (wordBoundary > Math.floor(collapsed.length * 0.5)) {
      collapsed = collapsed.slice(0, wordBoundary).trimEnd();
    }
  }

  return `${collapsed}...`;
}

export function ExpandablePostText({
  text,
  extraData,
  collapsedChars = 380,
  textClassName,
  toggleClassName,
}: ExpandablePostTextProps) {
  const normalizedText = text.trim();
  const [measuredWidth, setMeasuredWidth] = React.useState(0);
  const fontDefinition = getFontTokenDefinition("expandableBody");
  const characterLength = React.useMemo(
    () => Array.from(normalizedText).length,
    [normalizedText],
  );
  const collapsedText = React.useMemo(
    () => getCollapsedText(normalizedText, collapsedChars),
    [collapsedChars, normalizedText],
  );
  const preparedText = React.useMemo(
    () => prepareText(normalizedText, fontDefinition.font),
    [fontDefinition.font, normalizedText],
  );
  const measuredLineCount = React.useMemo(() => {
    if (measuredWidth <= 0) {
      return null;
    }

    return measureLineCount(preparedText, measuredWidth, fontDefinition.lineHeight);
  }, [fontDefinition.lineHeight, measuredWidth, preparedText]);
  const isCollapsible =
    Platform.OS === "web"
      ? (measuredLineCount ?? 0) > 5
      : characterLength > collapsedChars;
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    setIsExpanded(false);
  }, [collapsedChars, normalizedText]);

  const handleToggle = React.useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation?.();
      setIsExpanded((previous) => !previous);
    },
    [],
  );

  return (
    <View>
      <View
        className={textClassName ?? "mt-1"}
        onLayout={(event) => {
          if (Platform.OS !== "web") {
            return;
          }

          const nextWidth = event.nativeEvent.layout.width;
          setMeasuredWidth((currentWidth) =>
            Math.abs(currentWidth - nextWidth) > 0.5 ? nextWidth : currentWidth,
          );
        }}
      >
        <RichText
          text={isExpanded || !isCollapsible ? normalizedText : collapsedText}
          extraData={extraData}
          textClassName={textClassName ?? "text-[15px] leading-6 text-slate-900 dark:text-slate-100"}
          linkClassName="text-sky-600 dark:text-sky-400 font-medium"
          mentionClassName="text-sky-600 dark:text-sky-400 font-semibold"
        />
        {isCollapsible ? " " : ""}
        {isCollapsible ? (
          <Text
            onPress={handleToggle}
            suppressHighlighting
            className={
              toggleClassName ??
              "text-[13px] font-semibold text-sky-600 dark:text-sky-400"
            }
            style={Platform.OS === "web" ? { cursor: "pointer" } : undefined}
          >
            {isExpanded ? "See less" : "See more"}
          </Text>
        ) : null}
      </View>

      {/* Keep separate line-break behavior predictable when text is empty. */}
      {normalizedText.length === 0 ? (
        <Text
          className={textClassName ?? "text-[15px] leading-6 text-slate-900 dark:text-slate-100"}
        />
      ) : null}
    </View>
  );
}
