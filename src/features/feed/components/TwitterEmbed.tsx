import React from "react";
import { View, Text, Pressable, Linking, Platform, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useGetTwitterTweet } from "../api/useGetTwitterTweet";
import { useGetTwitterOEmbed } from "../api/useGetTwitterOEmbed";

type TwitterEmbedProps = {
    url: string;
    isDark: boolean;
    extraData?: Record<string, any> | null;
};

export function TwitterEmbed({ url, isDark, extraData }: TwitterEmbedProps) {
    // Determine the effective URL (prioritize extraData if relevant)
    const effectiveUrl = React.useMemo(() => {
        const raw = extraData?.TwitterURL || url;
        // Normalize: strip query params AND force twitter.com domain
        // (OEmbed and Syndication APIs are more stable with twitter.com)
        try {
            const parsed = new URL(raw.trim());
            if (parsed.hostname.includes("twitter.com") || parsed.hostname.includes("x.com")) {
                // Force twitter.com for consistency
                const clean = `https://twitter.com${parsed.pathname}`;
                return clean;
            }
        } catch {
            // ignore
        }
        return raw;
    }, [url, extraData]);

    // Extract Tweet ID for the native pre-fetch/fallback
    const tweetId = React.useMemo(() => {
        try {
            // Handle various formats: twitter.com, x.com, with/without query params
            const match = effectiveUrl.match(/(?:twitter\.com|x\.com)\/.+\/status\/(\d+)/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }, [effectiveUrl]);

    // We fetch BOTH. Native for quick preview, OEmbed for the "Real" blockquote look.
    const { data: tweet, isLoading: isNativeLoading } = useGetTwitterTweet(tweetId);
    const { data: oembed, isLoading: isOembedLoading, isFetching: isOembedFetching } = useGetTwitterOEmbed(effectiveUrl, isDark);

    // Ref-based approach for web: set innerHTML ONCE so React never overwrites
    // the widget that widgets.js builds.
    const webEmbedRef = React.useRef<HTMLDivElement | null>(null);
    const [webWidgetReady, setWebWidgetReady] = React.useState(false);

    React.useEffect(() => {
        if (Platform.OS !== "web" || !oembed?.html || !webEmbedRef.current) return;

        // Only set the innerHTML if the container is empty (first mount or new oembed)
        if (webEmbedRef.current.childElementCount === 0) {
            webEmbedRef.current.innerHTML = oembed.html;
        }

        setWebWidgetReady(true);

        // Load or re-run Twitter widgets.js
        const loadWidgets = () => {
            // @ts-ignore
            if (window.twttr?.widgets) {
                // @ts-ignore
                window.twttr.widgets.load(webEmbedRef.current);
            }
        };

        // @ts-ignore
        if (window.twttr?.widgets) {
            loadWidgets();
        } else {
            // Check if script is already added
            if (!document.getElementById("twitter-wjs")) {
                const script = document.createElement("script");
                script.id = "twitter-wjs";
                script.src = "https://platform.twitter.com/widgets.js";
                script.async = true;
                script.onload = loadWidgets;
                document.body.appendChild(script);
            }
        }
    }, [oembed?.html]);

    const handlePress = () => {
        Linking.openURL(effectiveUrl).catch(() => { });
    };

    // Priority 1: If we have OEmbed data, show it.
    if (oembed?.html) {
        if (Platform.OS === "web") {
            return (
                <View
                    className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"
                    style={{ minHeight: 150 }}
                >
                    <div
                        ref={webEmbedRef as any}
                        style={{ display: 'flex', justifyContent: 'center' }}
                    />
                </View>
            );
        }

        return (
            <View
                className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                style={{ height: 450 }} // WebView needs a height, or a complex auto-height solution
            >
                <WebView
                    originWhitelist={["*"]}
                    source={{
                        html: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                                <style>
                                    body { 
                                        margin: 0; 
                                        padding: 0; 
                                        background-color: transparent;
                                        display: flex;
                                        justify-content: center;
                                    }
                                    .twitter-tweet {
                                        margin: 0 !important;
                                    }
                                </style>
                            </head>
                            <body>
                                ${oembed.html}
                            </body>
                            </html>
                        `
                    }}
                    style={{ backgroundColor: "transparent" }}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    onShouldStartLoadWithRequest={(request) => {
                        // Open links in external browser instead of inside WebView
                        if (request.url !== "about:blank") {
                            Linking.openURL(request.url).catch(() => { });
                            return false;
                        }
                        return true;
                    }}
                />
            </View>
        );
    }

    // Priority 2: If OEmbed is loading/fetching, show a spinner to avoid the "flash" of fallback
    if (isOembedLoading || (isOembedFetching && !oembed)) {
        return (
            <View className="mt-3 h-32 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <ActivityIndicator size="small" color={isDark ? "#94a3b8" : "#64748b"} />
            </View>
        );
    }

    if (!tweet) {
        // Fallback to basic link card if fetch fails or no tweet id
        return (
            <Pressable
                onPress={handlePress}
                className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
            >
                <View className="p-4">
                    <Text className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                        View post on X.com
                    </Text>
                    <Text className="mt-1 text-[13px] text-sky-600 dark:text-sky-400" numberOfLines={1}>
                        {url}
                    </Text>
                </View>
            </Pressable>
        );
    }

    return (
        <Pressable
            onPress={handlePress}
            className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
            style={Platform.OS === "web" ? { cursor: "pointer" } : undefined}
        >
            <View className="p-4">
                {/* Header */}
                <View className="flex-row items-start justify-between">
                    <View className="flex-row items-center flex-1">
                        <View className="h-11 w-11 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            {tweet.user.profile_image_url_https ? (
                                <Image
                                    source={{ uri: tweet.user.profile_image_url_https.replace("_normal", "_400x400") }}
                                    style={{ width: "100%", height: "100%" }}
                                    contentFit="cover"
                                />
                            ) : (
                                <View className="h-full w-full items-center justify-center">
                                    <Feather name="user" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                                </View>
                            )}
                        </View>
                        <View className="ml-3 flex-1">
                            <View className="flex-row items-center">
                                <Text className="text-[16px] font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                                    {tweet.user.name}
                                </Text>
                                {(tweet.user.is_blue_verified || tweet.user.verified) && (
                                    <View className="ml-1">
                                        <Feather name="check-circle" size={16} color="#3b82f6" />
                                    </View>
                                )}
                            </View>
                            <View className="flex-row items-center">
                                <Text className="text-[14px] text-slate-500 dark:text-slate-400" numberOfLines={1}>
                                    @{tweet.user.screen_name}
                                </Text>
                                <Text className="mx-1.5 text-slate-400 dark:text-slate-600">·</Text>
                                <Text className="text-[14px] font-bold text-sky-500">Follow</Text>
                            </View>
                        </View>
                    </View>
                    <View className="ml-2">
                        <Feather name="twitter" size={24} color={isDark ? "#ffffff" : "#000000"} />
                    </View>
                </View>

                {/* Content */}
                <View className="mt-4">
                    <Text className="text-[17px] leading-6 text-slate-900 dark:text-slate-100">
                        {tweet.text}
                    </Text>
                </View>

                {/* Media (Images) */}
                {tweet.mediaDetails && tweet.mediaDetails.length > 0 && (
                    <View className="mt-4 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-900">
                        {tweet.mediaDetails.map((media, index) => (
                            <Image
                                key={media.media_url_https}
                                source={{ uri: media.media_url_https }}
                                style={{
                                    width: "100%",
                                    aspectRatio: tweet.mediaDetails!.length === 1 ? 16 / 9 : 1.2,
                                    marginTop: index > 0 ? 2 : 0
                                }}
                                contentFit="cover"
                            />
                        ))}
                    </View>
                )}

                {/* Footer Time & Info */}
                <View className="mt-4 flex-row items-center justify-between">
                    <Text className="text-[14px] text-slate-500 dark:text-slate-400">
                        {new Date(tweet.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {new Date(tweet.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Feather name="info" size={16} color={isDark ? "#475569" : "#94a3b8"} />
                </View>

                {/* Interaction Row */}
                <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-900">
                    <View className="flex-row items-center gap-1.5">
                        <Feather name="heart" size={18} color="#f43f5e" />
                        <Text className="text-[14px] font-medium text-slate-600 dark:text-slate-400">
                            {tweet.favorite_count ? (tweet.favorite_count > 1000 ? `${(tweet.favorite_count / 1000).toFixed(1)}K` : tweet.favorite_count) : "0"}
                        </Text>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                        <Feather name="message-circle" size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                        <Text className="text-[14px] font-medium text-slate-600 dark:text-slate-400">Reply</Text>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                        <Feather name="link" size={18} color={isDark ? "#94a3b8" : "#64748b"} />
                        <Text className="text-[14px] font-medium text-slate-600 dark:text-slate-400">Copy link</Text>
                    </View>
                </View>

                {/* Read Replies Button */}
                {tweet.conversation_count !== undefined && (
                    <Pressable
                        onPress={handlePress}
                        className="mt-4 items-center justify-center rounded-full border border-slate-200 py-2.5 dark:border-slate-800"
                    >
                        <Text className="text-[15px] font-bold text-slate-900 dark:text-white">
                            Read {tweet.conversation_count} replies
                        </Text>
                    </Pressable>
                )}
            </View>
        </Pressable>
    );
}
