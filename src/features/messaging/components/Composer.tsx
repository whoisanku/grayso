import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Keyboard,
    NativeSyntheticEvent,
    TextInputContentSizeChangeEventData,
    DeviceEventEmitter,
} from "react-native";
import Reanimated, {
    useAnimatedStyle,
    FadeInDown,
    FadeOutUp,
} from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { Platform } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColorScheme } from "nativewind";
import { ChatType, DecryptedMessageEntryResponse, PublicKeyToProfileEntryResponseMap } from "deso-protocol";
import { encryptAndSendNewMessage } from "../services/conversations";
import { OUTGOING_MESSAGE_EVENT } from "../constants/events";
import { getProfileDisplayName } from "../../../utils/deso";
import { getDisplayedMessageText } from "../utils/messageUtils";

export type ComposerProps = {
    isGroupChat: boolean;
    userPublicKey: string;
    counterPartyPublicKey: string;
    threadAccessGroupKeyName: string;
    userAccessGroupKeyName: string;
    conversationId: string;
    chatType: ChatType;
    onMessageSent?: (messageText: string) => void;
    onSendingChange?: (sending: boolean) => void;
    bottomInset?: number;
    recipientAccessGroupPublicKeyBase58Check?: string;
    replyToMessage?: DecryptedMessageEntryResponse | null;
    onCancelReply?: () => void;
    profiles?: PublicKeyToProfileEntryResponseMap;
    editingMessage?: DecryptedMessageEntryResponse | null;
    editDraft?: string;
    onEditDraftChange?: (text: string) => void;
    onCancelEdit?: () => void;
    onSaveEdit?: () => void;
    isSavingEdit?: boolean;
};

