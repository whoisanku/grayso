import { useState, useCallback, useEffect } from "react";
import { ChatType } from "deso-protocol";
import { fetchAccessGroupMembers, GroupMember } from "../services/desoGraphql";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../constants/messaging";

type UseGroupMembersProps = {
    isGroupChat: boolean;
    threadAccessGroupKeyName?: string;
    recipientOwnerKey?: string;
    counterPartyPublicKey: string;
    initialGroupMembers?: GroupMember[];
};

export const useGroupMembers = ({
    isGroupChat,
    threadAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
    recipientOwnerKey,
    counterPartyPublicKey,
    initialGroupMembers,
}: UseGroupMembersProps) => {
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [groupMembers, setGroupMembers] = useState<GroupMember[]>(
        initialGroupMembers || []
    );
    const [showMembersModal, setShowMembersModal] = useState(false);

    const loadGroupMembers = useCallback(async () => {
        if (!isGroupChat || loadingMembers) return;

        setLoadingMembers(true);
        try {
            const { members } = await fetchAccessGroupMembers({
                accessGroupKeyName: threadAccessGroupKeyName,
                accessGroupOwnerPublicKey: recipientOwnerKey ?? counterPartyPublicKey,
            });
            setGroupMembers(members);
        } catch (error) {
            console.error("[useGroupMembers] Failed to fetch group members", error);
        } finally {
            setLoadingMembers(false);
        }
    }, [
        isGroupChat,
        loadingMembers,
        threadAccessGroupKeyName,
        recipientOwnerKey,
        counterPartyPublicKey,
    ]);

    useEffect(() => {
        if (isGroupChat && groupMembers.length === 0) {
            loadGroupMembers();
        }
    }, [
        isGroupChat,
        threadAccessGroupKeyName,
        recipientOwnerKey,
        counterPartyPublicKey,
        groupMembers.length,
        loadGroupMembers,
    ]);

    return {
        groupMembers,
        loadingMembers,
        showMembersModal,
        setShowMembersModal,
        loadGroupMembers,
    };
};
