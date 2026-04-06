import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useIsAuthenticated } from "@/hooks/use-auth";

type WorkspaceResponse = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    primaryDomain: string;
    onboardingStatus: string;
  };
  membership: {
    role: string;
  };
  profile: {
    status: string;
    calibration: any;
  } | null;
  credentials: any[];
  credentialSuggestions: any[];
  clientMemory: any[];
  calibrationState: "default" | "partial" | "full";
};

const calibrationDefaults = {
  coreServices: [] as string[],
  preferredSectors: [] as string[],
  minimumBudget: "",
  idealProjectSize: "",
  idealTimelineBand: "",
  riskRedLines: [] as string[],
  pitchEffortTolerance: "moderate",
  preferredClientTypes: [] as string[],
  saudiComplianceSensitivity: "moderate",
  teamSize: "",
};

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function OnboardingChat({ onCalibrationReady, onClose }: { onCalibrationReady: (calibration: any) => void; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingCalibration, setPendingCalibration] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  const chat = useMutation({
    mutationFn: async (allMessages: ChatMessage[]) => {
      const res = await apiRequest("POST", "/api/workspace/onboarding-chat", { messages: allMessages });
      return res.json() as Promise<{ reply: string; calibration: any }>;
    },
    onSuccess: (data, allMessages) => {
      const updated = [...allMessages, { role: "assistant" as const, content: data.reply }];
      setMessages(updated);
      if (data.calibration) setPendingCalibration(data.calibration);
    },
  });

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    const initial: ChatMessage[] = [{ role: "user", content: "Hi, I'd like to set up my agency profile." }];
    setMessages(initial);
    chat.mutate(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || chat.isPending) return;
    setInput("");
    setPendingCalibration(null);
    const updated = [...messages, { role: "user" as const, content: text }];
    setMessages(updated);
    chat.mutate(updated);
  }, [input, messages, chat]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border border-white/[0.08] bg-[#050505] overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-[#ff5a36]" />
          <p className="text-sm font-semibold">AI Setup Assistant</p>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="h-[300px] overflow-y-auto px-5 py-4 space-y-3">
        {messages.filter((m) => !(m.role === "user" && m.content === "Hi, I'd like to set up my agency profile.")).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-white/[0.08] text-white"
                  : "bg-[#ff5a36]/[0.06] text-white/90 border border-[#ff5a36]/10"
              }`}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}
        {chat.isPending && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 bg-[#ff5a36]/[0.06] border border-[#ff5a36]/10">
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-white/[0.06]">
        {pendingCalibration ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-[11px] text-emerald-400/80 flex-1">Ready — this will fill in the fields below.</p>
            <button
              onClick={() => onCalibrationReady(pendingCalibration)}
              className="bg-white px-5 py-2 text-sm font-bold text-black hover:bg-white/90 transition-colors"
            >
              Apply to profile
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={chat.isPending}
              placeholder="Type your answer..."
              className="flex-1 bg-black border border-white/[0.08] px-4 py-2.5 text-sm disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || chat.isPending}
              className="border border-white/[0.08] px-3 py-2.5 text-white/60 hover:text-white transition-colors disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function WorkspacePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, workspace, onboarding, isAuthenticated, isLoading } = useIsAuthenticated();
  const [form, setForm] = useState(calibrationDefaults);
  const [showChat, setShowChat] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedForm, setSavedForm] = useState(calibrationDefaults);

  const { data, isLoading: workspaceLoading } = useQuery<WorkspaceResponse>({
    queryKey: ["/api/workspace"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !user) setLocation("/sign-in");
  }, [isLoading, setLocation, user]);

  useEffect(() => {
    const calibration = data?.profile?.calibration;
    if (calibration && typeof calibration === "object") {
      const loaded = {
        ...calibrationDefaults,
        ...calibration,
        coreServices: Array.isArray(calibration.coreServices) ? calibration.coreServices : [],
        preferredSectors: Array.isArray(calibration.preferredSectors) ? calibration.preferredSectors : [],
        riskRedLines: Array.isArray(calibration.riskRedLines) ? calibration.riskRedLines : [],
        preferredClientTypes: Array.isArray(calibration.preferredClientTypes) ? calibration.preferredClientTypes : [],
      };
      setForm(loaded);
      setSavedForm(loaded);
      setHasUnsavedChanges(false);
    }
  }, [data]);

  const updateForm = useCallback((updater: (prev: typeof calibrationDefaults) => typeof calibrationDefaults) => {
    setForm((prev) => {
      const next = updater(prev);
      setHasUnsavedChanges(true);
      return next;
    });
  }, []);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", "/api/workspace/profile", form);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/workspace"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setSavedForm(form);
      setHasUnsavedChanges(false);
      toast({ title: "Profile saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save profile", description: error.message, variant: "destructive" });
    },
  });

  const isCalibrated = data?.calibrationState === "full" || data?.calibrationState === "partial";

  const handleCalibrationFromChat = useCallback(async (calibration: any) => {
    try {
      await apiRequest("PATCH", "/api/workspace/profile", calibration);
      await queryClient.invalidateQueries({ queryKey: ["/api/workspace"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setShowChat(false);
      setForm((prev) => ({
        ...prev,
        ...calibration,
        coreServices: Array.isArray(calibration.coreServices) ? calibration.coreServices : prev.coreServices,
        preferredSectors: Array.isArray(calibration.preferredSectors) ? calibration.preferredSectors : prev.preferredSectors,
        riskRedLines: Array.isArray(calibration.riskRedLines) ? calibration.riskRedLines : prev.riskRedLines,
        preferredClientTypes: Array.isArray(calibration.preferredClientTypes) ? calibration.preferredClientTypes : prev.preferredClientTypes,
      }));
      toast({ title: "Profile updated from AI assistant" });
    } catch (error: any) {
      toast({ title: "Failed to save profile", description: error.message, variant: "destructive" });
    }
  }, [toast]);

  const completedCount = useMemo(() => {
    return [
      form.coreServices.length > 0,
      form.preferredSectors.length > 0,
      Boolean(form.minimumBudget),
      form.riskRedLines.length > 0,
      Boolean(form.teamSize),
    ].filter(Boolean).length;
  }, [form]);

  if (isLoading || workspaceLoading || (!isAuthenticated && !user)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-sm text-white/50 font-mono">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar />
      <div className="mx-auto max-w-[800px] px-6 py-8 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#ff5a36]/70">
                {data?.workspace?.name || workspace?.name}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Agency profile</h1>
              <p className="mt-1.5 text-sm text-white/45">
                These preferences shape how every RFP is scored for your team.
              </p>
            </div>
            <button
              onClick={() => setLocation("/upload")}
              className="inline-flex items-center gap-2 bg-white px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-white/90"
            >
              Go to analyses
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>

        {/* AI Assistant toggle */}
        <AnimatePresence mode="wait">
          {showChat ? (
            <div className="mb-4" key="chat">
              <OnboardingChat
                onCalibrationReady={handleCalibrationFromChat}
                onClose={() => setShowChat(false)}
              />
            </div>
          ) : (
            <motion.button
              key="chat-trigger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowChat(true)}
              className="mb-4 w-full border border-dashed border-white/[0.1] bg-[#050505] px-5 py-3.5 flex items-center gap-3 text-left hover:border-[#ff5a36]/30 transition-colors group"
            >
              <Sparkles className="h-4 w-4 text-[#ff5a36]/60 group-hover:text-[#ff5a36] transition-colors" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                  {isCalibrated ? "Re-run AI setup" : "Set up with AI assistant"}
                </p>
                <p className="text-[11px] text-white/30">
                  Answer a few questions and we'll fill in the fields for you.
                </p>
              </div>
              <MessageCircle className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Profile form */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="border border-white/[0.08] bg-[#050505] p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {isCalibrated && !hasUnsavedChanges ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <p className="text-[11px] font-mono uppercase tracking-wide text-emerald-400/70">
                    Profile saved · {completedCount}/5 fields
                  </p>
                </>
              ) : (
                <p className="text-[11px] font-mono uppercase tracking-wide text-white/40">
                  {completedCount}/5 fields filled
                </p>
              )}
            </div>
            {hasUnsavedChanges ? (
              <button
                onClick={() => saveProfile.mutate()}
                disabled={saveProfile.isPending}
                className="bg-white px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                {saveProfile.isPending ? "Saving..." : "Save changes"}
              </button>
            ) : !isCalibrated ? (
              <button
                onClick={() => saveProfile.mutate()}
                disabled={saveProfile.isPending || completedCount === 0}
                className="bg-white px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                {saveProfile.isPending ? "Saving..." : "Save"}
              </button>
            ) : null}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wide text-white/50">Core services</span>
              <input value={form.coreServices.join(", ")} onChange={(e) => updateForm((c) => ({ ...c, coreServices: parseCsv(e.target.value) }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm" placeholder="Branding, campaigns, content" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wide text-white/50">Preferred sectors</span>
              <input value={form.preferredSectors.join(", ")} onChange={(e) => updateForm((c) => ({ ...c, preferredSectors: parseCsv(e.target.value) }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm" placeholder="Government, tourism, sports" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wide text-white/50">Minimum budget (SAR)</span>
              <input value={form.minimumBudget} onChange={(e) => updateForm((c) => ({ ...c, minimumBudget: e.target.value }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm" placeholder="250000" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wide text-white/50">Team size</span>
              <input value={form.teamSize} onChange={(e) => updateForm((c) => ({ ...c, teamSize: e.target.value }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm" placeholder="10-25" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wide text-white/50">Pitch effort tolerance</span>
              <select value={form.pitchEffortTolerance} onChange={(e) => updateForm((c) => ({ ...c, pitchEffortTolerance: e.target.value }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm">
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wide text-white/50">Saudi/GCC compliance importance</span>
              <select value={form.saudiComplianceSensitivity} onChange={(e) => updateForm((c) => ({ ...c, saudiComplianceSensitivity: e.target.value }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm">
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[11px] font-mono uppercase tracking-wide text-white/50">Deal-breakers</span>
              <input value={form.riskRedLines.join(", ")} onChange={(e) => updateForm((c) => ({ ...c, riskRedLines: parseCsv(e.target.value) }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm" placeholder="Unlimited revisions, exclusivity, no budget disclosed" />
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[11px] font-mono uppercase tracking-wide text-white/50">Preferred client types</span>
              <input value={form.preferredClientTypes.join(", ")} onChange={(e) => updateForm((c) => ({ ...c, preferredClientTypes: parseCsv(e.target.value) }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm" placeholder="Semi-government, challenger brands, retained accounts" />
            </label>
          </div>
        </motion.section>

        {/* Workspace info — compact footer */}
        <div className="mt-6 flex items-center justify-between text-[11px] text-white/30 font-mono">
          <span>@{data?.workspace?.primaryDomain || workspace?.slug}</span>
          <span className="capitalize">{data?.membership?.role || workspace?.role || "member"}</span>
        </div>
      </div>
    </div>
  );
}
