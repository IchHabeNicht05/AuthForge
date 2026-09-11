"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiError } from "@/lib/api-client";
import {
  ShieldCheck,
  ShieldOff,
  Loader2,
  KeyRound,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface UserInfo {
  twoFactorEnabled: boolean;
  email: string;
  hasPassword: boolean;
}

export default function SecurityPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [step, setStep] = useState<
    "idle" | "setup" | "confirm" | "backup-codes"
  >("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const router = useRouter();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UserInfo>("/api/user").then(setUser);
  }, []);

  async function startSetup() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ secret: string; qrDataUrl: string }>(
        "/api/2fa/setup",
        { method: "POST" },
      );
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setStep("confirm");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to start setup.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmSetup() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ backupCodes: string[] }>(
        "/api/2fa/confirm",
        {
          method: "POST",
          body: JSON.stringify({ code }),
        },
      );
      setBackupCodes(data.backupCodes);
      setStep("backup-codes");
      setUser((u) => (u ? { ...u, twoFactorEnabled: true } : u));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  async function disable2fa() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ currentPassword: disablePassword }),
      });
      setUser((u) => (u ? { ...u, twoFactorEnabled: false } : u));
      setDisablePassword("");
      setStep("idle");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to disable 2FA.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    try {
      await apiFetch("/api/user/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordMessage(
        "Password updated. Other sessions have been signed out.",
      );
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordMessage(
        err instanceof ApiError ? err.message : "Unable to update password.",
      );
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two-factor authentication and password.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Two-factor authentication
            </CardTitle>
            <CardDescription>
              Require a code from an authenticator app when signing in.
            </CardDescription>
          </div>
          {user && (
            <Badge variant={user.twoFactorEnabled ? "success" : "outline"}>
              {user.twoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {step === "idle" && user && !user.twoFactorEnabled && (
            <Button onClick={startSetup} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Set up two-factor authentication
            </Button>
          )}

          {step === "confirm" && qrDataUrl && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (1Password, Authy,
                Google Authenticator), then enter the 6-digit code it generates.
              </p>
              <div className="flex items-center gap-6">
                <Image
                  src={qrDataUrl}
                  alt="2FA QR code"
                  width={160}
                  height={160}
                  className="rounded-md border border-border"
                  unoptimized
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Can&apos;t scan? Enter this code manually:
                  </p>
                  <p className="rounded bg-muted px-2 py-1 font-mono text-xs">
                    {secret}
                  </p>
                </div>
              </div>
              <div className="max-w-xs space-y-2">
                <Label htmlFor="confirm-code">6-digit code</Label>
                <Input
                  id="confirm-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono"
                  maxLength={6}
                />
              </div>
              <Button
                onClick={confirmSetup}
                disabled={loading || code.length !== 6}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm and enable
              </Button>
            </div>
          )}

          {step === "backup-codes" && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-warning">
                Save these backup codes now — they won&apos;t be shown again.
                Each can be used once if you lose access to your authenticator
                app.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted p-4 font-mono text-sm">
                {backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <Button variant="outline" onClick={() => setStep("idle")}>
                Done
              </Button>
            </div>
          )}

          {step === "idle" && user?.twoFactorEnabled && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Disabling requires your password.
              </p>
              <div className="flex max-w-sm items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="disable-password">Current password</Label>
                  <Input
                    id="disable-password"
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={disable2fa}
                  disabled={loading || !disablePassword}
                >
                  <ShieldOff className="h-4 w-4" /> Disable
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Change password
          </CardTitle>
          <CardDescription>
            Changing your password signs out every other device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="max-w-sm space-y-4">
            {passwordMessage && (
              <p className="text-sm text-muted-foreground">{passwordMessage}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit">Update password</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {user?.hasPassword !== false && (
            <div className="max-w-sm space-y-2">
              <Label htmlFor="delete-password">Password</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
          )}
          <Button
            variant="destructive"
            onClick={async () => {
              if (!confirm("This permanently deletes your account. Continue?"))
                return;
              try {
                await apiFetch("/api/user", {
                  method: "DELETE",
                  body: JSON.stringify({
                    ...(deletePassword ? { password: deletePassword } : {}),
                    confirmation: "DELETE",
                  }),
                });
                router.push("/");
              } catch (err) {
                setError(
                  err instanceof ApiError
                    ? err.message
                    : "Unable to delete account.",
                );
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