export const Composer = React.memo(function Composer({
    isGroupChat,
    userPublicKey,
    counterPartyPublicKey,
    threadAccessGroupKeyName,
    userAccessGroupKeyName,
    conversationId,
    chatType,
    onMessageSent,
    onSendingChange,
    bottomInset = 0,
    recipientAccessGroupPublicKeyBase58Check,
    replyToMessage,
    onCancelReply,
    profiles = {},
    editingMessage,
    editDraft = "",
    onEditDraftChange,
    onCancelEdit,
    onSaveEdit,
    isSavingEdit = false,
}: ComposerProps) {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [inputHeight, setInputHeight] = useState(32);
    const textInputRef = useRef<TextInput>(null);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    // Use keyboard controller for dynamic keyboard height
    const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
    const animatedComposerStyle = useAnimatedStyle(() => ({
        paddingBottom: Platform.OS === "ios"
            ? Math.max(keyboardHeight.value, bottomInset)
            : bottomInset,
        // Add smooth transition for keyboard height changes
        marginBottom: Platform.OS === "android" && keyboardHeight.value > 0 ? 0 : 0,
    }));

    const focusInput = useCallback(() => {
        textInputRef.current?.focus();
    }, []);

    // Auto-focus when entering edit mode or reply mode (with better timing)
    useEffect(() => {
        if (editingMessage || replyToMessage) {
            // Use a longer delay to ensure layout is stable
            const timer = setTimeout(() => {
                focusInput();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [editingMessage, replyToMessage, focusInput]);

    const handleContentSizeChange = useCallback(
        (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
            const nextHeight = Math.min(
                120,
                Math.max(32, event.nativeEvent.contentSize.height)
            );
            setInputHeight(nextHeight);
        },
        []
    );

    const onSend = useCallback(async (messageText?: string) => {
        const textToSend = messageText || text.trim();
        if (!textToSend || sending) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSending(true);
            onSendingChange?.(true);

            const extraData: { [k: string]: string } = {};
            if (replyToMessage && replyToMessage.MessageInfo?.TimestampNanosString) {
                extraData.RepliedToMessageId = replyToMessage.MessageInfo.TimestampNanosString;
                if (replyToMessage.MessageInfo.EncryptedText) {
                    extraData.RepliedToMessageEncryptedText = replyToMessage.MessageInfo.EncryptedText;
                }
            }

            await encryptAndSendNewMessage(
                textToSend,
                userPublicKey,
                counterPartyPublicKey,
                threadAccessGroupKeyName,
                userAccessGroupKeyName,
                recipientAccessGroupPublicKeyBase58Check,
                extraData
            );

            const timestampNanos = Math.round(Date.now() * 1e6);
            onMessageSent?.(textToSend);
            if (onCancelReply) onCancelReply();
            DeviceEventEmitter.emit(OUTGOING_MESSAGE_EVENT, {
                conversationId,
                messageText: textToSend,
                timestampNanos,
                chatType,
                threadPublicKey: counterPartyPublicKey,
                threadAccessGroupKeyName,
                userAccessGroupKeyName,
            });
            setText("");
            focusInput();
        } catch (e) {
            console.error("Send message error", e);
        } finally {
            setSending(false);
            onSendingChange?.(false);
        }
    }, [
        text,
        sending,
        userPublicKey,
        counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName,
        onMessageSent,
        onSendingChange,
        focusInput,
        conversationId,
        chatType,
        replyToMessage,
        onCancelReply,
        recipientAccessGroupPublicKeyBase58Check,
    ]);

    // Handle cancel reply with keyboard dismiss and haptic
    const handleCancelReply = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Keyboard.dismiss();
        onCancelReply?.();
    }, [onCancelReply]);

    // Reply preview - now with smooth animations like edit mode
    const replyPreview = useMemo(() => {
        if (!replyToMessage) return null;
        const senderPk = replyToMessage.SenderInfo?.OwnerPublicKeyBase58Check;
        const senderProfile = senderPk ? profiles[senderPk] : null;
        const displayName = senderPk ? getProfileDisplayName(senderProfile, senderPk) : "Unknown";
        const messageText = getDisplayedMessageText(replyToMessage) || "Message not loaded";

        return (
            <Reanimated.View
                key="reply-preview"
                entering={FadeInDown.duration(150)}
                exiting={FadeOutUp.duration(150)}
                className={`flex-row items-center py-3 px-4 ${isDark
                    ? "bg-[#0f1419]"
                    : "bg-[#f1f5f9]"
                    }`}
            >
                {/* Left accent bar */}
                <View
                    style={{
                        width: 3,
                        height: '100%',
                        minHeight: 40,
                        backgroundColor: '#1DB7A4',
                        borderRadius: 2,
                        marginRight: 12,
                    }}
                />
                <View className="flex-1">
                    <Text
                        className="text-base font-semibold mb-1"
                        style={{ color: '#1DB7A4' }}
                        numberOfLines={1}
                    >
                        {displayName}
                    </Text>
                    <Text
                        className={`text-sm ${isDark ? "text-[#8899a6]" : "text-[#64748b]"}`}
                        numberOfLines={1}
                    >
                        {messageText}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={handleCancelReply}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        borderWidth: 2,
                        borderColor: isDark ? '#4a5568' : '#cbd5e1',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 12,
                    }}
                >
                    <Feather name="x" size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
                </TouchableOpacity>
            </Reanimated.View>
        );
    }, [replyToMessage, handleCancelReply, isDark, profiles]);

    // Handle cancel edit with keyboard dismiss and haptic
    const handleCancelEdit = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Keyboard.dismiss();
        onCancelEdit?.();
    }, [onCancelEdit]);

    const editPreview = useMemo(() => {
        if (!editingMessage) return null;
        const messageText = getDisplayedMessageText(editingMessage) || "Message";

        return (
            <Reanimated.View
                key="edit-preview"
                entering={FadeInDown.duration(150)}
                exiting={FadeOutUp.duration(150)}
                className={`flex-row items-center py-3 px-4 ${isDark
                    ? "bg-[#1e293b]"
                    : "bg-[#f1f5f9]"
                    }`}
            >
                {/* Left accent bar - amber for edit mode */}
                <View
                    style={{
                        width: 3,
                        height: '100%',
                        minHeight: 40,
                        backgroundColor: '#f59e0b',
                        borderRadius: 2,
                        marginRight: 12,
                    }}
                />
                <View className="flex-1">
                    <Text className="text-base font-semibold text-[#f59e0b] mb-1">
                        Editing message
                    </Text>
                    <Text className={`text-sm ${isDark ? "text-[#cbd5e1]" : "text-[#64748b]"}`} numberOfLines={1}>
                        {messageText}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={handleCancelEdit}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        borderWidth: 2,
                        borderColor: isDark ? '#4a5568' : '#cbd5e1',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 12,
                    }}
                >
                    <Feather name="x" size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
                </TouchableOpacity>
            </Reanimated.View>
        );
    }, [editingMessage, handleCancelEdit, isDark]);

    const isEditMode = Boolean(editingMessage);
    const currentText = isEditMode ? editDraft : text;
    const currentHasText = currentText.trim().length > 0;

    const handleTextChange = (newText: string) => {
        if (isEditMode) {
            onEditDraftChange?.(newText);
        } else {
            setText(newText);
        }
    };

    const handleSendOrSave = () => {
        if (isEditMode) {
            onSaveEdit?.();
        } else {
            onSend();
        }
    };

    const isDisabled = isEditMode
        ? (!currentText.trim() || isSavingEdit)
        : (sending || !currentText.trim());

    return (
        <Reanimated.View
            className={`border-t border-slate-200 dark:border-slate-800 ${isDark ? "bg-[#000]" : "bg-[#fff]"
                }`}
            style={animatedComposerStyle}
        >
            {editPreview}
            {replyPreview}
            <View className="flex-row items-end mx-3 mt-3 justify-between">
                <View className={`flex-1 rounded-3xl flex-row items-center pl-4 pr-1.5 py-1.5 ${isDark ? "bg-[#1e293b]" : "bg-[#f1f5f9]"
                    }`}>
                    <TextInput
                        ref={textInputRef}
                        placeholder={isEditMode ? "Update your message" : (isGroupChat ? "Message the group…" : "Write a message")}
                        placeholderTextColor={isDark ? "#94a3b8" : "#64748b"}
                        value={currentText}
                        onChangeText={handleTextChange}
                        multiline
                        keyboardAppearance={isDark ? "dark" : "light"}
                        autoCorrect
                        autoCapitalize="sentences"
                        textAlignVertical="center"
                        returnKeyType="default"
                        blurOnSubmit={false}
                        onContentSizeChange={handleContentSizeChange}
                        className={`flex-1 text-base leading-5 p-0 ml-0 ${isDark ? "text-[#f8fafc]" : "text-[#1e293b]"
                            }`}
                        style={{
                            minHeight: 24,
                            maxHeight: 80,
                            paddingVertical: 4,
                        }}
                    />
                    <TouchableOpacity
                        onPress={handleSendOrSave}
                        disabled={isDisabled}
                        activeOpacity={0.85}
                        className="ml-2"
                    >
                        <View className={`h-8 w-8 rounded-full items-center justify-center ${!currentHasText ? (isDark ? "bg-[#334155]" : "bg-[#e2e8f0]") : (isEditMode ? "bg-[#f59e0b]" : "bg-[#0085ff]")
                            }`}>
                            {(sending || isSavingEdit) ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Ionicons
                                    name={isEditMode ? "checkmark" : "arrow-up"}
                                    size={20}
                                    color={!currentHasText ? (isDark ? "#94a3b8" : "#64748b") : "#ffffff"}
                                />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </Reanimated.View>
    );
});
