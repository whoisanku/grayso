import { useCallback, useContext, useEffect, useState } from "react";
import { getAllAccessGroups, type AccessGroupEntryResponse } from "deso-protocol";
import { DeSoIdentityContext } from "react-deso-protocol";

type UseMessagingAccessGroupsResult = {
  groups: AccessGroupEntryResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  reload: () => void;
};

export function useMessagingAccessGroups(): UseMessagingAccessGroupsResult {
  const { currentUser } = useContext(DeSoIdentityContext);
  const [groups, setGroups] = useState<AccessGroupEntryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadGroups = useCallback(() => {
    if (!currentUser?.PublicKeyBase58Check) {
      setGroups([]);
      setIsLoaded(true);
      return;
    }

    setIsLoading(true);
    setIsLoaded(false);

    getAllAccessGroups({
      PublicKeyBase58Check: currentUser.PublicKeyBase58Check,
    })
      .then((response) => {
        const owned = response.AccessGroupsOwned ?? [];
        const member = response.AccessGroupsMember ?? [];
        setGroups([...owned, ...member]);
      })
      .catch((error) => {
        console.warn("Failed to load access groups", error);
        setGroups([]);
      })
      .finally(() => {
        setIsLoading(false);
        setIsLoaded(true);
      });
  }, [currentUser?.PublicKeyBase58Check]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return {
    groups,
    isLoading,
    isLoaded,
    reload: loadGroups,
  };
}
