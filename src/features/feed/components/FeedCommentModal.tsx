import React, { useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { DeSoIdentityContext } from "react-deso-protocol";
import { Feather } from "@expo/vector-icons";

import { type FocusFeedPost } from "@/lib/focus/graphql";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { getBorderColor } from "@/theme/borders";
import { getProfileImageUrl } from "@/utils/deso";
import {
  getValidHttpUrl,
  normalizeVideoSource,
  toPlatformSafeImageUrl,
} from "@/lib/mediaUrl";
import { Toast } from "@/components/ui/Toast";
import CircularProgressIndicator from "@/components/CircularProgressIndicator";
import {
  MAX_COMMENT_LENGTH,
  useSubmitComment,
} from "@/features/feed/api/useSubmitComment";
import { uploadImage } from "@/lib/media";

const DEFAULT_IMAGE_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

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

function getReplyTarget(post: FocusFeedPost | null) {
  const postBody = post?.body?.trim() || "";
  const isPureRepost = Boolean(post?.repostedPost?.postHash && !postBody);
  const sourcePost = isPureRepost ? post?.repostedPost ?? null : post;
  const sourcePoster = sourcePost?.poster ?? post?.poster ?? null;

  const username = sourcePoster?.username?.trim() || "unknown";
  const rawDisplayName = sourcePoster?.extraData?.DisplayName;
  const displayName =
    typeof rawDisplayName === "string" && rawDisplayName.trim()
      ? rawDisplayName.trim()
      : username;

  const avatarRaw = getProfileImageUrl(sourcePoster?.publicKey ?? undefined);
  const avatarUri = toPlatformSafeImageUrl(avatarRaw) ?? avatarRaw;
  const previewTextRaw = sourcePost?.body?.trim() || postBody || "This post has no text.";
  const previewText = previewTextRaw
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const imagePreview = sourcePost?.imageUrls
    ?.map((url) => getValidHttpUrl(url))
    .find((url): url is string => Boolean(url));
  const safeImagePreview = toPlatformSafeImageUrl(imagePreview) ?? imagePreview;

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
    const raw = getProfileImageUrl(currentUser?.PublicKeyBase58Check ?? undefined);
    return toPlatformSafeImageUrl(raw) ?? raw;
  }, [currentUser?.PublicKeyBase58Check]);

  const remainingCharacters = MAX_COMMENT_LENGTH - commentText.length;
  const hasReplyImage = Boolean(replyImageUploadedUrl);
  const hasReplyContent = commentText.trim().length > 0 || hasReplyImage;

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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable className="absolute inset-0 bg-black/55" onPress={handleClose} />

        <SafeAreaView edges={["top", "bottom"]} className="flex-1 px-4">
          <View className="flex-1 items-center justify-center" pointerEvents="box-none">
            <View
              className="w-full overflow-hidden rounded-2xl border"
              style={{
                backgroundColor: isDark ? "#0b1629" : "#ffffff",
                borderColor: getBorderColor(isDark, "contrast_low"),
                maxWidth: Platform.OS === "web" ? 520 : 500,
                minHeight: 460,
                maxHeight: 640,
              }}
            >
              <View className="flex-row items-center justify-between px-4 pb-3 pt-3.5">
                <Pressable
                  onPress={handleClose}
                  disabled={isPending || isUploadingReplyImage}
                  className="active:opacity-75"
                  hitSlop={8}
                >
                  <Text className="text-[15px] font-medium" style={{ color: accentColor }}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  className="h-8 min-w-[72px] items-center justify-center rounded-full px-3"
                  style={{
                    backgroundColor: canSubmit
                      ? accentColor
                      : isDark
                        ? "rgba(51, 65, 85, 0.7)"
                        : "rgba(203, 213, 225, 0.9)",
                  }}
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-[14px] font-semibold text-white">Reply</Text>
                  )}
                </Pressable>
              </View>

              <View className="px-4 pb-4">
                <View className="flex-row items-start gap-3">
                  <Image
                    source={{ uri: avatarUri }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                    className="bg-slate-200 dark:bg-slate-700"
                    contentFit="cover"
                    placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
                    transition={500}
                  />

                  <View className="min-w-0 flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-[18px] font-semibold leading-6"
                      style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
                    >
                      {displayName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="mt-0.5 text-[13px]"
                      style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                    >
                      @{username}
                    </Text>
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

              <View className="flex-1 px-4 pb-5 pt-4">
                <View className="flex-row items-start gap-3">
                  <Image
                    source={{ uri: currentUserAvatarUri }}
                    style={{ width: 36, height: 36, borderRadius: 18 }}
                    className="bg-slate-200 dark:bg-slate-700"
                    contentFit="cover"
                    placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
                    transition={500}
                  />

                  <View className="flex-1 pt-0.5">
                    <TextInput
                      multiline
                      autoFocus
                      value={commentText}
                      onChangeText={handleCommentChange}
                      placeholder="Write your reply"
                      placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                      style={{
                        minHeight: 158,
                        maxHeight: 280,
                        fontSize: 18,
                        lineHeight: 26,
                        color: isDark ? "#f8fafc" : "#0f172a",
                        textAlignVertical: "top",
                        ...(Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as const)
                          : null),
                      }}
                    />
                  </View>
                </View>

                {replyImageLocalUri ? (
                  <View className="mt-4 pl-[48px]">
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

              <View
                className="flex-row items-center justify-between px-4 py-2.5"
                style={{
                  borderTopWidth: 1,
                  borderTopColor: getBorderColor(isDark, "subtle"),
                }}
              >
                <Pressable
                  onPress={handlePickReplyImage}
                  disabled={isUploadingReplyImage || isPending}
                  className="h-9 w-9 items-center justify-center rounded-lg"
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
                      size={17}
                      color={replyImageLocalUri ? accentStrong : accentColor}
                    />
                  )}
                </Pressable>

                <View className="flex-row items-center gap-2.5">
                  <Text
                    className="text-[15px]"
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
                      size={28}
                      strokeWidth={2.5}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
