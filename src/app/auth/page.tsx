import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthScreen } from "@/components/auth/auth-screen";
import { auth } from "@/lib/auth";

export default async function AuthPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/dashboard");
  }

  return <AuthScreen />;
}
