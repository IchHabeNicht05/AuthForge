import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import {
  LayoutDashboard,
  Monitor,
  ShieldCheck,
  KeyRound,
  Building2,
  ScrollText,
  AppWindow,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/sessions", label: "Sessions", icon: Monitor },
  { href: "/dashboard/security", label: "Security", icon: ShieldCheck },
  { href: "/dashboard/api-keys", label: "API keys", icon: KeyRound },
  { href: "/dashboard/organizations", label: "Organizations", icon: Building2 },
  { href: "/dashboard/applications", label: "Applications", icon: AppWindow },
  { href: "/dashboard/audit-log", label: "Audit log", icon: ScrollText },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const userLabel = user.name ?? user.email;

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Mobilní horní lišta — jen pod md breakpointem */}
      <header className="flex h-16 items-center justify-between border-b border-border px-4 md:hidden">
        <MobileNav navItems={NAV} userLabel={userLabel} />
        <Link href="/">
          <Logo />
        </Link>
        <div className="w-9" /> {/* vyvážení layoutu, ať je logo na střed */}
      </header>

      {/* Desktopový postranní panel — beze změny */}
      <aside className="hidden w-64 shrink-0 border-r border-border md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-2 px-3 text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-mono text-xs">
              {userLabel.slice(0, 1).toUpperCase()}
            </div>
            <span className="truncate text-muted-foreground">{user.email}</span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-5xl py-10">{children}</div>
      </main>
    </div>
  );
}