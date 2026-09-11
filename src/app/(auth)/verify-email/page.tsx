"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError } from "@/lib/api-client";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    apiFetch("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Unable to verify email.");
      });
  }, [token]);

  return (
    <Card>
      <CardHeader>
        {status === "loading" && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {status === "success" && <CheckCircle2 className="h-5 w-5 text-success" />}
        {status === "error" && <AlertCircle className="h-5 w-5 text-destructive" />}
        <CardTitle>
          {status === "loading" && "Verifying..."}
          {status === "success" && "Email verified"}
          {status === "error" && "Verification failed"}
        </CardTitle>
        <CardDescription>
          {status === "success" && "Your email address has been confirmed."}
          {status === "error" && message}
        </CardDescription>
      </CardHeader>
      {status !== "loading" && (
        <CardFooter>
          <Button asChild className="w-full" variant="outline">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
