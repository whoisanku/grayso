import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GroupMember } from "@/lib/deso/graphql";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "@/constants/messaging";
import {
  fetchGroupMembers,
  getGroupMembersQueryKey,
} from "@/state/queries/messages/members";
import {
  addMembersToGroup,
  removeMembersFromGroup,
} from "@/features/messaging/api/groupChat";

type UseGroupMembersProps = {
  isGroupChat: boolean;
  threadAccessGroupKeyName?: string;
  recipientOwnerKey?: string;
  counterPartyPublicKey: string;
  initialGroupMembers?: GroupMember[];
  userPublicKey?: string; // Added userPublicKey to check ownership
};

export const useGroupMembers = ({
  isGroupChat,
  threadAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  recipientOwnerKey,
  counterPartyPublicKey,
  initialGroupMembers,
  userPublicKey,
}: UseGroupMembersProps) => {
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [addingMemberKey, setAddingMemberKey] = useState<string | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const ownerKey = recipientOwnerKey ?? counterPartyPublicKey;
  const isOwner = userPublicKey === ownerKey;

  const {
    data: groupMembers = initialGroupMembers || [],
    isLoading: loadingMembers,
    refetch: loadGroupMembers,
  } = useQuery({
    queryKey: getGroupMembersQueryKey(threadAccessGroupKeyName, ownerKey),
    queryFn: () => fetchGroupMembers(threadAccessGroupKeyName, ownerKey),
    enabled: isGroupChat && !!ownerKey,
    initialData: initialGroupMembers,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const safeGroupMembers = useMemo(() => {
    if (Array.isArray(groupMembers)) return groupMembers;
    if (Array.isArray(initialGroupMembers)) return initialGroupMembers;
    return [];
  }, [groupMembers, initialGroupMembers]);

  const addMembers = useCallback(
    async (memberKeys: string[]) => {
      if (!userPublicKey || !threadAccessGroupKeyName) return;
      // We only support adding one at a time in the UI for now, so taking the first one
      const keyToAdd = memberKeys[0];
      if (keyToAdd) setAddingMemberKey(keyToAdd);

      try {
        await addMembersToGroup(
          threadAccessGroupKeyName,
          memberKeys,
          userPublicKey
        );
        await loadGroupMembers();
      } catch (error) {
        console.error("Failed to add members:", error);
        throw error;
      } finally {
        setAddingMemberKey(null);
      }
    },
    [userPublicKey, threadAccessGroupKeyName, loadGroupMembers]
  );

  const removeMembers = useCallback(
    async (memberKeys: string[]) => {
      if (!userPublicKey || !threadAccessGroupKeyName) return;
      setIsRemovingMember(true);
      try {
        await removeMembersFromGroup(
          threadAccessGroupKeyName,
          memberKeys,
          userPublicKey
        );
        await loadGroupMembers();
      } catch (error) {
        console.error("Failed to remove members:", error);
        throw error;
      } finally {
        setIsRemovingMember(false);
      }
    },
    [userPublicKey, threadAccessGroupKeyName, loadGroupMembers]
  );

  return {
    groupMembers: safeGroupMembers,
    loadingMembers,
    showMembersModal,
    setShowMembersModal,
    loadGroupMembers,
    addMembers,
    removeMembers,
    addingMemberKey,
    isRemovingMember,
    isOwner,
  };
};
