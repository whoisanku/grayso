import { useCallback, useContext } from "react";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { StorageService } from "@/lib/storage";

export type ThreadMailbox = "inbox" | "spam";
export type ThreadSettingsMap = Record<string, ThreadMailbox>;

export const threadSettingsKeys = {
  all: (userPublicKey?: string) => ["threadSettings", userPublicKey] as const,
};

function coerceThreadSettingsMap(value: unknown): ThreadSettingsMap {
  if (!value || typeof value !== "object") {
    return {};
  }

  const output: ThreadSettingsMap = {};
  for (const [threadId, mailbox] of Object.entries(value as Record<string, unknown>)) {
    if (!threadId) continue;
    if (mailbox === "inbox" || mailbox === "spam") {
      output[threadId] = mailbox;
    }
  }
  return output;
}

export function useThreadSettings() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const userPublicKey = currentUser?.PublicKeyBase58Check;
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: threadSettingsKeys.all(userPublicKey),
    enabled: Boolean(userPublicKey),
    staleTime: Infinity,
    queryFn: async () => {
      if (!userPublicKey) return {};
      const cached = await StorageService.getThreadSettings(userPublicKey);
      return coerceThreadSettingsMap(cached);
    },
  });

  const settings = (data ?? {}) as ThreadSettingsMap;

  const setThreadMailbox = useCallback(
    async (threadIdentifier: string, mailbox: ThreadMailbox | null) => {
      if (!userPublicKey || !threadIdentifier) {
        return;
      }

      queryClient.setQueryData(threadSettingsKeys.all(userPublicKey), (prev) => {
        const next = { ...coerceThreadSettingsMap(prev) };
        if (mailbox) {
          next[threadIdentifier] = mailbox;
        } else {
          delete next[threadIdentifier];
        }
        return next;
      });

      const nextSettings = coerceThreadSettingsMap(
        queryClient.getQueryData(threadSettingsKeys.all(userPublicKey))
      );
      await StorageService.saveThreadSettings(userPublicKey, nextSettings);
    },
    [queryClient, userPublicKey]
  );

  return {
    settings,
    setThreadMailbox,
  };
}

