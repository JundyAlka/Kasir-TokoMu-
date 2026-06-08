import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const AUTH_INTENTS = {
  "sign-in": {
    authPath: "/api/auth/sign-in/email",
    mode: "signin",
    defaultError: "Gagal masuk ke dashboard.",
    requiredFields: ["email", "password"] as const,
  },
  "sign-up": {
    authPath: "/api/auth/sign-up/email",
    mode: "signup",
    defaultError: "Gagal membuat akun baru.",
    requiredFields: ["name", "email", "password"] as const,
  },
} as const;

type Intent = keyof typeof AUTH_INTENTS;

function redirectToAuth(request: NextRequest, mode: string, error: string) {
  const url = new URL("/auth", request.url);
  url.searchParams.set("mode", mode);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

function appendSetCookieHeaders(source: Response, target: NextResponse) {
  const responseHeaders = source.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof responseHeaders.getSetCookie === "function"
      ? responseHeaders.getSetCookie()
      : (() => {
          const setCookie = source.headers.get("set-cookie");
          return setCookie ? [setCookie] : [];
        })();

  for (const value of setCookies) {
    target.headers.append("set-cookie", value);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ intent: string }> }
) {
  const { intent } = await params;
  const config = AUTH_INTENTS[intent as Intent];

  if (!config) {
    return NextResponse.json({ error: "Intent auth tidak dikenal." }, { status: 404 });
  }

  const formData = await request.formData();
  const callbackURL = String(formData.get("callbackURL") ?? "/dashboard");
  const payload = {
    callbackURL,
    ...(intent === "sign-up"
      ? {
          name: String(formData.get("name") ?? ""),
        }
      : {}),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const hasMissingField = config.requiredFields.some(
    (field) => String(formData.get(field) ?? "").trim().length === 0
  );
  if (hasMissingField) {
    return redirectToAuth(request, config.mode, "Lengkapi dulu data akun yang wajib diisi.");
  }

  const authURL = new URL(config.authPath, request.url);

  try {
    const authResponse = await fetch(authURL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: request.nextUrl.origin,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const authResult = (await authResponse.json().catch(() => null)) as
      | { message?: string; url?: string | null }
      | null;

    if (!authResponse.ok) {
      return redirectToAuth(
        request,
        config.mode,
        authResult?.message ?? config.defaultError
      );
    }

    const redirectTarget = new URL(authResult?.url ?? callbackURL, request.url);
    const response = NextResponse.redirect(redirectTarget, { status: 303 });
    appendSetCookieHeaders(authResponse, response);
    return response;
  } catch {
    return redirectToAuth(request, config.mode, config.defaultError);
  }
}
