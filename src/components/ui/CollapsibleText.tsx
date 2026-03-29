import React from "react";
import { Platform, Pressable, Text, View, type LayoutChangeEvent } from "react-native";

import { getFontTokenDefinition, measureLineCount, prepareText, type TextFontToken } from "@/lib/textLayout";

type CollapsibleTextProps = {
  text: string;
  collapsedLineCount: number;
  textClassName: string;
  toggleClassName: string;
  containerClassName?: string;
  fontToken: TextFontToken;
  fallbackCharacterThreshold?: number;
  expandedLabel?: string;
  collapsedLabel?: string;
};

export function CollapsibleText({
  text,
  collapsedLineCount,
  textClassName,
  toggleClassName,
  containerClassName,
  fontToken,
  fallbackCharacterThreshold = 220,
  expandedLabel = "See less",
  collapsedLabel = "See more",
}: CollapsibleTextProps) {
  const normalizedText = React.useMemo(() => text.trim(), [text]);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [measuredWidth, setMeasuredWidth] = React.useState(0);
  const fontDefinition = getFontTokenDefinition(fontToken);

  React.useEffect(() => {
    setIsExpanded(false);
  }, [normalizedText, collapsedLineCount]);

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
      ? (measuredLineCount ?? 0) > collapsedLineCount
      : Array.from(normalizedText).length > fallbackCharacterThreshold;

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    if (Platform.OS !== "web") {
      return;
    }

    const nextWidth = event.nativeEvent.layout.width;
    setMeasuredWidth((currentWidth) =>
      Math.abs(currentWidth - nextWidth) > 0.5 ? nextWidth : currentWidth,
    );
  }, []);

  if (!normalizedText) {
    return null;
  }

  return (
    <View className={containerClassName} onLayout={handleLayout}>
      <Text
        numberOfLines={isCollapsible && !isExpanded ? collapsedLineCount : undefined}
        className={textClassName}
      >
        {normalizedText}
      </Text>

      {isCollapsible ? (
        <Pressable
          onPress={() => setIsExpanded((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? "Show less text" : "Show more text"}
        >
          <Text className={toggleClassName}>
            {isExpanded ? expandedLabel : collapsedLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
