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
    TextInputSelectionChangeEventData,
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
import { broadcastMessageUpdate } from "../../lib/supabaseClient";
import { OUTGOING_MESSAGE_EVENT } from "../../constants/events";
import { getProfileDisplayName } from "../../utils/deso";
import { getDisplayedMessageText } from "../../utils/messageUtils";
import * as ImagePicker from "expo-image-picker";
import { uploadImage, uploadVideo } from "../../services/media";

// Type for selected images (for future API integration)
export type SelectedImage = {
    uri: string;
    width: number;
    height: number;
    fileName?: string | null;
    mimeType?: string;
    // Upload state
    uploadStatus: 'pending' | 'uploading' | 'completed' | 'error';
    progress: number;
    uploadedUrl?: string;
};

export type ComposerProps = {
    isGroupChat: boolean;
    userPublicKey: string;
    counterPartyPublicKey: string;
    threadAccessGroupKeyName: string;
    userAccessGroupKeyName: string;
    conversationId: string;
    chatType: ChatType;
    onMessageSent?: (text: string, extraData?: Record<string, any>) => void;
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
    recipientOnline?: boolean;
    onSendEphemeral?: (content: string) => Promise<void>;
    isSendingEphemeral?: boolean;
};

const extractVideoId = (url: string): string | null => {
    try {
        const parsed = new URL(url);
        const pathSegments = parsed.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
            return pathSegments[pathSegments.length - 1];
        }
        return parsed.hostname === "iframe.videodelivery.net" ? parsed.pathname.replace(/^\//, '') : null;
    } catch {
        return null;
    }
};

