import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRequestUser } from "@/lib/server/app-service";
import { listAuditLogs } from "@/lib/server/audit";
import { requireRole } from "@/lib/server/rbac";
import { formatDateTime } from "@/lib/format";

type PageProps = {
  searchParams?: Promise<{
    eventType?: string;
    actorUserId?: string;
    start?: string;
    end?: string;
  }>;
};

function payloadSummary(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  return JSON.stringify(value).slice(0, 180);
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  let workspaceOwnerId: string;

  try {
    await getRequestUser();
    const context = await requireRole(["pimpinan"]);
    workspaceOwnerId = context.workspaceOwnerId;
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      redirect("/dashboard");
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/auth");
    }

    throw error;
  }

  const filters = (await searchParams) ?? {};
  const logs = await listAuditLogs(workspaceOwnerId, {
    eventType: filters.eventType?.trim() || undefined,
    actorUserId: filters.actorUserId?.trim() || undefined,
    start: filters.start ? `${filters.start}T00:00:00.000Z` : undefined,
    end: filters.end ? `${filters.end}T23:59:59.999Z` : undefined,
  });

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card/74">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Audit log</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]" action="/pengaturan/audit-log">
            <div className="grid gap-2">
              <Label htmlFor="eventType">Event type</Label>
              <Input id="eventType" name="eventType" defaultValue={filters.eventType ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="actorUserId">Actor user ID</Label>
              <Input id="actorUserId" name="actorUserId" defaultValue={filters.actorUserId ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="start">Mulai</Label>
              <Input id="start" name="start" type="date" defaultValue={filters.start ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">Sampai</Label>
              <Input id="end" name="end" type="date" defaultValue={filters.end ?? ""} />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Filter</Button>
              <Button variant="outline" render={<Link href="/pengaturan/audit-log" />} nativeButton={false}>
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/74">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                  <TableCell className="font-medium">{entry.eventType}</TableCell>
                  <TableCell>
                    <div>
                      <p>{entry.actorName ?? entry.actorUserId}</p>
                      <p className="text-xs text-muted-foreground">{entry.actorEmail ?? entry.actorUserId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{entry.entityType}</p>
                      <p className="text-xs text-muted-foreground">{entry.entityId ?? "-"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[420px] overflow-hidden text-ellipsis text-xs text-muted-foreground">
                    {payloadSummary(entry.payload)}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Belum ada audit log untuk filter ini.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
