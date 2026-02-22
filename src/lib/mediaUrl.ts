import { Platform } from "react-native";

export function getValidHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function toPlatformSafeImageUrl(
  value: string | null | undefined,
): string | null {
  const url = getValidHttpUrl(value);
  if (!url) return null;

  if (Platform.OS === "web") {
    return url;
  }

  // Some iOS builds fail to decode remote .webp images reliably. Convert to jpeg via proxy.
  if (/\.webp(?:$|\?)/i.test(url)) {
    const normalized = url.replace(/^https?:\/\//i, "");
    return `https://images.weserv.nl/?url=${encodeURIComponent(normalized)}&output=jpg`;
  }

  return url;
}

// ---------------------------------------------------------------------------
// Video helpers
// ---------------------------------------------------------------------------

export type NormalizedVideoSource = {
  /** Original URL suitable for a web <iframe>. */
  iframeUrl?: string;
  /** Direct-playable URL (HLS .m3u8 on native, or the raw URL on web). */
  playableUrl: string;
  /** Whether the playable URL is an HLS manifest. */
  isHls: boolean;
  /** Optional poster / thumbnail. */
  posterUrl?: string;
  /** Livepeer playback ID for resolution. */
  playbackId?: string;
};

function trimSlashes(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function getSinglePathSegment(pathname: string): string | null {
  const clean = trimSlashes(pathname);
  if (!clean || clean.includes("/")) return null;
  return clean;
}

function getLikelyVideoId(pathname: string): string | null {
  const segments = trimSlashes(pathname)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (/^[A-Za-z0-9_-]{8,}$/.test(segment)) {
      return segment;
    }
  }

  return null;
}

function buildCloudflarePosterUrl(videoId: string): string {
  return `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg?time=1s`;
}

function buildLivepeerPosterUrl(playbackId: string): string {
  return `https://livepeercdn.studio/asset/${playbackId}/video/thumbnail.png`;
}

export function buildWebIframeUrl(
  rawUrl: string,
  options: {
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
  } = {},
): string {
  try {
    const parsed = new URL(rawUrl);

    if (options.autoplay !== false && !parsed.searchParams.has("autoplay")) {
      parsed.searchParams.set("autoplay", "true");
    }
    if (options.muted !== false && !parsed.searchParams.has("muted")) {
      parsed.searchParams.set("muted", "true");
    }
    if (options.loop !== false && !parsed.searchParams.has("loop")) {
      parsed.searchParams.set("loop", "true");
    }
    if (options.controls !== false && !parsed.searchParams.has("controls")) {
      parsed.searchParams.set("controls", "true");
    }

    return parsed.toString();
  } catch {
    const connector = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${connector}autoplay=true&muted=true&loop=true&controls=true`;
  }
}

/**
 * Resolve a raw video URL into a form that each platform can play:
 *  – Web: returns iframe or HTML5 <video> URLs as-is.
 *  – Native: converts to an HLS .m3u8 manifest URL that AVPlayer can stream.
 *
 * Handles:
 *  1. Cloudflare Stream – `iframe.videodelivery.net`, `videodelivery.net`,
 *     `*.cloudflarestream.com`
 *  2. Livepeer – `lvpr.tv?v=<playbackId>`
 *  3. Direct `.m3u8` / `.mp4` links
 */
export function normalizeVideoSource(rawUrl: string): NormalizedVideoSource {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();

    // ── Livepeer ─────────────────────────────────────────────────────────
    if (hostname === "lvpr.tv") {
      const playbackId = parsed.searchParams.get("v")?.trim();
      if (playbackId) {
        return {
          iframeUrl: rawUrl,
          playableUrl: rawUrl, // Placeholder, will be resolved
          isHls: false,
          playbackId,
          posterUrl: buildLivepeerPosterUrl(playbackId),
        };
      }

      return { iframeUrl: rawUrl, playableUrl: rawUrl, isHls: false };
    }

    // ── Cloudflare: iframe.videodelivery.net ──────────────────────────────
    if (hostname === "iframe.videodelivery.net") {
      const videoId =
        getSinglePathSegment(parsed.pathname) ??
        getLikelyVideoId(parsed.pathname);
      if (videoId) {
        return {
          iframeUrl: rawUrl,
          playableUrl: `https://videodelivery.net/${videoId}/manifest/video.m3u8`,
          isHls: true,
          posterUrl: buildCloudflarePosterUrl(videoId),
        };
      }

      return { iframeUrl: rawUrl, playableUrl: rawUrl, isHls: false };
    }

    // ── Cloudflare: videodelivery.net ─────────────────────────────────────
    if (hostname === "videodelivery.net") {
      const cleanPath = trimSlashes(parsed.pathname);
      const videoId =
        cleanPath.split("/")[0]?.trim() || getLikelyVideoId(parsed.pathname);

      if (videoId) {
        return {
          iframeUrl: `https://iframe.videodelivery.net/${videoId}`,
          playableUrl: `https://videodelivery.net/${videoId}/manifest/video.m3u8`,
          isHls: true,
          posterUrl: buildCloudflarePosterUrl(videoId),
        };
      }
    }

    // ── Cloudflare: *.cloudflarestream.com ────────────────────────────────
    if (hostname.includes("cloudflarestream.com")) {
      // Already an HLS manifest?
      if (rawUrl.includes(".m3u8")) {
        return { playableUrl: rawUrl, isHls: true };
      }

      // Try to extract an ID and build the manifest URL
      const pathParts = trimSlashes(parsed.pathname).split("/");
      const videoId = pathParts[0];
      if (videoId && /^[A-Za-z0-9_-]{8,}$/.test(videoId)) {
        return {
          playableUrl: `https://${hostname}/${videoId}/manifest/video.m3u8`,
          isHls: true,
          posterUrl: buildCloudflarePosterUrl(videoId),
        };
      }
    }
    // ── YouTube ────────────────────────────────────────────────────────
    if (hostname.includes("youtube.com") || hostname === "youtu.be") {
      let videoId = "";
      if (hostname === "youtu.be") {
        videoId = trimSlashes(parsed.pathname);
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }

      if (videoId) {
        return {
          iframeUrl: `https://www.youtube.com/embed/${videoId}`,
          playableUrl: `https://www.youtube.com/watch?v=${videoId}`,
          isHls: false,
          posterUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    }
  } catch {
    // Fall through to raw URL playback.
  }

  // ── Fallback: direct URL ───────────────────────────────────────────────
  const isHls = rawUrl.includes(".m3u8");
  return { playableUrl: rawUrl, isHls };
}

export async function resolveLivepeerPlayback(
  playbackId: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://livepeer.com/api/playback/${playbackId}`,
    );
    if (!response.ok) return null;
    const data = await response.json();

    // Prioritize HLS
    const hlsSource = data?.meta?.source?.find(
      (s: any) =>
        s.type?.includes("application/vnd.apple.mpegurl") ||
        s.url?.includes(".m3u8"),
    );
    if (hlsSource?.url) return hlsSource.url;

    // Fallback to MP4
    const mp4Source = data?.meta?.source?.find(
      (s: any) => s.type?.includes("video/mp4") || s.url?.includes(".mp4"),
    );
    if (mp4Source?.url) return mp4Source.url;
  } catch {
    // ignore
  }
  return null;
}
