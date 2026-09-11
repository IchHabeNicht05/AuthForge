"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { CodeBlock } from "@/components/code-block";
import { AppWindow, ArrowRight } from "lucide-react";

/**
 * A deliberately tiny standalone demo: it does NOT call AuthForge's own
 * cookie-based session (that's what /dashboard uses). Instead it shows the
 * integration path a *separate* application takes — hold an AuthForge API
 * key server-side, send it as a bearer token, and treat a 200 response as
 * "this request is authenticated as this AuthForge user". Generate a key
 * on the Applications/API keys page first, then paste it below.
 */
export default function DemoPage() {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function callProtectedRoute() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/demo", { headers: { Authorization: `Bearer ${apiKey}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <Badge />
        </div>
      </header>

      <div className="container max-w-2xl py-16">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <AppWindow className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">My SaaS</h1>
            <p className="text-sm text-muted-foreground">A demo app integrating AuthForge as its identity provider.</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1–2. Sign up and sign in</CardTitle>
              <CardDescription>
                A real integration sends users through AuthForge&apos;s hosted auth pages. Try it with your own account.
              </CardDescription>
            </CardHeader>
            <CardFooter className="gap-3">
              <Button asChild variant="outline">
                <Link href="/register">Sign up via AuthForge</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login">Log in via AuthForge</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Make an authenticated request</CardTitle>
              <CardDescription>
                Server-side code for &quot;My SaaS&quot; holds an AuthForge API key and calls a protected endpoint with it.
                Generate a key from{" "}
                <Link href="/dashboard/api-keys" className="text-accent hover:underline">
                  your dashboard
                </Link>{" "}
                and paste it below to see a real round trip.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">AuthForge API key</Label>
                <Input
                  id="api-key"
                  placeholder="af_live_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono"
                />
              </div>
              <Button onClick={callProtectedRoute} disabled={!apiKey || loading}>
                {loading ? "Sending..." : "Call GET /api/demo"} <ArrowRight className="h-4 w-4" />
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {result && <CodeBlock label="response">{result}</CodeBlock>}
              <CodeBlock label="server.ts (My SaaS backend)">{`const res = await fetch("https://your-app.dev/api/demo", {
  headers: { Authorization: \`Bearer \${process.env.AUTHFORGE_API_KEY}\` },
});
const { authenticatedAs } = await res.json();
// authenticatedAs.userId is now trusted server-side`}</CodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Log out</CardTitle>
              <CardDescription>Ends the AuthForge session; the API key above keeps working independently until revoked.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Badge() {
  return <span className="font-mono text-xs text-muted-foreground">demo app</span>;
}
