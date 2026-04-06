import { Switch, Route } from "wouter";
import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useState,
} from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { useLenis } from "@/hooks/use-lenis";
import { Preloader } from "@/components/preloader";
import { PageTransition } from "@/components/page-transition";

const LandingPage = lazy(() => import("@/pages/landing"));
const UploadPage = lazy(() => import("@/pages/upload"));
const AnalysisPage = lazy(() => import("@/pages/analysis"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const WorkspacePage = lazy(() => import("@/pages/workspace"));
// const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const NotFound = lazy(() => import("@/pages/not-found"));

/**
 * Preloader context — two-phase signal:
 *  • exiting = true → preloader overlay is dissolving (hero can begin cross-fade)
 *  • done    = true → preloader is fully gone (text & CTA animations fire)
 * This enables a cinematic cross-dissolve between preloader exit and hero entrance.
 */
type PreloaderState = { exiting: boolean; done: boolean };
const PreloaderContext = createContext<PreloaderState>({ exiting: false, done: false });
export const usePreloaderState = () => useContext(PreloaderContext);
/** Backwards-compatible shorthand */
export const usePreloaderDone = () => useContext(PreloaderContext).done;

function Router() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-lg font-bold tracking-tight text-white/80">
              angle<span className="text-white/25">/rfp</span>
            </div>
            <div className="h-[2px] w-24 bg-white/[0.06] overflow-hidden rounded-full">
              <div className="h-full w-8 bg-[#ff5a36]/60 rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      }
    >
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/upload" component={UploadPage} />
        <Route path="/analysis/:id" component={AnalysisPage} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        {/* <Route path="/verify-email" component={VerifyEmailPage} /> */}
        <Route path="/workspace" component={WorkspacePage} />
        {/* <Route path="/pricing" component={PricingPage} /> */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  // Lenis smooth scroll — drives GSAP ScrollTrigger via shared RAF
  useLenis();

  // Preloader state — two-phase: exiting (overlay dissolving) → done (fully gone)
  const [preloaderState, setPreloaderState] = useState<PreloaderState>({
    exiting: false,
    done: false,
  });
  const handlePreloaderExiting = useCallback(
    () => setPreloaderState((s) => ({ ...s, exiting: true })),
    [],
  );
  const handlePreloaderDone = useCallback(
    () => setPreloaderState({ exiting: true, done: true }),
    [],
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground">
            <Toaster />
            {/* Preloader overlay — shows once per session, then skips */}
            <Preloader onExiting={handlePreloaderExiting} onComplete={handlePreloaderDone} />
            {/* Animated page transitions between routes */}
            <PreloaderContext.Provider value={preloaderState}>
              <PageTransition>
                <Router />
              </PageTransition>
            </PreloaderContext.Provider>
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
