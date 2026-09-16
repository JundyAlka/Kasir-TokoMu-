import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthScreen } from "@/components/auth/auth-screen";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthPage() {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    console.warn("Auth page session check caught error, proceeding to login screen:", error);
  }

  if (session) {
    redirect("/kasir");
  }

  return (
    <Suspense fallback={null}>
      <AuthScreen />
    </Suspense>
  );
}
