import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, KeyRound, Building2, ScrollText } from "lucide-react";
import Link from "next/link";

export default async function DashboardOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [sessionCount, apiKeyCount, orgCount, recentLogs] = await Promise.all([
    prisma.session.count({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.apiKey.count({ where: { userId: user.id, revokedAt: null } }),
    prisma.organizationMember.count({ where: { userId: user.id } }),
    prisma.auditLog.findMany({
      where: { actorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const stats = [
    { label: "Active sessions", value: sessionCount, href: "/dashboard/sessions", icon: Monitor },
    { label: "API keys", value: apiKeyCount, href: "/dashboard/api-keys", icon: KeyRound },
    { label: "Organizations", value: orgCount, href: "/dashboard/organizations", icon: Building2 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.emailVerified ? "Your email is verified." : "Your email address isn't verified yet."}
          {!user.twoFactorEnabled && " Two-factor authentication is currently off."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:border-foreground/20">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                </div>
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" /> Recent activity
            </CardTitle>
            <CardDescription>The last events recorded on your account.</CardDescription>
          </div>
          <Link href="/dashboard/audit-log" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentLogs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          {recentLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
              <div>
                <Badge variant="outline" className="font-mono">
                  {log.event}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.ipAddress ?? "unknown IP"} · {log.userAgent?.slice(0, 40) ?? "unknown device"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{log.createdAt.toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
