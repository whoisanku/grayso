import { fetchAccessGroupMembers } from "../../../services/desoGraphql";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../../../constants/messaging";

export const getGroupMembersQueryKey = (
  accessGroupKeyName: string,
  ownerPublicKey: string
) => ["groupMembers", accessGroupKeyName, ownerPublicKey] as const;

export const fetchGroupMembers = async (
  accessGroupKeyName: string = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  ownerPublicKey: string
) => {
  const { members } = await fetchAccessGroupMembers({
    accessGroupKeyName,
    accessGroupOwnerPublicKey: ownerPublicKey,
  });
  return members;
};
