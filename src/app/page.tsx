import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    console.warn("Home page session check caught error, redirecting to /auth:", error);
  }

  redirect(session?.user ? "/kasir" : "/auth");
}
