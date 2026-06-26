ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "is_active" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_workspace_active_idx" ON "user_roles" ("workspace_owner_id", "is_active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "token" text NOT NULL,
  "status" text NOT NULL,
  "invited_by_user_id" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  CONSTRAINT "invitations_role_check" CHECK ("role" in ('pengelola_keuangan', 'kasir')),
  CONSTRAINT "invitations_status_check" CHECK ("status" in ('pending', 'accepted', 'expired'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_workspace_email_idx" ON "invitations" ("workspace_owner_id", "email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_idx" ON "invitations" ("token");
