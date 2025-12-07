import {
    addAccessGroupMembers,
    createAccessGroup,
    encrypt,
    getBulkAccessGroups,
    identity,
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
