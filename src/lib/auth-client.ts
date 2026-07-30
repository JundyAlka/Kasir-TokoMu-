import { createAuthClient } from "better-auth/react";

// NEXT_PUBLIC_BETTER_AUTH_URL harus diset di .env VPS ke URL publik app
// (misal: https://domain-kamu.com atau http://ip-vps:3000)
// Jika tidak diset, default ke window.location.origin (aman untuk dev lokal)
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
});

export const { signIn, signOut, signUp, useSession } = authClient;
