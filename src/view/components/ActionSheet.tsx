import React from "react";
import { View, Text, TouchableOpacity, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { DecryptedMessageEntryResponse, PublicKeyToProfileEntryResponseMap } from "deso-protocol";
import { getProfileDisplayName } from "../../utils/deso";
import { getDisplayedMessageText, isEditedValue, formatTimestamp } from "../../utils/messageUtils";
import { LiquidGlassView } from "../../utils/liquidGlass";
import { BlurView } from "expo-blur";
import { useAccentColor } from "../../state/theme/useAccentColor";

const ACTION_SHEET_WIDTH = 240;
const ESTIMATED_ACTION_HEIGHT = 100;
const MIN_GAP_BETWEEN_BUBBLE_AND_SHEET = 8;
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
                <Text className={`ml-3 text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}>
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
                    <Text className={`ml-3 text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                        Edit message
                    </Text>
                </TouchableOpacity>
            ) : null}
            <TouchableOpacity
                onPress={onCopy}
                className="flex-row items-center px-4 py-3 active:opacity-70 border-t border-slate-200/30 dark:border-slate-700/30"
            >
                <Feather
                    name="copy"
                    size={18}
                    color={isDark ? "#e2e8f0" : "#0f172a"}
                />
                <Text className={`ml-3 text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}>
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
    const senderPk = message.SenderInfo?.OwnerPublicKeyBase58Check || "";
    const senderProfile = profiles[senderPk];
    const displayName = getProfileDisplayName(senderProfile, senderPk);
    const text = getDisplayedMessageText(message) || "Message";
    const extra = message.MessageInfo?.ExtraData as Record<string, any> | undefined;
    const isEdited = isEditedValue(extra?.edited) || Boolean(extra?.editedMessage);
    const timestamp = message.MessageInfo?.TimestampNanos;
    const { accentColor, accentStrong, accentSoft, onAccent } = useAccentColor();

    // Reply logic
    const repliedToMessageId = extra?.RepliedToMessageId;
    const repliedToMessage = repliedToMessageId && messageIdMap
        ? messageIdMap.get(repliedToMessageId)
        : null;

    const renderReplyPreview = () => {
        if (!repliedToMessageId) return null;

        // If we found the message locally, use it. Otherwise try fallback from ExtraData.
        const fallbackText = extra?.RepliedToMessageDecryptedText;
        const replyText = getDisplayedMessageText(repliedToMessage) || fallbackText || "Message not loaded";

        const replySenderPk = repliedToMessage?.SenderInfo?.OwnerPublicKeyBase58Check;
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
                        color: isMine ? "rgba(255, 255, 255, 0.8)" : "#4b5563",
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
                    borderWidth: isMine ? 0 : 1,
                    borderColor: isMine ? "transparent" : (isDark ? "#334155" : "#e2e8f0"),
                    backgroundColor: isMine ? accentColor : (isDark ? "#1e293b" : "#ffffff"),
                    shadowColor: isMine ? accentStrong : (isDark ? "#000" : "#0f172a"),
                    shadowOpacity: 0.25,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 12,
                    justifyContent: 'flex-start',
                }}
            >
                {!isMine && (
                    <View className="mb-1">
                        <Text
                            className="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                            numberOfLines={1}
                        >
                            {displayName}
                        </Text>
                    </View>
                )}
                {renderReplyPreview()}
                <Text
                    className="text-[16px] leading-[22px]"
                    textBreakStrategy="balanced"
                    selectable={false}
                    selectionColor={accentColor}
                    style={{
                        marginTop: isMine ? 0 : 2,
                        color: isMine ? onAccent : (isDark ? "#f1f5f9" : "#1e293b"),
                    } as any}
                >
                    {text}
                </Text>
                <View
                    className={`mt-1.5 flex-row items-center ${isMine ? "justify-end" : "justify-start"
                        }`}
                >
                    {isEdited ? (
                        <Text
                            className="mr-2 text-[11px] font-semibold"
                            style={{ color: isMine ? onAccent : (isDark ? "#cbd5e1" : "#475569") }}
                        >
                            Edited
                        </Text>
                    ) : null}
                    {timestamp ? (
                        <Text
                            className="text-[11px]"
                            style={{ color: isMine ? onAccent : (isDark ? "#94a3b8" : "#94a3b8") }}
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
 * Compute positions for both bubble preview and action sheet
 * Returns adjusted positions that ensure:
 * 1. Both bubble and action sheet are visible on screen
 * 2. Action sheet is below the bubble with proper gap
 * 3. When near bottom, bubble moves up to make room
 */
export function computeModalPositions(
    layout: { x: number; y: number; width: number; height: number },
    bottomInset: number,
    isSender: boolean
): {
    bubbleTop: number;
    actionTop: number;
    actionLeft: number;
} {
    const headerHeight = 60; // Approximate header height
    const minTop = headerHeight + 8;
    const maxBottom = WINDOW.height - bottomInset - 20;
    const PROFILE_IMAGE_OFFSET = 40; // 32px image + 8px margin

    // Total space needed: bubble height + gap + action sheet height
    const totalNeededHeight = layout.height + MIN_GAP_BETWEEN_BUBBLE_AND_SHEET + ESTIMATED_ACTION_HEIGHT;

    // Calculate where bubble and action sheet would go if placed at original position
    let bubbleTop = layout.y;
    let actionTop = layout.y + layout.height + MIN_GAP_BETWEEN_BUBBLE_AND_SHEET;

    // Check if action sheet would go below screen bottom
    const actionBottom = actionTop + ESTIMATED_ACTION_HEIGHT;
    if (actionBottom > maxBottom) {
        // Need to move everything up
        // Calculate how much to move up
        const overflow = actionBottom - maxBottom;
        bubbleTop = Math.max(minTop, bubbleTop - overflow);
        actionTop = bubbleTop + layout.height + MIN_GAP_BETWEEN_BUBBLE_AND_SHEET;
    }

    // Ensure bubble doesn't go above header
    if (bubbleTop < minTop) {
        bubbleTop = minTop;
        actionTop = bubbleTop + layout.height + MIN_GAP_BETWEEN_BUBBLE_AND_SHEET;
    }

    // Calculate left position - align with the bubble content (after profile image for received)
    let actionLeft: number;
    if (isSender) {
        // For sent messages: align action sheet's right edge with bubble's right edge
        const desiredLeft = layout.x + layout.width - ACTION_SHEET_WIDTH;
        actionLeft = clamp(desiredLeft, 12, WINDOW.width - ACTION_SHEET_WIDTH - 12);
    } else {
        // For received messages: align with bubble content start (after profile image)
        // Subtract the profile image offset from the bubble's x position
        const desiredLeft = layout.x + PROFILE_IMAGE_OFFSET;
        actionLeft = clamp(desiredLeft, 12, WINDOW.width - ACTION_SHEET_WIDTH - 12);
    }

    return { bubbleTop, actionTop, actionLeft };
}

export function getFallbackBubbleLayout(): { x: number; y: number; width: number; height: number } {
    return {
        x: 16,
        y: WINDOW.height / 2 - 80,
        width: ACTION_SHEET_WIDTH,
        height: 60,
    };
}
