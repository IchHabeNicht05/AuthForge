"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Building2, Loader2 } from "lucide-react";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ organizations: OrgRow[] }>("/api/organizations");
    setOrgs(data.organizations);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await apiFetch("/api/organizations", { method: "POST", body: JSON.stringify({ name, slug }) });
      setName("");
      setSlug("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create organization.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Shared workspaces with members and roles.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> New organization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createOrg} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input id="org-name" placeholder="Acme Inc." required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">Slug</Label>
              <Input
                id="org-slug"
                placeholder="acme-inc"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                className="font-mono"
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {orgs?.length === 0 && <p className="text-sm text-muted-foreground">You&apos;re not part of any organization yet.</p>}
        {orgs?.map((org) => (
          <Link key={org.id} href={`/dashboard/organizations/${org.id}`}>
            <Card className="transition-colors hover:border-foreground/20">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium">{org.name}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">/{org.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{org.memberCount} members</span>
                  <Badge variant="outline">{org.role}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
