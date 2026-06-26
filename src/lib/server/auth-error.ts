type AuthErrorResponse = {
  code?: string;
  message?: string;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "Email ini sudah pernah terdaftar. Silakan masuk atau gunakan email lain.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Email ini sudah pernah terdaftar. Silakan masuk atau gunakan email lain.",
  INVALID_EMAIL: "Format email tidak valid.",
  INVALID_EMAIL_OR_PASSWORD: "Email atau kata sandi salah.",
  INVALID_PASSWORD: "Email atau kata sandi salah.",
  PASSWORD_TOO_SHORT: "Kata sandi minimal 8 karakter.",
  PASSWORD_TOO_LONG: "Kata sandi terlalu panjang.",
};

export function getAuthErrorMessage(
  error: AuthErrorResponse | null,
  fallback: string
) {
  if (error?.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code];
  }

  return fallback;
}
