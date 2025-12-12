import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Text, Platform, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

export type VideoPlayerModalProps = {
    visible: boolean;
    uri: string | null;
    onClose: () => void;
    isDark?: boolean;
};

// Helper to convert iframe URL to HLS URL for native playback
const getHlsUrl = (uri: string | null): string | null => {
    if (!uri) return null;

    // Only convert for Native platforms
    if (Platform.OS !== 'web' && uri.includes('iframe.videodelivery.net')) {
        // Extract video ID
        const parts = uri.split('/');
        const lastPart = parts[parts.length - 1];
        const videoId = lastPart.split('?')[0]; // Remove query params if any

        return `https://videodelivery.net/${videoId}/manifest/video.m3u8`;
    }

    return uri;
};

export const VideoPlayerModal = React.memo(({
    visible,
    uri,
    onClose,
    isDark = true,
}: VideoPlayerModalProps) => {
    const insets = useSafeAreaInsets();
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Escape key listener for Web
    useEffect(() => {
        if (Platform.OS === 'web' && visible) {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [visible, onClose]);

    // Reset state when modal opens/closes or URI changes
    useEffect(() => {
        if (visible) {
            setIsLoading(true);
            setHasError(false);
            setErrorMessage('');
        }
    }, [visible, uri]);

    if (!visible || !uri) return null;

    const isWeb = Platform.OS === 'web';
    const isIframeUrl = uri.includes('iframe.videodelivery.net');

    const renderContent = () => {
        // Web + Cloudflare Iframe = Use Iframe (Reliable)
        if (isWeb && isIframeUrl) {
            const iframeSrc = uri.includes('?') ? `${uri}&autoplay=true` : `${uri}?autoplay=true`;
            return (
                <View style={styles.videoContainer}>
                    <iframe
                        src={iframeSrc}
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                        }}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                    />

                    {/* Close button overlay - High Z-Index for Web */}
                    <View
                        style={[
                            styles.header,
                            { paddingTop: 20 }
                        ]}
                        pointerEvents="box-none"
                    >
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            // Web specific props
                            // @ts-ignore
                            dataSet={{ className: "cursor-pointer" }}
                        >
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        // Native or Direct URL = Use Native Player
        const videoUri = getHlsUrl(uri);
        if (!videoUri) return null;

        return (
            <NativeVideoPlayer
                uri={videoUri}
                onClose={onClose}
                onError={(msg) => {
                    setHasError(true);
                    setErrorMessage(msg);
                    setIsLoading(false);
                }}
                onLoad={() => setIsLoading(false)}
            />
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="black" />
                {renderContent()}
            </View>
        </Modal>
    );
});

function NativeVideoPlayer({ uri, onClose, onError, onLoad }: { uri: string, onClose: () => void, onError: (msg: string) => void, onLoad: () => void }) {
    const insets = useSafeAreaInsets();

    const player = useVideoPlayer(uri, (player) => {
        player.loop = false;
        player.play();
    });

    useEffect(() => {
        const subscription = player.addListener('statusChange', (status) => {
            if (status.error) {
                onError(status.error.message || 'Unknown playback error');
            }
        });

        const playingSubscription = player.addListener('playingChange', (isPlaying) => {
            if (isPlaying) {
                onLoad();
            }
        });

        return () => {
            subscription.remove();
            playingSubscription.remove();
        };
    }, [player, onError, onLoad]);

    return (
        <View style={styles.videoContainer}>
            <VideoView
                style={StyleSheet.absoluteFill}
                player={player}
                allowsFullscreen
                allowsPictureInPicture
                nativeControls
            />

            {/* Close button overlay */}
            <View
                style={[
                    styles.header,
                    { paddingTop: insets.top + 10 }
                ]}
                pointerEvents="box-none"
            >
                <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative', // Ensure absolute children are relative to this
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        zIndex: 9999, // High z-index for web
        pointerEvents: 'box-none', // Allow clicks to pass through empty areas
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer', // For web
        pointerEvents: 'auto', // Ensure button captures clicks
    },
});

VideoPlayerModal.displayName = 'VideoPlayerModal';
