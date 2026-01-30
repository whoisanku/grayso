import React, { useRef, useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    Keyboard,
    Platform,
    TouchableOpacity,
    useWindowDimensions,
} from "react-native";
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
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { DecryptedMessageEntryResponse, PublicKeyToProfileEntryResponseMap } from "deso-protocol";
import { getProfileDisplayName, getProfileImageUrl, FALLBACK_PROFILE_IMAGE } from "@/utils/deso";
import { MESSAGE_GROUPING_WINDOW_NS } from "@/constants/messaging";
import {
    getMessageId,
    isEditedValue,
    getDisplayedMessageText,
    formatTimestamp,
    shouldShowDayDivider,
    formatDayLabel,
} from "../../../utils/messageUtils";
import { FileAndMessageBubble } from "./FileAndMessageBubble";
import { VideoMessageBubble } from "./VideoMessageBubble";
import { ImageGalleryModal } from "./ImageGalleryModal";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { useAccentColor } from "@/state/theme/useAccentColor";

const DEFAULT_AVATAR_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

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
    onAvatarPress?: (publicKey: string, username?: string) => void;
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
    onAvatarPress,
}: MessageBubbleProps) {
    const bubbleContainerRef = useRef<View>(null);
    const animatedBubbleRef = useAnimatedRef<Reanimated.View>();
    const { accentColor, accentSoft, onAccent } = useAccentColor();
    const { width: windowWidth } = useWindowDimensions();
    const enableSwipeToReply = Platform.OS !== "web";

    // Image gallery state
    const [galleryVisible, setGalleryVisible] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);

    const handleImagePress = useCallback((images: string[], index: number) => {
        setGalleryImages(images);
        setGalleryInitialIndex(index);
        setGalleryVisible(true);
    }, []);

    const handleCloseGallery = useCallback(() => {
        setGalleryVisible(false);
    }, []);

    // Video modal state
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUri, setCurrentVideoUri] = useState<string | null>(null);

    const handlePlayVideo = useCallback((uri: string) => {
        setCurrentVideoUri(uri);
        setVideoModalVisible(true);
    }, []);

    const handleCloseVideo = useCallback(() => {
        setVideoModalVisible(false);
        setCurrentVideoUri(null);
    }, []);

    const extraData = item.MessageInfo?.ExtraData || {};
    const decryptedImageURLs = extraData?.decryptedImageURLs;
    const decryptedVideoURLs = extraData?.decryptedVideoURLs;
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
        (hasError ? "Unable to decrypt this message." : "");
    const messageText =
        (isEditedMessage && editedMessageText ? editedMessageText : baseMessageText) ||
        baseMessageText;
    const normalizedMessageText = messageText?.trim();
    const timestamp = item.MessageInfo?.TimestampNanos;

    const senderProfile = profiles[senderPk];
    const displayName = getProfileDisplayName(senderProfile, senderPk);

    // For group chats, try to use profile pic from GraphQL first
    let avatarUri: string;
    if (isGroupChat && senderProfile?.ExtraData?.LargeProfilePicURL) {
        avatarUri = `https://node.deso.org/api/v0/get-single-profile-picture/${senderPk}?fallback=${senderProfile.ExtraData.LargeProfilePicURL}`;
    } else {
        // Fix: Don't pass groupChat: true here, as that generates a group avatar (initials)
        // We want the user's personal profile picture
        avatarUri = getProfileImageUrl(senderPk) ?? FALLBACK_PROFILE_IMAGE;
    }
    const hasAvatar = Boolean(avatarUri);
    const showDayDivider = shouldShowDayDivider(timestamp, previousTimestamp);

    const hasMedia = Boolean(decryptedImageURLs || decryptedVideoURLs);
    const isMediaOnly = hasMedia && (!normalizedMessageText || normalizedMessageText.length === 0);


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
                    backgroundColor: isMine
                        ? "rgba(255, 255, 255, 0.15)"
                        : accentSoft,
                    borderLeftWidth: 3,
                    borderLeftColor: isMine ? "rgba(255, 255, 255, 0.5)" : accentColor,
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginBottom: 8,
                }}
            >
                <Text
                    style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: isMine ? "rgba(255, 255, 255, 0.9)" : accentColor,
                        marginBottom: 2,
                    }}
                    numberOfLines={1}
                >
                    {replyDisplayName}
                </Text>
                <Text
                    style={{
                        fontSize: 13,
                        lineHeight: 18,
                        color: isMine
                            ? "rgba(255, 255, 255, 0.75)"
                            : (isDark ? "#94a3b8" : "#4b5563"),
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

    const triggerHaptic = useCallback(() => {
        if (Platform.OS === "web") return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    const triggerReply = useCallback(() => {
        if (!onReply) return;
        onReply(item);
    }, [onReply, item]);


    const panGesture = useMemo(() => Gesture.Pan()
        .enabled(enableSwipeToReply)
        //.enabled(!hasMedia) // Enabled for all messages now
        .activeOffsetX(isMine ? -15 : 15) // Start gesture after 15px horizontal movement
        .failOffsetY([-10, 10]) // Fail (allow scroll) if vertical movement exceeds 10px
        .onUpdate((event) => {
            'worklet';
            if (typeof event?.translationX !== "number") return;
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
            'worklet';
            const absValue = Math.abs(translateX.value);
            if (absValue >= SWIPE_THRESHOLD) {
                runOnJS(triggerReply)();
            }
            // Smooth snap back without bounce
            translateX.value = withSpring(0, {
                damping: 20,
                stiffness: 300,
                overshootClamping: true,
            });
            hasTriggeredHaptic.value = false;
        }), [enableSwipeToReply, hasMedia, isMine, triggerHaptic, triggerReply]);

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

    const handleLongPress = useCallback((layout: { x: number; y: number; width: number; height: number }) => {
        if (!onLongPress) return;
        // Haptic is handled in useMessageActions to avoid double feedback
        onLongPress(item, layout);
    }, [onLongPress, item]);

    const longPressGesture = useMemo(() => Gesture.LongPress()
        .minDuration(250)
        .onStart(() => {
            'worklet';
            const measured = measure(animatedBubbleRef);
            if (measured) {
                runOnJS(handleLongPress)({
                    x: measured.pageX,
                    y: measured.pageY,
                    width: measured.width,
                    height: measured.height,
                });
            }
        }), [handleLongPress]);

    const dismissKeyboard = useCallback(() => {
        Keyboard.dismiss();
    }, []);

    const tapGesture = useMemo(() => Gesture.Tap()
        .enabled(!hasMedia)
        .onEnd(() => {
            'worklet';
            runOnJS(dismissKeyboard)();
        }), [hasMedia, dismissKeyboard]);

    const contentGesture = useMemo(() => Gesture.Exclusive(longPressGesture, tapGesture), [longPressGesture, tapGesture]);



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

    const bubbleBackgroundColor = isMine
        ? accentColor
        : (isDark ? "#1e2738" : "#f8fafc");
    const bubbleBorderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

    // Dynamic border radius based on position in group - memoized for performance
    const borderRadiusStyle = useMemo(() => {
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
    }, [isOnlyMessage, isMine, isFirstInGroup, isLastInGroup]);

    // Memoize bubble border and shadow styles for performance
    // Consistent shadow styling across platforms
    const bubbleExtraStyle = useMemo(() => {
        const baseStyles = [
            borderRadiusStyle,
            !isMine && { borderWidth: 0.5, borderColor: bubbleBorderColor },
        ];

        if (Platform.OS === 'web') {
            // CSS box-shadow for web
            return [
                ...baseStyles,
                {
                    boxShadow: isDark
                        ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                        : '0 1px 4px rgba(0, 0, 0, 0.08)'
                } as any,
            ];
        }

        // React Native shadow for iOS/Android - matching web shadow intensity
        return [
            ...baseStyles,
            { 
                shadowColor: '#000', 
                shadowOffset: { width: 0, height: 2 }, 
                shadowOpacity: isDark ? 0.25 : 0.08, 
                shadowRadius: 4,
                // Android elevation
                elevation: isDark ? 4 : 2,
            },
        ];
    }, [borderRadiusStyle, isMine, isDark, bubbleBorderColor]);

    const marginBottom = isLastInGroup ? 12 : 2;
    const maxBubbleWidth = useMemo(() => {
        // Consistent max width across platforms for visual parity
        // Avatar is now absolutely positioned, so no offset needed
        const baseWidth = Math.min(windowWidth * 0.75, 360);
        return Math.max(240, baseWidth);
    }, [windowWidth]);

    return (
        <View
            style={{ marginBottom }}
            ref={bubbleContainerRef}
        >
            {showDayDivider ? (
                <View className="items-center py-5 my-2">
                    <View className="rounded-full bg-gray-200/80 px-4 py-1.5 dark:bg-white/10">
                        <Text className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                            {formatDayLabel(timestamp)}
                        </Text>
                    </View>
                </View>
            ) : null}

            {/* Message row wrapper - positions reply icon relative to message only */}
            <View style={{ position: 'relative' }}>
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
                <GestureDetector gesture={panGesture} touchAction="pan-y">
                    <Reanimated.View style={animatedRowStyle}>
                        <GestureDetector gesture={contentGesture} touchAction="pan-y">
                            <View
                                className={`flex-row ${isMine ? "justify-end" : "justify-start"}`}
                                style={{ paddingHorizontal: 6 }}
                            >
                                {/* No avatar in group chats - sender name inside bubble is sufficient */}
                                <View style={{ position: "relative" }}>
                                    <Reanimated.View
                                        ref={animatedBubbleRef}
                                        style={[
                                            bubbleExtraStyle,
                                            {
                                                paddingHorizontal: isMediaOnly ? 0 : 14,
                                                paddingVertical: isMediaOnly ? 0 : 10,
                                                maxWidth: maxBubbleWidth,
                                                overflow: 'hidden',
                                                backgroundColor: bubbleBackgroundColor,
                                            },
                                        ]}
                                    >
                                        {/* Only show sender name in GROUP chats */}
                                        {!isMine && isGroupChat && isFirstInGroup && (
                                            <Text
                                                className="mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                                style={isMediaOnly ? { marginHorizontal: 10, marginTop: 8 } : undefined}
                                                numberOfLines={1}
                                            >
                                                {displayName}
                                            </Text>
                                        )}
                                        {renderReplyPreview()}
                                        <View className={hasMedia && !isMediaOnly ? "flex-col gap-2" : undefined}>
                                            <FileAndMessageBubble
                                                decryptedImageURLs={typeof decryptedImageURLs === "string" ? decryptedImageURLs : undefined}
                                                extraData={extraData}
                                                isDark={isDark}
                                                onImagePress={handleImagePress}
                                                compact={isMediaOnly}
                                                borderRadius={16}
                                                parentMaxWidth={maxBubbleWidth}
                                            />
                                            <VideoMessageBubble
                                                decryptedVideoURLs={typeof decryptedVideoURLs === "string" ? decryptedVideoURLs : undefined}
                                                extraData={extraData}
                                                isDark={isDark}
                                                compact={isMediaOnly}
                                                onPlayVideo={handlePlayVideo}
                                            />
                                            {/* WhatsApp-style: text + inline timestamp using nested Text */}
                                            {(!isMediaOnly) && (
                                                <Text
                                                    className="text-[15px] leading-[21px]"
                                                    style={{
                                                        flexShrink: 1,
                                                        color: isMine ? onAccent : (isDark ? "#e2e8f0" : "#0f172a"),
                                                        paddingHorizontal: isMediaOnly ? 10 : 0,
                                                        marginBottom: isMediaOnly ? 10 : 0,
                                                    }}
                                                >
                                                    {messageText}
                                                    {/* Invisible spacer to ensure minimum gap before timestamp */}
                                                    <Text style={{ fontSize: 10, opacity: 0 }}>
                                                        {"  "}{hasError ? "Failed" : ((isEditedMessage ? "edited " : "") + (timestamp ? formatTimestamp(timestamp) : ""))}
                                                    </Text>
                                                </Text>
                                            )}
                                        </View>

                                        {/* Actual timestamp overlaid at bottom-right */}
                                        {isMediaOnly ? (
                                            // Media Only: Overlay with gradient
                                            <View style={{ position: 'absolute', bottom: 0, right: 0, left: 0, height: 40, justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                                                <LinearGradient
                                                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                                                    style={{ position: 'absolute', inset: 0 }}
                                                    pointerEvents="none"
                                                />
                                                <Text
                                                    style={{
                                                        fontSize: 10,
                                                        color: "#ffffff",
                                                        fontWeight: '500',
                                                        marginRight: 10,
                                                        marginBottom: 6,
                                                        textShadowColor: 'rgba(0,0,0,0.5)',
                                                        textShadowOffset: { width: 0, height: 1 },
                                                        textShadowRadius: 2,
                                                    }}
                                                >
                                                    {hasError ? "Failed" : (
                                                        <>
                                                            {isEditedMessage ? (
                                                                <Text style={{ fontStyle: "italic" }}>edited </Text>
                                                            ) : null}
                                                            {timestamp ? formatTimestamp(timestamp) : ""}
                                                        </>
                                                    )}
                                                </Text>
                                            </View>
                                        ) : (
                                            // Normal Text: Standard position
                                            <Text
                                                style={{
                                                    position: 'absolute',
                                                    bottom: 10,
                                                    right: 14,
                                                    fontSize: 10,
                                                    color: hasError
                                                        ? "#ef4444"
                                                        : isMine
                                                            ? onAccent
                                                            : (isDark ? "#94a3b8" : "#94a3b8"),
                                                }}
                                            >
                                                {hasError ? "Failed" : (
                                                    <>
                                                        {isEditedMessage ? (
                                                            <Text style={{ fontStyle: "italic" }}>edited </Text>
                                                        ) : null}
                                                        {timestamp ? formatTimestamp(timestamp) : ""}
                                                    </>
                                                )}
                                            </Text>
                                        )}
                                    </Reanimated.View>
                                </View>
                            </View>
                        </GestureDetector>
                    </Reanimated.View>
                </GestureDetector>
            </View>

            {/* Fullscreen Image Gallery Modal */}
            <ImageGalleryModal
                visible={galleryVisible}
                images={galleryImages}
                initialIndex={galleryInitialIndex}
                onClose={handleCloseGallery}
            />

            {/* Fullscreen Video Player Modal */}
            <VideoPlayerModal
                visible={videoModalVisible}
                uri={currentVideoUri}
                onClose={handleCloseVideo}
                isDark={isDark}
            />
        </View>
    );
});
