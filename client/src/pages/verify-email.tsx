import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

type VerifyState = "verifying" | "verified" | "failed" | "sent" | "resending";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<VerifyState>("verifying");
  const [message, setMessage] = useState("Verifying your business email and preparing your workspace.");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const sent = params.get("sent") === "1";
    const emailFromUrl = params.get("email") || "";
    setEmail(emailFromUrl);

    if (sent && !token) {
      setState("sent");
      setMessage(
        emailFromUrl
          ? `We sent a verification link to ${emailFromUrl}. Open it to activate your workspace.`
          : "We sent a verification link to your business email. Open it to activate your workspace.",
      );
      return;
    }

    if (!token) {
      setState("failed");
      setMessage("Verification token is missing.");
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          credentials: "include",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Verification failed");
        }
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        setState("verified");
        setMessage("Your business email is verified. Redirecting into your workspace.");
        setTimeout(() => {
          setLocation(data?.redirectTo || "/workspace");
        }, 900);
      } catch (error: any) {
        setState("failed");
        setMessage(error?.message || "Verification failed");
      }
    })();
  }, [setLocation]);

  async function resendVerification() {
    if (!email) return;
    setState("resending");
    setMessage(`Sending a new verification link to ${email}.`);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to resend verification");
      }

      if (payload?.verificationPreviewUrl) {
        setLocation(payload.verificationPreviewUrl);
        return;
      }

      setState("sent");
      setMessage(
        email
          ? `A fresh verification link has been sent to ${email}.`
          : "A fresh verification link has been sent to your business email.",
      );
    } catch (error: any) {
      setState("failed");
      setMessage(error?.message || "Failed to resend verification");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg border border-white/[0.08] bg-[#050505] p-8 sm:p-10"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#ff5a36]/70">
          Email verification
        </p>
        <div className="mt-4 flex items-center gap-3">
          {state === "verifying" ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#ff5a36]" />
          ) : state === "verified" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <XCircle className="h-5 w-5 text-red-400" />
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            {state === "verifying"
              ? "Verifying your email"
              : state === "verified"
                ? "Workspace ready"
                : "Verification failed"}
          </h1>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/55">{message}</p>
        {state !== "failed" && (
          <div className="mt-6 border border-white/[0.06] bg-black/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <MailCheck className="h-4 w-4 text-[#ff5a36]" />
              Business-domain verification enables automatic workspace joining by company domain.
            </div>
          </div>
        )}
        {state === "sent" && email && (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => void resendVerification()}
              className="inline-flex items-center justify-center border border-white/[0.08] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/5"
            >
              Resend verification
            </button>
            <button
              onClick={() => setLocation("/sign-in")}
              className="inline-flex items-center justify-center bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90"
            >
              Back to sign in
            </button>
          </div>
        )}
        {state === "resending" && (
          <div className="mt-6 flex items-center gap-2 text-sm text-white/55">
            <Loader2 className="h-4 w-4 animate-spin text-[#ff5a36]" />
            Sending a fresh link...
          </div>
        )}
      </motion.div>
    </div>
  );
}
