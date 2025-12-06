import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GroupMember } from "../../services/desoGraphql";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../../constants/messaging";
import { fetchGroupMembers, getGroupMembersQueryKey } from "../../state/queries/messages/members";

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
    const [showMembersModal, setShowMembersModal] = useState(false);

    const ownerKey = recipientOwnerKey ?? counterPartyPublicKey;

    const {
        data: groupMembers = initialGroupMembers || [],
        isLoading: loadingMembers,
        refetch: loadGroupMembers
    } = useQuery({
        queryKey: getGroupMembersQueryKey(threadAccessGroupKeyName, ownerKey),
        queryFn: () => fetchGroupMembers(threadAccessGroupKeyName, ownerKey),
        enabled: isGroupChat && !!ownerKey,
        initialData: initialGroupMembers,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return {
        groupMembers,
        loadingMembers,
        showMembersModal,
        setShowMembersModal,
        loadGroupMembers,
    };
};
