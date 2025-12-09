import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import {
    Menu,
    MenuOptions,
    MenuOption,
    MenuTrigger,
} from "react-native-popup-menu";
import { Feather } from "@expo/vector-icons";

interface ChatMenuProps {
    isDark: boolean;
    accentColor: string;
    activeMailbox: "inbox" | "spam";
    isLoading: boolean;
    onMoveToSpam: () => void;
    onMoveToInbox: () => void;
}

export const ChatMenu: React.FC<ChatMenuProps> = ({
    isDark,
    accentColor,
    activeMailbox,
    isLoading,
    onMoveToSpam,
    onMoveToInbox,
}) => {
    const getBorderColor = (dark: boolean, type: "subtle" | "strong") => {
        if (type === "subtle") return dark ? "#334155" : "#e2e8f0";
        return dark ? "#475569" : "#cbd5e1";
    };

    if (isLoading) {
        return (
            <View className="ml-2 h-10 w-10 items-center justify-center">
                <ActivityIndicator size="small" color={isDark ? "#94a3b8" : "#64748b"} />
            </View>
        );
    }

    return (
        <Menu>
            <MenuTrigger
                customStyles={{
                    TriggerTouchableComponent: TouchableOpacity,
                    triggerTouchable: {
                        activeOpacity: 0.7,
                        underlayColor: 'transparent',
                    },
                }}
            >
                <View className="ml-2 h-10 w-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-slate-800">
                    <Feather
                        name="more-vertical"
                        size={20}
                        color={isDark ? "#94a3b8" : "#64748b"}
                    />
                </View>
            </MenuTrigger>

            <MenuOptions
                customStyles={{
                    optionsContainer: {
                        backgroundColor: isDark ? "#1e293b" : "#ffffff",
                        borderRadius: 12,
                        padding: 4,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        elevation: 8,
                        borderWidth: 1,
                        borderColor: getBorderColor(isDark, "subtle"),
                        marginTop: 30, // Adjust position to not cover the trigger
                        width: 160,
                    },
                }}
            >
                <MenuOption
                    onSelect={activeMailbox === "inbox" ? onMoveToSpam : onMoveToInbox}
                    customStyles={{
                        optionWrapper: {
                            padding: 10,
                            borderRadius: 8,
                        },
                    }}
                >
                    <View className="flex-row items-center">
                        <Feather
                            name={activeMailbox === "inbox" ? "alert-octagon" : "inbox"}
                            size={16}
                            color={activeMailbox === "inbox" ? "#ef4444" : accentColor}
                            style={{ marginRight: 10 }}
                        />
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "500",
                                color:
                                    activeMailbox === "inbox"
                                        ? "#ef4444"
                                        : isDark
                                            ? "#f1f5f9"
                                            : "#0f172a",
                            }}
                        >
                            {activeMailbox === "inbox" ? "Move to Spam" : "Move to Inbox"}
                        </Text>
                    </View>
                </MenuOption>
            </MenuOptions>
        </Menu>
    );
};
