import React from "react";
import { View, Text, TouchableOpacity, Dimensions, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  DecryptedMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import { getProfileDisplayName } from "@/utils/deso";
import {
  getDisplayedMessageText,
  isEditedValue,
  formatTimestamp,
} from "../../../utils/messageUtils";
import { LiquidGlassView } from "../../../utils/liquidGlass";
import { BlurView } from "expo-blur";
import { useAccentColor } from "@/state/theme/useAccentColor";

const ACTION_SHEET_WIDTH = 240;
const ESTIMATED_ACTION_HEIGHT = 160; // Slightly increased for better estimation
const GAP_BETWEEN_BUBBLE_AND_SHEET = 20; // Consistent gap - fixed spacing
const WINDOW = Dimensions.get("window");

type ActionSheetCardProps = {
  isDark: boolean;
  onReply: () => void;
  onEdit?: () => void;
  onCopy: () => void;
};

export function ActionSheetCard({
  isDark,
  onReply,
  onEdit,
  onCopy,
}: ActionSheetCardProps) {
  const cardContent = (
    <>
      <TouchableOpacity
        onPress={onReply}
        className="flex-row items-center px-4 py-3 active:opacity-70"
      >
        <Feather
          name="corner-up-left"
          size={18}
          color={isDark ? "#e2e8f0" : "#0f172a"}
        />
        <Text
          className={`ml-3 text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}
        >
          Reply
        </Text>
      </TouchableOpacity>
      {onEdit ? (
        <TouchableOpacity
          onPress={onEdit}
          className="flex-row items-center px-4 py-3 active:opacity-70 border-t border-slate-200/30 dark:border-slate-700/30"
        >
          <Feather
            name="edit-2"
            size={18}
            color={isDark ? "#e2e8f0" : "#0f172a"}
          />
          <Text
            className={`ml-3 text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}
          >
            Edit message
          </Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        onPress={onCopy}
        className="flex-row items-center px-4 py-3 active:opacity-70 border-t border-slate-200/30 dark:border-slate-700/30"
      >
        <Feather name="copy" size={18} color={isDark ? "#e2e8f0" : "#0f172a"} />
        <Text
          className={`ml-3 text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}
        >
          Copy
        </Text>
      </TouchableOpacity>
    </>
  );

  // Use LiquidGlassView for iOS 26+, otherwise fall back to BlurView or plain View
  if (LiquidGlassView) {
    return (
      <LiquidGlassView
        effect="regular"
        style={{
          width: ACTION_SHEET_WIDTH,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {cardContent}
      </LiquidGlassView>
    );
  }

  // Fallback for older iOS
  return (
    <BlurView
      intensity={80}
      tint={isDark ? "dark" : "light"}
      style={{
        width: ACTION_SHEET_WIDTH,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {cardContent}
    </BlurView>
  );
}

type SelectedBubblePreviewProps = {
  message: DecryptedMessageEntryResponse;
  profiles: PublicKeyToProfileEntryResponseMap;
  isDark: boolean;
  messageIdMap?: Map<string, DecryptedMessageEntryResponse>;
  layout?: { width: number; height: number };
};

export function SelectedBubblePreview({
  message,
  profiles,
  isDark,
  messageIdMap,
  layout,
}: SelectedBubblePreviewProps) {
  const isMine = Boolean(message.IsSender);
  const text = getDisplayedMessageText(message) || "Message";
  const extra = message.MessageInfo?.ExtraData as
    | Record<string, any>
    | undefined;
  const isEdited =
    isEditedValue(extra?.edited) || Boolean(extra?.editedMessage);
  const timestamp = message.MessageInfo?.TimestampNanos;
  const { accentColor, accentSoft, onAccent } = useAccentColor();

  // Media handling
  const decryptedImageURLs = extra?.decryptedImageURLs;
  const decryptedVideoURLs = extra?.decryptedVideoURLs;
  const hasImages =
    typeof decryptedImageURLs === "string" && decryptedImageURLs.length > 0;
  const hasVideos =
    typeof decryptedVideoURLs === "string" && decryptedVideoURLs.length > 0;

  const imageUrls = hasImages
    ? decryptedImageURLs.split(",").filter((url: string) => url.trim())
    : [];
  const videoUrls = hasVideos
    ? decryptedVideoURLs.split(",").filter((url: string) => url.trim())
    : [];

  // Reply logic
  const repliedToMessageId = extra?.RepliedToMessageId;
  const repliedToMessage =
    repliedToMessageId && messageIdMap
      ? messageIdMap.get(repliedToMessageId)
      : null;

  const renderReplyPreview = () => {
    if (!repliedToMessageId) return null;

    const fallbackText = extra?.RepliedToMessageDecryptedText;
    const replyText =
      getDisplayedMessageText(repliedToMessage) ||
      fallbackText ||
      "Message not loaded";

    const replySenderPk =
      repliedToMessage?.SenderInfo?.OwnerPublicKeyBase58Check;
    const replySenderProfile = replySenderPk ? profiles[replySenderPk] : null;
    const replyDisplayName = replySenderPk
      ? getProfileDisplayName(replySenderProfile, replySenderPk)
      : "Replied Message";

    return (
      <View
        style={{
          backgroundColor: isMine ? "rgba(255, 255, 255, 0.2)" : accentSoft,
          borderLeftWidth: 4,
          borderLeftColor: isMine ? "rgba(255, 255, 255, 0.6)" : accentColor,
          borderRadius: 4,
          padding: 6,
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: isMine ? onAccent : accentColor,
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          {replyDisplayName}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: isMine
              ? "rgba(255, 255, 255, 0.8)"
              : isDark
                ? "#94a3b8"
                : "#4b5563",
          }}
          numberOfLines={2}
        >
          {replyText}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={{
        width: layout?.width,
        minWidth: 0,
        maxWidth: layout?.width,
      }}
    >
      <View
        className="px-4 py-3"
        style={{
          width: layout?.width,
          borderRadius: 22,
          borderWidth: isMine ? 0 : 0.5,
          borderColor: isMine
            ? "transparent"
            : isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.06)",
          backgroundColor: isMine
            ? accentColor
            : isDark
              ? "#1e2738"
              : "#f8fafc",
          shadowColor: "#000",
          shadowOpacity: isDark ? 0.4 : 0.15,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
          justifyContent: "flex-start",
        }}
      >
        {/* Username removed - only show message text like iMessage */}
        {renderReplyPreview()}

        {/* Render images if present */}
        {imageUrls.length > 0 && (
          <View
            style={{
              marginHorizontal: -16,
              marginTop: -12,
              marginBottom: 8,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {imageUrls.length === 1 ? (
              <Image
                source={{ uri: imageUrls[0] }}
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: 12,
                }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {imageUrls.slice(0, 4).map((url: string, index: number) => (
                  <Image
                    key={index}
                    source={{ uri: url }}
                    style={{
                      width: imageUrls.length === 2 ? "49%" : "48.5%",
                      height: 120,
                      borderRadius: 8,
                    }}
                    resizeMode="cover"
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Render video thumbnail if present */}
        {videoUrls.length > 0 && (
          <View
            style={{
              marginHorizontal: -16,
              marginTop: -12,
              marginBottom: 8,
              borderRadius: 12,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Image
              source={{ uri: videoUrls[0] }}
              style={{
                width: "100%",
                height: 200,
                borderRadius: 12,
                backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
              }}
              resizeMode="cover"
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.3)",
              }}
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Feather
                  name="play"
                  size={24}
                  color="#000"
                  style={{ marginLeft: 3 }}
                />
              </View>
            </View>
          </View>
        )}

        {text && text.trim().length > 0 && (
          <Text
            className="text-[16px] leading-[22px]"
            textBreakStrategy="balanced"
            selectable={false}
            selectionColor={accentColor}
            style={
              {
                color: isMine ? onAccent : isDark ? "#e2e8f0" : "#0f172a",
                marginTop: imageUrls.length > 0 || videoUrls.length > 0 ? 4 : 0,
              } as any
            }
          >
            {text}
          </Text>
        )}
        <View
          className={`mt-1.5 flex-row items-center ${isMine ? "justify-end" : "justify-start"}`}
        >
          {isEdited ? (
            <Text
              className="mr-2 text-[11px] font-semibold"
              style={{
                color: isMine ? onAccent : isDark ? "#cbd5e1" : "#475569",
              }}
            >
              Edited
            </Text>
          ) : null}
          {timestamp ? (
            <Text
              className="text-[11px]"
              style={{
                color: isMine ? onAccent : isDark ? "#94a3b8" : "#94a3b8",
              }}
            >
              {formatTimestamp(timestamp)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute positions for both bubble preview and action sheet (iMessage-style)
 * Returns adjusted positions that ensure:
 * 1. Both bubble and action sheet are visible on screen
 * 2. Action sheet appears below bubble by default with proper gap
 * 3. When bubble is near bottom, action sheet appears ABOVE the bubble
 * 4. Bubble stays at original position when possible (iMessage behavior)
 */
export function computeModalPositions(
  layout: { x: number; y: number; width: number; height: number },
  bottomInset: number,
  isSender: boolean
): {
  bubbleTop: number;
  actionTop: number;
  actionLeft: number;
  showAbove: boolean; // always false now (modal stays below)
} {
  const headerHeight = 60;
  const minTop = headerHeight + 20;
  const maxBottom = WINDOW.height - bottomInset - 20;

  // Total space needed: bubble + fixed gap + action sheet
  const totalNeededHeight =
    layout.height + GAP_BETWEEN_BUBBLE_AND_SHEET + ESTIMATED_ACTION_HEIGHT;

  // Start with original bubble position
  let bubbleTop = layout.y;

  // Calculate where action sheet would end up
  let actionTop = bubbleTop + layout.height + GAP_BETWEEN_BUBBLE_AND_SHEET;
  let actionBottom = actionTop + ESTIMATED_ACTION_HEIGHT;

  // If action sheet would go off screen, move bubble up
  if (actionBottom > maxBottom) {
    // Work backwards from the bottom
    const overflow = actionBottom - maxBottom;
    bubbleTop = bubbleTop - overflow;

    // Don't let bubble go above header
    if (bubbleTop < minTop) {
      bubbleTop = minTop;
    }

    // Recalculate action position with EXACT gap
    actionTop = bubbleTop + layout.height + GAP_BETWEEN_BUBBLE_AND_SHEET;
  } else if (bubbleTop < minTop) {
    // Bubble is too high, bring it down to minimum
    bubbleTop = minTop;
    actionTop = bubbleTop + layout.height + GAP_BETWEEN_BUBBLE_AND_SHEET;
  }

  // Calculate left position - align with the bubble content
  let actionLeft: number;
  if (isSender) {
    // For sent messages: align action sheet's right edge with bubble's right edge
    const desiredLeft = layout.x + layout.width - ACTION_SHEET_WIDTH;
    actionLeft = clamp(desiredLeft, 12, WINDOW.width - ACTION_SHEET_WIDTH - 12);
  } else {
    // For received messages: align with bubble's left edge
    const desiredLeft = layout.x;
    actionLeft = clamp(desiredLeft, 12, WINDOW.width - ACTION_SHEET_WIDTH - 12);
  }

  return { bubbleTop, actionTop, actionLeft, showAbove: false };
}

export function getFallbackBubbleLayout(): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: 16,
    y: WINDOW.height / 2 - 80,
    width: ACTION_SHEET_WIDTH,
    height: 60,
  };
}
