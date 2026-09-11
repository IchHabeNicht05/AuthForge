"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiError } from "@/lib/api-client";
import { KeyRound, Loader2, Copy, Check } from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ apiKeys: ApiKeyRow[] }>("/api/api-keys");
    setKeys(data.apiKeys);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const data = await apiFetch<{ secret: string }>("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes: [] }),
      });
      setNewSecret(data.secret);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create key.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    await apiFetch(`/api/api-keys/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use these to authenticate server-to-server requests.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Create a new key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {newSecret ? (
            <div className="space-y-3 rounded-md border border-warning/30 bg-warning/10 p-4">
              <p className="text-sm font-medium text-warning">
                Copy this key now — it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-3 py-2 font-mono text-xs">{newSecret}</code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(newSecret);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setNewSecret(null)}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={createKey} className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="key-name">Key name</Label>
                <Input id="key-name" placeholder="My SaaS — production" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Generate key
              </Button>
            </form>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {keys?.length === 0 && <p className="text-sm text-muted-foreground">No API keys yet.</p>}
        {keys?.map((k) => (
          <Card key={k.id}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{k.name}</p>
                  {k.revokedAt && <Badge variant="destructive">Revoked</Badge>}
                  {!k.revokedAt && k.expiresAt && new Date(k.expiresAt) < new Date() && (
                    <Badge variant="destructive">Expired</Badge>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{k.prefix}...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(k.createdAt).toLocaleDateString()} ·{" "}
                  {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}
                </p>
              </div>
              {!k.revokedAt && (
                <Button variant="ghost" size="sm" onClick={() => revoke(k.id)}>
                  Revoke
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
