import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useCurrentUser, useSignOut } from "@/hooks/use-auth";

export function NavBar() {
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { data } = useCurrentUser();
  const signOut = useSignOut();
  const user = data?.user ?? null;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-14 border-b border-foreground/10 bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-50"
    >
      {/* Left: wordmark */}
      <Link href="/">
        <span className="text-lg font-bold tracking-tight cursor-pointer">
          angle<span className="text-primary">/</span>RFP
        </span>
      </Link>

      {/* Right: nav links + actions */}
      <div className="flex items-center gap-6">
        <Link href="/upload">
          <span
            className={`nav-link cursor-pointer ${
              location === "/upload" ? "nav-link-active" : ""
            }`}
          >
            Upload
          </span>
        </Link>
        <Link href="/pricing">
          <span
            className={`nav-link cursor-pointer ${
              location === "/pricing" ? "nav-link-active" : ""
            }`}
          >
            Pricing
          </span>
        </Link>

        {user ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              signOut.mutate(undefined, {
                onSuccess: () => setLocation("/sign-in"),
              });
            }}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium border border-foreground/15 bg-card text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
          >
            Sign Out
          </motion.button>
        ) : (
          <Link href="/sign-in">
            <motion.span
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium border border-foreground/15 bg-card text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
            >
              Sign In
            </motion.span>
          </Link>
        )}

        <button
          onClick={toggleTheme}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </motion.nav>
  );
}
