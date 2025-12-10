import { useState, useCallback, useRef } from "react";
import {
  DecryptedMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import {
  getDisplayedMessageText,
  getMessageId,
  normalizeAndSortMessages,
} from "@/utils/messageUtils";
import { encryptAndSendNewMessage } from "@/features/messaging/api/conversations";

type UseMessageActionsProps = {
  userPublicKey: string;
  counterPartyPublicKey: string;
  threadAccessGroupKeyName: string;
  userAccessGroupKeyName: string;
  recipientInfo?: any;
  setMessages: React.Dispatch<
    React.SetStateAction<DecryptedMessageEntryResponse[]>
  >;
};

export const useMessageActions = ({
  userPublicKey,
  counterPartyPublicKey,
  threadAccessGroupKeyName,
  userAccessGroupKeyName,
  recipientInfo,
  setMessages,
}: UseMessageActionsProps) => {
  const [replyToMessage, setReplyToMessage] =
    useState<DecryptedMessageEntryResponse | null>(null);
  const [selectedMessage, setSelectedMessage] =
    useState<DecryptedMessageEntryResponse | null>(null);
  const [editingMessage, setEditingMessage] =
    useState<DecryptedMessageEntryResponse | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedBubbleLayout, setSelectedBubbleLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const bubbleLayoutsRef = useRef<
    Map<string, { x: number; y: number; width: number; height: number }>
  >(new Map());

  // Reanimated shared values for modal animations
  const actionSheetAnim = useSharedValue(0);
  const backdropAnim = useSharedValue(0);
  const blurAnim = useSharedValue(0); // For blur backdrop

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropAnim.value,
  }));

  const actionSheetStyle = useAnimatedStyle(() => ({
    opacity: actionSheetAnim.value,
    transform: [
      { translateY: interpolate(actionSheetAnim.value, [0, 1], [20, 0]) },
      { scale: interpolate(actionSheetAnim.value, [0, 1], [0.96, 1]) },
    ],
  }));

  const bubblePreviewStyle = useAnimatedStyle(() => ({
    // Keep bubble visible; only add a subtle settle effect
    opacity: 1,
    transform: [
      { translateY: interpolate(actionSheetAnim.value, [0, 1], [0, 2]) },
      { scale: interpolate(actionSheetAnim.value, [0, 1], [1, 0.99]) },
    ],
  }));

  const handleReply = useCallback((message: DecryptedMessageEntryResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyToMessage(message);
  }, []);

  const animateOpenActions = useCallback(() => {
    backdropAnim.value = withTiming(1, { duration: 200 });
    blurAnim.value = withTiming(1, { duration: 250 }); // Blur fade-in
    actionSheetAnim.value = withSpring(1, {
      damping: 15,
      stiffness: 200,
      mass: 0.8,
    });
  }, []);

  const animateCloseActions = useCallback((onFinished?: () => void) => {
    backdropAnim.value = withTiming(0, { duration: 150 });
    blurAnim.value = withTiming(0, { duration: 150 }); // Blur fade-out
    actionSheetAnim.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished && onFinished) {
        runOnJS(onFinished)();
      }
    });
  }, []);

  const handleMessageLongPress = useCallback(
    (
      message: DecryptedMessageEntryResponse,
      layout?: { x: number; y: number; width: number; height: number }
    ) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);

      const messageId = getMessageId(message);
      let bubbleLayout = layout;

      if (!bubbleLayout && messageId) {
        bubbleLayout = bubbleLayoutsRef.current.get(messageId) || undefined;
      }

      // Fallback layout if missing
      const finalLayout = bubbleLayout || { x: 0, y: 0, width: 0, height: 0 };

      setSelectedMessage(message);
      setSelectedBubbleLayout(finalLayout);

      requestAnimationFrame(() => {
        animateOpenActions();
      });
    },
    [animateOpenActions]
  );

  const handleCloseMessageActions = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateCloseActions(() => {
      setSelectedMessage(null);
      setSelectedBubbleLayout(null);
    });
  }, [animateCloseActions]);

  const handleActionReply = useCallback(() => {
    if (!selectedMessage) return;
    handleReply(selectedMessage);
    handleCloseMessageActions();
  }, [selectedMessage, handleReply, handleCloseMessageActions]);

  const handleActionCopy = useCallback(async () => {
    if (!selectedMessage) return;
    const text = getDisplayedMessageText(selectedMessage) || "";
    if (!text.trim()) return;
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleCloseMessageActions();
  }, [selectedMessage, handleCloseMessageActions]);

  const startEditingMessage = useCallback(
    (message?: DecryptedMessageEntryResponse | null) => {
      const target = message ?? selectedMessage;
      if (!target || !target.IsSender) return;
      if (!getMessageId(target)) return;
      const draft =
        getDisplayedMessageText(target) || target.DecryptedMessage || "";
      setEditDraft(draft);
      setEditingMessage(target);
      handleCloseMessageActions();
    },
    [selectedMessage, handleCloseMessageActions]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditDraft("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage) return;

    const trimmed = editDraft.trim();
    const messageId = getMessageId(editingMessage);
    if (!trimmed || !messageId) {
      return;
    }

    const currentText = getDisplayedMessageText(editingMessage)?.trim() || "";
    if (trimmed === currentText) {
      handleCancelEdit();
      return;
    }

    try {
      setIsSavingEdit(true);
      const extraData = {
        edited: "true",
        editedMessage: trimmed,
        editedMessageId: messageId,
      };

      await encryptAndSendNewMessage(
        trimmed,
        userPublicKey,
        counterPartyPublicKey,
        threadAccessGroupKeyName,
        userAccessGroupKeyName,
        recipientInfo?.AccessGroupPublicKeyBase58Check,
        extraData
      );

      setMessages((prev) =>
        normalizeAndSortMessages(
          prev.map((msg) => {
            const id = getMessageId(msg);
            if (id !== messageId) return msg;

            const nextExtraData = {
              ...(msg.MessageInfo?.ExtraData || {}),
              ...extraData,
            };

            return {
              ...msg,
              MessageInfo: {
                ...(msg.MessageInfo || {}),
                ExtraData: nextExtraData,
              },
            } as DecryptedMessageEntryResponse;
          })
        )
      );
      handleCancelEdit();
    } catch (error) {
      console.error("[useMessageActions] Failed to edit message", error);
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    counterPartyPublicKey,
    editDraft,
    editingMessage,
    handleCancelEdit,
    threadAccessGroupKeyName,
    userAccessGroupKeyName,
    userPublicKey,
    recipientInfo?.AccessGroupPublicKeyBase58Check,
    setMessages,
  ]);

  return {
    replyToMessage,
    setReplyToMessage,
    selectedMessage,
    setSelectedMessage,
    editingMessage,
    setEditingMessage,
    editDraft,
    setEditDraft,
    isSavingEdit,
    selectedBubbleLayout,
    setSelectedBubbleLayout,
    bubbleLayoutsRef,
    blurAnim, // Export blur animation shared value
    backdropStyle,
    actionSheetStyle,
    bubblePreviewStyle,
    handleReply,
    handleMessageLongPress,
    handleCloseMessageActions,
    handleActionReply,
    handleActionCopy,
    startEditingMessage,
    handleCancelEdit,
    handleSaveEdit,
  };
};
