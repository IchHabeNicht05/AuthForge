"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import { ScrollText } from "lucide-react";

interface LogRow {
  id: string;
  event: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  useEffect(() => {
    apiFetch<{ logs: LogRow[] }>("/api/audit-logs").then((data) => setLogs(data.logs));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">A complete, append-only history of security events on your account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Events
          </CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border">
          {logs?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No events recorded yet.</p>}
          {logs?.map((log) => (
            <div key={log.id} className="flex items-center justify-between py-3">
              <div>
                <Badge variant="outline" className="font-mono">
                  {log.event}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.ipAddress ?? "unknown IP"} · {log.userAgent?.slice(0, 50) ?? "unknown device"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
