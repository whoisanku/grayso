import { useCallback, useRef, useState } from "react";

type RefreshHandler = () => Promise<unknown>;

export function useManualRefresh(refreshHandler: RefreshHandler) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInFlightRef = useRef(false);

  const onRefresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    setIsRefreshing(true);

    try {
      await refreshHandler();
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [refreshHandler]);

  return {
    isRefreshing,
    onRefresh,
  };
}
