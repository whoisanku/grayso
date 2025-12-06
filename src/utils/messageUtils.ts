import { DecryptedMessageEntryResponse } from "deso-protocol";

/**
 * Get a unique identifier for a message
 */
export function getMessageId(message?: DecryptedMessageEntryResponse | null): string {
    if (!message?.MessageInfo) return "";
    return (
        message.MessageInfo.TimestampNanosString ??
        (message.MessageInfo.TimestampNanos != null
            ? String(message.MessageInfo.TimestampNanos)
            : "")
    );
}

/**
 * Check if a value represents an edited message flag
 */
export function isEditedValue(value: any): boolean {
    return value === true || value === "true" || value === "1";
}

/**
 * Normalize edited messages by applying edits to original messages
 * and filtering out edit messages
 */
export function normalizeEditedMessages(
    messages: DecryptedMessageEntryResponse[]
): DecryptedMessageEntryResponse[] {
    const messageIds = new Set<string>();
    const edits: Record<
        string,
        {
            editedMessage?: string;
            isEdited: boolean;
            timestamp?: number;
        }
    > = {};

    messages.forEach((msg) => {
        const id = getMessageId(msg);
        if (id) {
            messageIds.add(id);
        }

        const extra = msg.MessageInfo?.ExtraData as Record<string, any> | undefined;
        const targetId =
            typeof extra?.editedMessageId === "string"
                ? extra.editedMessageId
                : extra?.editedMessageId != null
                    ? String(extra.editedMessageId)
                    : undefined;

        if (
            targetId &&
            targetId !== id &&
            typeof extra?.editedMessage === "string"
        ) {
            const ts = msg.MessageInfo?.TimestampNanos ?? 0;
            const existing = edits[targetId];
            const editedFlag =
                isEditedValue(extra?.edited) || Boolean(extra?.editedMessage);

            if (!existing || (existing.timestamp ?? 0) < ts) {
                edits[targetId] = {
                    editedMessage: extra.editedMessage,
                    isEdited: editedFlag,
                    timestamp: ts,
                };
            }
        }
    });

    const updatedMessages = messages.map((msg) => {
        const id = getMessageId(msg);
        const edit = id ? edits[id] : undefined;
        if (!edit) return msg;

        const nextExtra = { ...(msg.MessageInfo?.ExtraData || {}) };
        if (edit.isEdited) {
            nextExtra.edited = "true";
        }
        if (edit.editedMessage) {
            nextExtra.editedMessage = edit.editedMessage;
        }

        return {
            ...msg,
            MessageInfo: {
                ...(msg.MessageInfo || {}),
                ExtraData: nextExtra,
            },
        };
    });

    const filteredMessages = updatedMessages.filter((msg) => {
        const extra = msg.MessageInfo?.ExtraData as Record<string, any> | undefined;
        const id = getMessageId(msg);
        const targetId =
            typeof extra?.editedMessageId === "string"
                ? extra.editedMessageId
                : extra?.editedMessageId != null
                    ? String(extra.editedMessageId)
                    : undefined;

        if (targetId && targetId !== id && messageIds.has(targetId)) {
            return false;
        }

        return true;
    });

    return filteredMessages;
}

/**
 * Sort messages in ascending order by timestamp (oldest first)
 */
export function sortMessagesAscending(
    messages: DecryptedMessageEntryResponse[]
): DecryptedMessageEntryResponse[] {
    return [...messages].sort(
        (a, b) =>
            (a.MessageInfo?.TimestampNanos ?? 0) -
            (b.MessageInfo?.TimestampNanos ?? 0)
    );
}

/**
 * Normalize and sort messages (apply edits and sort by timestamp)
 */
export function normalizeAndSortMessages(
    messages: DecryptedMessageEntryResponse[]
): DecryptedMessageEntryResponse[] {
    return sortMessagesAscending(normalizeEditedMessages(messages));
}

/**
 * Get the displayed text for a message (edited text if available, otherwise original)
 */
export function getDisplayedMessageText(
    message?: DecryptedMessageEntryResponse | null
): string | undefined {
    if (!message) return undefined;

    const extraData = message.MessageInfo?.ExtraData as Record<string, any> | undefined;
    const editedText =
        typeof extraData?.editedMessage === "string" ? extraData.editedMessage : undefined;

    const isEdited = isEditedValue(extraData?.edited) || Boolean(editedText);

    if (isEdited && editedText) {
        return editedText;
    }

    return message.DecryptedMessage || undefined;
}

/**
 * Format timestamp for display (e.g., "3:45 PM" or "Dec 3")
 */
export function formatTimestamp(timestampNanos: number): string {
    const date = new Date(Number(timestampNanos) / 1_000_000);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const now = Date.now();
    const diff = now - date.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < oneDay) {
        return date.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

/**
 * Check if two dates are on the same calendar day
 */
export function isSameCalendarDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/**
 * Check if a day divider should be shown between two messages
 */
export function shouldShowDayDivider(
    currentTimestampNanos?: number,
    previousTimestampNanos?: number
): boolean {
    if (!currentTimestampNanos) {
        return false;
    }

    if (!previousTimestampNanos) {
        return true;
    }

    const currentDate = new Date(currentTimestampNanos / 1_000_000);
    const previousDate = new Date(previousTimestampNanos / 1_000_000);

    if (
        Number.isNaN(currentDate.getTime()) ||
        Number.isNaN(previousDate.getTime())
    ) {
        return false;
    }

    return !isSameCalendarDay(currentDate, previousDate);
}

/**
 * Format a day label for display (e.g., "Today", "Yesterday", "Wed, Dec 3")
 */
export function formatDayLabel(timestampNanos?: number): string {
    if (!timestampNanos) {
        return "";
    }

    const date = new Date(timestampNanos / 1_000_000);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (isSameCalendarDay(date, now)) {
        return "Today";
    }

    if (isSameCalendarDay(date, yesterday)) {
        return "Yesterday";
    }

    return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}
