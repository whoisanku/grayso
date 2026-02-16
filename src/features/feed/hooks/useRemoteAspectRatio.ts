import { useEffect, useMemo, useState } from "react";
import { Image as NativeImage } from "react-native";

import { toPlatformSafeImageUrl } from "@/lib/mediaUrl";

const aspectRatioCache = new Map<string, number>();

function normalizeUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return toPlatformSafeImageUrl(trimmed) ?? trimmed;
}

export function useRemoteAspectRatio(
  value: string | null | undefined,
): number | null {
  const uri = useMemo(() => normalizeUrl(value), [value]);
  const [resolved, setResolved] = useState<{
    uri: string;
    aspectRatio: number;
  } | null>(null);

  const cachedAspectRatio = useMemo(() => {
    if (!uri) {
      return null;
    }

    return aspectRatioCache.get(uri) ?? null;
  }, [uri]);

  const aspectRatio = useMemo(() => {
    if (!uri) {
      return null;
    }

    if (resolved?.uri === uri) {
      return resolved.aspectRatio;
    }

    return cachedAspectRatio;
  }, [cachedAspectRatio, resolved, uri]);

  useEffect(() => {
    if (!uri || cachedAspectRatio) {
      return;
    }

    let isCancelled = false;

    NativeImage.getSize(
      uri,
      (width, height) => {
        if (isCancelled || width <= 0 || height <= 0) {
          return;
        }

        const nextRatio = width / height;
        if (!Number.isFinite(nextRatio) || nextRatio <= 0) {
          return;
        }

        aspectRatioCache.set(uri, nextRatio);
        setResolved({ uri, aspectRatio: nextRatio });
      },
      () => {},
    );

    return () => {
      isCancelled = true;
    };
  }, [cachedAspectRatio, uri]);

  return aspectRatio;
}
