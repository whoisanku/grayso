import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { DeSoIdentityContext } from "react-deso-protocol";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { type FocusFeedPost } from "@/lib/focus/graphql";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { getBorderColor } from "@/theme/borders";
import { getProfileImageUrl } from "@/utils/deso";
import {
  getValidHttpUrl,
  normalizeVideoSource,
  toPlatformSafeImageUrl,
} from "@/lib/mediaUrl";
import { useMobileWebKeyboardInset } from "@/lib/keyboard/useMobileWebKeyboardInset";
import { Toast } from "@/components/ui/Toast";
import CircularProgressIndicator from "@/components/CircularProgressIndicator";
import {
  MAX_COMMENT_LENGTH,
  useSubmitComment,
} from "@/features/feed/api/useSubmitComment";
import { uploadImage } from "@/lib/media";
import { UserAvatar } from "@/components/UserAvatar";
import { parseRichTextContent } from "@/lib/richText";

const DEFAULT_IMAGE_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const MOBILE_KEYBOARD_BAR_GAP = 8;
const MOBILE_COMPOSER_FOOTER_PADDING_BOTTOM = 96;

type FeedCommentModalProps = {
  visible: boolean;
  post: FocusFeedPost | null;
  onClose: () => void;
  onSubmitted?: () => void | Promise<void>;
};

type ReplyTargetPreviewMedia = {
  kind: "image" | "video";
  thumbnailUri?: string;
};

function normalizeDisplayName(rawValue: unknown, username: string): string {
  if (typeof rawValue !== "string") {
    return username;
  }

  const normalized = rawValue
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized === "@") {
    return username;
  }

  const lower = normalized.toLowerCase();
  if (lower === "null" || lower === "undefined") {
    return username;
  }

  return normalized;
}

function getReplyTarget(post: FocusFeedPost | null) {
  const rawPostBody = post?.body?.trim() || "";
  const isPureRepost = Boolean(post?.repostedPost?.postHash && !rawPostBody);
  const sourcePost = isPureRepost ? post?.repostedPost ?? null : post;
  const sourcePoster = sourcePost?.poster ?? post?.poster ?? null;

  const username = sourcePoster?.username?.trim() || "unknown";
  const rawDisplayName = sourcePoster?.extraData?.DisplayName ?? null;
  const displayName = normalizeDisplayName(rawDisplayName, username);

  const largeProfilePic = getValidHttpUrl(sourcePoster?.extraData?.LargeProfilePicURL);
  const generatedProfilePic = sourcePoster?.publicKey
    ? getValidHttpUrl(getProfileImageUrl(sourcePoster.publicKey))
    : null;
  const avatarUriRaw = largeProfilePic ?? generatedProfilePic ?? null;
  const avatarUri = avatarUriRaw ? (toPlatformSafeImageUrl(avatarUriRaw) ?? avatarUriRaw) : null;
  const parsedSourceContent = parseRichTextContent({
    body: sourcePost?.body ?? post?.body,
    imageUrls: sourcePost?.imageUrls ?? post?.imageUrls,
  });
  const previewText = parsedSourceContent.text || "This post has no text.";

  const imagePreview = parsedSourceContent.imageUrls[0] ?? null;
  const safeImagePreview = imagePreview
    ? (toPlatformSafeImageUrl(imagePreview) ?? imagePreview)
    : null;

  let mediaPreview: ReplyTargetPreviewMedia | null = null;

  if (safeImagePreview) {
    mediaPreview = {
      kind: "image",
      thumbnailUri: safeImagePreview,
    };
  } else {
    const videoUrl = sourcePost?.videoUrls
      ?.map((url) => getValidHttpUrl(url))
      .find((url): url is string => Boolean(url));

    if (videoUrl) {
      const normalizedVideo = normalizeVideoSource(videoUrl);
      const safePoster =
        toPlatformSafeImageUrl(normalizedVideo.posterUrl) ?? normalizedVideo.posterUrl;
      mediaPreview = {
        kind: "video",
        thumbnailUri: safePoster,
      };
    }
  }

  return { username, displayName, avatarUri, previewText, mediaPreview };
}

