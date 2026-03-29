import { type FocusFeedPost } from "@/lib/focus/graphql";
import { parseRichTextContent } from "@/lib/richText";
import { getFontTokenDefinition, measureLineCount, prepareText } from "@/lib/textLayout";

const FEED_COLLAPSED_BODY_MAX_LINES = 5;
const FEED_COLLAPSED_EMBEDDED_BODY_MAX_LINES = 4;

function estimateMediaHeight(
  imageCount: number,
  hasVideo: boolean,
  width: number,
  compact = false,
) {
  if (hasVideo) {
    return Math.round(Math.min(compact ? 240 : 340, width * (compact ? 0.78 : 0.9))) + 12;
  }

  if (imageCount <= 0) {
    return 0;
  }

  if (imageCount === 1) {
    return Math.round(Math.min(compact ? 220 : 320, width * (compact ? 0.74 : 0.86))) + 12;
  }

  return Math.round(Math.min(compact ? 240 : 300, width * (compact ? 0.82 : 0.92))) + 12;
}

function estimateTextHeight(
  text: string,
  width: number,
  fontToken: "feedBody" | "feedEmbeddedBody",
  collapsedMaxLines: number,
) {
  if (!text.trim()) {
    return 0;
  }

  const fontDefinition = getFontTokenDefinition(fontToken);
  const lineCount = measureLineCount(
    prepareText(text, fontDefinition.font),
    Math.max(1, width),
    fontDefinition.lineHeight,
  );

  return Math.min(lineCount, collapsedMaxLines) * fontDefinition.lineHeight;
}

export function estimateFeedCardHeight(post: FocusFeedPost, cardWidth: number) {
  const safeCardWidth = Math.max(cardWidth, 280);
  const bodyWidth = Math.max(safeCardWidth - 84, 180);
  const embeddedBodyWidth = Math.max(bodyWidth - 24, 156);
  const rawPostBody = post.body?.trim() ?? "";
  const repostedPost = post.repostedPost;
  const parsedPostContent = parseRichTextContent({
    body: post.body,
    imageUrls: post.imageUrls,
  });
  const parsedRepostContent = parseRichTextContent({
    body: repostedPost?.body,
    imageUrls: repostedPost?.imageUrls,
  });
  const postBody = parsedPostContent.text;
  const repostBody = parsedRepostContent.text;
  const isPureRepost = Boolean(repostedPost?.postHash && !rawPostBody);

  const primaryBody = isPureRepost ? repostBody : postBody;
  const primaryImageUrls = isPureRepost ? parsedRepostContent.imageUrls : parsedPostContent.imageUrls;
  const primaryVideoUrl = isPureRepost ? repostedPost?.videoUrls?.[0] : post.videoUrls?.[0];
  const hasEmbeddedRepostCard = Boolean(!isPureRepost && postBody && repostedPost?.postHash);

  let estimatedHeight = 172;

  estimatedHeight += estimateTextHeight(
    primaryBody,
    bodyWidth,
    "feedBody",
    FEED_COLLAPSED_BODY_MAX_LINES,
  );

  estimatedHeight += estimateMediaHeight(
    primaryImageUrls.length,
    Boolean(primaryVideoUrl),
    bodyWidth,
  );

  if (hasEmbeddedRepostCard) {
    estimatedHeight += 92;
    estimatedHeight += estimateTextHeight(
      repostBody,
      embeddedBodyWidth,
      "feedEmbeddedBody",
      FEED_COLLAPSED_EMBEDDED_BODY_MAX_LINES,
    );
    estimatedHeight += estimateMediaHeight(
      parsedRepostContent.imageUrls.length,
      Boolean(repostedPost?.videoUrls?.[0]),
      embeddedBodyWidth,
      true,
    );
  }

  return estimatedHeight;
}
