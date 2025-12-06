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
    Image,
    ScrollView,
} from "react-native";
import Reanimated, {
    FadeInDown,
    FadeOutUp,
} from "react-native-reanimated";
// Keyboard animation now handled by ScreenWrapper's KeyboardAvoidingView
import { Platform } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColorScheme } from "nativewind";
import { ChatType, DecryptedMessageEntryResponse, PublicKeyToProfileEntryResponseMap } from "deso-protocol";
import { encryptAndSendNewMessage } from "../../services/conversations";
import { OUTGOING_MESSAGE_EVENT } from "../../constants/events";
import { getProfileDisplayName } from "../../utils/deso";
import { getDisplayedMessageText } from "../../utils/messageUtils";
import * as ImagePicker from "expo-image-picker";

// Type for selected images (for future API integration)
export type SelectedImage = {
    uri: string;
    width: number;
    height: number;
    fileName?: string;
    mimeType?: string;
};

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
    const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
    const textInputRef = useRef<TextInput>(null);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    // Keyboard avoidance is now handled by ScreenWrapper's KeyboardAvoidingView
    // This ensures the entire content (including FlatList) moves up with keyboard

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

    // Image picker handler
    const handlePickImages = useCallback(async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsMultipleSelection: true,
                quality: 0.8,
                selectionLimit: 10,
            });

            if (!result.canceled && result.assets.length > 0) {
                const newImages: SelectedImage[] = result.assets.map((asset) => ({
                    uri: asset.uri,
                    width: asset.width || 0,
                    height: asset.height || 0,
                    fileName: asset.fileName || undefined,
                    mimeType: asset.mimeType || undefined,
                }));
                setSelectedImages((prev) => [...prev, ...newImages].slice(0, 10)); // Limit to 10 images
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            console.error("Image picker error:", error);
        }
    }, []);

    // Remove image handler
    const handleRemoveImage = useCallback((index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    }, []);

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
                className={`flex-row items-center py-3 px-3 ${isDark
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
                        backgroundColor: isDark ? '#1e2738' : '#e2e8f0',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 8,
                        marginRight: 1.5, // Align with send button (pr-1.5 in composer input)
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
                className={`flex-row items-center py-3 px-3 ${isDark
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
                        backgroundColor: isDark ? '#1e2738' : '#e2e8f0',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 8,
                        marginRight: 1.5, // Align with send button (pr-1.5 in composer input)
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
            // TODO: Your friend should integrate selectedImages here for API upload
            // The selectedImages array contains { uri, width, height, fileName, mimeType }
            // After successful send, clear images: setSelectedImages([])
            onSend();
            // Clear images after sending (for now just clears locally)
            if (selectedImages.length > 0) {
                setSelectedImages([]);
            }
        }
    };

    const hasContent = currentText.trim().length > 0 || selectedImages.length > 0;
    const isDisabled = isEditMode
        ? (!currentText.trim() || isSavingEdit)
        : (sending || !hasContent);

    return (
        <View
            className={`border-t border-slate-200 dark:border-slate-800 ${isDark ? "bg-[#0a0f1a]" : "bg-[#fff]"
                }`}
            style={{ paddingBottom: bottomInset }}
        >
            {editPreview}
            {replyPreview}

            {/* Selected Images Preview */}
            {selectedImages.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
                    className="border-b border-slate-100 dark:border-slate-800"
                >
                    {selectedImages.map((image, index) => (
                        <View key={`${image.uri}-${index}`} style={{ position: 'relative' }}>
                            <Image
                                source={{ uri: image.uri }}
                                style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: 12,
                                    backgroundColor: isDark ? '#1e2738' : '#f1f5f9',
                                }}
                                resizeMode="cover"
                            />
                            <TouchableOpacity
                                onPress={() => handleRemoveImage(index)}
                                activeOpacity={0.8}
                                style={{
                                    position: 'absolute',
                                    top: -6,
                                    right: -6,
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    backgroundColor: isDark ? '#334155' : '#e2e8f0',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 2,
                                    borderColor: isDark ? '#0a0f1a' : '#fff',
                                }}
                            >
                                <Feather name="x" size={12} color={isDark ? '#94a3b8' : '#64748b'} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            )}

            <View className="flex-row items-end mx-3 my-3 justify-between">
                {/* Image Picker Button - only show when not editing */}
                {!isEditMode && (
                    <TouchableOpacity
                        onPress={handlePickImages}
                        activeOpacity={0.7}
                        className="mr-2"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ alignSelf: 'center' }}
                    >
                        <View
                            className={`h-9 w-9 rounded-full items-center justify-center ${isDark ? "bg-[#1e2738]" : "bg-[#f1f5f9]"
                                }`}
                        >
                            <Feather name="plus" size={22} color={isDark ? "#94a3b8" : "#64748b"} />
                        </View>
                    </TouchableOpacity>
                )}

                <View className={`flex-1 rounded-3xl flex-row items-center pl-4 pr-1.5 py-1.5 ${isDark ? "bg-[#1e2738]" : "bg-[#f1f5f9]"
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
                        <View className={`h-9 w-9 rounded-full items-center justify-center ${!hasContent ? (isDark ? "bg-[#334155]" : "bg-[#e2e8f0]") : (isEditMode ? "bg-[#f59e0b]" : "bg-[#0085ff]")}`}>
                            {(sending || isSavingEdit) ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Ionicons
                                    name={isEditMode ? "checkmark" : "arrow-up"}
                                    size={22}
                                    color={!hasContent ? (isDark ? "#94a3b8" : "#64748b") : "#ffffff"}
                                />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
});
