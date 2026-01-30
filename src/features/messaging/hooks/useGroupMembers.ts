import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { getPaginatedAccessGroupMembers } from "deso-protocol";

import { GroupMember } from "@/lib/deso/graphql";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "@/constants/messaging";

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
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(
    Array.isArray(initialGroupMembers) ? initialGroupMembers : []
  );
  const hasLoadedMembersRef = useRef(
    Array.isArray(initialGroupMembers) && initialGroupMembers.length > 0
  );

  const ownerKey = recipientOwnerKey ?? counterPartyPublicKey;
  const isOwner = userPublicKey === ownerKey;

  useEffect(() => {
    if (
      Array.isArray(initialGroupMembers) &&
      initialGroupMembers.length > 0 &&
      !hasLoadedMembersRef.current
    ) {
      setGroupMembers(initialGroupMembers);
      hasLoadedMembersRef.current = true;
    }
  }, [initialGroupMembers]);

  const loadGroupMembers = useCallback(
    async (options?: { force?: boolean }) => {
      if (!isGroupChat || !ownerKey || !threadAccessGroupKeyName) {
        return;
      }

      if (loadingMembers) {
        return;
      }

      if (hasLoadedMembersRef.current && !options?.force) {
        return;
      }

      setLoadingMembers(true);
      try {
        const response = await getPaginatedAccessGroupMembers({
          AccessGroupOwnerPublicKeyBase58Check: ownerKey,
          AccessGroupKeyName: threadAccessGroupKeyName,
          MaxMembersToFetch: 200,
        });

        const profileMap = response.PublicKeyToProfileEntryResponse ?? {};
        const members = (response.AccessGroupMembersBase58Check ?? []).map(
          (publicKey) => {
            const profile = profileMap[publicKey] ?? null;
            return {
              publicKey,
              username: profile?.Username ?? undefined,
              profilePic:
                profile?.ExtraData?.LargeProfilePicURL ??
                undefined,
            };
          }
        );

        setGroupMembers(members);
        hasLoadedMembersRef.current = true;
      } catch (error) {
        console.error("[useGroupMembers] Failed to load members:", error);
      } finally {
        setLoadingMembers(false);
      }
    },
    [
      isGroupChat,
      ownerKey,
      threadAccessGroupKeyName,
      loadingMembers,
    ]
  );

  const safeGroupMembers = useMemo(
    () =>
      Array.isArray(groupMembers)
        ? groupMembers
        : Array.isArray(initialGroupMembers)
          ? initialGroupMembers
          : [],
    [groupMembers, initialGroupMembers]
  );

  // Force refetch when modal opens to ensure fresh data
  useEffect(() => {
    if (showMembersModal && isGroupChat && ownerKey) {
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
        await loadGroupMembers({ force: true });
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
        await loadGroupMembers({ force: true });
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
