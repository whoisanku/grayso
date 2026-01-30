import React, { useMemo } from "react";
import { View, Text, Platform, useWindowDimensions } from "react-native";
import { MessageImage } from './MessageImage';

type FileAndMessageBubbleProps = {
    decryptedImageURLs?: string;
    extraData?: Record<string, any> | null;
    isDark: boolean;
    onImagePress?: (images: string[], index: number) => void;
    compact?: boolean;
    borderRadius?: number;
    parentMaxWidth?: number; // Parent's calculated max width for consistency
};

export const FileAndMessageBubble = React.memo(({ 
    decryptedImageURLs, 
    extraData, 
    isDark,
    onImagePress,
    compact = false,
    borderRadius = 12,
    parentMaxWidth,
}: FileAndMessageBubbleProps) => {
    const { width: windowWidth } = useWindowDimensions();

    const maxBubbleWidth = useMemo(() => {
        // Use parent's calculated width if provided, otherwise calculate fallback
        if (parentMaxWidth) return parentMaxWidth;
        const baseWidth = Math.min(windowWidth * 0.75, 360);
        return Math.max(240, baseWidth);
    }, [windowWidth, parentMaxWidth]);

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
        // When compact (media-only), images fill the bubble edge-to-edge
        // When not compact (text + media), we need to fit within the bubble's padding
        const effectiveMaxWidth = Math.max(
          0,
          maxBubbleWidth - (compact ? 0 : 28) // account for parent bubble horizontal padding (14px * 2)
        );

        // Single image - use aspect ratio logic via MessageImage
        if (imageCount === 1) {
            const { width, height } = getDimensions(0);
            return (
                <View style={{ maxWidth: effectiveMaxWidth, overflow: 'hidden', borderRadius: effectiveRadius }}>
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
                <View className="flex-row overflow-hidden" style={{ maxWidth: effectiveMaxWidth, borderRadius: effectiveRadius }}>
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
                <View className="overflow-hidden" style={{ maxWidth: effectiveMaxWidth, borderRadius: effectiveRadius }}>
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
            <View className="overflow-hidden" style={{ maxWidth: effectiveMaxWidth, borderRadius: effectiveRadius }}>
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