function ReplyTargetMediaPreview({
  media,
  isDark,
}: {
  media: ReplyTargetPreviewMedia | null;
  isDark: boolean;
}) {
  if (!media) {
    return null;
  }

  return (
    <View
      className="relative h-[64px] w-[64px] overflow-hidden rounded-md border"
      style={{
        borderColor: getBorderColor(isDark, "subtle"),
        backgroundColor: isDark
          ? "rgba(30, 41, 59, 0.6)"
          : "rgba(241, 245, 249, 0.9)",
      }}
    >
      {media.thumbnailUri ? (
        <Image
          source={{ uri: media.thumbnailUri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
          transition={400}
        />
      ) : null}

      {media.kind === "video" ? (
        <View className="absolute inset-0 items-center justify-center bg-black/25">
          <Feather name="play" size={15} color="#ffffff" />
        </View>
      ) : null}
    </View>
  );
}

export function FeedCommentModal({
  visible,
  post,
  onClose,
  onSubmitted,
}: FeedCommentModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { currentUser } = useContext(DeSoIdentityContext);
  const {
    isDark,
    accentColor,
    accentStrong,
    accentSurface,
    accentSoft,
  } = useAccentColor();
  const [commentText, setCommentText] = useState("");
  const [replyImageLocalUri, setReplyImageLocalUri] = useState<string | null>(null);
  const [replyImageUploadedUrl, setReplyImageUploadedUrl] = useState<string | null>(null);
  const [isUploadingReplyImage, setIsUploadingReplyImage] = useState(false);
  const { mutateAsync, isPending, reset } = useSubmitComment();

  const { username, displayName, avatarUri, previewText, mediaPreview } = useMemo(
    () => getReplyTarget(post),
    [post],
  );

  const currentUserAvatarUri = useMemo(() => {
    const publicKey = currentUser?.PublicKeyBase58Check;
    if (!publicKey) {
      return null;
    }

    const raw = getValidHttpUrl(getProfileImageUrl(publicKey));
    if (!raw) {
      return null;
    }

    return toPlatformSafeImageUrl(raw) ?? raw;
  }, [currentUser?.PublicKeyBase58Check]);

  const remainingCharacters = MAX_COMMENT_LENGTH - commentText.length;
  const hasReplyImage = Boolean(replyImageUploadedUrl);
  const hasReplyContent = commentText.trim().length > 0 || hasReplyImage;
  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;
  const { keyboardInset, isMobileWeb } = useMobileWebKeyboardInset();
  const isMobileWebComposer = Platform.OS === "web" && !isDesktopWeb && isMobileWeb;
  const composerFooterOffset =
    isMobileWebComposer && keyboardInset > 0
      ? keyboardInset + MOBILE_KEYBOARD_BAR_GAP
      : 0;
  const animatedFooterOffset = useSharedValue(0);
  const desktopModalHeight = Math.max(460, Math.min(620, windowHeight * 0.72));

  useEffect(() => {
    animatedFooterOffset.value = withTiming(composerFooterOffset, {
      duration: 110,
      easing: Easing.out(Easing.quad),
    });
  }, [animatedFooterOffset, composerFooterOffset]);

  const composerFooterAnimatedStyle = useAnimatedStyle(() => ({
    bottom: animatedFooterOffset.value,
  }));

  const canSubmit = Boolean(
    post?.postHash &&
      currentUser?.PublicKeyBase58Check &&
      hasReplyContent &&
      remainingCharacters >= 0 &&
      !isPending &&
      !isUploadingReplyImage,
  );

  const resetComposerState = () => {
    setCommentText("");
    setReplyImageLocalUri(null);
    setReplyImageUploadedUrl(null);
    setIsUploadingReplyImage(false);
    reset();
  };

  const handleClose = () => {
    if (isPending || isUploadingReplyImage) {
      return;
    }
    resetComposerState();
    onClose();
  };

  const handlePickReplyImage = async () => {
    const userPublicKey = currentUser?.PublicKeyBase58Check;
    if (!userPublicKey) {
      Toast.show({
        type: "error",
        text1: "Login required",
        text2: "Sign in to attach an image.",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const localUri = result.assets[0].uri;
    setReplyImageLocalUri(localUri);
    setReplyImageUploadedUrl(null);
    setIsUploadingReplyImage(true);

    try {
      const uploadedUrl = await uploadImage(userPublicKey, localUri);
      setReplyImageUploadedUrl(uploadedUrl);
    } catch (error) {
      setReplyImageLocalUri(null);
      setReplyImageUploadedUrl(null);
      Toast.show({
        type: "error",
        text1: "Image upload failed",
        text2: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsUploadingReplyImage(false);
    }
  };

  const handleRemoveReplyImage = () => {
    if (isUploadingReplyImage || isPending) {
      return;
    }
    setReplyImageLocalUri(null);
    setReplyImageUploadedUrl(null);
  };

  const handleSubmit = async () => {
    if (!post?.postHash) {
      Toast.show({
        type: "error",
        text1: "Unable to comment",
        text2: "This post is missing an identifier.",
      });
      return;
    }

    const userPublicKey = currentUser?.PublicKeyBase58Check;
    if (!userPublicKey) {
      Toast.show({
        type: "error",
        text1: "Login required",
        text2: "Sign in to reply to posts.",
      });
      return;
    }

    if (isUploadingReplyImage) {
      Toast.show({
        type: "info",
        text1: "Uploading image",
        text2: "Please wait for upload to finish.",
      });
      return;
    }

    if (replyImageLocalUri && !replyImageUploadedUrl) {
      Toast.show({
        type: "error",
        text1: "Image not ready",
        text2: "Please reattach the image and try again.",
      });
      return;
    }

    try {
      await mutateAsync({
        updaterPublicKey: userPublicKey,
        parentPostHash: post.postHash,
        body: commentText,
        imageUrls: replyImageUploadedUrl ? [replyImageUploadedUrl] : [],
      });

      Toast.show({
        type: "success",
        text1: "Reply posted",
        text2: `Your reply to @${username} is live.`,
      });

      resetComposerState();
      onClose();
      if (onSubmitted) {
        await Promise.resolve(onSubmitted());
      }
    } catch (error) {
      const fallbackMessage = "Please try again.";
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage;
      Toast.show({
        type: "error",
        text1: "Failed to post reply",
        text2: errorMessage,
      });
    }
  };

  const handleCommentChange = (value: string) => {
    if (value.length <= MAX_COMMENT_LENGTH) {
      setCommentText(value);
      return;
    }
    setCommentText(value.slice(0, MAX_COMMENT_LENGTH));
  };

  const composerFooterControls = (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={handlePickReplyImage}
        disabled={isUploadingReplyImage || isPending}
        className="h-8 w-8 items-center justify-center rounded-md"
        style={{
          borderWidth: 1,
          borderColor: replyImageLocalUri
            ? accentColor
            : getBorderColor(isDark, "input"),
          backgroundColor: replyImageLocalUri ? accentSoft : accentSurface,
          opacity: isUploadingReplyImage ? 0.7 : 1,
        }}
        accessibilityRole="button"
        accessibilityLabel="Attach image"
      >
        {isUploadingReplyImage ? (
          <ActivityIndicator size="small" color={accentStrong} />
        ) : (
          <Feather
            name="image"
            size={16}
            color={replyImageLocalUri ? accentStrong : accentColor}
          />
        )}
      </Pressable>

      <View className="ml-auto flex-row items-center gap-2.5">
        <Text
          className="text-[14px]"
          style={{
            color:
              remainingCharacters < 20
                ? "#ef4444"
                : isDark
                  ? "#cbd5e1"
                  : "#334155",
            fontVariant: ["tabular-nums"],
          }}
        >
          {remainingCharacters}
        </Text>

        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${remainingCharacters} characters remaining`}
          accessibilityValue={{
            min: 0,
            max: MAX_COMMENT_LENGTH,
            now: commentText.length,
          }}
        >
          <CircularProgressIndicator
            current={commentText.length}
            max={MAX_COMMENT_LENGTH}
            size={24}
            strokeWidth={2.25}
          />
        </View>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        className="h-9 min-w-[88px] items-center justify-center rounded-full px-4"
        style={{
          backgroundColor: canSubmit
            ? accentColor
            : isDark
              ? "rgba(51, 65, 85, 0.7)"
              : "rgba(203, 213, 225, 0.9)",
        }}
        accessibilityRole="button"
        accessibilityLabel="Submit reply"
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text className="text-[16px] font-semibold text-white">Reply</Text>
        )}
      </Pressable>
    </View>
  );

  const composerContent = (
    <View className="flex-1">
      <View
        className="flex-row items-center justify-between px-4 py-3.5"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: getBorderColor(isDark, "subtle"),
        }}
      >
        <Text
          numberOfLines={1}
          className="mr-3 flex-1 text-[21px] font-extrabold"
          style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
        >
          Reply to @{username}
        </Text>
        <Pressable
          onPress={handleClose}
          disabled={isPending || isUploadingReplyImage}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: isDark
              ? "rgba(30, 41, 59, 0.8)"
              : "rgba(241, 245, 249, 1)",
          }}
          accessibilityRole="button"
          accessibilityLabel="Close reply composer"
        >
          <Feather
            name="x"
            size={18}
            color={isDark ? "#cbd5e1" : "#475569"}
          />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: isMobileWebComposer
            ? MOBILE_COMPOSER_FOOTER_PADDING_BOTTOM
            : 24,
        }}
      >
        <View className="px-4 pb-4 pt-3.5">
          <View className="flex-row items-start gap-3">
            <UserAvatar uri={avatarUri} name={displayName} size={40} />

            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text
                  numberOfLines={1}
                  className="max-w-[58%] text-[17px] font-semibold"
                  style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
                >
                  {displayName}
                </Text>
                <Text
                  numberOfLines={1}
                  className="min-w-0 flex-1 text-[15px]"
                  style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                >
                  @{username}
                </Text>
              </View>

              {mediaPreview ? (
                <View className="mt-2 flex-row items-start gap-3">
                  <View className="min-w-0 flex-1">
                    <Text
                      numberOfLines={4}
                      className="text-[15px] leading-5"
                      style={{ color: isDark ? "#cbd5e1" : "#334155" }}
                    >
                      {previewText}
                    </Text>
                  </View>
                  <View className="w-[68px] shrink-0 pt-0.5">
                    <ReplyTargetMediaPreview media={mediaPreview} isDark={isDark} />
                  </View>
                </View>
              ) : (
                <Text
                  numberOfLines={4}
                  className="mt-2 text-[15px] leading-5"
                  style={{ color: isDark ? "#cbd5e1" : "#334155" }}
                >
                  {previewText}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View
          className="mx-4"
          style={{
            height: 1,
            backgroundColor: getBorderColor(isDark, "subtle"),
          }}
        />

        <View className="px-4 pb-4 pt-4">
          <View className="flex-row items-start gap-3">
            <UserAvatar
              uri={currentUserAvatarUri}
              name={
                currentUser?.ProfileEntryResponse?.Username ||
                currentUser?.PublicKeyBase58Check ||
                "You"
              }
              size={38}
            />

            <View className="flex-1">
              <TextInput
                multiline
                autoFocus
                value={commentText}
                onChangeText={handleCommentChange}
                placeholder="What's new?"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                style={{
                  minHeight: isDesktopWeb ? 180 : 220,
                  fontSize: 22,
                  lineHeight: 30,
                  color: isDark ? "#f8fafc" : "#0f172a",
                  textAlignVertical: "top",
                  borderWidth: 0,
                  ...(Platform.OS === "web" && {
                    outlineStyle: "none" as any,
                    outlineWidth: 0 as any,
                    boxShadow: "none" as any,
                  }),
                }}
              />
            </View>
          </View>

          {replyImageLocalUri ? (
            <View className="mt-4 pl-[50px]">
              <View
                className="flex-row items-center rounded-xl border px-2.5 py-2.5"
                style={{
                  borderColor: getBorderColor(isDark, "subtle"),
                  backgroundColor: isDark
                    ? "rgba(15, 23, 42, 0.65)"
                    : "rgba(241, 245, 249, 0.8)",
                }}
              >
                <View className="relative h-[62px] w-[62px] overflow-hidden rounded-lg">
                  <Image
                    source={{ uri: replyImageLocalUri }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
                    transition={400}
                  />

                  {isUploadingReplyImage ? (
                    <View className="absolute inset-0 items-center justify-center bg-black/45">
                      <ActivityIndicator size="small" color="#ffffff" />
                    </View>
                  ) : null}
                </View>

                <View className="ml-3 flex-1">
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
                  >
                    {isUploadingReplyImage ? "Uploading image..." : "Image attached"}
                  </Text>
                  <Text
                    className="mt-1 text-[12px]"
                    style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                  >
                    {isUploadingReplyImage
                      ? "Please wait before posting."
                      : "This image will be included in your reply."}
                  </Text>
                </View>

                {!isUploadingReplyImage ? (
                  <Pressable
                    onPress={handleRemoveReplyImage}
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Remove attached image"
                  >
                    <Feather
                      name="x"
                      size={15}
                      color={isDark ? "#cbd5e1" : "#475569"}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {isMobileWebComposer ? (
        <Animated.View
          className="absolute left-0 right-0 px-4 pb-2.5 pt-2"
          style={[
            {
              borderTopWidth: 1,
              borderTopColor: getBorderColor(isDark, "subtle"),
            },
            composerFooterAnimatedStyle,
          ]}
        >
          {composerFooterControls}
        </Animated.View>
      ) : (
        <View
          className="px-4 pb-2.5 pt-2"
          style={{
            borderTopWidth: 1,
            borderTopColor: getBorderColor(isDark, "subtle"),
          }}
        >
          {composerFooterControls}
        </View>
      )}
    </View>
  );

  const modalBody = isDesktopWeb ? (
    <View
      className="flex-1 items-center justify-center px-6 py-8"
      pointerEvents="box-none"
    >
      <Pressable
        className="absolute inset-0"
        onPress={handleClose}
        style={{
          backgroundColor: isDark ? "rgba(2, 6, 23, 0.72)" : "rgba(15, 23, 42, 0.35)",
        }}
      />
      <View
        className="w-full overflow-hidden rounded-3xl border"
        style={{
          maxWidth: 640,
          height: desktopModalHeight,
          backgroundColor: isDark ? "#0b1629" : "#ffffff",
          borderColor: getBorderColor(isDark, "contrast_low"),
        }}
      >
        {composerContent}
      </View>
    </View>
  ) : (
    <View
      className="flex-1"
      style={{
        backgroundColor: isDark ? "#0b1629" : "#ffffff",
      }}
    >
      {composerContent}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={isDesktopWeb}
      animationType="fade"
      presentationStyle={
        isDesktopWeb ? "overFullScreen" : Platform.OS === "ios" ? "fullScreen" : "overFullScreen"
      }
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={handleClose}
    >
      <SafeAreaView
        edges={isDesktopWeb ? [] : ["top", "bottom"]}
        className="flex-1"
        style={{
          backgroundColor: isDesktopWeb
            ? "transparent"
            : isDark
              ? "#0b1629"
              : "#ffffff",
        }}
      >
        {Platform.OS === "web" ? (
          modalBody
        ) : (
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {modalBody}
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
