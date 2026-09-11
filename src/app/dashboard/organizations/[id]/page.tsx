"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Users, Loader2 } from "lucide-react";

interface Member {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  user: { id: string; email: string; name: string | null };
}

const ROLES: Member["role"][] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const orgId = params.id;

  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ members: Member[] }>(`/api/organizations/${orgId}/members`);
    setMembers(data.members);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await apiFetch(`/api/organizations/${orgId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to invite member.");
    } finally {
      setInviting(false);
    }
  }

  async function updateRole(memberId: string, newRole: Member["role"]) {
    await apiFetch(`/api/organizations/${orgId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ role: newRole }),
    });
    await load();
  }

  async function remove(memberId: string) {
    await apiFetch(`/api/organizations/${orgId}/members/${memberId}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage who has access and what they can do.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Invite a member
          </CardTitle>
          <CardDescription>They must already have an AuthForge account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Member["role"])}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {ROLES.filter((r) => r !== "OWNER").map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Invite
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {members?.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                <p className="text-xs text-muted-foreground">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={m.role}
                  onChange={(e) => updateRole(m.id, e.target.value as Member["role"])}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => remove(m.id)}>
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
