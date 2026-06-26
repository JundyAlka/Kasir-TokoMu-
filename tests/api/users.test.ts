import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { CASHIER_ID, setupTestDb, WORKSPACE_ID } from "../setup";

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("users API", () => {
  it("lists workspace users for pimpinan and rejects kasir access", async () => {
    await setupTestDb();
    const usersRoute = await import("@/app/api/users/route");

    const response = await usersRoute.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: WORKSPACE_ID,
          role: "pimpinan",
          isActive: true,
        }),
        expect.objectContaining({
          id: CASHIER_ID,
          role: "kasir",
          isActive: true,
        }),
      ])
    );

    await setupTestDb({ role: "kasir" });
    const kasirUsersRoute = await import("@/app/api/users/route");
    const rejected = await kasirUsersRoute.GET();
    expect(rejected.status).toBe(403);
  });

  it("invites a new kasir, assigns role, stores invitation, and writes audit log", async () => {
    const { pool } = await setupTestDb();
    const { POST } = await import("@/app/api/users/invite/route");

    const response = await POST(
      jsonRequest("http://localhost/api/users/invite", {
        email: "baru@tokomu.test",
        role: "kasir",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      email: "baru@tokomu.test",
      user: {
        email: "baru@tokomu.test",
        role: "kasir",
        isActive: true,
      },
      invitation: {
        status: "accepted",
      },
    });
    expect(body.temporaryPassword).toEqual(expect.any(String));

    const role = await pool.query(
      `select ur.role, ur.is_active
       from user_roles ur
       join "user" u on u.id = ur.user_id
       where lower(u.email) = 'baru@tokomu.test'`
    );
    expect(role.rows[0]).toMatchObject({ role: "kasir", is_active: 1 });

    const invitation = await pool.query(
      "select email, role, status from invitations where workspace_owner_id = $1",
      [WORKSPACE_ID]
    );
    expect(invitation.rows[0]).toMatchObject({
      email: "baru@tokomu.test",
      role: "kasir",
      status: "accepted",
    });

    const audit = await pool.query(
      "select event_type from audit_logs where workspace_owner_id = $1 and event_type = 'USER_INVITED'",
      [WORKSPACE_ID]
    );
    expect(audit.rows).toHaveLength(1);
  });

  it("changes staff role and soft-removes staff from the workspace", async () => {
    const { pool } = await setupTestDb();
    const roleRoute = await import("@/app/api/users/[id]/role/route");
    const userRoute = await import("@/app/api/users/[id]/route");

    const roleResponse = await roleRoute.PATCH(
      jsonRequest("http://localhost/api/users/usr_kasir/role", {
        role: "pengelola_keuangan",
      }, "PATCH"),
      { params: Promise.resolve({ id: CASHIER_ID }) }
    );
    const roleBody = await roleResponse.json();
    expect(roleResponse.status).toBe(200);
    expect(roleBody.user).toMatchObject({
      id: CASHIER_ID,
      role: "pengelola_keuangan",
      isActive: true,
    });

    const deleteResponse = await userRoute.DELETE(
      new NextRequest("http://localhost/api/users/usr_kasir", { method: "DELETE" }),
      { params: Promise.resolve({ id: CASHIER_ID }) }
    );
    const deleteBody = await deleteResponse.json();
    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.user).toMatchObject({
      id: CASHIER_ID,
      role: "pengelola_keuangan",
      isActive: false,
    });

    const role = await pool.query("select role, is_active from user_roles where user_id = $1", [
      CASHIER_ID,
    ]);
    expect(role.rows[0]).toMatchObject({
      role: "pengelola_keuangan",
      is_active: 0,
    });

    const audit = await pool.query(
      `select event_type from audit_logs
       where workspace_owner_id = $1 and event_type in ('ROLE_CHANGED', 'USER_DEACTIVATED')
       order by event_type`,
      [WORKSPACE_ID]
    );
    expect(audit.rows.map((row: { event_type: string }) => row.event_type)).toEqual([
      "ROLE_CHANGED",
      "USER_DEACTIVATED",
    ]);
  });

  it("rejects staff role, invite, and delete endpoints for non-pimpinan", async () => {
    await setupTestDb({ role: "kasir" });
    const inviteRoute = await import("@/app/api/users/invite/route");
    const roleRoute = await import("@/app/api/users/[id]/role/route");
    const userRoute = await import("@/app/api/users/[id]/route");

    const invite = await inviteRoute.POST(
      jsonRequest("http://localhost/api/users/invite", {
        email: "baru@tokomu.test",
        role: "kasir",
      })
    );
    const role = await roleRoute.PATCH(
      jsonRequest("http://localhost/api/users/usr_kasir/role", {
        role: "pengelola_keuangan",
      }, "PATCH"),
      { params: Promise.resolve({ id: CASHIER_ID }) }
    );
    const deleted = await userRoute.DELETE(
      new NextRequest("http://localhost/api/users/usr_kasir", { method: "DELETE" }),
      { params: Promise.resolve({ id: CASHIER_ID }) }
    );

    expect(invite.status).toBe(403);
    expect(role.status).toBe(403);
    expect(deleted.status).toBe(403);
  });
});
