import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Sparkles, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useIsAuthenticated } from "@/hooks/use-auth";

const signUpHighlights: Array<{ title: string; text: string; Icon: LucideIcon }> = [
  {
    title: "Free to start",
    text: "Three full analyses a month, no card required. Upgrade when it makes sense.",
    Icon: ShieldCheck,
  },
  {
    title: "Built for agencies",
    text: "Upload an RFP, get a scored brief with risks flagged and a clear bid recommendation.",
    Icon: BriefcaseBusiness,
  },
  {
    title: "Results you can share",
    text: "Export a PDF brief for your team or client lead in one click.",
    Icon: Sparkles,
  },
];

// Animation variants matching landing page
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, onboarding } = useIsAuthenticated();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation(onboarding?.status === "completed" ? "/upload" : "/workspace");
    }
  }, [isAuthenticated, isLoading, onboarding?.status, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-sm text-white/50 font-mono">Checking your session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left side - Brand/Highlights */}
        <section className="relative hidden overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,90,54,0.15),transparent_25%),radial-gradient(circle_at_78%_24%,rgba(255,255,255,0.04),transparent_25%),linear-gradient(155deg,#000_0%,#0a0a0a_45%,#111_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.4)_55%,rgba(0,0,0,0.9))]" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
            <motion.div
              initial={fadeUp.initial}
              animate={fadeUp.animate}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between"
            >
              <Link href="/">
                <span className="cursor-pointer font-bold text-xl tracking-tight text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]">
                  ANGLE<span className="text-white/35">/RFP</span>
                </span>
              </Link>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
                New account
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="max-w-2xl"
            >
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#ff5a36]/80">
                Get started free
              </p>
              <h1 className="max-w-xl text-[clamp(2.5rem,5vw,5rem)] font-extrabold leading-[0.92] tracking-[-0.04em] text-white text-balance">
                Stop reading RFPs the hard way.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-white/50">
                Upload any RFP and get a scored brief with risks, deadlines, and
                a clear bid recommendation — in about seven minutes.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid max-w-2xl gap-px bg-white/[0.06] md:grid-cols-3"
            >
              {signUpHighlights.map(({ title, text, Icon }) => (
                <div
                  key={title}
                  className="bg-black p-6 border border-white/[0.06]"
                >
                  <div className="mb-3 inline-flex border border-[#ff5a36]/30 bg-[#ff5a36]/10 p-2 text-[#ff5a36]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/40">{text}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Right side - Form */}
        <section className="relative flex min-h-screen flex-col overflow-hidden bg-black">
          {/* Mobile header */}
          <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] px-6 py-5 lg:hidden">
            <Link href="/">
              <span className="cursor-pointer font-bold text-xl tracking-tight text-white">
                ANGLE<span className="text-white/35">/RFP</span>
              </span>
            </Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/40">
              Sign Up
            </span>
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="w-full max-w-md border border-white/[0.08] bg-[#050505] p-8 sm:p-10"
            >
              <div className="mb-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#ff5a36]/70">
                  Create account
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">Try it free.</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/40">
                  Use your business email to create or join your agency workspace.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (password !== confirmPassword) {
                    toast({
                      title: "Passwords do not match",
                      description: "Please confirm your password again.",
                      variant: "destructive",
                    });
                    return;
                  }

                  setSubmitting(true);
                  try {
                    const response = await fetch("/api/auth/sign-up", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        fullName: name,
                        email,
                        password,
                      }),
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                      throw new Error(payload?.message || "Unable to create account");
                    }
                    if (payload?.verificationPreviewUrl) {
                      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
                      setLocation(payload.verificationPreviewUrl);
                      return;
                    }
                    if (payload?.redirectTo) {
                      setLocation(payload.redirectTo);
                      return;
                    }
                    throw new Error("Verification link was not generated");
                  } catch (error: any) {
                    toast({
                      title: "Sign up failed",
                      description: error.message || "Unable to create account",
                      variant: "destructive",
                    });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="space-y-5"
              >
                <div>
                  <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full border border-white/[0.08] bg-black px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#ff5a36]/60 focus:bg-[#0a0a0a]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">
                    Business email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    className="w-full border border-white/[0.08] bg-black px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#ff5a36]/60 focus:bg-[#0a0a0a]"
                    required
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-white/[0.08] bg-black px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#ff5a36]/60 focus:bg-[#0a0a0a]"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">
                      Confirm password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-white/[0.08] bg-black px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#ff5a36]/60 focus:bg-[#0a0a0a]"
                      required
                    />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.985 }}
                  className="inline-flex w-full items-center justify-center gap-2 bg-white px-6 py-3.5 text-sm font-bold text-black transition-colors hover:bg-white/90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
                >
                  {submitting ? "Creating account..." : "Create free account"}
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </form>

              <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-5 text-sm">
                <span className="text-white/40">Already have an account?</span>
                <Link href="/sign-in">
                  <span className="cursor-pointer font-bold text-white transition-colors hover:text-[#ff5a36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]">
                    Sign in
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
