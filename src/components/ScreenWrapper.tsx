import React from "react";
import {
    KeyboardAvoidingView as RNKeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
    ViewStyle,
    StatusBar as RNStatusBar,
} from "react-native";
import {
    SafeAreaView,
    Edge,
    SafeAreaProviderProps,
} from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { KeyboardAvoidingView as KeyboardControllerView } from "react-native-keyboard-controller";

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

    const containerStyle = [
        styles.container,
        { backgroundColor: defaultBackgroundColor },
        style,
    ];

    const content = scrollable ? (
        <ScrollView
            contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            {children}
        </ScrollView>
    ) : (
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
    );

    const Wrapper = (
        <SafeAreaView style={containerStyle} edges={edges}>
            {/* 
        StatusBar placeholder for Android if needed, 
        though Expo StatusBar usually handles this.
      */}
            {content}
        </SafeAreaView>
    );

    if (keyboardAvoiding) {
        if (useKeyboardController) {
            return (
                <KeyboardControllerView
                    style={styles.keyboardAvoiding}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={keyboardVerticalOffset}
                >
                    {Wrapper}
                </KeyboardControllerView>
            );
        }

        return (
            <RNKeyboardAvoidingView
                style={styles.keyboardAvoiding}
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardAvoiding: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
    },
});

export default ScreenWrapper;
