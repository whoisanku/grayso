import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ImageGalleryModalProps = {
    visible: boolean;
    images: string[];
    initialIndex: number;
    onClose: () => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_IMAGE_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

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

    const handlePrevious = React.useCallback(() => {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    }, [images.length]);

    const handleNext = React.useCallback(() => {
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    }, [images.length]);

    // Handle keyboard navigation
    React.useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft') {
                handlePrevious();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, onClose, handlePrevious, handleNext]);

    if (!visible || images.length === 0) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/95">
                {/* Header */}
                <View 
                    className="absolute left-0 right-0 top-0 z-50 flex-row items-center justify-between px-4 pb-3"
                    style={{ paddingTop: insets.top + 8 }}
                >
                    {images.length > 1 ? (
                        <View className="rounded-2xl bg-white/15 px-3.5 py-1.5">
                            <Text className="text-sm font-semibold text-white">
                                {currentIndex + 1} / {images.length}
                            </Text>
                        </View>
                    ) : (
                        <View />
                    )}

                    <TouchableOpacity 
                        onPress={onClose} 
                        className="p-1"
                    >
                        <View className="h-9 w-9 items-center justify-center rounded-full bg-white/15">
                            <Feather name="x" size={20} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Image Container */}
                <View className="flex-1 items-center justify-center px-16 py-20">
                    {/* Previous Button */}
                    {images.length > 1 && (
                        <TouchableOpacity 
                            className="absolute left-4 z-10 h-12 w-12 items-center justify-center rounded-full bg-white/15"
                            onPress={handlePrevious}
                        >
                            <Feather name="chevron-left" size={32} color="#fff" />
                        </TouchableOpacity>
                    )}

                    {/* Current Image */}
                    <Image
                        source={{ uri: images[currentIndex] }}
                        className="h-full w-full"
                        style={{
                            maxWidth: SCREEN_WIDTH * 0.9,
                            maxHeight: SCREEN_HEIGHT * 0.75,
                        }}
                        contentFit="contain"
                        placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
                        transition={500}
                    />

                    {/* Next Button */}
                    {images.length > 1 && (
                        <TouchableOpacity 
                            className="absolute right-4 z-10 h-12 w-12 items-center justify-center rounded-full bg-white/15"
                            onPress={handleNext}
                        >
                            <Feather name="chevron-right" size={32} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Thumbnail Strip (if multiple images) */}
                {images.length > 1 && (
                    <View className="px-2 py-4">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {images.map((uri, index) => (
                                <TouchableOpacity 
                                    key={index}
                                    onPress={() => setCurrentIndex(index)}
                                    className={`mx-1 h-[60px] w-[60px] overflow-hidden rounded-lg border-2 ${index === currentIndex ? 'border-white opacity-100' : 'border-transparent opacity-60'}`}
                                >
                                    <Image 
                                        source={{ uri }} 
                                        className="h-full w-full"
                                        contentFit="cover"
                                        placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
                                        transition={500}
                                    />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </View>
        </Modal>
    );
});

ImageGalleryModal.displayName = 'ImageGalleryModal';
