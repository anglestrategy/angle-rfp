import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TimelineDate {
  date?: string;
  event?: string;
  description?: string;
  milestone?: string;
  label?: string;
  phase?: string;
  [key: string]: any;
}

interface TimelinePanelProps {
  dates: TimelineDate[];
  overallDuration?: string;
  startDate?: string;
  endDate?: string;
  submissionDeadline?: string;
}

/* ── Helpers ── */

function isSubmissionDate(item: TimelineDate): boolean {
  if (item.phase === "submission") return true;
  if (item.phase === "project") return false;

  const text = [
    item.description,
    item.event,
    item.label,
    item.date,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const rfpPhrases = [
    "proposal submission", "proposal deadline", "proposal due",
    "bid submission", "bid deadline", "bid due",
    "rfp response", "rfp deadline", "rfp due",
    "submit proposal", "submit bid", "submit rfp",
    "submission deadline", "response deadline",
    "last day for question", "questions deadline", "q&a deadline",
    "q&a period", "clarification deadline", "clarification period",
    "pre-qualification", "pre-bid", "prebid",
    "shortlist", "shortlisting",
    "intent to bid", "intent to respond",
    "mandatory briefing", "bidder conference",
    "award notification", "contract award",
    "evaluation period", "evaluation committee",
    "site visit for bidder",
  ];

  return rfpPhrases.some((phrase) => text.includes(phrase));
}

function shortenDate(raw: string): string {
  if (!raw) return "\u2014";

  let s = raw.trim();

  if (s.length <= 20) return s;

  const fillers = [
    /^no more than\s*/i,
    /^within\s*/i,
    /^no later than\s*/i,
    /^at least\s*/i,
    /^approximately\s*/i,
    /^a maximum of\s*/i,
    /^a minimum of\s*/i,
  ];
  for (const re of fillers) s = s.replace(re, "");

  const daysPattern =
    /^(\d+)\s*(?:calendar|business|working)?\s*days?\s*(?:after|from|following)\s*(.+)$/i;
  const daysMatch = s.match(daysPattern);
  if (daysMatch) return `${daysMatch[1]}d post ${simplifyAnchor(daysMatch[2])}`;

  const daysPriorPattern =
    /^(\d+)\s*(?:calendar|business|working)?\s*days?\s*(?:before|prior to|ahead of)\s*(.+)$/i;
  const daysPriorMatch = s.match(daysPriorPattern);
  if (daysPriorMatch) return `${daysPriorMatch[1]}d pre ${simplifyAnchor(daysPriorMatch[2])}`;

  const weeksPattern =
    /^(\d+)\s*weeks?\s*(?:from|after|following)\s*(.+)$/i;
  const weeksMatch = s.match(weeksPattern);
  if (weeksMatch) return `${weeksMatch[1]}w post ${simplifyAnchor(weeksMatch[2])}`;

  const weeksPriorPattern =
    /^(\d+)\s*weeks?\s*(?:before|prior to)\s*(.+)$/i;
  const weeksPriorMatch = s.match(weeksPriorPattern);
  if (weeksPriorMatch) return `${weeksPriorMatch[1]}w pre ${simplifyAnchor(weeksPriorMatch[2])}`;

  if (s.length > 30) return s.slice(0, 28) + "\u2026";
  return s;
}

function simplifyAnchor(anchor: string): string {
  const a = anchor.trim().toLowerCase();
  if (a.includes("contract") && (a.includes("effective") || a.includes("signing") || a.includes("execution")))
    return "signing";
  if (a.includes("kick-off") || a.includes("kickoff"))
    return "kick-off";
  if (a.includes("project start") || a.includes("commencement"))
    return "start";
  if (a.includes("launch"))
    return "launch";
  if (a.includes("conclusion") || a.includes("completion"))
    return "completion";
  const short = anchor.trim();
  return short.length > 15 ? short.slice(0, 13) + "\u2026" : short;
}

/* ── Component ── */

export function TimelinePanel({
  dates,
  overallDuration,
  startDate,
  endDate,
  submissionDeadline,
}: TimelinePanelProps) {
  const { submissionDates, projectDates } = useMemo(() => {
    const sub: TimelineDate[] = [];
    const proj: TimelineDate[] = [];

    if (!dates || dates.length === 0) return { submissionDates: sub, projectDates: proj };

    for (const d of dates) {
      if (isSubmissionDate(d)) sub.push(d);
      else proj.push(d);
    }

    return { submissionDates: sub, projectDates: proj };
  }, [dates]);

  const deadlineIsReal = !!submissionDeadline &&
    !/not\s*specified|n\/?a|tbd|tba|unknown|none|null/i.test(submissionDeadline);

  const hasSub = submissionDates.length > 0 || deadlineIsReal;
  const hasProj = projectDates.length > 0;
  const hasAnything = hasSub || hasProj || startDate || endDate;

  if (!hasAnything) {
    return (
      <div className="dash-panel">
        <div className="dash-panel-header">
          <span className="dash-panel-title">Key Dates</span>
        </div>
        <div className="dash-panel-body">
          <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.4)" }}>No key dates identified</p>
        </div>
      </div>
    );
  }

  const allDates: Array<{ date: string; title: string; description: string; isSubmission: boolean; isDeadline?: boolean }> = [];

  // Add submission deadline at the top
  if (deadlineIsReal) {
    allDates.push({
      date: submissionDeadline!,
      title: "Proposal Submission Deadline",
      description: "",
      isSubmission: true,
      isDeadline: true,
    });
  }

  // Add submission dates
  for (const item of submissionDates) {
    const dateStr = item.date || item.milestone || "";
    const desc = item.description || item.event || item.label || "";
    const isDupe =
      submissionDeadline &&
      desc.toLowerCase().includes("submission") &&
      desc.toLowerCase().includes("deadline");
    if (isDupe) continue;
    allDates.push({
      date: dateStr,
      title: desc,
      description: "",
      isSubmission: true,
    });
  }

  // Add project dates
  for (const item of projectDates) {
    const dateStr = item.date || item.milestone || "";
    const desc = item.description || item.event || item.label || "";
    allDates.push({
      date: dateStr,
      title: desc,
      description: "",
      isSubmission: false,
    });
  }

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Key Dates</span>
        {overallDuration && (
          <span className="dash-panel-badge">{overallDuration}</span>
        )}
      </div>

      <div className="dash-panel-body">
        {/* Submission deadline highlight */}
        {deadlineIsReal && (
          <div className="mb-6 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="dash-metric-label">Submission Deadline</p>
            <p className="dash-metric-value !text-2xl" style={{ color: "#ff5a36" }}>
              {shortenDate(submissionDeadline!)}
            </p>
          </div>
        )}

        {/* Timeline with left border and circle nodes */}
        <div className="relative" style={{ paddingLeft: "24px", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
          {allDates.filter(d => !d.isDeadline).map((item, idx) => (
            <div key={idx} className="relative mb-6 last:mb-0">
              {/* Circle node */}
              <div
                className="absolute"
                style={{
                  left: "-29px",
                  top: "4px",
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: item.isSubmission ? "#ff5a36" : "rgba(255,255,255,0.3)",
                }}
              />

              {/* Date pill */}
              <span
                className="inline-block font-mono text-xs font-bold mb-1.5 px-2.5 py-0.5"
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "20px",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {shortenDate(item.date)}
              </span>

              {/* Title */}
              <p className="text-sm font-bold uppercase" style={{ color: "rgba(255,255,255,0.9)" }}>
                {item.title}
              </p>

              {/* Description */}
              {item.description && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {item.description}
                </p>
              )}
            </div>
          ))}

          {/* Start/End dates if no other project dates */}
          {!hasProj && (startDate || endDate) && (
            <>
              {startDate && (
                <div className="relative mb-6">
                  <div
                    className="absolute"
                    style={{
                      left: "-29px",
                      top: "4px",
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.3)",
                    }}
                  />
                  <span
                    className="inline-block font-mono text-xs font-bold mb-1.5 px-2.5 py-0.5"
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "20px",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    {startDate}
                  </span>
                  <p className="text-sm font-bold uppercase" style={{ color: "rgba(255,255,255,0.9)" }}>
                    Project Start
                  </p>
                </div>
              )}
              {endDate && (
                <div className="relative mb-0">
                  <div
                    className="absolute"
                    style={{
                      left: "-29px",
                      top: "4px",
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.3)",
                    }}
                  />
                  <span
                    className="inline-block font-mono text-xs font-bold mb-1.5 px-2.5 py-0.5"
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "20px",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    {endDate}
                  </span>
                  <p className="text-sm font-bold uppercase" style={{ color: "rgba(255,255,255,0.9)" }}>
                    Project End
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
