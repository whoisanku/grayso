import {
    addAccessGroupMembers,
    createAccessGroup,
    encrypt,
    getBulkAccessGroups,
    identity,
    getAllAccessGroupsMemberOnly,
    publicKeyToBase58Check,
    removeAccessGroupMembers,
    waitForTransactionFound,
} from "deso-protocol";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../constants/messaging";
import { encryptAndSendNewMessage } from "./conversations";

export const createGroupChat = async (
    groupName: string,
    memberPublicKeys: string[],
    currentUserPublicKey: string,
    groupImageUrl?: string
): Promise<string | null> => {
    try {
        // 1. Derive Access Group Keys
        const accessGroupKeys = await identity.accessGroupStandardDerivation(
            groupName
        );

        // 2. Create Access Group with optional image
        const extraData: Record<string, string> = {};
        if (groupImageUrl) {
            extraData.groupImage = groupImageUrl;
        }

        await createAccessGroup({
            AccessGroupKeyName: groupName,
            AccessGroupOwnerPublicKeyBase58Check: currentUserPublicKey,
            AccessGroupPublicKeyBase58Check:
                accessGroupKeys.AccessGroupPublicKeyBase58Check,
            MinFeeRateNanosPerKB: 1000,
            ExtraData: Object.keys(extraData).length > 0 ? extraData : undefined,
        });

        const groupMembersArray = Array.from(
            new Set([...memberPublicKeys, currentUserPublicKey])
        );

        // 3. Get Bulk Access Groups to check for missing pairs
        const { AccessGroupEntries, PairsNotFound } = await getBulkAccessGroups({
            GroupOwnerAndGroupKeyNamePairs: groupMembersArray.map((key) => ({
                GroupOwnerPublicKeyBase58Check: key,
                GroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
            })),
        });

        if (PairsNotFound?.length) {
            console.warn("Pairs not found for some members:", PairsNotFound);
            // Proceeding might fail for these members, but we'll try with what we have
            // or we could throw an error. For now, let's proceed with found entries.
        }

        // 4. Encrypt keys for members
        const groupMemberList = await Promise.all(
            AccessGroupEntries.map(async (accessGroupEntry) => {
                return {
                    AccessGroupMemberPublicKeyBase58Check:
                        accessGroupEntry.AccessGroupOwnerPublicKeyBase58Check,
                    AccessGroupMemberKeyName: accessGroupEntry.AccessGroupKeyName,
                    EncryptedKey: await encrypt(
                        accessGroupEntry.AccessGroupPublicKeyBase58Check,
                        accessGroupKeys.AccessGroupPrivateKeyHex
                    ),
                };
            })
        );

        // 5. Add Access Group Members
        await addAccessGroupMembers({
            AccessGroupOwnerPublicKeyBase58Check: currentUserPublicKey,
            AccessGroupKeyName: groupName,
            AccessGroupMemberList: groupMemberList,
            MinFeeRateNanosPerKB: 1000,
        });

        // 6. Send initial message
        const txnHash = await encryptAndSendNewMessage(
            `Hi. This is my first message to "${groupName}"`,
            currentUserPublicKey,
            currentUserPublicKey,
            groupName
        );

        // Wait a bit for the message to be indexed
        await new Promise(resolve => setTimeout(resolve, 2000));

        return `${currentUserPublicKey}${accessGroupKeys.AccessGroupKeyName}`;
    } catch (error) {
        console.error("Error creating group chat:", error);
        throw error;
    }
};

