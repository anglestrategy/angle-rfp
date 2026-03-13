import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { GrainOverlay } from "@/components/grain-overlay";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useIsAuthenticated } from "@/hooks/use-auth";

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useIsAuthenticated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/upload");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Brand Panel (left) ── */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-foreground overflow-hidden">
        {/* Grain overlay (inverted panel) */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%">
            <filter id="auth-grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.65"
                numOctaves="3"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#auth-grain)" />
          </svg>
        </div>

        {/* Editorial grid lines */}
        <div className="editorial-grid absolute inset-0 pointer-events-none opacity-[0.03]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1
              className="font-display font-black tracking-tight text-background leading-[0.85] mb-6"
              style={{ fontSize: "clamp(56px, 8vw, 96px)" }}
            >
              angle
            </h1>
            <p className="font-mono text-xs text-background/40 uppercase tracking-[0.2em] max-w-sm leading-relaxed">
              RFP intelligence for agencies that win.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Form Panel (right) ── */}
      <div className="flex-1 flex flex-col relative">
        <GrainOverlay />

        {/* Mobile brand strip */}
        <div className="lg:hidden px-6 py-6 border-b border-foreground/10">
          <Link href="/">
            <span className="font-display text-xl font-bold tracking-tight cursor-pointer">
              angle<span className="text-primary">/</span>RFP
            </span>
          </Link>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-sm"
          >
            <h2 className="text-2xl font-bold tracking-tight mb-1">
              Sign in
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              Welcome back. Enter your credentials to continue.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                try {
                  await apiRequest("POST", "/api/auth/sign-in", { email, password });
                  await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
                  setLocation("/upload");
                } catch (error: any) {
                  toast({
                    title: "Sign in failed",
                    description: error.message || "Unable to sign in",
                    variant: "destructive",
                  });
                } finally {
                  setSubmitting(false);
                }
              }}
              className="space-y-5"
            >
              {/* Email */}
              <div>
                <label className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground block mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  className="w-full px-4 py-3 text-sm bg-transparent border border-foreground/15 focus:border-foreground/40 outline-none transition-colors placeholder:text-muted-foreground/40"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground block mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 text-sm bg-transparent border border-foreground/15 focus:border-foreground/40 outline-none transition-colors placeholder:text-muted-foreground/40"
                  required
                />
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-60"
              >
                {submitting ? "Signing in..." : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </form>

            {/* Footer link */}
            <p className="text-sm text-muted-foreground mt-8 text-center">
              Don't have an account?{" "}
              <Link href="/sign-up">
                <span className="text-foreground font-medium hover:text-primary transition-colors cursor-pointer">
                  Sign up
                </span>
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
