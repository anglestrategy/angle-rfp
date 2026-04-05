import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Building2, CheckCircle2, FolderKanban, LibraryBig, Users2 } from "lucide-react";
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

export default function WorkspacePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, workspace, onboarding, isAuthenticated, isLoading } = useIsAuthenticated();
  const [form, setForm] = useState(calibrationDefaults);
  const [credentialDraft, setCredentialDraft] = useState({
    title: "",
    caseStudyText: "",
    services: "",
    sectors: "",
    tags: "",
  });

  const { data, isLoading: workspaceLoading } = useQuery<WorkspaceResponse>({
    queryKey: ["/api/workspace"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/sign-in");
    }
  }, [isLoading, setLocation, user]);

  useEffect(() => {
    const calibration = data?.profile?.calibration;
    if (calibration && typeof calibration === "object") {
      setForm({
        ...calibrationDefaults,
        ...calibration,
        coreServices: Array.isArray(calibration.coreServices) ? calibration.coreServices : [],
        preferredSectors: Array.isArray(calibration.preferredSectors) ? calibration.preferredSectors : [],
        riskRedLines: Array.isArray(calibration.riskRedLines) ? calibration.riskRedLines : [],
        preferredClientTypes: Array.isArray(calibration.preferredClientTypes) ? calibration.preferredClientTypes : [],
      });
    }
  }, [data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", "/api/workspace/profile", form);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/workspace"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Workspace profile saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save profile", description: error.message, variant: "destructive" });
    },
  });

  const addCredential = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/workspace/credentials", {
        title: credentialDraft.title,
        caseStudyText: credentialDraft.caseStudyText,
        services: parseCsv(credentialDraft.services),
        sectors: parseCsv(credentialDraft.sectors),
        tags: parseCsv(credentialDraft.tags),
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/workspace"] });
      setCredentialDraft({ title: "", caseStudyText: "", services: "", sectors: "", tags: "" });
      toast({ title: "Credential added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add credential", description: error.message, variant: "destructive" });
    },
  });

  const approveSuggestion = useMutation({
    mutationFn: async (suggestion: any) => {
      const response = await apiRequest(
        "PATCH",
        `/api/workspace/credential-suggestions/${suggestion.id}`,
        {
          approvalStatus: "approved",
          title: suggestion.extractedSummary.split(".")[0]?.slice(0, 80) || `Suggested credential ${suggestion.id}`,
        },
      );
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/workspace"] });
      toast({ title: "Suggestion approved into credentials" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to approve suggestion", description: error.message, variant: "destructive" });
    },
  });

  const readinessSummary = useMemo(() => {
    const completedSignals = [
      form.coreServices.length > 0,
      form.preferredSectors.length > 0,
      Boolean(form.minimumBudget),
      form.riskRedLines.length > 0,
      Boolean(form.teamSize),
    ].filter(Boolean).length;
    return `${completedSignals}/5 calibration signals set`;
  }, [form]);
  const canManageWorkspace =
    data?.membership?.role === "owner" || data?.membership?.role === "admin";

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
      <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-16">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#ff5a36]/70">
            Agency workspace
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {data?.workspace?.name || workspace?.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
                Calibrate the product for your agency before the team starts making bid decisions from it.
              </p>
            </div>
            <button
              onClick={() => setLocation("/upload")}
              className="inline-flex items-center gap-2 border border-white/[0.08] bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-white/90"
            >
              Continue to analyses
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>

        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-3">
            <section className="border border-white/[0.08] bg-[#050505] p-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-[#ff5a36]" />
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/45">Calibration profile</p>
                  <h2 className="text-lg font-semibold">Agency fit and commercial rules</h2>
                </div>
              </div>

              <fieldset disabled={!canManageWorkspace} className="mt-6 grid gap-4 md:grid-cols-2 disabled:opacity-60">
                <label className="space-y-2">
                  <span className="text-sm text-white/70">Core services</span>
                  <input value={form.coreServices.join(", ")} onChange={(e) => setForm((current) => ({ ...current, coreServices: parseCsv(e.target.value) }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="Branding, campaigns, content" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-white/70">Preferred sectors</span>
                  <input value={form.preferredSectors.join(", ")} onChange={(e) => setForm((current) => ({ ...current, preferredSectors: parseCsv(e.target.value) }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="Sports, government, consumer" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-white/70">Minimum budget floor</span>
                  <input value={form.minimumBudget} onChange={(e) => setForm((current) => ({ ...current, minimumBudget: e.target.value }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="250000 SAR" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-white/70">Team size</span>
                  <input value={form.teamSize} onChange={(e) => setForm((current) => ({ ...current, teamSize: e.target.value }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="10-25" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-white/70">Pitch effort tolerance</span>
                  <select value={form.pitchEffortTolerance} onChange={(e) => setForm((current) => ({ ...current, pitchEffortTolerance: e.target.value }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed">
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-white/70">Saudi/GCC compliance sensitivity</span>
                  <select value={form.saudiComplianceSensitivity} onChange={(e) => setForm((current) => ({ ...current, saudiComplianceSensitivity: e.target.value }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed">
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm text-white/70">Agency red lines</span>
                  <input value={form.riskRedLines.join(", ")} onChange={(e) => setForm((current) => ({ ...current, riskRedLines: parseCsv(e.target.value) }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="Unlimited revisions, exclusivity, no budget disclosed" />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm text-white/70">Preferred client types</span>
                  <input value={form.preferredClientTypes.join(", ")} onChange={(e) => setForm((current) => ({ ...current, preferredClientTypes: parseCsv(e.target.value) }))} className="w-full border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="Semi-government, challenger brands, retained accounts" />
                </label>
              </fieldset>

              <div className="mt-6 flex items-center justify-between gap-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/40">{readinessSummary}</p>
                <button
                  onClick={() => saveProfile.mutate()}
                  disabled={saveProfile.isPending || !canManageWorkspace}
                  className="inline-flex items-center gap-2 bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
                >
                  {saveProfile.isPending ? "Saving..." : "Save calibration"}
                </button>
              </div>
              {!canManageWorkspace && (
                <p className="mt-3 text-xs text-white/45">
                  Only workspace owners and admins can update shared calibration rules.
                </p>
              )}
            </section>

            <section className="border border-white/[0.08] bg-[#050505] p-6">
              <div className="flex items-center gap-3">
                <LibraryBig className="h-4 w-4 text-[#ff5a36]" />
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/45">Credentials library</p>
                  <h2 className="text-lg font-semibold">Approved case studies and proof points</h2>
                </div>
              </div>

              <fieldset disabled={!canManageWorkspace} className="mt-6 grid gap-4 md:grid-cols-2 disabled:opacity-60">
                <input value={credentialDraft.title} onChange={(e) => setCredentialDraft((current) => ({ ...current, title: e.target.value }))} className="border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="Credential title" />
                <input value={credentialDraft.services} onChange={(e) => setCredentialDraft((current) => ({ ...current, services: e.target.value }))} className="border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="Services (comma separated)" />
                <input value={credentialDraft.sectors} onChange={(e) => setCredentialDraft((current) => ({ ...current, sectors: e.target.value }))} className="border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="Sectors (comma separated)" />
                <input value={credentialDraft.tags} onChange={(e) => setCredentialDraft((current) => ({ ...current, tags: e.target.value }))} className="border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="Tags (comma separated)" />
                <textarea value={credentialDraft.caseStudyText} onChange={(e) => setCredentialDraft((current) => ({ ...current, caseStudyText: e.target.value }))} className="min-h-[120px] md:col-span-2 border border-white/[0.08] bg-black px-4 py-3 text-sm disabled:cursor-not-allowed" placeholder="What did the agency do, for whom, and what kind of outcome or format is reusable here?" />
              </fieldset>
              <div className="mt-4 flex justify-end">
                <button onClick={() => addCredential.mutate()} disabled={addCredential.isPending || !credentialDraft.title || !credentialDraft.caseStudyText || !canManageWorkspace} className="bg-[#ff5a36] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
                  {addCredential.isPending ? "Adding..." : "Add credential"}
                </button>
              </div>

              <div className="mt-6 space-y-2">
                {(data?.credentials || []).map((credential) => (
                  <div key={credential.id} className="border border-white/[0.06] bg-black/40 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{credential.title}</p>
                        <p className="mt-1 text-[11px] text-white/45">
                          {(credential.services || []).join(", ") || "No service tags yet"}
                        </p>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400">
                        {credential.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-3">
            <section className="border border-white/[0.08] bg-[#050505] p-6">
              <div className="flex items-center gap-3">
                <Users2 className="h-4 w-4 text-[#ff5a36]" />
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/45">Workspace status</p>
                  <h2 className="text-lg font-semibold">{data?.workspace?.primaryDomain || workspace?.slug}</h2>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm text-white/60">
                <p>Calibration state: <span className="text-white">{data?.calibrationState || onboarding?.calibrationState || "default"}</span></p>
                <p>Onboarding status: <span className="text-white">{data?.workspace?.onboardingStatus || workspace?.onboardingStatus || "not_started"}</span></p>
                <p>Workspace role: <span className="text-white">{data?.membership?.role || workspace?.role || "member"}</span></p>
                <p>Workspace owner flow is domain-based. Any verified teammate with the same business domain will join this workspace automatically.</p>
              </div>
            </section>

            <section className="border border-white/[0.08] bg-[#050505] p-6">
              <div className="flex items-center gap-3">
                <FolderKanban className="h-4 w-4 text-[#ff5a36]" />
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/45">Memory</p>
                  <h2 className="text-lg font-semibold">Client notes and draft suggestions</h2>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {(data?.clientMemory || []).length > 0 ? (
                  data?.clientMemory.map((item) => (
                    <div key={item.id} className="border border-white/[0.06] bg-black/40 px-4 py-3">
                      <p className="text-sm font-semibold">{item.normalizedClientKey}</p>
                      <p className="mt-1 text-[11px] text-white/50">
                        {item.qualityRating} · {item.badFitFlag ? "bad-fit flagged" : "active"}
                      </p>
                      {item.notes && <p className="mt-2 text-[11px] leading-relaxed text-white/60">{item.notes}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/45">
                    Client memory will populate as the team logs pursuit outcomes.
                  </p>
                )}
              </div>

              {(data?.credentialSuggestions || []).length > 0 && (
                <div className="mt-6 border-t border-white/[0.06] pt-4">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <CheckCircle2 className="h-4 w-4 text-[#ff5a36]" />
                    Draft credential suggestions
                  </div>
                  <div className="mt-3 space-y-2">
                    {data?.credentialSuggestions.map((suggestion) => (
                      <div key={suggestion.id} className="border border-white/[0.06] bg-black/40 px-4 py-3">
                        <p className="text-sm leading-relaxed">{suggestion.extractedSummary}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                            {suggestion.approvalStatus}
                          </p>
                          <button
                            onClick={() => approveSuggestion.mutate(suggestion)}
                            disabled={approveSuggestion.isPending || suggestion.approvalStatus === "approved" || !canManageWorkspace}
                            className="border border-white/[0.08] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-40"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
