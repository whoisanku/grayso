import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const TwitterUserSchema = z.object({
    id_str: z.string(),
    name: z.string(),
    screen_name: z.string(),
    profile_image_url_https: z.string(),
    is_blue_verified: z.boolean().optional(),
    verified: z.boolean().optional(),
}).passthrough();

const TwitterMediaSchema = z.object({
    type: z.string(),
    media_url_https: z.string(),
    expanded_url: z.string(),
    display_url: z.string(),
}).passthrough();

const TweetResultSchema = z.object({
    __typename: z.string().optional(),
    lang: z.string().optional(),
    id_str: z.string(),
    text: z.string(),
    created_at: z.string(),
    user: TwitterUserSchema,
    favorite_count: z.number().optional(),
    conversation_count: z.number().optional(),
    mediaDetails: z.array(TwitterMediaSchema).optional(),
    photos: z.array(z.any()).optional(),
}).passthrough();

export type TweetResult = z.infer<typeof TweetResultSchema>;

export function useGetTwitterTweet(tweetId: string | null) {
    return useQuery<TweetResult | null>({
        queryKey: ["twitter-tweet", tweetId],
        queryFn: async () => {
            if (!tweetId) return null;

            const response = await fetch(
                `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`
            );

            if (!response.ok) {
                throw new Error(`Twitter API error: ${response.status}`);
            }

            const json = await response.json();
            const parsed = TweetResultSchema.safeParse(json);

            if (!parsed.success) {
                console.error("Twitter validation error:", parsed.error);
                return null;
            }

            return parsed.data;
        },
        enabled: !!tweetId,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
