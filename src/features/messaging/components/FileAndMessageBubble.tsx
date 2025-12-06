import React, { useState, useCallback } from 'react';
import { View, Image, ActivityIndicator, Text, TouchableOpacity, StyleSheet, Dimensions, DimensionValue } from 'react-native';
import { Feather } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.72; // 80% max-width minus padding

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
                style={[
                    styles.imageContainer,
                    borderStyle,
                    {
                        width,
                        height,
                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                    }
                ]}
            >
                <Feather name="image" size={24} color={isDark ? '#475569' : '#94a3b8'} />
                <Text style={[styles.errorText, { color: isDark ? '#64748b' : '#94a3b8' }]}>
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
            style={[
                styles.imageContainer,
                borderStyle,
                {
                    width,
                    height,
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                }
            ]}
        >
            {isLoading && (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="small" color={isDark ? '#64748b' : '#94a3b8'} />
                </View>
            )}
            <Image
                source={{ uri: url }}
                style={[styles.image, borderStyle]}
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

        // Single image - full width, natural aspect ratio
        if (imageCount === 1) {
            const aspectRatio = getAspectRatio(0);
            return (
                <View style={styles.container}>
                    <ImageItem
                        url={imageUrls[0]}
                        aspectRatio={aspectRatio}
                        width="100%"
                        height={Math.min(MAX_BUBBLE_WIDTH / aspectRatio, 300)}
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
                <View style={[styles.container, styles.row]}>
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
                <View style={styles.container}>
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
                    <View style={styles.row}>
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
            <View style={styles.container}>
                {/* Top row */}
                <View style={styles.row}>
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
                <View style={styles.row}>
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
                            <View style={styles.moreOverlay}>
                                <Text style={styles.moreText}>+{extraCount}</Text>
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

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
    },
    imageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    errorText: {
        fontSize: 11,
        marginTop: 4,
    },
    moreOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    moreText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
    },
});
