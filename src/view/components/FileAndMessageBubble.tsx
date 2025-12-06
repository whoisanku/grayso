import React, { useState, useCallback } from 'react';
import { View, Image, ActivityIndicator, Text, TouchableOpacity, Dimensions, DimensionValue, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cx } from '../../lib/styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// On web, limit bubble width to prevent oversized images. On mobile, use 72% of screen.
const MAX_BUBBLE_WIDTH = Platform.OS === 'web' 
  ? Math.min(SCREEN_WIDTH * 0.72, 320) 
  : SCREEN_WIDTH * 0.72;

type FileAndMessageBubbleProps = {
    decryptedImageURLs?: string;
    extraData: Record<string, any>;
    isDark: boolean;
    onImagePress?: (images: string[], index: number) => void;
};

type ImageItemProps = {
    url: string;
    aspectRatio: number;
    width: DimensionValue;
    height: DimensionValue;
    isDark: boolean;
    borderRadius?: {
        topLeft?: number;
        topRight?: number;
        bottomLeft?: number;
        bottomRight?: number;
    };
    onPress?: () => void;
    overlay?: React.ReactNode;
};

const ImageItem = React.memo(({ 
    url, 
    aspectRatio, 
    width, 
    height, 
    isDark, 
    borderRadius,
    onPress,
    overlay,
}: ImageItemProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const handleLoad = useCallback(() => {
        setIsLoading(false);
        setHasError(false);
    }, []);

    const handleError = useCallback(() => {
        setIsLoading(false);
        setHasError(true);
        console.warn('[ImageItem] Failed to load image:', url);
    }, [url]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        setHasError(false);
    }, []);

    const borderStyle = {
        borderTopLeftRadius: borderRadius?.topLeft ?? 8,
        borderTopRightRadius: borderRadius?.topRight ?? 8,
        borderBottomLeftRadius: borderRadius?.bottomLeft ?? 8,
        borderBottomRightRadius: borderRadius?.bottomRight ?? 8,
    };

    if (hasError) {
        return (
            <TouchableOpacity 
                onPress={handleRetry}
                className={`items-center justify-center overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                style={[
                    borderStyle,
                    {
                        width,
                        height,
                    }
                ]}
            >
                <Feather name="image" size={24} color={isDark ? '#475569' : '#94a3b8'} />
                <Text className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Tap to retry
                </Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity 
            activeOpacity={0.9}
            onPress={onPress}
            disabled={!onPress}
            className={`items-center justify-center overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
            style={[
                borderStyle,
                {
                    width,
                    height,
                }
            ]}
        >
            {isLoading && (
                <View className="absolute inset-0 z-10 items-center justify-center">
                    <ActivityIndicator size="small" color={isDark ? '#64748b' : '#94a3b8'} />
                </View>
            )}
            <Image
                source={{ uri: url }}
                style={[borderStyle, { width: '100%', height: '100%' }]}
                resizeMode="cover"
                onLoad={handleLoad}
                onError={handleError}
            />
            {overlay}
        </TouchableOpacity>
    );
});

ImageItem.displayName = 'ImageItem';

export const FileAndMessageBubble = React.memo(({ 
    decryptedImageURLs, 
    extraData, 
    isDark,
    onImagePress,
}: FileAndMessageBubbleProps) => {
    let imageUrls: string[] = [];

    try {
        if (decryptedImageURLs && typeof decryptedImageURLs === 'string') {
            try {
                imageUrls = JSON.parse(decryptedImageURLs);
            } catch {
                if (decryptedImageURLs.startsWith('http')) {
                    imageUrls = [decryptedImageURLs];
                }
            }
        }

        // Fallback: Check for images in extraData if no decrypted URLs found
        if ((!imageUrls || imageUrls.length === 0) && extraData) {
            let index = 0;
            while (true) {
                const clientIdKey = `image.${index}.clientId`;
                const clientId = extraData[clientIdKey];

                if (!clientId) break;

                imageUrls.push(`https://images.deso.org/${clientId}`);
                index++;
            }
        }

        if (!Array.isArray(imageUrls) || imageUrls.length === 0) return null;

        const handleImagePress = (index: number) => {
            onImagePress?.(imageUrls, index);
        };

        // Get aspect ratios for images
        const getAspectRatio = (index: number): number => {
            const widthKey = `image.${index}.width`;
            const heightKey = `image.${index}.height`;
            const imgWidth = extraData[widthKey] ? parseInt(extraData[widthKey] as string, 10) : undefined;
            const imgHeight = extraData[heightKey] ? parseInt(extraData[heightKey] as string, 10) : undefined;
            return (imgWidth && imgHeight) ? imgWidth / imgHeight : 1;
        };

        const imageCount = imageUrls.length;
        const GRID_GAP = 3;
        const CORNER_RADIUS = 12;

        // Single image - constrained width and height
        if (imageCount === 1) {
            const aspectRatio = getAspectRatio(0);
            const imageWidth = MAX_BUBBLE_WIDTH;
            const imageHeight = Math.min(imageWidth / aspectRatio, 250);
            return (
                <View className="mb-2 overflow-hidden rounded-xl" style={{ maxWidth: MAX_BUBBLE_WIDTH }}>
                    <ImageItem
                        url={imageUrls[0]}
                        aspectRatio={aspectRatio}
                        width={imageWidth}
                        height={imageHeight}
                        isDark={isDark}
                        borderRadius={{ 
                            topLeft: CORNER_RADIUS, 
                            topRight: CORNER_RADIUS, 
                            bottomLeft: CORNER_RADIUS, 
                            bottomRight: CORNER_RADIUS 
                        }}
                        onPress={() => handleImagePress(0)}
                    />
                </View>
            );
        }

        // Two images - side by side
        if (imageCount === 2) {
            const itemWidth = (MAX_BUBBLE_WIDTH - GRID_GAP) / 2;
            return (
                <View className="mb-2 flex-row overflow-hidden rounded-xl" style={{ maxWidth: MAX_BUBBLE_WIDTH }}>
                    <ImageItem
                        url={imageUrls[0]}
                        aspectRatio={1}
                        width={itemWidth}
                        height={itemWidth}
                        isDark={isDark}
                        borderRadius={{ topLeft: CORNER_RADIUS, bottomLeft: CORNER_RADIUS }}
                        onPress={() => handleImagePress(0)}
                    />
                    <View style={{ width: GRID_GAP }} />
                    <ImageItem
                        url={imageUrls[1]}
                        aspectRatio={1}
                        width={itemWidth}
                        height={itemWidth}
                        isDark={isDark}
                        borderRadius={{ topRight: CORNER_RADIUS, bottomRight: CORNER_RADIUS }}
                        onPress={() => handleImagePress(1)}
                    />
                </View>
            );
        }

        // Three images - 1 large top, 2 small bottom
        if (imageCount === 3) {
            const bottomItemWidth = (MAX_BUBBLE_WIDTH - GRID_GAP) / 2;
            return (
                <View className="mb-2 overflow-hidden rounded-xl" style={{ maxWidth: MAX_BUBBLE_WIDTH }}>
                    <ImageItem
                        url={imageUrls[0]}
                        aspectRatio={16/9}
                        width="100%"
                        height={MAX_BUBBLE_WIDTH * 0.56}
                        isDark={isDark}
                        borderRadius={{ topLeft: CORNER_RADIUS, topRight: CORNER_RADIUS }}
                        onPress={() => handleImagePress(0)}
                    />
                    <View style={{ height: GRID_GAP }} />
                    <View className="flex-row">
                        <ImageItem
                            url={imageUrls[1]}
                            aspectRatio={1}
                            width={bottomItemWidth}
                            height={bottomItemWidth * 0.75}
                            isDark={isDark}
                            borderRadius={{ bottomLeft: CORNER_RADIUS }}
                            onPress={() => handleImagePress(1)}
                        />
                        <View style={{ width: GRID_GAP }} />
                        <ImageItem
                            url={imageUrls[2]}
                            aspectRatio={1}
                            width={bottomItemWidth}
                            height={bottomItemWidth * 0.75}
                            isDark={isDark}
                            borderRadius={{ bottomRight: CORNER_RADIUS }}
                            onPress={() => handleImagePress(2)}
                        />
                    </View>
                </View>
            );
        }

        // Four or more images - 2x2 grid with +N overlay on 4th if more
        const gridItemSize = (MAX_BUBBLE_WIDTH - GRID_GAP) / 2;
        const extraCount = imageCount - 4;

        return (
            <View className="mb-2 overflow-hidden rounded-xl" style={{ maxWidth: MAX_BUBBLE_WIDTH }}>
                {/* Top row */}
                <View className="flex-row">
                    <ImageItem
                        url={imageUrls[0]}
                        aspectRatio={1}
                        width={gridItemSize}
                        height={gridItemSize}
                        isDark={isDark}
                        borderRadius={{ topLeft: CORNER_RADIUS }}
                        onPress={() => handleImagePress(0)}
                    />
                    <View style={{ width: GRID_GAP }} />
                    <ImageItem
                        url={imageUrls[1]}
                        aspectRatio={1}
                        width={gridItemSize}
                        height={gridItemSize}
                        isDark={isDark}
                        borderRadius={{ topRight: CORNER_RADIUS }}
                        onPress={() => handleImagePress(1)}
                    />
                </View>
                <View style={{ height: GRID_GAP }} />
                {/* Bottom row */}
                <View className="flex-row">
                    <ImageItem
                        url={imageUrls[2]}
                        aspectRatio={1}
                        width={gridItemSize}
                        height={gridItemSize}
                        isDark={isDark}
                        borderRadius={{ bottomLeft: CORNER_RADIUS }}
                        onPress={() => handleImagePress(2)}
                    />
                    <View style={{ width: GRID_GAP }} />
                    <ImageItem
                        url={imageUrls[3]}
                        aspectRatio={1}
                        width={gridItemSize}
                        height={gridItemSize}
                        isDark={isDark}
                        borderRadius={{ bottomRight: CORNER_RADIUS }}
                        onPress={() => handleImagePress(3)}
                        overlay={extraCount > 0 ? (
                            <View className="absolute inset-0 items-center justify-center bg-black/55">
                                <Text className="text-2xl font-bold text-white">+{extraCount}</Text>
                            </View>
                        ) : undefined}
                    />
                </View>
            </View>
        );
    } catch (e) {
        console.warn("Failed to render images:", e);
        return null;
    }
});

FileAndMessageBubble.displayName = "FileAndMessageBubble";
