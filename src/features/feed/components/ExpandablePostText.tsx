import React from "react";
import {
  Platform,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

type ExpandablePostTextProps = {
  text: string;
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
  collapsedChars = 380,
  textClassName,
  toggleClassName,
}: ExpandablePostTextProps) {
  const normalizedText = text.trim();
  const characterLength = React.useMemo(
    () => Array.from(normalizedText).length,
    [normalizedText],
  );
  const isCollapsible = characterLength > collapsedChars;
  const collapsedText = React.useMemo(
    () => getCollapsedText(normalizedText, collapsedChars),
    [collapsedChars, normalizedText],
  );
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
      <Text
        className={textClassName ?? "text-[15px] leading-6 text-slate-900 dark:text-slate-100"}
      >
        {isExpanded || !isCollapsible ? normalizedText : collapsedText}
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
      </Text>

      {/* Keep separate line-break behavior predictable when text is empty. */}
      {normalizedText.length === 0 ? (
        <Text
          className={textClassName ?? "text-[15px] leading-6 text-slate-900 dark:text-slate-100"}
        />
      ) : null}
    </View>
  );
}
