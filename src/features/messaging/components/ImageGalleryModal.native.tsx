import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
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
            style={[
                styles.header, 
                { paddingTop: insets.top + 8 }
            ]}
        >
            <TouchableOpacity 
                onPress={onClose} 
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

const styles = StyleSheet.create({
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
});
