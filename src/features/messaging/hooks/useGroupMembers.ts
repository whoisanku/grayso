import { useState, useCallback, useMemo, useEffect } from "react";
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

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

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
    staleTime: 1000 * 30, // 30 seconds - reduced to ensure fresh data
  });

  const safeGroupMembers = useMemo(() => {
    const result = Array.isArray(groupMembers) 
      ? groupMembers 
      : Array.isArray(initialGroupMembers) 
        ? initialGroupMembers 
        : [];
    
    devLog("[useGroupMembers] Current member count:", result.length);
    return result;
  }, [groupMembers, initialGroupMembers]);

  // Force refetch when modal opens to ensure fresh data
  useEffect(() => {
    if (showMembersModal && isGroupChat && ownerKey) {
      devLog("[useGroupMembers] Modal opened - forcing refetch");
      loadGroupMembers();
    }
  }, [showMembersModal, isGroupChat, ownerKey, loadGroupMembers]);

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
