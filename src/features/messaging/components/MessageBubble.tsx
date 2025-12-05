import React, { useEffect, useRef } from "react";
import { View, Text, Image, Keyboard, TouchableWithoutFeedback } from "react-native";
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
    Extrapolation,
    runOnJS,
    useAnimatedRef,
    measure,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { DecryptedMessageEntryResponse, PublicKeyToProfileEntryResponseMap } from "deso-protocol";
import { getProfileDisplayName, getProfileImageUrl, FALLBACK_PROFILE_IMAGE } from "../../../utils/deso";
import { MESSAGE_GROUPING_WINDOW_NS } from "../constants/messaging";
import {
    getMessageId,
    isEditedValue,
    getDisplayedMessageText,
    formatTimestamp,
    shouldShowDayDivider,
    formatDayLabel,
} from "../utils/messageUtils";

export type MessageBubbleProps = {
    item: DecryptedMessageEntryResponse;
    previousMessage?: DecryptedMessageEntryResponse;
    nextMessage?: DecryptedMessageEntryResponse;
    previousTimestamp?: number;
    profiles: PublicKeyToProfileEntryResponseMap;
    isGroupChat: boolean;
    onReply: (message: DecryptedMessageEntryResponse) => void;
    onLongPress: (
        message: DecryptedMessageEntryResponse,
        layout?: { x: number; y: number; width: number; height: number }
    ) => void;
    onBubbleMeasure?: (
        id: string,
        layout: { x: number; y: number; width: number; height: number }
    ) => void;
    messageIdMap: Map<string, DecryptedMessageEntryResponse>;
    isDark: boolean;
};

