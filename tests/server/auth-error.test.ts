import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "@/lib/server/auth-error";

describe("getAuthErrorMessage", () => {
  it("menjelaskan bahwa email sudah pernah terdaftar", () => {
    expect(
      getAuthErrorMessage(
        { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
        "Gagal membuat akun baru."
      )
    ).toBe("Email ini sudah pernah terdaftar. Silakan masuk atau gunakan email lain.");
  });

  it("menerjemahkan kredensial login yang tidak valid", () => {
    expect(
      getAuthErrorMessage(
        { code: "INVALID_EMAIL_OR_PASSWORD" },
        "Gagal masuk ke dashboard."
      )
    ).toBe("Email atau kata sandi salah.");
  });

  it("tidak menampilkan pesan internal untuk error yang tidak dikenal", () => {
    expect(
      getAuthErrorMessage(
        { code: "INTERNAL_SERVER_ERROR", message: "connect ECONNREFUSED" },
        "Gagal membuat akun baru."
      )
    ).toBe("Gagal membuat akun baru.");
  });
});
