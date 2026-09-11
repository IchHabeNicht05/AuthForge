"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api-client";
import { AppWindow, Loader2, Copy, Check } from "lucide-react";

interface AppRow {
  id: string;
  name: string;
  clientId: string;
  createdAt: string;
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ applications: AppRow[] }>("/api/applications");
    setApps(data.applications);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createApp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const data = await apiFetch<{ application: AppRow; clientSecret: string }>("/api/applications", {
        method: "POST",
        body: JSON.stringify({ name, redirectUrls: [] }),
      });
      setCreated({ clientId: data.application.clientId, clientSecret: data.clientSecret });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create application.");
    } finally {
      setCreating(false);
    }
  }

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register an app to get a client ID and secret — see the <a href="/demo" className="text-accent hover:underline">demo integration</a>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AppWindow className="h-4 w-4" /> Register an application
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {created ? (
            <div className="space-y-3 rounded-md border border-warning/30 bg-warning/10 p-4">
              <p className="text-sm font-medium text-warning">Save the client secret now — it won&apos;t be shown again.</p>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-muted-foreground">Client ID</span>
                  <code className="flex-1 truncate rounded bg-background px-2 py-1">{created.clientId}</code>
                  <Button size="icon" variant="outline" onClick={() => copy(created.clientId, "id")}>
                    {copied === "id" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-muted-foreground">Client secret</span>
                  <code className="flex-1 truncate rounded bg-background px-2 py-1">{created.clientSecret}</code>
                  <Button size="icon" variant="outline" onClick={() => copy(created.clientSecret, "secret")}>
                    {copied === "secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={createApp} className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="app-name">Application name</Label>
                <Input id="app-name" placeholder="My SaaS" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Register
              </Button>
            </form>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {apps?.length === 0 && <p className="text-sm text-muted-foreground">No applications registered yet.</p>}
        {apps?.map((app) => (
          <Card key={app.id}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm font-medium">{app.name}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{app.clientId}</p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(app.createdAt).toLocaleDateString()}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
