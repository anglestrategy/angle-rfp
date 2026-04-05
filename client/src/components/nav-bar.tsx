import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useCurrentUser, useSignOut } from "@/hooks/use-auth";

export function NavBar() {
  const [location, setLocation] = useLocation();
  const { data } = useCurrentUser();
  const signOut = useSignOut();
  const user = data?.user ?? null;
  const workspace = data?.workspace ?? null;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/[0.06] bg-black/90 px-6 backdrop-blur-sm"
    >
      {/* Left: wordmark */}
      <Link href="/">
        <span className="cursor-pointer font-bold text-lg tracking-tight text-white">
          ANGLE<span className="text-white/35">/RFP</span>
        </span>
      </Link>

      {/* Right: nav links + actions */}
      <div className="flex items-center gap-6">
        {user && (
          <Link href="/workspace">
            <span
              className={`cursor-pointer font-mono text-[11px] uppercase tracking-[0.15em] transition-colors ${
                location === "/workspace"
                  ? "text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {workspace?.name || "Workspace"}
            </span>
          </Link>
        )}
        <Link href="/upload">
          <span
            className={`cursor-pointer font-mono text-[11px] uppercase tracking-[0.15em] transition-colors ${
              location === "/upload"
                ? "text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            Upload
          </span>
        </Link>
        {/* Pricing link hidden until billing is wired up
        <Link href="/pricing">
          <span
            className={`cursor-pointer font-mono text-[11px] uppercase tracking-[0.15em] transition-colors ${
              location === "/pricing"
                ? "text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            Pricing
          </span>
        </Link>
        */}

        {user ? (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => {
              signOut.mutate(undefined, {
                onSuccess: () => setLocation("/sign-in"),
              });
            }}
            className="cursor-pointer border border-white/[0.08] bg-black px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-white/50 transition-colors hover:border-white/20 hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
          >
            Sign out
          </motion.button>
        ) : (
          <>
            <Link href="/sign-in">
              <motion.span
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="cursor-pointer border border-white/[0.08] bg-black px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-white/50 transition-colors hover:border-white/20 hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
              >
                Sign in
              </motion.span>
            </Link>
            <Link href="/sign-up">
              <motion.span
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="cursor-pointer bg-[#ff5a36] px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-white transition-colors hover:bg-[#ff5a36]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Try free
              </motion.span>
            </Link>
          </>
        )}
      </div>
    </motion.nav>
  );
}
