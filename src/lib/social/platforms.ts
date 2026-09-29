/** Redes onde o Cortix agenda posts. Facebook só publica de verdade pela Meta (Graph API). */
export const SOCIAL_PLATFORMS = ["tiktok", "instagram", "youtube", "facebook"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
