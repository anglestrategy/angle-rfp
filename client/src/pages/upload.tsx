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
import { GrainOverlay } from "@/components/grain-overlay";
import { NavBar } from "@/components/nav-bar";
import type { RfpAnalysis } from "@shared/schema";

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
      className="file-row group"
    >
      {/* File icon */}
      <div className="flex-shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors">
        <FileText className="h-4 w-4" />
      </div>

      {/* File name + date */}
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium truncate leading-snug"
          title={analysis.fileName}
        >
          {analysis.fileName}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground tracking-wide mt-0.5">
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
          <span className="text-xs text-muted-foreground/40">--</span>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={analysis.status} />
      </div>

      {/* Chevron */}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground/60 transition-colors flex-shrink-0" />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   UPLOAD PAGE — File Manager Workspace
   Viewport-fitting layout: NavBar + drop zone + file list
   ═══════════════════════════════════════════════════════════ */
export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useIsAuthenticated();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [cursorNear, setCursorNear] = useState(false);

  const { data: analyses, isLoading } = useQuery<RfpAnalysis[]>({
    queryKey: ["/api/analyses"],
    enabled: isAuthenticated,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      document.title = "Uploading... | angle/RFP";
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
      document.title = "angle/RFP";
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      setLocation(`/analysis/${data.id}`);
    },
    onError: (error: Error) => {
      document.title = "angle/RFP";
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validateAndUpload = useCallback(
    (file: File) => {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or DOCX file.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 20MB.",
          variant: "destructive",
        });
        return;
      }
      uploadMutation.mutate(file);
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
      const file = e.dataTransfer.files[0];
      if (file) validateAndUpload(file);
    },
    [validateAndUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndUpload(file);
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col relative">
      <GrainOverlay />

      {/* ── NAV BAR ── */}
      <NavBar />

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden max-w-6xl w-full mx-auto">
        {/* ── COMPACT DROP ZONE ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="px-6 pt-6 pb-4"
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
                ? "hsl(var(--primary))"
                : cursorNear
                  ? "hsl(var(--foreground) / 0.25)"
                  : "hsl(var(--foreground) / 0.1)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`
              relative border border-dashed cursor-pointer
              flex items-center justify-center gap-5 px-8 py-8
              transition-shadow duration-300
              ${isDragging ? "shadow-[0_0_40px_hsl(var(--primary)/0.12)] bg-primary/[0.02]" : ""}
              ${uploadMutation.isPending ? "pointer-events-none" : ""}
            `}
          >
            {/* Corner registration marks */}
            <span className="corner-mark corner-mark-tl" style={{ color: isDragging ? "hsl(var(--primary))" : undefined }}>+</span>
            <span className="corner-mark corner-mark-tr" style={{ color: isDragging ? "hsl(var(--primary))" : undefined }}>+</span>
            <span className="corner-mark corner-mark-bl" style={{ color: isDragging ? "hsl(var(--primary))" : undefined }}>+</span>
            <span className="corner-mark corner-mark-br" style={{ color: isDragging ? "hsl(var(--primary))" : undefined }}>+</span>

            <input
              ref={fileInputRef}
              type="file"
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
                        stroke="hsl(var(--foreground) / 0.1)"
                        strokeWidth="2.5"
                      />
                      <motion.circle
                        cx="32" cy="32" r="28"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 28}
                        initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 3, ease: "linear" }}
                      />
                    </svg>
                    <FileText className="absolute inset-0 m-auto h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Uploading...</p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-5"
                >
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ArrowUp className="h-5 w-5 text-muted-foreground/50" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Drop your RFP document
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 tracking-wide">
                      PDF or DOCX &middot; up to 20 MB
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
                    className="ml-auto px-4 py-2 text-xs font-medium border border-foreground/15 bg-card text-foreground hover:border-foreground/40 transition-colors"
                  >
                    Browse files
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* ── FILE LIST ── */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {/* Section header */}
          <div className="flex items-center justify-between py-3 border-b border-foreground/10">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Recent Analyses{analysisCount > 0 ? ` (${analysisCount})` : ""}
            </span>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3">
                  <div className="h-4 w-4 bg-muted animate-pulse rounded-sm" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-muted animate-pulse rounded-sm mb-1" />
                    <div className="h-2.5 w-20 bg-muted animate-pulse rounded-sm" />
                  </div>
                  <div className="h-5 w-8 bg-muted animate-pulse rounded-sm" />
                  <div className="h-4 w-16 bg-muted animate-pulse rounded-sm" />
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
              <p className="text-[clamp(28px,4vw,40px)] font-light tracking-tight text-foreground/15 leading-tight">
                No analyses yet
              </p>
              <p className="text-sm text-muted-foreground/40 mt-2 flex items-center gap-1.5">
                Drop an RFP above to begin
                <motion.span
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </motion.span>
              </p>
            </motion.div>
          ) : (
            <div className="divide-y divide-border/50">
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
