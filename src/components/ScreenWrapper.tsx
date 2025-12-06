import React from "react";
import {
    KeyboardAvoidingView as RNKeyboardAvoidingView,
    Platform,
    ScrollView,
    View,
    ViewStyle,
} from "react-native";
import {
    SafeAreaView,
    Edge,
} from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";

// Dynamically import keyboard controller only on native
let KeyboardControllerView: any = View;
if (Platform.OS !== "web") {
    try {
        KeyboardControllerView = require("react-native-keyboard-controller").KeyboardAvoidingView;
    } catch (e) {
        console.warn("react-native-keyboard-controller not found");
    }
}

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: ViewStyle;
    contentContainerStyle?: ViewStyle;
    edges?: Edge[];
    scrollable?: boolean;
    keyboardAvoiding?: boolean;
    keyboardVerticalOffset?: number;
    backgroundColor?: string;
    keyboardBehavior?: "height" | "padding" | "position";
    useKeyboardController?: boolean;
}

const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
    children,
    style,
    contentContainerStyle,
    edges = ["top", "bottom", "left", "right"],
    scrollable = false,
    keyboardAvoiding = true,
    keyboardVerticalOffset = 0,
    backgroundColor,
    keyboardBehavior,
    useKeyboardController = false,
}) => {
    const { colorScheme } = useColorScheme();

    const defaultBackgroundColor = backgroundColor
        ? backgroundColor
        : colorScheme === "dark"
            ? "#000000"
            : "#ffffff";

    const content = scrollable ? (
        <ScrollView
            contentContainerStyle={contentContainerStyle}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            className="flex-grow"
        >
            {children}
        </ScrollView>
    ) : (
        <View style={contentContainerStyle} className="flex-1">
            {children}
        </View>
    );

    const Wrapper = (
        <SafeAreaView
            style={[{ flex: 1, backgroundColor: defaultBackgroundColor }, style]}
            edges={edges}
        >
            {content}
        </SafeAreaView>
    );

    if (keyboardAvoiding) {
        if (useKeyboardController && Platform.OS !== 'web') {
            return (
                <KeyboardControllerView
                    className="flex-1"
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={keyboardVerticalOffset}
                >
                    {Wrapper}
                </KeyboardControllerView>
            );
        }

        return (
            <RNKeyboardAvoidingView
                className="flex-1"
                behavior={
                    keyboardBehavior ?? (Platform.OS === "ios" ? "padding" : "height")
                }
                keyboardVerticalOffset={keyboardVerticalOffset}
            >
                {Wrapper}
            </RNKeyboardAvoidingView>
        );
    }

    return Wrapper;
};

export default ScreenWrapper;
