import React from "react";
import { View, Text, Dimensions, Platform } from "react-native";
import { cx } from '@/lib/styles';
import { MessageImage } from './MessageImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// On web, limit bubble width to prevent oversized images. On mobile, use 72% of screen.
const MAX_BUBBLE_WIDTH = Platform.OS === 'web' 
  ? Math.min(SCREEN_WIDTH * 0.72, 320) 
  : SCREEN_WIDTH * 0.72;

type FileAndMessageBubbleProps = {
    decryptedImageURLs?: string;
    extraData?: Record<string, any> | null;
    isDark: boolean;
    onImagePress?: (images: string[], index: number) => void;
    compact?: boolean;
    borderRadius?: number;
};

export const FileAndMessageBubble = React.memo(({ 
    decryptedImageURLs, 
    extraData, 
    isDark,
    onImagePress,
    compact = false,
    borderRadius = 12,
}: FileAndMessageBubbleProps) => {
    let imageUrls: string[] = [];
    const metadata: Record<string, any> = extraData ?? {};

    const pushUrls = (value?: string) => {
        if (!value || typeof value !== 'string') return;
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                imageUrls = parsed.filter((url) => typeof url === 'string' && url.length > 0);
            }
        } catch {
            if (value.startsWith('http')) {
                imageUrls = [value];
            }
        }
    };

    try {
        pushUrls(decryptedImageURLs);

        if ((!imageUrls || imageUrls.length === 0) && extraData?.decryptedImageURLs) {
            pushUrls(extraData.decryptedImageURLs as string);
        }

        // Fallback: Check for images in extraData if no URLs found
        if ((!imageUrls || imageUrls.length === 0) && extraData) {
            let index = 0;
            while (true) {
                const clientIdKey = `image.${index}.clientId`;
                const clientId = metadata[clientIdKey];

                if (!clientId) break;

                imageUrls.push(`https://images.deso.org/${clientId}`);
                index++;
            }
        }

        if (!Array.isArray(imageUrls) || imageUrls.length === 0) return null;

        const handleImagePress = (index: number) => {
            onImagePress?.(imageUrls, index);
        };

        // Get dimensions from metadata
        const getDimensions = (index: number) => {
            const widthKey = `image.${index}.width`;
            const heightKey = `image.${index}.height`;
            const rawWidth = metadata[widthKey] ? parseInt(String(metadata[widthKey]), 10) : undefined;
            const rawHeight = metadata[heightKey] ? parseInt(String(metadata[heightKey]), 10) : undefined;
            return { width: rawWidth, height: rawHeight };
        };

        const imageCount = imageUrls.length;
        const GRID_GAP = 3;
        const effectiveRadius = compact ? 0 : borderRadius;
        const effectiveMaxWidth = Math.max(
          0,
          MAX_BUBBLE_WIDTH - (compact ? 0 : 32)
        ); // account for parent bubble horizontal padding

        // Single image - use aspect ratio logic via MessageImage
        if (imageCount === 1) {
            const { width, height } = getDimensions(0);
            return (
                <View style={{ maxWidth: effectiveMaxWidth }}>
                    <MessageImage
                        uri={imageUrls[0]}
                        width={width}
                        height={height}
                        maxWidth={effectiveMaxWidth}
                        maxHeight={effectiveMaxWidth}
                        borderRadius={effectiveRadius}
                        forceSquare={true}
                        contentFit="cover"
                        onPress={() => handleImagePress(0)}
                    />
                </View>
            );
        }

        // Two images - side by side
        if (imageCount === 2) {
            const itemWidth = (effectiveMaxWidth - GRID_GAP) / 2;
            return (
                <View className={cx("flex-row overflow-hidden", compact ? undefined : "rounded-xl")} style={{ maxWidth: effectiveMaxWidth }}>
                    <MessageImage
                        uri={imageUrls[0]}
                        style={{ width: itemWidth, height: itemWidth }}
                        borderRadius={0}
                        onPress={() => handleImagePress(0)}
                    />
                    <View style={{ width: GRID_GAP }} />
                    <MessageImage
                        uri={imageUrls[1]}
                        style={{ width: itemWidth, height: itemWidth }}
                        borderRadius={0}
                        onPress={() => handleImagePress(1)}
                    />
                </View>
            );
        }

        // Three images - 1 large top, 2 small bottom
        if (imageCount === 3) {
            const bottomItemWidth = (effectiveMaxWidth - GRID_GAP) / 2;
            const topHeight = effectiveMaxWidth * 0.56;
            
            return (
                <View className={cx("overflow-hidden", compact ? undefined : "rounded-xl")} style={{ maxWidth: effectiveMaxWidth }}>
                    <MessageImage
                        uri={imageUrls[0]}
                        style={{ width: '100%', height: topHeight }}
                        borderRadius={0}
                        onPress={() => handleImagePress(0)}
                    />
                    <View style={{ height: GRID_GAP }} />
                    <View className="flex-row">
                        <MessageImage
                            uri={imageUrls[1]}
                            style={{ width: bottomItemWidth, height: bottomItemWidth * 0.75 }}
                            borderRadius={0}
                            onPress={() => handleImagePress(1)}
                        />
                        <View style={{ width: GRID_GAP }} />
                         <MessageImage
                            uri={imageUrls[2]}
                            style={{ width: bottomItemWidth, height: bottomItemWidth * 0.75 }}
                            borderRadius={0}
                            onPress={() => handleImagePress(2)}
                        />
                    </View>
                </View>
            );
        }

        // Four or more images - 2x2 grid with +N overlay on 4th if more
        const gridItemSize = (effectiveMaxWidth - GRID_GAP) / 2;
        const extraCount = imageCount - 4;

        return (
            <View className={cx("overflow-hidden", compact ? undefined : "rounded-xl")} style={{ maxWidth: effectiveMaxWidth }}>
                {/* Top row */}
                <View className="flex-row">
                    <MessageImage
                        uri={imageUrls[0]}
                        style={{ width: gridItemSize, height: gridItemSize }}
                        borderRadius={0}
                        onPress={() => handleImagePress(0)}
                    />
                    <View style={{ width: GRID_GAP }} />
                    <MessageImage
                        uri={imageUrls[1]}
                        style={{ width: gridItemSize, height: gridItemSize }}
                        borderRadius={0}
                        onPress={() => handleImagePress(1)}
                    />
                </View>
                <View style={{ height: GRID_GAP }} />
                {/* Bottom row */}
                <View className="flex-row">
                     <MessageImage
                        uri={imageUrls[2]}
                        style={{ width: gridItemSize, height: gridItemSize }}
                        borderRadius={0}
                        onPress={() => handleImagePress(2)}
                    />
                    <View style={{ width: GRID_GAP }} />
                    <View style={{ position: 'relative', width: gridItemSize, height: gridItemSize }}>
                         <MessageImage
                            uri={imageUrls[3]}
                            style={{ width: gridItemSize, height: gridItemSize }}
                            borderRadius={0}
                            onPress={() => handleImagePress(3)}
                        />
                        {extraCount > 0 && (
                            <View className="absolute inset-0 items-center justify-center bg-black/55" pointerEvents="none">
                                <Text className="text-2xl font-bold text-white">+{extraCount}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    } catch (e) {
        console.warn("Failed to render images:", e);
        return null;
    }
});

FileAndMessageBubble.displayName = "FileAndMessageBubble";
