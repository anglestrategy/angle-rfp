import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Minus, ArrowRight } from "lucide-react";
import { GrainOverlay } from "@/components/grain-overlay";
import { NavBar } from "@/components/nav-bar";

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
    category: "Analysis",
    features: [
      { name: "RFP analyses per month", free: "3", premium: "Unlimited" },
      { name: "Fit score & go/no-go", free: true, premium: true },
      { name: "Risk register", free: false, premium: true },
      { name: "Scope analysis", free: false, premium: true },
      { name: "Contract terms extraction", free: false, premium: true },
    ],
  },
  {
    category: "Export",
    features: [
      { name: "Executive brief PDF", free: false, premium: true },
      { name: "Submission checklist", free: false, premium: true },
      { name: "Client intelligence report", free: false, premium: true },
    ],
  },
  {
    category: "Support",
    features: [
      { name: "Email support", free: true, premium: true },
      { name: "Priority support", free: false, premium: true },
    ],
  },
];

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const monthlyPrice = 49;
  const annualPrice = 39;
  const displayPrice = isAnnual ? annualPrice : monthlyPrice;

  return (
    <div className="relative min-h-screen">
      <GrainOverlay />
      <NavBar />

      <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-[clamp(32px,6vw,48px)] font-bold tracking-tight leading-[1.1] mb-3">
            Simple, transparent pricing.
          </h1>
          <p className="text-lg text-muted-foreground">
            Start free. Scale when ready.
          </p>
        </motion.div>

        {/* ── Billing Toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex items-center justify-center gap-3 mb-12"
        >
          <button
            onClick={() => setIsAnnual(false)}
            className={`font-mono text-xs uppercase tracking-wider px-4 py-2 transition-colors ${
              !isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>

          {/* Toggle pill */}
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-12 h-6 rounded-full bg-foreground/10 border border-foreground/15 transition-colors"
          >
            <motion.div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-primary"
              animate={{ left: isAnnual ? "calc(100% - 22px)" : "2px" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>

          <button
            onClick={() => setIsAnnual(true)}
            className={`font-mono text-xs uppercase tracking-wider px-4 py-2 transition-colors ${
              isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Annual
            <span className="text-primary ml-1.5">-20%</span>
          </button>
        </motion.div>

        {/* ── Pricing Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20"
        >
          {/* Free Tier */}
          <div className="border border-foreground/10 p-8">
            <div className="mb-6">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Free
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">$0</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                "3 analyses per month",
                "Fit score & go/no-go",
                "Basic risk overview",
                "Email support",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>

            <Link href="/upload">
              <motion.span
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium border border-foreground/15 text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </motion.span>
            </Link>
          </div>

          {/* Premium Tier */}
          <div className="border-2 border-primary p-8 relative">
            {/* Recommended badge */}
            <div className="absolute -top-3 left-6">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-primary text-background px-3 py-1">
                Recommended
              </span>
            </div>

            <div className="mb-6">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Premium
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  <AnimatedPrice value={displayPrice} />
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              {isAnnual && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground mt-1 font-mono"
                >
                  Billed annually at ${annualPrice * 12}/yr
                </motion.p>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              {[
                "Unlimited analyses",
                "Full analysis dashboard",
                "Executive brief PDF export",
                "Risk register & contract terms",
                "Scope analysis & timeline",
                "Submission guide & checklist",
                "Client intelligence report",
                "Priority support",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link href="/upload">
              <motion.span
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
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
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">
            Feature Comparison
          </h2>

          <div className="border border-foreground/10">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px] border-b border-foreground/10 px-4 py-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Feature
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground text-center">
                Free
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground text-center">
                Premium
              </span>
            </div>

            {COMPARISON.map((section) => (
              <div key={section.category}>
                {/* Category header */}
                <div className="px-4 py-2.5 bg-muted/30 border-b border-foreground/5">
                  <span className="text-xs font-semibold">
                    {section.category}
                  </span>
                </div>

                {/* Feature rows */}
                {section.features.map((feat) => (
                  <div
                    key={feat.name}
                    className="grid grid-cols-[1fr_100px_100px] border-b border-foreground/5 px-4 py-2.5 hover:bg-muted/20 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">
                      {feat.name}
                    </span>
                    <span className="flex justify-center">
                      {typeof feat.free === "string" ? (
                        <span className="text-sm font-mono">{feat.free}</span>
                      ) : feat.free ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </span>
                    <span className="flex justify-center">
                      {typeof feat.premium === "string" ? (
                        <span className="text-sm font-mono">
                          {feat.premium}
                        </span>
                      ) : feat.premium ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer credit */}
        <p className="font-mono text-[10px] text-muted-foreground/30 mt-16 text-center tracking-wider uppercase">
          angle/RFP &middot; RFP Intelligence for Creative Agencies
        </p>
      </div>
    </div>
  );
}
