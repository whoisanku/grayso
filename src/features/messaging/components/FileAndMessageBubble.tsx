import React from 'react';
import { View, Image } from 'react-native';

type FileAndMessageBubbleProps = {
    decryptedImageURLs?: string;
    extraData: Record<string, any>;
    isDark: boolean;
};

export const FileAndMessageBubble = React.memo(({ decryptedImageURLs, extraData, isDark }: FileAndMessageBubbleProps) => {
    if (!decryptedImageURLs || typeof decryptedImageURLs !== 'string') return null;

    try {
        let imageUrls: string[] = [];
        try {
            imageUrls = JSON.parse(decryptedImageURLs);
        } catch {
            if (decryptedImageURLs.startsWith('http')) {
                imageUrls = [decryptedImageURLs];
            }
        }

        if (!Array.isArray(imageUrls) || imageUrls.length === 0) return null;

        return (
            <View className="mb-2">
                {imageUrls.map((url, index) => {
                    const widthKey = `image.${index}.width`;
                    const heightKey = `image.${index}.height`;
                    const imgWidth = extraData[widthKey] ? parseInt(extraData[widthKey] as string, 10) : undefined;
                    const imgHeight = extraData[heightKey] ? parseInt(extraData[heightKey] as string, 10) : undefined;
                    const aspectRatio = (imgWidth && imgHeight) ? imgWidth / imgHeight : 1;

                    return (
                        <Image
                            key={index}
                            source={{ uri: url }}
                            style={{
                                width: '100%',
                                aspectRatio: aspectRatio,
                                borderRadius: 8,
                                marginBottom: index < imageUrls.length - 1 ? 8 : 0,
                                backgroundColor: isDark ? '#334155' : '#e2e8f0'
                            }}
                            resizeMode="cover"
                        />
                    );
                })}
            </View>
        );
    } catch (e) {
        console.warn("Failed to render images:", e);
        return null;
    }
});

FileAndMessageBubble.displayName = "FileAndMessageBubble";
