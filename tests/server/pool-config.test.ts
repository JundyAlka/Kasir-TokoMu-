import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPoolConfig, isSslDisabled, needsSsl } from "@/db/pool-config";

describe("Database Pool & SSL Configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("isSslDisabled", () => {
    it("detects sslmode=disable in connection string URL query parameter", () => {
      expect(
        isSslDisabled("postgresql://postgres:postgres@db:5432/warungos?sslmode=disable")
      ).toBe(true);
      expect(
        isSslDisabled("postgresql://postgres:postgres@localhost:5432/warungos?sslmode=disable&uselibpqcompat=true")
      ).toBe(true);
    });

    it("detects ssl=false or ssl=0 in connection string", () => {
      expect(
        isSslDisabled("postgresql://postgres:postgres@db:5432/warungos?ssl=false")
      ).toBe(true);
      expect(
        isSslDisabled("postgresql://postgres:postgres@db:5432/warungos?ssl=0")
      ).toBe(true);
    });

    it("detects PGSSLMODE=disable from process.env", () => {
      process.env.PGSSLMODE = "disable";
      expect(
        isSslDisabled("postgresql://postgres:postgres@db:5432/warungos")
      ).toBe(true);
    });

    it("detects DATABASE_SSLMODE=disable from process.env", () => {
      process.env.DATABASE_SSLMODE = "disable";
      expect(
        isSslDisabled("postgresql://postgres:postgres@db:5432/warungos")
      ).toBe(true);
    });

    it("detects DATABASE_SSL=false from process.env", () => {
      process.env.DATABASE_SSL = "false";
      expect(
        isSslDisabled("postgresql://postgres:postgres@db:5432/warungos")
      ).toBe(true);
    });

    it("returns false for production SSL URLs without disable flag", () => {
      expect(
        isSslDisabled(
          "postgresql://postgres:pass@rnuh6nq3.us-east.database.insforge.app:5432/insforge?sslmode=require"
        )
      ).toBe(false);
    });
  });

  describe("needsSsl", () => {
    it("returns false when sslmode=disable is present", () => {
      expect(
        needsSsl("postgresql://postgres:postgres@db:5432/warungos?sslmode=disable")
      ).toBe(false);
      expect(
        needsSsl("postgresql://postgres:postgres@remote-host.com:5432/warungos?sslmode=disable")
      ).toBe(false);
    });

    it("returns false when PGSSLMODE=disable is in env", () => {
      process.env.PGSSLMODE = "disable";
      expect(
        needsSsl("postgresql://postgres:postgres@db:5432/warungos")
      ).toBe(false);
      expect(
        needsSsl("postgresql://postgres:pass@rnuh6nq3.us-east.database.insforge.app:5432/insforge")
      ).toBe(false);
    });

    it("returns false for local / docker hosts without explicit require", () => {
      expect(needsSsl("postgresql://postgres:postgres@localhost:5432/warungos")).toBe(false);
      expect(needsSsl("postgresql://postgres:postgres@127.0.0.1:5432/warungos")).toBe(false);
      expect(needsSsl("postgresql://postgres:postgres@db:5432/warungos")).toBe(false);
      expect(needsSsl("postgresql://postgres:postgres@postgres:5432/warungos")).toBe(false);
      expect(needsSsl("postgresql://postgres:postgres@host.docker.internal:5432/warungos")).toBe(false);
    });

    it("returns true for remote cloud hosts requiring SSL", () => {
      expect(
        needsSsl(
          "postgresql://postgres:pass@rnuh6nq3.us-east.database.insforge.app:5432/insforge?sslmode=require"
        )
      ).toBe(true);
      expect(
        needsSsl("postgresql://postgres:pass@aws-rds-cluster.amazonaws.com:5432/warungos")
      ).toBe(true);
    });
  });

  describe("createPoolConfig", () => {
    it("does NOT include ssl property when sslmode=disable is detected (Docker/local scenario)", () => {
      const config = createPoolConfig(
        "postgresql://postgres:postgres@db:5432/warungos?sslmode=disable"
      );
      expect(config.ssl).toBeUndefined();
      expect("ssl" in config).toBe(false);
    });

    it("does NOT include ssl property when PGSSLMODE=disable in .env (friend's Docker setup)", () => {
      process.env.PGSSLMODE = "disable";
      const config = createPoolConfig(
        "postgresql://postgres:postgres@db:5432/warungos"
      );
      expect(config.ssl).toBeUndefined();
      expect("ssl" in config).toBe(false);
    });

    it("includes ssl: { rejectUnauthorized: false } for remote production databases", () => {
      const config = createPoolConfig(
        "postgresql://postgres:pass@rnuh6nq3.us-east.database.insforge.app:5432/insforge?sslmode=require"
      );
      expect(config.ssl).toEqual({ rejectUnauthorized: false });
    });

    it("handles connection strings safely without throwing on unusual characters", () => {
      const config = createPoolConfig(
        "postgresql://postgres:pass#word@db:5432/warungos?sslmode=disable"
      );
      expect(config.ssl).toBeUndefined();
    });
  });
});
