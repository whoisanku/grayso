import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type AuthTransitionReason = "login" | "logout" | "unknown";

type AuthTransitionContextValue = {
  isTransitioning: boolean;
  reason: AuthTransitionReason;
  startAuthTransition: (reason?: AuthTransitionReason) => void;
  endAuthTransition: () => void;
};

const AuthTransitionContext = createContext<AuthTransitionContextValue | null>(null);

export function AuthTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(0);
  const [reason, setReason] = useState<AuthTransitionReason>("unknown");

  const startAuthTransition = useCallback((nextReason: AuthTransitionReason = "unknown") => {
    setCount((c) => c + 1);
    setReason(nextReason);
  }, []);

  const endAuthTransition = useCallback(() => {
    setCount((c) => {
      const next = Math.max(0, c - 1);
      if (next === 0) {
        setReason("unknown");
      }
      return next;
    });
  }, []);

  const value = useMemo<AuthTransitionContextValue>(
    () => ({
      isTransitioning: count > 0,
      reason,
      startAuthTransition,
      endAuthTransition,
    }),
    [count, reason, startAuthTransition, endAuthTransition]
  );

  return (
    <AuthTransitionContext.Provider value={value}>
      {children}
    </AuthTransitionContext.Provider>
  );
}

export function useAuthTransition(): AuthTransitionContextValue {
  const ctx = useContext(AuthTransitionContext);
  if (!ctx) {
    throw new Error("useAuthTransition must be used within AuthTransitionProvider");
  }
  return ctx;
}

