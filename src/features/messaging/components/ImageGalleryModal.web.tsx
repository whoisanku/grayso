import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ImageGalleryModalProps = {
    visible: boolean;
    images: string[];
    initialIndex: number;
    onClose: () => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
            <View style={styles.overlay}>
                {/* Header */}
                <View 
                    style={[
                        styles.header, 
                        { paddingTop: insets.top + 8 }
                    ]}
                >
                    <TouchableOpacity 
                        onPress={onClose} 
                        style={styles.closeButton}
                    >
                        <View style={styles.closeButtonInner}>
                            <Feather name="x" size={20} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    
                    {images.length > 1 && (
                        <View style={styles.counterContainer}>
                            <Text style={styles.counterText}>
                                {currentIndex + 1} / {images.length}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Image Container */}
                <View style={styles.imageContainer}>
                    {/* Previous Button */}
                    {images.length > 1 && (
                        <TouchableOpacity 
                            style={[styles.navButton, styles.navButtonLeft]}
                            onPress={handlePrevious}
                        >
                            <Feather name="chevron-left" size={32} color="#fff" />
                        </TouchableOpacity>
                    )}

                    {/* Current Image */}
                    <Image
                        source={{ uri: images[currentIndex] }}
                        style={styles.image}
                        resizeMode="contain"
                    />

                    {/* Next Button */}
                    {images.length > 1 && (
                        <TouchableOpacity 
                            style={[styles.navButton, styles.navButtonRight]}
                            onPress={handleNext}
                        >
                            <Feather name="chevron-right" size={32} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Thumbnail Strip (if multiple images) */}
                {images.length > 1 && (
                    <View style={styles.thumbnailContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {images.map((uri, index) => (
                                <TouchableOpacity 
                                    key={index}
                                    onPress={() => setCurrentIndex(index)}
                                    style={[
                                        styles.thumbnail,
                                        index === currentIndex && styles.thumbnailActive
                                    ]}
                                >
                                    <Image 
                                        source={{ uri }} 
                                        style={styles.thumbnailImage}
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

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    closeButton: {
        padding: 4,
    },
    closeButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    counterContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
    },
    counterText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 60,
        paddingVertical: 80,
    },
    image: {
        width: '100%',
        height: '100%',
        maxWidth: SCREEN_WIDTH * 0.9,
        maxHeight: SCREEN_HEIGHT * 0.75,
    },
    navButton: {
        position: 'absolute',
        zIndex: 10,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navButtonLeft: {
        left: 16,
    },
    navButtonRight: {
        right: 16,
    },
    thumbnailContainer: {
        paddingVertical: 16,
        paddingHorizontal: 8,
    },
    thumbnail: {
        width: 60,
        height: 60,
        marginHorizontal: 4,
        borderRadius: 8,
        overflow: 'hidden',
        opacity: 0.6,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    thumbnailActive: {
        opacity: 1,
        borderColor: '#fff',
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
});