const normalizeVideoUploadMetadata = (
    url: string,
    index: number,
    width: number,
    height: number,
    extraData: Record<string, string>
) => {
    if (!url) return;

    const appendBaseMetadata = (clientIdValue: string) => {
        const sanitizedClientId = clientIdValue.split('?')[0];
        if (sanitizedClientId) {
            extraData[`video.${index}.clientId`] = sanitizedClientId;
        }
        extraData[`video.${index}.width`] = String(width);
        extraData[`video.${index}.height`] = String(height);
        extraData[`video.${index}.orientation`] = width > height ? "landscape" : "portrait";
        // Placeholder average color until backend provides actual value
        if (!extraData[`video.${index}.avgColor`]) {
            extraData[`video.${index}.avgColor`] = JSON.stringify("");
        }
    };

    const extractedId = extractVideoId(url) || url.split('/').pop() || '';
    appendBaseMetadata(extractedId);
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
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const textInputRef = useRef<TextInput>(null);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    // Typing indicator throttling
    const lastTypingSentRef = useRef<number>(0);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTextChange = useCallback((newText: string) => {
        if (editingMessage) {
            onEditDraftChange?.(newText);
            return;
        }

        setText(newText);

        // Don't send typing events if empty (handled by stop typing logic) or if sending
        if (sending) return;

        const now = Date.now();
        const THROTTLE_MS = 3000; // Send at most every 3 seconds

        // If user is typing (text not empty)
        if (newText.length > 0) {
            // Send "is_typing: true" if enough time has passed
            if (now - lastTypingSentRef.current > THROTTLE_MS) {
                lastTypingSentRef.current = now;
                broadcastMessageUpdate(
                    {
                        conversationId,
                        timestampNanos: Date.now() * 1e6,
                        senderPublicKey: userPublicKey,
                        is_typing: true
                    },
                    `messages-${conversationId}`,
                    undefined,
                    { keepAlive: true }
                ).catch(err => console.warn('[Composer] Failed to broadcast typing:', err));
            }

            // Clear existing stop timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Set new stop timeout (debounce)
            typingTimeoutRef.current = setTimeout(() => {
                broadcastMessageUpdate(
                    {
                        conversationId,
                        timestampNanos: Date.now() * 1e6,
                        senderPublicKey: userPublicKey,
                        is_typing: false
                    },
                    `messages-${conversationId}`,
                    undefined,
                    { keepAlive: true }
                ).catch(err => console.warn('[Composer] Failed to broadcast stop typing:', err));
            }, 2000); // Consider stopped after 2 seconds of inactivity
        } else {
            // If text became empty, send stop immediately
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            broadcastMessageUpdate(
                {
                    conversationId,
                    timestampNanos: Date.now() * 1e6,
                    senderPublicKey: userPublicKey,
                    is_typing: false
                },
                `messages-${conversationId}`,
                undefined,
                { keepAlive: true }
            ).catch(err => console.warn('[Composer] Failed to broadcast stop typing:', err));
        }
    }, [conversationId, userPublicKey, sending, editingMessage, onEditDraftChange]);

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
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsMultipleSelection: true,
                quality: 0.8,
                selectionLimit: 10,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newImages: SelectedImage[] = result.assets.map((asset) => ({
                    uri: asset.uri,
                    width: asset.width,
                    height: asset.height,
                    fileName: asset.fileName,
                    mimeType: asset.mimeType,
                    uploadStatus: 'pending',
                    progress: 0
                }));

                setSelectedImages((prev) => [...prev, ...newImages]);

                // Start uploads immediately
                newImages.forEach((image) => {
                    uploadMediaItem(image);
                });
            }
        } catch (error) {
            console.error("Error picking images:", error);
        }
    }, [userPublicKey]);

    const uploadMediaItem = async (item: SelectedImage) => {
        // Update status to uploading
        setSelectedImages(prev => prev.map(img =>
            img.uri === item.uri ? { ...img, uploadStatus: 'uploading' } : img
        ));

        try {
            const isVideo = item.mimeType?.startsWith('video/');
            let url = "";

            const onProgress = (progress: number) => {
                setSelectedImages(prev => prev.map(img =>
                    img.uri === item.uri ? { ...img, progress } : img
                ));
            };

            if (isVideo) {
                url = await uploadVideo(userPublicKey, item.uri, onProgress);
            } else {
                url = await uploadImage(userPublicKey, item.uri, onProgress);
            }

            // Update status to completed
            setSelectedImages(prev => prev.map(img =>
                img.uri === item.uri ? { ...img, uploadStatus: 'completed', uploadedUrl: url, progress: 1 } : img
            ));

        } catch (error) {
            console.error("Upload failed:", error);
            setSelectedImages(prev => prev.map(img =>
                img.uri === item.uri ? { ...img, uploadStatus: 'error', progress: 0 } : img
            ));
        }
    };

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

            const {
                EncryptedMessageText,
                ExtraData,
                SenderAccessGroupPublicKeyBase58Check,
                SenderAccessGroupKeyName,
                RecipientAccessGroupPublicKeyBase58Check: RecipientAccessGroupPublicKey,
                RecipientAccessGroupKeyName,
            } = await encryptAndSendNewMessage(
                textToSend,
                userPublicKey,
                counterPartyPublicKey,
                threadAccessGroupKeyName,
                userAccessGroupKeyName,
                recipientAccessGroupPublicKeyBase58Check,
                extraData
            );

            const timestampNanos = Math.round(Date.now() * 1e6);

            // Broadcast message via Supabase for instant delivery when both users are online
            try {
                const broadcastChannel = `messages-${conversationId}`;
                console.log('[Composer] Broadcasting to channel:', broadcastChannel);

                await broadcastMessageUpdate(
                    {
                        conversationId,
                        timestampNanos,
                        senderPublicKey: userPublicKey,
                        recipients: [counterPartyPublicKey],
                        metadata: {
                            chatType,
                        },
                        EncryptedMessageText,
                        ExtraData,
                        SenderAccessGroupPublicKeyBase58Check,
                        SenderAccessGroupKeyName,
                        RecipientAccessGroupPublicKeyBase58Check: RecipientAccessGroupPublicKey,
                        RecipientAccessGroupKeyName,
                    },
                    broadcastChannel, // Use conversation-specific channel
                    undefined, // default event
                    { keepAlive: true } // Keep channel open for useConversationMessages
                );
                console.log('[Composer] Message broadcast via Supabase successfully');
            } catch (broadcastError) {
                console.warn('[Composer] Supabase broadcast failed (message still sent to blockchain):', broadcastError);
            }

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
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: isDark ? '#0f1419' : '#f1f5f9',
                }}
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
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: '#1DB7A4',
                            marginBottom: 2,
                        }}
                        numberOfLines={1}
                    >
                        {displayName}
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            color: isDark ? '#8899a6' : '#64748b',
                        }}
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
                        marginRight: 1.5,
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
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                }}
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
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: '#f59e0b',
                            marginBottom: 2,
                        }}
                    >
                        Editing message
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            color: isDark ? '#cbd5e1' : '#64748b',
                        }}
                        numberOfLines={1}
                    >
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
                        marginRight: 1.5,
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



    const handleSelectionChange = useCallback((event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        setSelection(event.nativeEvent.selection);
    }, []);



    const handleSendOrSave = async () => {
        if (isEditMode) {
            onSaveEdit?.();
        } else {
            // Check if we have content to send
            if (!currentText.trim() && selectedImages.length === 0) return;

            try {
                setSending(true);
                onSendingChange?.(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                const extraData: { [k: string]: string } = { isMarkdown: "false" };
                const optimisticVideoUrls: string[] = [];

                // Handle image uploads if any
                const imageURLs: string[] = [];
                const videoURLs: string[] = [];

                if (selectedImages.length > 0) {
                    // Check if any uploads are still pending or failed
                    const pendingUploads = selectedImages.filter(img => img.uploadStatus === 'uploading' || img.uploadStatus === 'pending');
                    if (pendingUploads.length > 0) {
                        // TODO: Show toast "Please wait for uploads to complete"
                        setSending(false);
                        onSendingChange?.(false);
                        return;
                    }

                    const failedUploads = selectedImages.filter(img => img.uploadStatus === 'error');
                    if (failedUploads.length > 0) {
                        // TODO: Show toast "Some uploads failed"
                        setSending(false);
                        onSendingChange?.(false);
                        return;
                    }

                    try {
                        const imagesToUpload = selectedImages.filter(img => !img.mimeType?.startsWith('video/'));
                        const videosToUpload = selectedImages.filter(img => img.mimeType?.startsWith('video/'));

                        // Collect uploaded images
                        imagesToUpload.forEach((img, i) => {
                            if (img.uploadedUrl) {
                                imageURLs.push(img.uploadedUrl);
                                const clientId = img.uploadedUrl.split('/').pop();
                                if (clientId) {
                                    extraData[`image.${i}.clientId`] = clientId;
                                    extraData[`image.${i}.width`] = String(img.width);
                                    extraData[`image.${i}.height`] = String(img.height);
                                    extraData[`image.${i}.orientation`] = img.width > img.height ? "landscape" : "portrait";
                                }
                            }
                        });

                        // Collect uploaded videos
                        videosToUpload.forEach((vid, i) => {
                            if (vid.uploadedUrl) {
                                videoURLs.push(vid.uploadedUrl);
                                optimisticVideoUrls.push(vid.uploadedUrl);
                                normalizeVideoUploadMetadata(
                                    vid.uploadedUrl,
                                    i,
                                    vid.width,
                                    vid.height,
                                    extraData
                                );
                            }
                        });

                    } catch (err) {
                        console.error("Failed to process media:", err);
                        // TODO: Show error toast to user
                        setSending(false);
                        onSendingChange?.(false);
                        return;
                    }
                }

                // Handle reply metadata
                if (replyToMessage && replyToMessage.MessageInfo?.TimestampNanosString) {
                    extraData.RepliedToMessageId = replyToMessage.MessageInfo.TimestampNanosString;
                    if (replyToMessage.MessageInfo.EncryptedText) {
                        extraData.RepliedToMessageEncryptedText = replyToMessage.MessageInfo.EncryptedText;
                    }
                }

                const networkExtraData = { ...extraData };

                const optimisticExtraData = { ...networkExtraData };
                if (optimisticVideoUrls.length > 0) {
                    optimisticExtraData.decryptedVideoURLs = JSON.stringify(optimisticVideoUrls);
                }
                if (imageURLs.length > 0) {
                    optimisticExtraData.decryptedImageURLs = JSON.stringify(imageURLs);
                }

                const {
                    EncryptedMessageText,
                    ExtraData,
                    SenderAccessGroupPublicKeyBase58Check,
                    SenderAccessGroupKeyName,
                    RecipientAccessGroupPublicKeyBase58Check: RecipientAccessGroupPublicKey,
                    RecipientAccessGroupKeyName,
                } = await encryptAndSendNewMessage(
                    currentText.trim(), // Can be empty string if only sending images
                    userPublicKey,
                    counterPartyPublicKey,
                    threadAccessGroupKeyName,
                    userAccessGroupKeyName,
                    recipientAccessGroupPublicKeyBase58Check,
                    networkExtraData,
                    imageURLs,
                    videoURLs
                );

                const timestampNanos = Math.round(Date.now() * 1e6);

                // Broadcast message via Supabase for instant delivery when both users are online
                try {
                    const broadcastChannel = `messages-${conversationId}`;
                    console.log('[Composer] Broadcasting to channel:', broadcastChannel);

                    await broadcastMessageUpdate(
                        {
                            conversationId,
                            timestampNanos,
                            senderPublicKey: userPublicKey,
                            recipients: [counterPartyPublicKey],
                            metadata: {
                                chatType,
                            },
                            EncryptedMessageText,
                            ExtraData,
                            SenderAccessGroupPublicKeyBase58Check,
                            SenderAccessGroupKeyName,
                            RecipientAccessGroupPublicKeyBase58Check: RecipientAccessGroupPublicKey,
                            RecipientAccessGroupKeyName,
                        },
                        broadcastChannel,
                        undefined,
                        { keepAlive: true }
                    );
                    console.log('[Composer] Message broadcast via Supabase successfully');
                } catch (broadcastError) {
                    console.warn('[Composer] Supabase broadcast failed (message still sent to blockchain):', broadcastError);
                }

                onMessageSent?.(currentText.trim(), optimisticExtraData);
                if (onCancelReply) onCancelReply();

                DeviceEventEmitter.emit(OUTGOING_MESSAGE_EVENT, {
                    conversationId,
                    messageText: currentText.trim(),
                    timestampNanos,
                    chatType,
                    threadPublicKey: counterPartyPublicKey,
                    threadAccessGroupKeyName,
                    userAccessGroupKeyName,
                    extraData: optimisticExtraData // Include extraData for optimistic UI if needed
                });

                setText("");
                setSelectedImages([]);
                focusInput();
            } catch (e) {
                console.error("Send message error", e);
            } finally {
                setSending(false);
                onSendingChange?.(false);
            }
        }
    };

    const handleKeyPress = useCallback((e: any) => {
        if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter') {
            // Cmd+Enter or Ctrl+Enter -> Insert Newline
            if (e.nativeEvent.metaKey || e.nativeEvent.ctrlKey) {
                e.preventDefault();
                const start = selection.start;
                const end = selection.end;
                const newText = currentText.substring(0, start) + '\n' + currentText.substring(end);
                handleTextChange(newText);
                
                // Move cursor forward
                setSelection({ start: start + 1, end: start + 1 });
                return;
            }

            // Plain Enter (no Shift) -> Send
            if (!e.nativeEvent.shiftKey) {
                e.preventDefault();
                handleSendOrSave();
            }
        }
    }, [selection, currentText, handleTextChange, handleSendOrSave]);

    const hasContent = currentText.trim().length > 0 || selectedImages.length > 0;
    const isDisabled = isEditMode
        ? (!currentText.trim() || isSavingEdit)
        : (sending || !hasContent);

    return (
        <View
            style={{
                borderTopWidth: 1,
                borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
                backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
                paddingBottom: bottomInset,
            }}
        >
            {editPreview}
            {replyPreview}

            {/* Selected Images Preview */}
            {selectedImages.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
                    className="border-b border-slate-100 dark:border-slate-800"
                >
                    {selectedImages.map((image, index) => (
                        <View key={`${image.uri}-${index}`} className="mr-2 relative">
                            <Image
                                source={{ uri: image.uri }}
                                style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: 12,
                                    backgroundColor: isDark ? '#1e2738' : '#f1f5f9',
                                    opacity: image.uploadStatus === 'uploading' ? 0.7 : 1
                                }}
                                resizeMode="cover"
                            />

                            {/* Progress Overlay */}
                            {image.uploadStatus === 'uploading' && (
                                <View className="absolute inset-0 items-center justify-center bg-black/35 rounded-xl px-4">
                                    <View
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 22,
                                            borderWidth: 2,
                                            borderColor: 'rgba(59,130,246,0.55)',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'rgba(59,130,246,0.18)',
                                        }}
                                    >
                                        <ActivityIndicator size="small" color="#3b82f6" />
                                    </View>
                                    <View className="w-full h-1.5 bg-white/30 rounded-full mt-3">
                                        <View
                                            style={{
                                                width: `${Math.max(5, Math.min(100, Math.round((image.progress || 0) * 100)))}%`,
                                                height: '100%',
                                                backgroundColor: '#3b82f6',
                                                borderRadius: 999,
                                            }}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Error Overlay */}
                            {image.uploadStatus === 'error' && (
                                <View className="absolute inset-0 items-center justify-center bg-red-500/50 rounded-xl">
                                    <Feather name="alert-circle" size={20} color="#fff" />
                                </View>
                            )}

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

            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    marginHorizontal: 12,
                    marginVertical: 12,
                    justifyContent: 'space-between',
                }}
            >
                {/* Image Picker Button - only show when not editing */}
                {!isEditMode && (
                    <TouchableOpacity
                        onPress={handlePickImages}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ alignSelf: 'center', marginRight: 8 }}
                    >
                        <View
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isDark ? '#1e2738' : '#f1f5f9',
                            }}
                        >
                            <Feather name="plus" size={22} color={isDark ? "#94a3b8" : "#64748b"} />
                        </View>
                    </TouchableOpacity>
                )}

                <View
                    style={{
                        flex: 1,
                        borderRadius: 24,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingLeft: 16,
                        paddingRight: 6,
                        paddingVertical: 6,
                        backgroundColor: isDark ? '#1e2738' : '#f1f5f9',
                    }}
                >
                    <TextInput
                        ref={textInputRef}
                        placeholder={isEditMode ? "Update your message" : (isGroupChat ? "Message the group…" : "Write a message")}
                        placeholderTextColor={isDark ? "#94a3b8" : "#64748b"}
                        value={currentText}
                        onChangeText={handleTextChange}
                        onSelectionChange={handleSelectionChange}
                        selection={selection}
                        onKeyPress={handleKeyPress}
                        multiline
                        keyboardAppearance={isDark ? "dark" : "light"}
                        autoCorrect
                        autoCapitalize="sentences"
                        textAlignVertical="center"
                        returnKeyType="default"
                        blurOnSubmit={false}
                        onContentSizeChange={handleContentSizeChange}
                        style={{
                            flex: 1,
                            fontSize: 16,
                            lineHeight: 20,
                            padding: 0,
                            marginLeft: 0,
                            color: isDark ? '#f8fafc' : '#1e293b',
                            minHeight: 24,
                            maxHeight: 80,
                            paddingVertical: 4,
                            // Remove focus outline on web
                            outlineStyle: 'none',
                        } as any}
                    />
                    <TouchableOpacity
                        onPress={handleSendOrSave}
                        disabled={isDisabled}
                        activeOpacity={0.85}
                        style={{ marginLeft: 8 }}
                    >
                        <View
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: !hasContent
                                    ? (isDark ? '#334155' : '#e2e8f0')
                                    : (isEditMode ? '#f59e0b' : '#0085ff'),
                            }}
                        >
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
        </View >
    );
});
