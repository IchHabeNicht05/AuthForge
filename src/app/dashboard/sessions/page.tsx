"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import { Laptop, Smartphone, Loader2 } from "lucide-react";

interface SessionRow {
  id: string;
  device: string | null;
  browser: string | null;
  os: string | null;
  approxLocation: string | null;
  createdAt: string;
  lastActiveAt: string;
  rememberDevice: boolean;
  isCurrent: boolean;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<{ sessions: SessionRow[] }>("/api/sessions");
    setSessions(data.sessions);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      await apiFetch(`/api/sessions/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeAllOthers() {
    setRevokingAll(true);
    try {
      await apiFetch("/api/sessions", { method: "DELETE" });
      await load();
    } finally {
      setRevokingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Active sessions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Devices currently signed in to your account.</p>
        </div>
        <Button variant="outline" size="sm" onClick={revokeAllOthers} disabled={revokingAll}>
          {revokingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Revoke all other sessions
        </Button>
      </div>

      <div className="space-y-3">
        {sessions === null && <p className="text-sm text-muted-foreground">Loading...</p>}
        {sessions?.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                {s.device?.toLowerCase().includes("mobile") ? (
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Laptop className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {s.browser ?? "Unknown browser"} · {s.os ?? "Unknown OS"}
                    </p>
                    {s.isCurrent && <Badge variant="accent">This device</Badge>}
                    {s.rememberDevice && <Badge variant="outline">Remembered</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.approxLocation ?? "Unknown location"} · last active {new Date(s.lastActiveAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {!s.isCurrent && (
                <Button variant="ghost" size="sm" onClick={() => revoke(s.id)} disabled={revokingId === s.id}>
                  {revokingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