export const MessageBubble = React.memo(function MessageBubble({
    item,
    previousMessage,
    nextMessage,
    previousTimestamp,
    profiles,
    isGroupChat,
    onReply,
    onLongPress,
    onBubbleMeasure,
    messageIdMap,
    isDark,
}: MessageBubbleProps) {
    const bubbleContainerRef = useRef<View>(null);
    const animatedBubbleRef = useAnimatedRef<Reanimated.View>();
    const scale = useSharedValue(0.95);
    const opacity = useSharedValue(0);

    // Only animate on initial mount, not on every prop change
    const hasAnimated = useRef(false);
    useEffect(() => {
        if (!hasAnimated.current) {
            scale.value = withSpring(1, { damping: 15, stiffness: 200 });
            opacity.value = withSpring(1, { damping: 15, stiffness: 200 });
            hasAnimated.current = true;
        }
    }, []);

    const animatedBubbleStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            opacity: opacity.value,
        };
    });
    const extraData = item.MessageInfo?.ExtraData || {};
    const senderPk = item.SenderInfo?.OwnerPublicKeyBase58Check ?? "";
    const isMine = Boolean(item.IsSender);
    const hasError = (item as any).error;
    const messageId = getMessageId(item);
    const editedMessageText =
        typeof (extraData as any).editedMessage === "string"
            ? (extraData as any).editedMessage
            : undefined;
    const isEditedMessage =
        isEditedValue(extraData?.edited) || Boolean(editedMessageText);
    const baseMessageText =
        item.DecryptedMessage ||
        (hasError ? "Unable to decrypt this message." : "Decrypting…");
    const messageText =
        (isEditedMessage && editedMessageText ? editedMessageText : baseMessageText) ||
        baseMessageText;
    const rawMessageText = messageText?.trim();
    const timestamp = item.MessageInfo?.TimestampNanos;

    const senderProfile = profiles[senderPk];
    const displayName = getProfileDisplayName(senderProfile, senderPk);

    // For group chats, try to use profile pic from GraphQL first
    let avatarUri: string;
    if (isGroupChat && senderProfile?.ExtraData?.LargeProfilePicURL) {
        avatarUri = `https://node.deso.org/api/v0/get-single-profile-picture/${senderPk}?fallback=${senderProfile.ExtraData.LargeProfilePicURL}`;
    } else {
        avatarUri = getProfileImageUrl(senderPk, { groupChat: isGroupChat }) ?? FALLBACK_PROFILE_IMAGE;
    }
    const hasAvatar = Boolean(avatarUri);
    const showDayDivider = shouldShowDayDivider(timestamp, previousTimestamp);

    // Reply logic
    const repliedToMessageId = item.MessageInfo?.ExtraData?.RepliedToMessageId;
    const repliedToMessage = repliedToMessageId
        ? messageIdMap.get(repliedToMessageId)
        : null;

    const renderReplyPreview = () => {
        if (!repliedToMessageId) return null;

        // If we found the message locally, use it. Otherwise try fallback from ExtraData.
        const fallbackText = item.MessageInfo?.ExtraData?.RepliedToMessageDecryptedText;
        const replyText = getDisplayedMessageText(repliedToMessage) || fallbackText || "Message not loaded";

        const replySenderPk = repliedToMessage?.SenderInfo?.OwnerPublicKeyBase58Check;
        const replySenderProfile = replySenderPk ? profiles[replySenderPk] : null;
        const replyDisplayName = replySenderPk
            ? getProfileDisplayName(replySenderProfile, replySenderPk)
            : "Replied Message";

        return (
            <View
                style={{
                    backgroundColor: isMine ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.05)",
                    borderLeftWidth: 4,
                    borderLeftColor: isMine ? "rgba(255, 255, 255, 0.5)" : "#3b82f6",
                    borderRadius: 4,
                    padding: 6,
                    marginBottom: 6,
                }}
            >
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isMine ? "rgba(255, 255, 255, 0.9)" : "#3b82f6",
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

    // === SWIPE-TO-REPLY WITH SPRING PHYSICS ===
    const SWIPE_THRESHOLD = 50; // px threshold to trigger reply
    const MAX_SWIPE = 80; // max translation
    const translateX = useSharedValue(0);
    const hasTriggeredHaptic = useSharedValue(false);

    const triggerHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const triggerReply = () => {
        onReply(item);
    };

    const panGesture = Gesture.Pan()
        .activeOffsetX(isMine ? -15 : 15) // Start gesture after 15px to avoid conflict with scroll
        .onUpdate((event) => {
            // For sent messages (isMine), swipe left (negative); for received, swipe right (positive)
            const clampedValue = isMine
                ? Math.max(-MAX_SWIPE, Math.min(0, event.translationX))
                : Math.min(MAX_SWIPE, Math.max(0, event.translationX));

            translateX.value = clampedValue;

            // Trigger haptic when crossing threshold
            const absValue = Math.abs(clampedValue);
            if (absValue >= SWIPE_THRESHOLD && !hasTriggeredHaptic.value) {
                hasTriggeredHaptic.value = true;
                runOnJS(triggerHaptic)();
            } else if (absValue < SWIPE_THRESHOLD && hasTriggeredHaptic.value) {
                hasTriggeredHaptic.value = false;
            }
        })
        .onEnd(() => {
            const absValue = Math.abs(translateX.value);
            if (absValue >= SWIPE_THRESHOLD) {
                runOnJS(triggerReply)();
            }
            // Spring back with bounce effect
            translateX.value = withSpring(0, {
                damping: 12,
                stiffness: 200,
                mass: 0.5,
                overshootClamping: false,
            });
            hasTriggeredHaptic.value = false;
        });

    const animatedRowStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
        };
    });

    const animatedIconStyle = useAnimatedStyle(() => {
        const absValue = Math.abs(translateX.value);
        const scale = interpolate(
            absValue,
            [0, SWIPE_THRESHOLD / 2, SWIPE_THRESHOLD],
            [0.3, 0.8, 1],
            Extrapolation.CLAMP
        );
        const opacity = interpolate(
            absValue,
            [0, 20, SWIPE_THRESHOLD],
            [0, 0.5, 1],
            Extrapolation.CLAMP
        );
        return {
            transform: [{ scale }],
            opacity,
        };
    });

    const handleLongPress = (layout: { x: number; y: number; width: number; height: number }) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress(item, layout);
    };

    const longPressGesture = Gesture.LongPress()
        .minDuration(250)
        .onStart(() => {
            const measured = measure(animatedBubbleRef);
            if (measured) {
                runOnJS(handleLongPress)({
                    x: measured.pageX,
                    y: measured.pageY,
                    width: measured.width,
                    height: measured.height,
                });
            }
        });

    const tapGesture = Gesture.Tap().onEnd(() => {
        runOnJS(Keyboard.dismiss)();
    });

    const contentGesture = Gesture.Exclusive(longPressGesture, tapGesture);



    // Determine message grouping for curved edges
    const isNextMessageFromSameSender = nextMessage?.IsSender === item.IsSender;
    const isPreviousMessageFromSameSender = previousMessage?.IsSender === item.IsSender;

    // Check if messages are within 1 minute of each other for grouping
    const isNextMessageClose = nextMessage && timestamp && nextMessage.MessageInfo?.TimestampNanos
        ? Math.abs(timestamp - nextMessage.MessageInfo.TimestampNanos) < MESSAGE_GROUPING_WINDOW_NS
        : false;
    const isPreviousMessageClose = previousMessage && timestamp && previousMessage.MessageInfo?.TimestampNanos
        ? Math.abs(timestamp - previousMessage.MessageInfo.TimestampNanos) < MESSAGE_GROUPING_WINDOW_NS
        : false;

    const isFirstInGroup = !isPreviousMessageFromSameSender || !isPreviousMessageClose;
    const isLastInGroup = !isNextMessageFromSameSender || !isNextMessageClose;
    const isOnlyMessage = isFirstInGroup && isLastInGroup;

    // Dynamic border radius based on position in group
    const getBorderRadius = () => {
        const R = 22; // Large radius
        const r = 4;  // Small radius

        if (isOnlyMessage) return { borderRadius: R };
        if (isMine) {
            if (isFirstInGroup) return { borderTopLeftRadius: R, borderTopRightRadius: R, borderBottomLeftRadius: R, borderBottomRightRadius: r };
            if (isLastInGroup) return { borderTopLeftRadius: R, borderTopRightRadius: r, borderBottomLeftRadius: R, borderBottomRightRadius: R };
            return { borderTopLeftRadius: R, borderTopRightRadius: r, borderBottomLeftRadius: R, borderBottomRightRadius: r };
        } else {
            if (isFirstInGroup) return { borderTopLeftRadius: R, borderTopRightRadius: R, borderBottomLeftRadius: r, borderBottomRightRadius: R };
            if (isLastInGroup) return { borderTopLeftRadius: r, borderTopRightRadius: R, borderBottomLeftRadius: R, borderBottomRightRadius: R };
            return { borderTopLeftRadius: r, borderTopRightRadius: R, borderBottomLeftRadius: r, borderBottomRightRadius: R };
        }
    };

    const marginBottom = isLastInGroup ? 16 : 2;

    return (
        <View
            style={{ marginBottom }}
            ref={bubbleContainerRef}
        >
            {showDayDivider ? (
                <View className="items-center py-1">
                    <View className="rounded-full bg-gray-200 px-3 py-1 dark:bg-slate-800">
                        <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400">
                            {formatDayLabel(timestamp)}
                        </Text>
                    </View>
                </View>
            ) : null}

            {/* Reply Icon - positioned behind the bubble */}
            <Reanimated.View
                style={[
                    {
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: 50,
                    },
                    isMine ? { right: -50 } : { left: -50 },
                    animatedIconStyle,
                ]}
                pointerEvents="none"
            >
                <View
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: isDark ? '#334155' : '#e2e8f0',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Feather name="corner-up-left" size={18} color={isDark ? '#cbd5e1' : '#64748b'} />
                </View>
            </Reanimated.View>

            {/* Swipeable message row */}
            <GestureDetector gesture={panGesture}>
                <Reanimated.View style={animatedRowStyle}>
                    <GestureDetector gesture={contentGesture}>
                        <View
                            className={`flex-row px-1 ${isMine ? "justify-end" : "justify-start"
                                }`}
                        >
                            {!isMine ? (
                                <View className="mr-2" style={{ width: 32 }}>
                                    {isLastInGroup && hasAvatar ? (
                                        <Image
                                            source={{ uri: avatarUri }}
                                            className="h-8 w-8 rounded-full bg-gray-200"
                                        />
                                    ) : isLastInGroup ? (
                                        <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-slate-700">
                                            <Feather name="user" size={16} color={isDark ? "#94a3b8" : "#6b7280"} />
                                        </View>
                                    ) : null}
                                </View>
                            ) : null}
                            <Reanimated.View
                                ref={animatedBubbleRef}
                                className={`max-w-[80%] px-4 py-3 shadow-sm ${isMine ? "bg-[#2563eb]" : "bg-white dark:bg-[#1e293b]"
                                    }`}
                                style={[
                                    getBorderRadius(),
                                    !isMine && { borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0' },
                                    animatedBubbleStyle,
                                ]}
                            >
                                {!isMine && isFirstInGroup && (
                                    <Text
                                        className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                        numberOfLines={1}
                                    >
                                        {displayName}
                                    </Text>
                                )}
                                {renderReplyPreview()}
                                <Text
                                    className={`text-[16px] leading-[22px] ${isMine ? "text-white" : "text-[#1e293b] dark:text-[#f1f5f9]"
                                        }`}
                                >
                                    {messageText}
                                </Text>
                                {isLastInGroup && (
                                    <View
                                        className={`mt-1.5 flex-row items-center ${isMine ? "justify-end" : "justify-start"
                                            }`}
                                    >
                                        {hasError ? (
                                            <Text className="text-[10px] font-medium text-red-500">
                                                Failed to decrypt
                                            </Text>
                                        ) : (
                                            <>
                                                {isEditedMessage ? (
                                                    <Text
                                                        className={`mr-2 text-[11px] font-semibold ${isMine ? "text-blue-100" : "text-slate-500 dark:text-slate-400"
                                                            }`}
                                                    >
                                                        Edited
                                                    </Text>
                                                ) : null}
                                                {timestamp ? (
                                                    <Text
                                                        className={`text-[10px] opacity-70 ${isMine ? "text-white/70" : "text-slate-500 dark:text-slate-400"
                                                            }`}
                                                    >
                                                        {formatTimestamp(timestamp)}
                                                    </Text>
                                                ) : null}
                                            </>
                                        )}
                                    </View>
                                )}
                            </Reanimated.View>
                        </View>
                    </GestureDetector>
                </Reanimated.View>
            </GestureDetector>
        </View>
    );
});
