import { useCallback, useContext, useMemo, useState } from "react";
import { identity, type User } from "deso-protocol";
import { DeSoIdentityContext } from "react-deso-protocol";

import { Toast } from "@/components/ui/Toast";
import { queryClient } from "@/state/queryClient";
import {
  formatPublicKey,
  getProfileDisplayName,
  getProfileImageUrl,
} from "@/utils/deso";

type PendingAction =
  | { type: "switch"; publicKey: string }
  | { type: "add" }
  | null;

export type WalletAccount = {
  user: User;
  publicKey: string;
  username: string;
  displayName: string;
  shortPublicKey: string;
  avatarUrl: string;
  isCurrent: boolean;
};

function toWalletAccount(user: User, isCurrent: boolean): WalletAccount {
  const publicKey = user.PublicKeyBase58Check;
  const profile = user.ProfileEntryResponse ?? null;
  const displayName = getProfileDisplayName(profile, publicKey);
  const username = profile?.Username ?? "";

  return {
    user,
    publicKey,
    username,
    displayName,
    shortPublicKey: formatPublicKey(publicKey),
    avatarUrl: getProfileImageUrl(publicKey),
    isCurrent,
  };
}

export function useWalletSwitcher() {
  const { currentUser, alternateUsers } = useContext(DeSoIdentityContext);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const accounts = useMemo<WalletAccount[]>(() => {
    const list: WalletAccount[] = [];
    const seen = new Set<string>();

    if (currentUser?.PublicKeyBase58Check) {
      list.push(toWalletAccount(currentUser, true));
      seen.add(currentUser.PublicKeyBase58Check);
    }

    alternateUsers.forEach((user) => {
      const pk = user.PublicKeyBase58Check;
      if (!pk || seen.has(pk)) return;
      list.push(toWalletAccount(user, false));
      seen.add(pk);
    });

    return list;
  }, [currentUser, alternateUsers]);

  const switchToPublicKey = useCallback(
    async (publicKey: string) => {
      if (!publicKey || pendingAction) return;
      if (publicKey === currentUser?.PublicKeyBase58Check) return;

      try {
        setPendingAction({ type: "switch", publicKey });
        await identity.setActiveUser(publicKey);

        // Clear cached server state to avoid cross-account leakage.
        queryClient.clear();

        const switchedTo = accounts.find((a) => a.publicKey === publicKey);
        Toast.show({
          type: "success",
          text1: "Switched wallet",
          text2: switchedTo?.username
            ? `Signed in as @${switchedTo.username}`
            : `Public key ${formatPublicKey(publicKey)}`,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        Toast.show({
          type: "error",
          text1: "Failed to switch wallet",
          text2: message,
        });
      } finally {
        setPendingAction(null);
      }
    },
    [pendingAction, currentUser, accounts],
  );

  const addWallet = useCallback(async () => {
    if (pendingAction) return;

    try {
      setPendingAction({ type: "add" });
      await identity.login();
      queryClient.clear();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Login cancelled";
      Toast.show({
        type: "error",
        text1: "Unable to add wallet",
        text2: message,
      });
    } finally {
      setPendingAction(null);
    }
  }, [pendingAction]);

  return {
    currentUser,
    accounts,
    pendingAction,
    switchToPublicKey,
    addWallet,
  };
}

