import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ShieldCheck, FileText, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { GrainOverlay } from "@/components/grain-overlay";
import { NavBar } from "@/components/nav-bar";

const valuePoints = [
  "Extract deadlines, deliverables, and contract risks in one place",
  "Keep uploads, analyses, and exports tied to each signed-in account",
  "Use the proven live scoring path while advanced features stay safely internal",
];

const trustPoints = [
  {
    title: "Public-safe auth",
    description: "Protected uploads, history, and analysis detail routes.",
    icon: ShieldCheck,
  },
  {
    title: "Stable analysis flow",
    description: "The live pipeline stays authoritative for launch.",
    icon: FileText,
  },
  {
    title: "Production rollout controls",
    description: "Shadow, OCR, worker mode, and web research remain feature-flagged.",
    icon: Sparkles,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <GrainOverlay />
      <NavBar />

      <main className="relative z-10">
        <section className="border-b border-border/60">
          <div className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-10">
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="space-y-5"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary/80">
                  Public Launch Baseline
                </p>
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
                  Analyze complex RFPs without digging through every clause by hand.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  angle/RFP turns dense procurement documents into a concise working brief:
                  scope, deadlines, risks, scoring, and an exportable summary your team can act on.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <Link href="/sign-up">
                  <span className="inline-flex cursor-pointer items-center justify-center gap-2 bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90">
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
                <Link href="/sign-in">
                  <span className="inline-flex cursor-pointer items-center justify-center border border-foreground/15 bg-card px-5 py-3 text-sm font-medium transition-colors hover:border-foreground/35">
                    Sign in
                  </span>
                </Link>
              </motion.div>

              <motion.ul
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.14 }}
                className="space-y-3"
              >
                {valuePoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </motion.ul>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="grid gap-4"
            >
              {trustPoints.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="border border-border/60 bg-card/80 p-6 backdrop-blur-sm"
                >
                  <div className="mb-4 inline-flex rounded-full border border-border/60 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-medium">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-3">
            <article className="border border-border/60 bg-card/70 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                01 Upload
              </p>
              <h3 className="mt-4 text-xl font-medium">Send a PDF or DOCX</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Files are validated server-side with size and type checks before entering the analysis flow.
              </p>
            </article>
            <article className="border border-border/60 bg-card/70 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                02 Analyze
              </p>
              <h3 className="mt-4 text-xl font-medium">Let the live pipeline score the opportunity</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The launch build keeps the proven live algorithm public while stricter shadow tooling stays internal.
              </p>
            </article>
            <article className="border border-border/60 bg-card/70 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                03 Act
              </p>
              <h3 className="mt-4 text-xl font-medium">Review, export, and reopen from history</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Each signed-in account sees only its own analyses and can export a concise PDF brief.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
