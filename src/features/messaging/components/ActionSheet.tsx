import React from "react";
import { View, Text, TouchableOpacity, Image, Dimensions, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { DecryptedMessageEntryResponse, PublicKeyToProfileEntryResponseMap } from "deso-protocol";
import { getProfileDisplayName, getProfileImageUrl, FALLBACK_PROFILE_IMAGE } from "../../../utils/deso";
import { getDisplayedMessageText, isEditedValue, formatTimestamp } from "../utils/messageUtils";

const ACTION_SHEET_WIDTH = 240;
const ESTIMATED_ACTION_HEIGHT = 100;
const MIN_GAP_BETWEEN_BUBBLE_AND_SHEET = 12;
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
    return (
        <View
            className={`${isDark ? "bg-[#0f172a]" : "bg-white"} rounded-2xl shadow-lg border ${isDark ? "border-slate-800" : "border-slate-200"
                }`}
            style={{
                width: ACTION_SHEET_WIDTH,
                overflow: "hidden",
            }}
        >
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
                    className="flex-row items-center px-4 py-3 active:opacity-70 border-t border-slate-200 dark:border-slate-800"
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
                className="flex-row items-center px-4 py-3 active:opacity-70 border-t border-slate-200 dark:border-slate-800"
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
        </View>
    );
}

type SelectedBubblePreviewProps = {
    message: DecryptedMessageEntryResponse;
    profiles: PublicKeyToProfileEntryResponseMap;
    isDark: boolean;
};

export function SelectedBubblePreview({
    message,
    profiles,
    isDark,
}: SelectedBubblePreviewProps) {
    const isMine = Boolean(message.IsSender);
    const senderPk = message.SenderInfo?.OwnerPublicKeyBase58Check || "";
    const senderProfile = profiles[senderPk];
    const displayName = getProfileDisplayName(senderProfile, senderPk);
    const text = getDisplayedMessageText(message) || "Message";
    const extra = message.MessageInfo?.ExtraData as Record<string, any> | undefined;
    const isEdited = isEditedValue(extra?.edited) || Boolean(extra?.editedMessage);
    const timestamp = message.MessageInfo?.TimestampNanos;

    // Get profile image URL for non-sender messages
    const avatarUri = senderPk
        ? getProfileImageUrl(senderPk) || FALLBACK_PROFILE_IMAGE
        : FALLBACK_PROFILE_IMAGE;

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
            }}
        >
            {/* Profile image for non-sender messages */}
            {!isMine && (
                <Image
                    source={{ uri: avatarUri }}
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        marginRight: 8,
                        backgroundColor: isDark ? '#334155' : '#e5e7eb',
                    }}
                />
            )}
            <View
                className={`max-w-[80%] px-4 py-3 ${isMine ? "bg-[#0085ff]" : "bg-[#f1f3f5] dark:bg-[#161e27]"}`}
                style={{
                    borderRadius: 20,
                    shadowColor: "#000",
                    shadowOpacity: 0.35,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 12 },
                    elevation: 14,
                }}
            >
                {!isMine && (
                    <Text
                        className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-400"
                        numberOfLines={1}
                    >
                        {displayName}
                    </Text>
                )}
                <Text
                    className={`text-[16px] leading-[22px] ${isMine ? "text-white" : "text-[#0f172a] dark:text-white"
                        }`}
                >
                    {text}
                </Text>
                <View
                    className={`mt-1.5 flex-row items-center ${isMine ? "justify-end" : "justify-start"
                        }`}
                >
                    {isEdited ? (
                        <Text
                            className={`mr-2 text-[11px] font-semibold ${isMine ? "text-blue-100" : "text-slate-500 dark:text-slate-400"
                                }`}
                        >
                            Edited
                        </Text>
                    ) : null}
                    {timestamp ? (
                        <Text
                            className={`text-[11px] ${isMine ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
                                }`}
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
