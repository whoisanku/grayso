import React, { memo } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SwipeableChatItem } from "./SwipeableChatItem";
import { MockConversation } from "../types";

interface ConversationListItemProps {
  item: MockConversation;
  isLoading: boolean;
  activeMailbox: "inbox" | "spam";
  accentColor: string;
  accentSoft: string;
  accentStrong: string;
  isDark: boolean;
  isDesktopWeb: boolean;
  onPress: (item: MockConversation) => void;
  onLongPress: (item: MockConversation) => void;
  onSwipeAction: (item: MockConversation) => void;
  onSwipeBegin: (id: string) => void;
  onSwipeEnd: (id: string) => void;
  checkIsSwiping: (id: string) => boolean;
}

export const ConversationListItem = memo(({
  item,
  isLoading,
  activeMailbox,
  accentColor,
  accentSoft,
  accentStrong,
  isDark,
  isDesktopWeb,
  onPress,
  onLongPress,
  onSwipeAction,
  onSwipeBegin,
  onSwipeEnd,
  checkIsSwiping,
}: ConversationListItemProps) => {
  return (
    <SwipeableChatItem
      onSwipeAction={() => onSwipeAction(item)}
      isLoading={isLoading}
      actionType={activeMailbox === 'inbox' ? 'spam' : 'inbox'}
      accentColor={accentColor}
      isDark={isDark}
      onSwipeBegin={() => onSwipeBegin(item.id)}
      onSwipeEnd={() => onSwipeEnd(item.id)}
    >
      <View className="flex-row items-center bg-white px-4 py-3 dark:bg-[#0a0f1a]">
        <TouchableOpacity
          className="flex-1 flex-row items-center"
          activeOpacity={0.7}
          onPress={() => {
            if (!checkIsSwiping(item.id)) {
              onPress(item);
            }
          }}
          onLongPress={() => {
             onLongPress(item);
          }}
          style={isDesktopWeb ? { borderRadius: 14 } : undefined}
        >
          <View className="mr-3">
            {item.isGroup && item.hasGroupImage && item.avatarUri ? (
              <Image
                source={{ uri: item.avatarUri }}
                className="h-14 w-14 rounded-full bg-gray-200 dark:bg-slate-700"
              />
            ) : item.isGroup && item.stackedAvatarUris && item.stackedAvatarUris.length > 0 ? (
              <View className="h-14 w-14 relative">
                {item.stackedAvatarUris.map((uri, index) => (
                  <Image
                    key={index}
                    source={{ uri }}
                    className="absolute h-10 w-10 rounded-full border-2 border-white bg-gray-200 dark:border-slate-800 dark:bg-slate-700"
                    style={{
                      top: index === 0 ? 0 : index === 1 ? 14 : 4,
                      left: index === 0 ? 0 : index === 1 ? 14 : 24,
                      zIndex: 3 - index,
                    }}
                  />
                ))}
              </View>
            ) : item.isGroup && item.isLoadingMembers ? (
              <View className="h-14 w-14 relative">
                {[0, 1, 2].map((i) => (
                  <View
                    key={`placeholder-${i}`}
                    className="absolute h-10 w-10 rounded-full border-2 border-white bg-gray-200 dark:border-slate-800 dark:bg-slate-700"
                    style={{
                      top: i === 0 ? 0 : i === 1 ? 14 : 4,
                      left: i === 0 ? 0 : i === 1 ? 14 : 24,
                      zIndex: 3 - i,
                    }}
                  />
                ))}
              </View>
            ) : item.avatarUri ? (
              <Image
                source={{ uri: item.avatarUri }}
                className="h-14 w-14 rounded-full bg-gray-200 dark:bg-slate-700"
              />
            ) : (
              <View
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: accentSoft }}
              >
                <Text
                  className="text-xl font-bold"
                  style={{ color: accentStrong }}
                >
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center justify-between mb-1">
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className="flex-1 mr-2 text-[15px] font-bold text-[#0f172a] dark:text-white"
              >
                {item.name}
              </Text>
              {item.time ? (
                <Text className="text-[13px] text-slate-500 flex-shrink-0 dark:text-slate-400">
                  {item.time}
                </Text>
              ) : null}
            </View>
            <View className="flex-row items-center">
              {item.isGroup ? (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  <Feather name="users" size={12} color={accentStrong} />
                </View>
              ) : null}
              <Text
                numberOfLines={1}
                className="flex-1 text-[14px] text-slate-500 dark:text-slate-400"
              >
                {item.preview}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </SwipeableChatItem>
  );
});
