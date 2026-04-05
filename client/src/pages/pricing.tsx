import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Minus, ArrowRight } from "lucide-react";
import { NavBar } from "@/components/nav-bar";

// Animation variants matching landing page
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

/* ── Animated price number ── */
function AnimatedPrice({ value }: { value: number }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.25 }}
        className="inline-block"
      >
        ${value}
      </motion.span>
    </AnimatePresence>
  );
}

/* ── Feature comparison data ── */
const COMPARISON = [
  {
    category: "Qualification",
    features: [
      { name: "RFP qualifications per month", free: "3", premium: "Unlimited" },
      { name: "Bid / no-bid recommendation", free: true, premium: true },
      { name: "Agency risk flags", free: false, premium: true },
      { name: "Scope & requirements breakdown", free: false, premium: true },
      { name: "Budget adequacy & pursuit cost", free: false, premium: true },
    ],
  },
  {
    category: "Decision Output",
    features: [
      { name: "Executive brief PDF", free: false, premium: true },
      { name: "Submission complexity checklist", free: false, premium: true },
      { name: "Client quality notes", free: false, premium: true },
      { name: "Saudi readiness cues", free: false, premium: true },
    ],
  },
  {
    category: "Support",
    features: [
      { name: "Email support",                 free: true,  premium: true },
      { name: "Priority support",              free: false, premium: true },
    ],
  },
];

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const monthlyPrice = 49;
  const annualPrice = 39;
  const displayPrice = isAnnual ? annualPrice : monthlyPrice;

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar />

      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-16 py-16 md:py-24">
        {/* ── Header ── */}
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-[clamp(2rem,4vw,4rem)] font-extrabold tracking-[-0.04em] leading-[1.05] mb-4 text-white text-balance">
            Qualify before you commit.
          </h1>
          <p className="text-lg text-white/50">
            Built for creative agency new-business teams that need fast bid judgment.
          </p>
        </motion.div>

        {/* ── Billing Toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <button
            onClick={() => setIsAnnual(false)}
            className={`font-mono text-[11px] uppercase tracking-[0.15em] px-4 py-2 transition-colors ${
              !isAnnual ? "text-white" : "text-white/40"
            }`}
          >
            Monthly
          </button>

          {/* Toggle switch - sharp corners */}
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-12 h-6 border border-white/20 bg-white/5 transition-colors"
          >
            <motion.div
              className="absolute top-0.5 w-5 h-5 bg-[#ff5a36]"
              animate={{ left: isAnnual ? "calc(100% - 21px)" : "1px" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>

          <button
            onClick={() => setIsAnnual(true)}
            className={`font-mono text-[11px] uppercase tracking-[0.15em] px-4 py-2 transition-colors ${
              isAnnual ? "text-white" : "text-white/40"
            }`}
          >
            Annual
            <span className="text-[#ff5a36] ml-2">-20%</span>
          </button>
        </motion.div>

        {/* ── Pricing Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.06] mb-20"
        >
          {/* Free Tier */}
          <div className="bg-black border border-white/[0.06] p-8 lg:p-10">
            <div className="mb-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/50 mb-3">
                Free
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-white">$0</span>
                <span className="text-sm text-white/40">/mo</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                "3 qualification reviews per month",
                "Bid / no-bid recommendation",
                "Email support",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-[#ff5a36] flex-shrink-0 mt-0.5" />
                  <span className="text-white/50">{item}</span>
                </li>
              ))}
            </ul>

            <Link href="/upload">
              <motion.span
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold border border-white/15 text-white hover:border-white/30 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </motion.span>
            </Link>
          </div>

          {/* Premium Tier */}
          <div className="bg-black border border-[#ff5a36]/30 p-8 lg:p-10 relative">
            {/* Recommended badge */}
            <div className="absolute -top-px left-6">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#ff5a36] text-black px-3 py-1">
                Recommended
              </span>
            </div>

            <div className="mb-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/50 mb-3">
                Premium
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  <AnimatedPrice value={displayPrice} />
                </span>
                <span className="text-sm text-white/40">/mo</span>
              </div>
              {isAnnual && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-white/40 mt-1 font-mono"
                >
                  Billed annually at ${annualPrice * 12}/yr
                </motion.p>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              {[
                "Unlimited qualification reviews",
                "Agency risk register with severity",
                "Scope and requirements breakdown",
                "Budget adequacy and pursuit-cost framing",
                "Executive brief PDF",
                "Submission complexity checklist",
                "Client quality notes",
                "Saudi readiness cues",
                "Priority support",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-[#ff5a36] flex-shrink-0 mt-0.5" />
                  <span className="text-white/70">{item}</span>
                </li>
              ))}
            </ul>

            <Link href="/sign-up">
              <motion.span
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold bg-white text-black hover:bg-white/90 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </motion.span>
            </Link>
          </div>
        </motion.div>

        {/* ── Feature Comparison Table ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/50 mb-6">
            Feature Comparison
          </p>

          <div className="border border-white/[0.06]">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px] border-b border-white/[0.06] px-4 py-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                Feature
              </span>
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 text-center">
                Free
              </span>
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 text-center">
                Premium
              </span>
            </div>

            {COMPARISON.map((section) => (
              <div key={section.category}>
                {/* Category header */}
                <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.04]">
                  <span className="text-xs font-semibold text-white/70">
                    {section.category}
                  </span>
                </div>

                {/* Feature rows */}
                {section.features.map((feat) => (
                  <div
                    key={feat.name}
                    className="grid grid-cols-[1fr_100px_100px] border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-sm text-white/50">
                      {feat.name}
                    </span>
                    <span className="flex justify-center">
                      {typeof feat.free === "string" ? (
                        <span className="text-sm font-mono text-white/60">{feat.free}</span>
                      ) : feat.free ? (
                        <Check className="h-4 w-4 text-[#ff5a36]" />
                      ) : (
                        <Minus className="h-4 w-4 text-white/20" />
                      )}
                    </span>
                    <span className="flex justify-center">
                      {typeof feat.premium === "string" ? (
                        <span className="text-sm font-mono text-white/60">
                          {feat.premium}
                        </span>
                      ) : feat.premium ? (
                        <Check className="h-4 w-4 text-[#ff5a36]" />
                      ) : (
                        <Minus className="h-4 w-4 text-white/20" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer credit */}
        <p className="font-mono text-[11px] text-white/20 mt-16 text-center tracking-[0.15em] uppercase">
          ANGLE/RFP &middot; Bid qualification for creative agencies
        </p>
      </div>
    </div>
  );
}
