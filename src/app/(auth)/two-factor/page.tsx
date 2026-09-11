"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError } from "@/lib/api-client";
import { AlertCircle, ShieldCheck } from "lucide-react";

export default function TwoFactorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeToken = searchParams.get("token") ?? "";
  const next = searchParams.get("next") ?? "/dashboard";

  const [code, setCode] = useState("");
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ challengeToken, code, isBackupCode }),
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <ShieldCheck className="h-5 w-5 text-accent" />
        <CardTitle>Two-factor verification</CardTitle>
        <CardDescription>
          {isBackupCode
            ? "Enter one of your unused backup codes."
            : "Enter the 6-digit code from your authenticator app."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="code">{isBackupCode ? "Backup code" : "Authentication code"}</Label>
            <Input
              id="code"
              autoFocus
              autoComplete="one-time-code"
              placeholder={isBackupCode ? "1234-5678-90" : "123456"}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono tracking-widest"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setIsBackupCode((v) => !v);
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {isBackupCode ? "Use authenticator app instead" : "Use a backup code instead"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
