import { createAuthClient } from "better-auth/react";

// Di browser (client-side), prioritaskan window.location.origin agar request auth
// selalu same-origin dan bebas dari masalah CORS / domain mismatch di multi-domain (Vercel, InsForge, VPS, Custom Domain).
function getClientBaseUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
}

export const authClient = createAuthClient({
  baseURL: getClientBaseUrl(),
});

export const { signIn, signOut, signUp, useSession } = authClient;
