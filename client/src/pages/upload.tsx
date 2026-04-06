import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  ArrowUp,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useIsAuthenticated } from "@/hooks/use-auth";
import { StatusBadge } from "@/components/status-badge";
import { getScoreColor } from "@/components/score-badge";
import { NavBar } from "@/components/nav-bar";
import type { RfpAnalysis } from "@shared/schema";

// Animation variants matching landing page
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

/* ═══════════════════════════════════════════════════════════
   SCORE TWEEN — Animated number count-up on mount
   ═══════════════════════════════════════════════════════════ */
function ScoreTween({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);

  return <>{display}</>;
}

/* ═══════════════════════════════════════════════════════════
   FILE ROW — Single analysis in the file list
   ═══════════════════════════════════════════════════════════ */
function FileRow({
  analysis,
  onClick,
  index,
}: {
  analysis: RfpAnalysis;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={onClick}
      className="flex items-center gap-4 px-6 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors border-b border-white/[0.04] last:border-b-0"
    >
      {/* File icon */}
      <div className="flex-shrink-0 text-white/30 group-hover:text-[#ff5a36] transition-colors">
        <FileText className="h-4 w-4" />
      </div>

      {/* File name + date */}
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium truncate leading-snug text-white/80"
          title={analysis.fileName}
        >
          {analysis.fileName}
        </p>
        <p className="font-mono text-[10px] text-white/40 tracking-wide mt-0.5">
          {analysis.createdAt
            ? formatDistanceToNow(new Date(analysis.createdAt), {
                addSuffix: true,
              })
            : "Just now"}
        </p>
      </div>

      {/* Score */}
      <div className="flex-shrink-0 w-12 text-right">
        {analysis.status === "complete" && analysis.overallScore != null ? (
          <span
            className={`text-lg font-bold tabular-nums leading-none ${getScoreColor(analysis.overallScore)}`}
          >
            <ScoreTween value={analysis.overallScore} />
          </span>
        ) : (
          <span className="text-xs text-white/30">--</span>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={analysis.status} />
      </div>

      {/* Chevron */}
      <ChevronRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   UPLOAD PAGE — File Manager Workspace
   ═══════════════════════════════════════════════════════════ */
export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, onboarding, isLoading: authLoading, isAuthenticated } = useIsAuthenticated();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [cursorNear, setCursorNear] = useState(false);

  const { data: analyses, isLoading } = useQuery<RfpAnalysis[]>({
    queryKey: ["/api/analyses"],
    enabled: isAuthenticated,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      document.title = `Uploading ${files.length > 1 ? `${files.length} files` : ""}... | angle/rfp`;
      const res = await fetch("/api/analyses/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: (data) => {
      document.title = "angle/rfp";
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      if (data.id) {
        setLocation(`/analysis/${data.id}`);
      }
    },
    onError: (error: Error) => {
      document.title = "angle/rfp";
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validateAndUpload = useCallback(
    (files: FileList | File[]) => {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      const valid: File[] = [];
      for (const file of Array.from(files)) {
        if (!validTypes.includes(file.type)) {
          toast({
            title: `Skipped ${file.name}`,
            description: "Only PDF and DOCX files are accepted.",
            variant: "destructive",
          });
          continue;
        }
        if (file.size > 50 * 1024 * 1024) {
          toast({
            title: `Skipped ${file.name}`,
            description: "Maximum file size is 50MB.",
            variant: "destructive",
          });
          continue;
        }
        valid.push(file);
      }
      if (valid.length > 0) {
        uploadMutation.mutate(valid);
      }
    },
    [uploadMutation, toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        validateAndUpload(e.dataTransfer.files);
      }
    },
    [validateAndUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        validateAndUpload(e.target.files);
      }
    },
    [validateAndUpload]
  );

  /* ── Cursor Proximity Detection ── */
  useEffect(() => {
    const handleGlobalMouse = (e: MouseEvent) => {
      if (!dropZoneRef.current) return;
      const rect = dropZoneRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      setCursorNear(dist < 300);
    };
    window.addEventListener("mousemove", handleGlobalMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleGlobalMouse);
  }, []);

  const analysisCount = analyses?.length ?? 0;

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/sign-in");
    }
  }, [authLoading, setLocation, user]);

  if (authLoading || (!isAuthenticated && !user)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-sm text-white/50 font-mono">Loading your workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1400px] flex-col overflow-hidden px-6 pb-8 pt-8 lg:px-16">
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.5 }}
          className="mb-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
        >
          <div className="space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#ff5a36]/80">
              Upload
            </p>
            <h1 className="max-w-3xl text-[clamp(2.5rem,5vw,4rem)] font-extrabold tracking-[-0.04em] leading-[0.92] text-white text-balance">
              Upload your RFP.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/50">
              Drop a file below and we'll score it in about a minute.
              Your past analyses are listed underneath so you can pick up where you left off.
            </p>
          </div>

          <div className="grid gap-px bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["Formats", "PDF and DOCX files, up to 50 MB each."],
              ["Privacy", "Your uploads and results are private to your account."],
              ["Processing", "Analysis usually takes around 7 minutes depending on document length."],
            ].map(([label, copy]) => (
              <div
                key={label}
                className="bg-black border border-white/[0.06] p-5"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#ff5a36]/70">{label}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/40">{copy}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="pb-6"
        >
          <motion.div
            ref={dropZoneRef}
            data-testid="dropzone-upload"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() =>
              !uploadMutation.isPending && fileInputRef.current?.click()
            }
            animate={{
              borderColor: isDragging
                ? "rgba(255, 90, 54, 0.6)"
                : cursorNear
                  ? "rgba(255, 255, 255, 0.15)"
                  : "rgba(255, 255, 255, 0.08)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`
              relative flex cursor-pointer items-center justify-center gap-5 overflow-hidden
              border border-dashed border-white/[0.08] bg-[#050505] px-8 py-10
              transition-shadow duration-300
              ${isDragging ? "shadow-[0_0_40px_rgba(255,90,54,0.15)] bg-[#ff5a36]/[0.03]" : ""}
              ${uploadMutation.isPending ? "pointer-events-none" : ""}
            `}
          >
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)] opacity-60" />

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-file"
            />

            <AnimatePresence mode="wait">
              {uploadMutation.isPending ? (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-4"
                >
                  <div className="relative w-10 h-10">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 64 64">
                      <circle
                        cx="32" cy="32" r="28"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="2.5"
                      />
                      <motion.circle
                        cx="32" cy="32" r="28"
                        fill="none"
                        stroke="#ff5a36"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 28}
                        initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 3, ease: "linear" }}
                      />
                    </svg>
                    <FileText className="absolute inset-0 m-auto h-4 w-4 text-[#ff5a36]" />
                  </div>
                  <p className="text-sm font-medium text-white/80">Uploading...</p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative z-10 flex w-full items-center gap-5"
                >
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="flex h-14 w-14 items-center justify-center border border-white/[0.08] bg-black"
                  >
                    <ArrowUp className="h-5 w-5 text-[#ff5a36]" />
                  </motion.div>
                  <div>
                    <p className="text-lg font-bold tracking-tight text-white">
                      Drop your RFP documents
                    </p>
                    <p className="mt-1 font-mono text-[11px] tracking-[0.15em] text-white/40">
                      PDF or DOCX &middot; up to 50 MB each
                    </p>
                  </div>
                  <motion.button
                    data-testid="button-browse"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="ml-auto border border-white/[0.08] bg-black px-5 py-2.5 text-xs font-bold text-white transition-colors hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
                  >
                    Browse files
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* ── FILE LIST ── */}
        <div className="flex-1 overflow-auto border border-white/[0.06] bg-[#050505] px-6 pb-6">
          {/* Section header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] py-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/50">
              Recent Analyses{analysisCount > 0 ? ` (${analysisCount})` : ""}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/30">
              Only visible to you
            </span>
          </div>

          {isLoading ? (
            <div className="divide-y divide-white/[0.04]">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3">
                  <div className="h-4 w-4 bg-white/[0.05] animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-white/[0.05] animate-pulse mb-1" />
                    <div className="h-2.5 w-20 bg-white/[0.05] animate-pulse" />
                  </div>
                  <div className="h-5 w-8 bg-white/[0.05] animate-pulse" />
                  <div className="h-4 w-16 bg-white/[0.05] animate-pulse" />
                </div>
              ))}
            </div>
          ) : !analyses || analyses.length === 0 ? (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <p className="text-[clamp(28px,4vw,40px)] font-light leading-tight tracking-tight text-white/15">
                No analyses yet
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-white/30">
                Upload a file to get started
                <motion.span
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </motion.span>
              </p>
            </motion.div>
          ) : (
            <div>
              {analyses.map((analysis, index) => (
                <FileRow
                  key={analysis.id}
                  analysis={analysis}
                  index={index}
                  onClick={() => setLocation(`/analysis/${analysis.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
