import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  StyleSheet,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getBorderColor } from '@/theme/borders';
import { CENTER_CONTENT_MAX_WIDTH } from '@/alf/breakpoints';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface ChatActionModalProps {
  visible: boolean;
  onClose: () => void;
  onAction: () => void;
  actionType: 'spam' | 'inbox';
  isDark: boolean;
  accentColor: string;
  isLoading: boolean;
  chatName: string;
  chatAvatar?: string | null;
}

export const ChatActionModal: React.FC<ChatActionModalProps> = ({
  visible,
  onClose,
  onAction,
  actionType,
  isDark,
  accentColor,
  isLoading,
  chatName,
  chatAvatar,
}) => {
  const isSpamAction = actionType === 'spam';
  const actionColor = isSpamAction ? '#ef4444' : accentColor;
  const actionIcon = isSpamAction ? 'alert-octagon' : 'inbox';
  const actionLabel = isSpamAction ? 'Move to Spam' : 'Move to Inbox';

  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth >= 1024;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setIsModalVisible(true);
      progress.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(
        0,
        {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(setIsModalVisible)(false);
          }
        }
      );
    }
  }, [visible, progress]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, isDark ? 0.85 : 0.7]),
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [400, 0]) },
    ],
  }));

  if (!isModalVisible) return null;

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              overlayAnimatedStyle,
              { backgroundColor: '#000000' },
            ]}
            pointerEvents="none"
          />
          
          {/* Desktop: Center the modal */}
          {isDesktopWeb ? (
            <View style={styles.desktopContainer}>
              <TouchableWithoutFeedback>
                <Animated.View
                  style={[
                    styles.bottomSheet,
                    sheetAnimatedStyle,
                    {
                      backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
                      maxWidth: CENTER_CONTENT_MAX_WIDTH,
                      width: '100%',
                      marginHorizontal: 'auto',
                    },
                  ]}
                >
                  {renderModalContent()}
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          ) : (
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.bottomSheet,
                  sheetAnimatedStyle,
                  {
                    backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
                  },
                ]}
              >
                {renderModalContent()}
              </Animated.View>
            </TouchableWithoutFeedback>
          )}
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  function renderModalContent() {
    return (
      <>
        {/* Header with Avatar and Name */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            {chatAvatar ? (
              <Image
                source={{ uri: chatAvatar }}
                style={styles.avatar}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' },
                ]}
              >
                <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 18 }}>
                  {chatName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              style={[
                styles.headerName,
                { color: isDark ? '#f8fafc' : '#0f172a' },
              ]}
              numberOfLines={1}
            >
              {chatName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeButton,
              {
                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              },
            ]}
            activeOpacity={0.7}
          >
            <Feather
              name="x"
              size={20}
              color={isDark ? '#94a3b8' : '#64748b'}
            />
          </TouchableOpacity>
        </View>

        {/* Options Container with shade */}
        <View style={styles.optionsContainer}>
          <View
            style={[
              styles.optionsBox,
              {
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderColor: getBorderColor(isDark, 'subtle'),
              },
            ]}
          >
            {/* Action Option */}
            <TouchableOpacity
              onPress={() => {
                onAction();
                onClose();
              }}
              disabled={isLoading}
              activeOpacity={0.7}
              style={[
                styles.menuOption,
                {
                  borderBottomWidth: 0.5,
                  borderBottomColor: getBorderColor(isDark, 'subtle'),
                },
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: actionColor },
                ]}
              >
                {actionLabel}
              </Text>
              {isLoading ? (
                <ActivityIndicator color={actionColor} size="small" />
              ) : (
                <Feather name={actionIcon} size={20} color={actionColor} />
              )}
            </TouchableOpacity>

            {/* Cancel Option */}
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              style={styles.menuOption}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: isDark ? '#94a3b8' : '#64748b' },
                ]}
              >
                Cancel
              </Text>
              <Feather
                name="x"
                size={20}
                color={isDark ? '#94a3b8' : '#64748b'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  desktopContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  optionsBox: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