export const addMembersToGroup = async (
    groupName: string,
    memberKeys: string[],
    userPublicKey: string
) => {
    try {
        let accessGroupKeyInfo: {
            AccessGroupPublicKeyBase58Check: string;
            AccessGroupPrivateKeyHex: string;
            AccessGroupKeyName: string;
        };

        // 1. Try to recover the group's private key
        try {
            const resp = await getAllAccessGroupsMemberOnly({
                PublicKeyBase58Check: userPublicKey,
            });

            const encryptedKey = (resp.AccessGroupsMember ?? []).find(
                (accessGroupEntry) =>
                    accessGroupEntry &&
                    accessGroupEntry.AccessGroupOwnerPublicKeyBase58Check ===
                    userPublicKey &&
                    accessGroupEntry.AccessGroupKeyName === groupName &&
                    accessGroupEntry.AccessGroupMemberEntryResponse
            )?.AccessGroupMemberEntryResponse?.EncryptedKey;

            if (encryptedKey) {
                const keys = await identity.decryptAccessGroupKeyPair(encryptedKey);
                const pkBs58Check = await publicKeyToBase58Check(keys.public);

                accessGroupKeyInfo = {
                    AccessGroupPublicKeyBase58Check: pkBs58Check,
                    AccessGroupPrivateKeyHex: keys.seedHex,
                    AccessGroupKeyName: groupName,
                };
            } else {
                // Fallback to standard derivation if no encrypted key found (e.g. legacy groups)
                accessGroupKeyInfo = await identity.accessGroupStandardDerivation(groupName);
            }
        } catch (e) {
            console.warn("Failed to decrypt group key, falling back to derivation", e);
            accessGroupKeyInfo = await identity.accessGroupStandardDerivation(groupName);
        }

        // 2. Get public keys for new members to encrypt the group key for them
        // We need their public keys. The input `memberKeys` are public keys.
        // We need to fetch their AccessGroupPublicKeyBase58Check? 
        // Actually, for `addAccessGroupMembers`, we encrypt the group's private key 
        // using the *member's* public key (or their default access group key).
        // The standard is to encrypt to the member's main public key (AccessGroupOwnerPublicKeyBase58Check)
        // and AccessGroupKeyName (usually default).

        // We need to get the AccessGroupEntry for each member to know their public key to encrypt against.
        // However, if we assume they are just users, we can encrypt to their main key (default group).
        // Let's verify what `getBulkAccessGroups` does.

        const { AccessGroupEntries } = await getBulkAccessGroups({
            GroupOwnerAndGroupKeyNamePairs: memberKeys.map(key => ({
                GroupOwnerPublicKeyBase58Check: key,
                GroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
            }))
        });

        const accessGroupMemberList = await Promise.all(
            AccessGroupEntries.map(async (accessGroupEntry) => {
                return {
                    AccessGroupMemberPublicKeyBase58Check:
                        accessGroupEntry.AccessGroupOwnerPublicKeyBase58Check,
                    AccessGroupMemberKeyName: accessGroupEntry.AccessGroupKeyName,
                    EncryptedKey: await encrypt(
                        accessGroupEntry.AccessGroupPublicKeyBase58Check,
                        accessGroupKeyInfo.AccessGroupPrivateKeyHex
                    ),
                };
            })
        );

        const { submittedTransactionResponse } = await addAccessGroupMembers({
            AccessGroupOwnerPublicKeyBase58Check: userPublicKey,
            AccessGroupKeyName: groupName,
            AccessGroupMemberList: accessGroupMemberList,
            MinFeeRateNanosPerKB: 1000,
        });

        if (!submittedTransactionResponse) {
            throw new Error("Failed to submit transaction to add members to group.");
        }

        return waitForTransactionFound(submittedTransactionResponse.TxnHashHex);

    } catch (error) {
        console.error("Error adding members to group:", error);
        throw error;
    }
};

export const removeMembersFromGroup = async (
    groupName: string,
    memberKeys: string[],
    userPublicKey: string
) => {
    try {
        // 1. Get Bulk Access Groups to ensure we have the correct KeyName (usually default)
        const { AccessGroupEntries } = await getBulkAccessGroups({
            GroupOwnerAndGroupKeyNamePairs: memberKeys.map(key => ({
                GroupOwnerPublicKeyBase58Check: key,
                GroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
            }))
        });

        // 2. Construct the list of members to remove
        const accessGroupMemberList = AccessGroupEntries.map(accessGroupEntry => ({
            AccessGroupMemberPublicKeyBase58Check: accessGroupEntry.AccessGroupOwnerPublicKeyBase58Check,
            AccessGroupMemberKeyName: accessGroupEntry.AccessGroupKeyName,
            EncryptedKey: "", // Not needed for removal
        }));

        const { submittedTransactionResponse } = await removeAccessGroupMembers({
            AccessGroupOwnerPublicKeyBase58Check: userPublicKey,
            AccessGroupKeyName: groupName,
            AccessGroupMemberList: accessGroupMemberList,
            MinFeeRateNanosPerKB: 1000,
        });

        if (!submittedTransactionResponse) {
            throw new Error("Failed to submit transaction to remove members from group.");
        }

        return waitForTransactionFound(submittedTransactionResponse.TxnHashHex);

    } catch (error) {
        console.error("Error removing members from group:", error);
        throw error;
    }
};
