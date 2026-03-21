import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const OEmbedSchema = z.object({
    url: z.string(),
    author_name: z.string(),
    author_url: z.string(),
    html: z.string(),
    width: z.number().optional(),
    height: z.number().nullable().optional(),
    type: z.string(),
    provider_name: z.string(),
    provider_url: z.string(),
    version: z.string(),
});

export type OEmbedResult = z.infer<typeof OEmbedSchema>;

export function useGetTwitterOEmbed(tweetUrl: string, isDark = false) {
    const theme = isDark ? "dark" : "light";
    return useQuery<OEmbedResult | null>({
        queryKey: ["twitter-oembed", tweetUrl, theme],
        queryFn: async () => {
            if (!tweetUrl) return null;

            // We use publish.twitter.com/oembed to get the official blockquote
            const response = await fetch(
                `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&dnt=true&omit_script=false&theme=${theme}`
            );

            if (!response.ok) {
                throw new Error(`Twitter OEmbed error: ${response.status}`);
            }

            const json = await response.json();
            const parsed = OEmbedSchema.safeParse(json);

            if (!parsed.success) {
                console.error("Twitter OEmbed validation error:", parsed.error);
                return null;
            }

            return parsed.data;
        },
        enabled: !!tweetUrl,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
    });
}
