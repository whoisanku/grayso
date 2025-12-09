import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ImageGalleryModalProps = {
    visible: boolean;
    images: string[];
    initialIndex: number;
    onClose: () => void;
};

export const ImageGalleryModal = React.memo(({
    visible,
    images,
    initialIndex,
    onClose,
}: ImageGalleryModalProps) => {
    const insets = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

    // Reset to initial index when modal opens
    React.useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
        }
    }, [visible, initialIndex]);

    const imageUris = React.useMemo(() => 
        images.map(uri => ({ uri })),
        [images]
    );

    // Custom header with close button and image counter
    const renderHeader = React.useCallback(() => (
        <View 
            className="absolute left-0 right-0 top-0 z-50 flex-row items-center justify-between px-4 pb-3"
            style={{ paddingTop: insets.top + 8 }}
        >
            <TouchableOpacity 
                onPress={onClose} 
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    <Feather name="x" size={20} color="#fff" />
                </View>
            </TouchableOpacity>
            
            {images.length > 1 && (
                <View className="rounded-2xl bg-white/15 px-3.5 py-1.5">
                    <Text className="text-sm font-semibold text-white">
                        {currentIndex + 1} / {images.length}
                    </Text>
                </View>
            )}
        </View>
    ), [currentIndex, images.length, insets.top, onClose]);

    if (!visible || images.length === 0) {
        return null;
    }

    return (
        <>
            <StatusBar barStyle="light-content" />
            <ImageViewing
                images={imageUris}
                imageIndex={initialIndex}
                visible={visible}
                onRequestClose={onClose}
                onImageIndexChange={setCurrentIndex}
                HeaderComponent={renderHeader}
                swipeToCloseEnabled={true}
                doubleTapToZoomEnabled={true}
                backgroundColor="rgba(0, 0, 0, 0.95)"
                presentationStyle="overFullScreen"
            />
        </>
    );
});

ImageGalleryModal.displayName = 'ImageGalleryModal';
