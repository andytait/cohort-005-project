// PROTOTYPE (wayfinder: "How does the Notification inbox look and behave?").
// Throwaway. Signs a Knock user token so the browser feed can load.
import { signUserToken } from "@knocklabs/node";

try {
  process.loadEnvFile(".env");
} catch {}

export async function getKnockPrototypeConfig(userId: number | null) {
  const publicKey = process.env.KNOCK_PUBLIC_API_KEY;
  const feedChannelId = process.env.KNOCK_FEED_CHANNEL_ID;
  const signingKey = process.env.KNOCK_SIGNING_KEY;
  if (!userId || !publicKey || !feedChannelId || !signingKey) return null;

  const userToken = await signUserToken(String(userId), {
    signingKey,
    expiresInSeconds: 60 * 60,
  });
  return { publicKey, feedChannelId, userToken, userId: String(userId) };
}

export type KnockPrototypeConfig = NonNullable<
  Awaited<ReturnType<typeof getKnockPrototypeConfig>>
>;
