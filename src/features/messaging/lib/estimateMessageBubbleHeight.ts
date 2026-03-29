import {
  type DecryptedMessageEntryResponse,
  type PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";

import { MESSAGE_GROUPING_WINDOW_NS } from "@/constants/messaging";
import { shouldShowDayDivider } from "@/utils/messageUtils";
import { getFontTokenDefinition, measureLineCount, prepareText } from "@/lib/textLayout";

function getBubbleGroupingFlags(
  item: DecryptedMessageEntryResponse,
  previousMessage?: DecryptedMessageEntryResponse,
  nextMessage?: DecryptedMessageEntryResponse,
) {
  const timestamp = item.MessageInfo?.TimestampNanos;
  const isNextMessageFromSameSender = nextMessage?.IsSender === item.IsSender;
  const isPreviousMessageFromSameSender = previousMessage?.IsSender === item.IsSender;
  const isNextMessageClose =
    nextMessage && timestamp && nextMessage.MessageInfo?.TimestampNanos
      ? Math.abs(timestamp - nextMessage.MessageInfo.TimestampNanos) < MESSAGE_GROUPING_WINDOW_NS
      : false;
  const isPreviousMessageClose =
    previousMessage && timestamp && previousMessage.MessageInfo?.TimestampNanos
      ? Math.abs(timestamp - previousMessage.MessageInfo.TimestampNanos) < MESSAGE_GROUPING_WINDOW_NS
      : false;

  return {
    isFirstInGroup: !isPreviousMessageFromSameSender || !isPreviousMessageClose,
    isLastInGroup: !isNextMessageFromSameSender || !isNextMessageClose,
  };
}

export function estimateMessageBubbleHeight({
  item,
  previousMessage,
  nextMessage,
  profiles,
  isGroupChat,
  messageIdMap,
  windowWidth,
}: {
  item: DecryptedMessageEntryResponse;
  previousMessage?: DecryptedMessageEntryResponse;
  nextMessage?: DecryptedMessageEntryResponse;
  profiles: PublicKeyToProfileEntryResponseMap;
  isGroupChat: boolean;
  messageIdMap: Map<string, DecryptedMessageEntryResponse>;
  windowWidth: number;
}) {
  const extraData = item.MessageInfo?.ExtraData || {};
  const editedMessageText =
    typeof (extraData as { editedMessage?: unknown }).editedMessage === "string"
      ? String((extraData as { editedMessage?: string }).editedMessage)
      : undefined;
  const baseMessageText = item.DecryptedMessage || "";
  const messageText = editedMessageText || baseMessageText;
  const normalizedMessageText = messageText.trim();
  const imageUrls =
    typeof extraData.decryptedImageURLs === "string"
      ? extraData.decryptedImageURLs.split(",").filter(Boolean)
      : [];
  const videoUrls =
    typeof extraData.decryptedVideoURLs === "string"
      ? extraData.decryptedVideoURLs.split(",").filter(Boolean)
      : [];
  const hasMedia = imageUrls.length > 0 || videoUrls.length > 0;
  const isMediaOnly = hasMedia && !normalizedMessageText;
  const { isFirstInGroup, isLastInGroup } = getBubbleGroupingFlags(
    item,
    previousMessage,
    nextMessage,
  );

  const maxBubbleWidth = Math.max(240, Math.min(windowWidth * 0.75, 360));
  const innerTextWidth = Math.max(120, maxBubbleWidth - 28);
  const messageFont = getFontTokenDefinition("messageBubble");
  const lineCount = normalizedMessageText
    ? measureLineCount(
        prepareText(normalizedMessageText, messageFont.font),
        innerTextWidth,
        messageFont.lineHeight,
      )
    : 0;

  let estimatedHeight = isLastInGroup ? 12 : 2;

  if (shouldShowDayDivider(item.MessageInfo?.TimestampNanos, previousMessage?.MessageInfo?.TimestampNanos)) {
    estimatedHeight += 62;
  }

  if (isMediaOnly) {
    estimatedHeight += 190;
  } else {
    estimatedHeight += 20 + lineCount * messageFont.lineHeight;
  }

  if (hasMedia && !isMediaOnly) {
    estimatedHeight += 136;
  }

  const repliedToMessageId = item.MessageInfo?.ExtraData?.RepliedToMessageId;
  if (repliedToMessageId && messageIdMap.get(repliedToMessageId)) {
    estimatedHeight += 48;
  } else if (repliedToMessageId) {
    estimatedHeight += 40;
  }

  const senderPk = item.SenderInfo?.OwnerPublicKeyBase58Check ?? "";
  if (isGroupChat && !item.IsSender && isFirstInGroup && profiles[senderPk]) {
    estimatedHeight += 18;
  }

  return Math.max(estimatedHeight, 68);
}
