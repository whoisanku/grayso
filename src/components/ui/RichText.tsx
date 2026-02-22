import React from "react";
import { View, Text, Linking, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useColorScheme } from "nativewind";
import { getRichTextSegments, type RichTextSegment } from "@/lib/richText";
import { TwitterEmbed } from "@/features/feed/components/TwitterEmbed";

type RichTextProps = {
    text: string;
    extraData?: Record<string, any> | null;
    textClassName?: string;
    linkClassName?: string;
    mentionClassName?: string;
    hashtagClassName?: string;
    numberOfLines?: number;
};

export function RichText({
    text,
    extraData,
    textClassName = "text-slate-900 dark:text-slate-100",
    linkClassName = "text-sky-600 dark:text-sky-400 font-medium",
    mentionClassName = "text-sky-600 dark:text-sky-400 font-semibold",
    hashtagClassName = "text-sky-600 dark:text-sky-400",
    numberOfLines,
}: RichTextProps) {
    const navigation = useNavigation<any>();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const segments = React.useMemo(() => getRichTextSegments(text), [text]);

    const twitterUrl = React.useMemo(() => {
        // 1. Check extraData if available (standard DeSo / Focus requirement)
        if (extraData?.TwitterURL) return extraData.TwitterURL;
        if (extraData?.EmbedVideoURL && (extraData.EmbedVideoURL.includes("twitter.com") || extraData.EmbedVideoURL.includes("x.com"))) {
            return extraData.EmbedVideoURL;
        }

        // 2. Fallback to parsing from text segments
        const link = segments.find(
            (s) =>
                s.type === "link" &&
                (s.url.includes("twitter.com") || s.url.includes("x.com")) &&
                s.url.includes("/status/"),
        );
        return link?.type === "link" ? link.url : null;
    }, [segments, extraData]);

    const handleMentionPress = (username: string) => {
        navigation.navigate("Profile", { username });
    };

    const handleLinkPress = (url: string) => {
        Linking.openURL(url).catch((err) =>
            console.error("Failed to open URL:", err),
        );
    };

    return (
        <View>
            <Text className={textClassName} numberOfLines={numberOfLines}>
                {segments.map((segment, index) => {
                    // ... existing segment mapping ...
                    if (segment.type === "mention") {
                        return (
                            <Text
                                key={`${index}-${segment.content}`}
                                className={mentionClassName}
                                onPress={() => handleMentionPress(segment.username)}
                                style={Platform.OS === "web" ? { cursor: "pointer" } : undefined}
                            >
                                {segment.content}
                            </Text>
                        );
                    }

                    if (segment.type === "hashtag") {
                        return (
                            <Text
                                key={`${index}-${segment.content}`}
                                className={hashtagClassName}
                                onPress={() => { }}
                                style={Platform.OS === "web" ? { cursor: "pointer" } : undefined}
                            >
                                {segment.content}
                            </Text>
                        );
                    }

                    if (segment.type === "link") {
                        return (
                            <Text
                                key={`${index}-${segment.content}`}
                                className={linkClassName}
                                onPress={() => handleLinkPress(segment.url)}
                                style={Platform.OS === "web" ? { cursor: "pointer" } : undefined}
                            >
                                {segment.content}
                            </Text>
                        );
                    }

                    return (
                        <Text key={`${index}-${segment.content}`}>{segment.content}</Text>
                    );
                })}
            </Text>

            {twitterUrl && <TwitterEmbed url={twitterUrl} isDark={isDark} extraData={extraData} />}
        </View>
    );
}
