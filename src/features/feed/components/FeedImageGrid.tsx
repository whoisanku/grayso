import React from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { ConstrainedMediaFrame } from "@/features/feed/components/ConstrainedMediaFrame";
import { useRemoteAspectRatio } from "@/features/feed/hooks/useRemoteAspectRatio";

const DEFAULT_IMAGE_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const BLUESKY_MIN_ASPECT_RATIO = 1 / 2;
const BLUESKY_SINGLE_IMAGE_MAX_HEIGHT_RATIO = 16 / 9;

function normalizeImageUrls(imageUrls: (string | null | undefined)[]) {
  return imageUrls
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url): url is string => Boolean(url));
}

function MediaImageTile({
  uri,
  aspectRatio = 1,
  flex = false,
  fill = false,
  overlayLabel,
  onPress,
}: {
  uri: string;
  aspectRatio?: number;
  flex?: boolean;
  fill?: boolean;
  overlayLabel?: string;
  onPress?: () => void;
}) {
  const safeUri = toPlatformSafeImageUrl(uri) ?? uri;
  const tileClassName =
    "relative w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700";
  const tileStyle = [
    !fill ? { aspectRatio } : null,
    flex ? { flex: 1 } : null,
    fill ? { flex: 1 } : null,
  ];

  const tileContents = (
    <>
      <Image
        source={{ uri: safeUri }}
        style={{ width: "100%", height: "100%" }}
        className="bg-slate-100 dark:bg-slate-800"
        contentFit="cover"
        placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
        transition={500}
      />

      {overlayLabel ? (
        <View className="absolute inset-0 items-center justify-center bg-black/45">
          <Text className="text-[24px] font-semibold text-white">
            {overlayLabel}
          </Text>
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={tileClassName}
        style={tileStyle}
        accessibilityRole="button"
        accessibilityLabel="Open image fullscreen"
      >
        {tileContents}
      </Pressable>
    );
  }

  return (
    <View className={tileClassName} style={tileStyle}>
      {tileContents}
    </View>
  );
}

function SingleImageTile({
  uri,
  compact,
  onPress,
}: {
  uri: string;
  compact: boolean;
  onPress?: () => void;
}) {
  const { height: viewportHeight } = useWindowDimensions();
  const safeUri = toPlatformSafeImageUrl(uri) ?? uri;
  const measuredAspectRatio = useRemoteAspectRatio(safeUri);
  const maxHeight = compact
    ? Math.min(220, viewportHeight * 0.4)
    : Math.min(420, Math.max(260, viewportHeight * 0.52));

  return (
    <View className="mt-3">
      <ConstrainedMediaFrame
        aspectRatio={compact ? 1 : measuredAspectRatio}
        minAspectRatio={compact ? 1 : BLUESKY_MIN_ASPECT_RATIO}
        maxHeightRatio={compact ? 1 : BLUESKY_SINGLE_IMAGE_MAX_HEIGHT_RATIO}
        maxHeight={maxHeight}
        fullBleed={compact}
      >
        <Pressable
          onPress={onPress}
          className="h-full w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
          accessibilityRole="button"
          accessibilityLabel="Open image fullscreen"
        >
          <Image
            source={{ uri: safeUri }}
            style={{ width: "100%", height: "100%" }}
            className="bg-slate-100 dark:bg-slate-800"
            contentFit="cover"
            placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
            transition={500}
          />
        </Pressable>
      </ConstrainedMediaFrame>
    </View>
  );
}

export function FeedImageGrid({
  imageUrls,
  compact = false,
}: {
  imageUrls: (string | null | undefined)[];
  compact?: boolean;
}) {
  const urls = normalizeImageUrls(imageUrls);
  const safeUrls = urls.map((url) => toPlatformSafeImageUrl(url) ?? url);
  const count = urls.length;
  const [activeImageIndex, setActiveImageIndex] = React.useState<number | null>(
    null,
  );

  if (count === 0) {
    return null;
  }

  const gap = compact ? 4 : 6;
  const closeLightbox = () => setActiveImageIndex(null);
  const activeImageUri =
    activeImageIndex == null ? null : safeUrls[activeImageIndex] ?? null;

  if (count === 1) {
    return (
      <>
        <SingleImageTile
          uri={urls[0]}
          compact={compact}
          onPress={() => setActiveImageIndex(0)}
        />
        <FeedImageLightbox uri={activeImageUri} onClose={closeLightbox} />
      </>
    );
  }

  if (count === 2) {
    return (
      <>
        <View className="mt-3 flex-row" style={{ gap }}>
          <MediaImageTile
            uri={urls[0]}
            aspectRatio={1}
            flex
            onPress={() => setActiveImageIndex(0)}
          />
          <MediaImageTile
            uri={urls[1]}
            aspectRatio={1}
            flex
            onPress={() => setActiveImageIndex(1)}
          />
        </View>
        <FeedImageLightbox uri={activeImageUri} onClose={closeLightbox} />
      </>
    );
  }

  if (count === 3) {
    return (
      <>
        <View className="mt-3 flex-row" style={{ gap }}>
          <MediaImageTile
            uri={urls[0]}
            aspectRatio={1}
            flex
            onPress={() => setActiveImageIndex(0)}
          />

          <View style={{ flex: 1, gap }}>
            <MediaImageTile uri={urls[1]} fill onPress={() => setActiveImageIndex(1)} />
            <MediaImageTile uri={urls[2]} fill onPress={() => setActiveImageIndex(2)} />
          </View>
        </View>
        <FeedImageLightbox uri={activeImageUri} onClose={closeLightbox} />
      </>
    );
  }

  const hiddenCount = count - 4;

  return (
    <>
      <View className="mt-3" style={{ gap }}>
        <View className="flex-row" style={{ gap }}>
          <MediaImageTile
            uri={urls[0]}
            aspectRatio={1.5}
            flex
            onPress={() => setActiveImageIndex(0)}
          />
          <MediaImageTile
            uri={urls[1]}
            aspectRatio={1.5}
            flex
            onPress={() => setActiveImageIndex(1)}
          />
        </View>

        <View className="flex-row" style={{ gap }}>
          <MediaImageTile
            uri={urls[2]}
            aspectRatio={1.5}
            flex
            onPress={() => setActiveImageIndex(2)}
          />
          <MediaImageTile
            uri={urls[3]}
            aspectRatio={1.5}
            flex
            overlayLabel={hiddenCount > 0 ? `+${hiddenCount}` : undefined}
            onPress={() => setActiveImageIndex(3)}
          />
        </View>
      </View>
      <FeedImageLightbox uri={activeImageUri} onClose={closeLightbox} />
    </>
  );
}

function FeedImageLightbox({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={Boolean(uri)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/95">
        <View className="items-end px-4 pt-8">
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
            accessibilityRole="button"
            accessibilityLabel="Close fullscreen image"
          >
            <Text className="text-[22px] text-white">×</Text>
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center px-3 pb-8">
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
              transition={250}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
