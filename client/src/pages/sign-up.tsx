import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ShieldCheck, BriefcaseBusiness, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading, onboarding } = useIsAuthenticated();

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
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left side - Brand/Highlights */}
        <section className="relative hidden overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,90,54,0.15),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(255,255,255,0.04),transparent_25%),linear-gradient(160deg,#000_0%,#0a0a0a_42%,#111_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.4)_60%,rgba(0,0,0,0.9))]" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
            <motion.div
              initial={fadeUp.initial}
              animate={fadeUp.animate}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between"
            >
              <Link href="/">
                <span className="cursor-pointer font-bold text-xl tracking-tight text-white">
                  angle<span className="text-white/35">/rfp</span>
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
              <h1 className="text-[2.8rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[3.5rem]">
                Stop reading RFPs the hard way.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-white/45">
                Upload any RFP and get a scored brief with risks, deadlines, and a clear bid recommendation — in about seven minutes.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {signUpHighlights.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
                  className="rounded border border-white/[0.06] bg-white/[0.02] p-5"
                >
                  <item.Icon className="mb-3 h-5 w-5 text-[#ff5a36]/70" />
                  <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/40">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Right side - Google OAuth */}
        <section className="relative flex flex-col bg-[#050505]">
          <div className="flex items-center justify-between px-6 py-5 lg:hidden">
            <Link href="/">
              <span className="cursor-pointer font-bold text-lg tracking-tight text-white">
                angle<span className="text-white/35">/rfp</span>
              </span>
            </Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/40">
              New account
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
                  Sign in with your business Google account to create or join your agency workspace.
                </p>
              </div>

              <a
                href="/api/auth/google"
                className="inline-flex w-full items-center justify-center gap-3 border border-white/[0.12] bg-white px-6 py-3.5 text-sm font-bold text-black transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
              >
                <GoogleIcon />
                Continue with Google
              </a>

              <p className="mt-4 text-center text-[11px] text-white/30 leading-relaxed">
                Use your business email (e.g., you@agency.com).<br />
                Personal accounts like Gmail are not supported.
              </p>

              <div className="mt-8 border-t border-white/[0.06] pt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">Already have an account?</span>
                  <Link href="/sign-in">
                    <span className="cursor-pointer font-bold text-white transition-colors hover:text-[#ff5a36]">
                      Sign in
                    </span>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
