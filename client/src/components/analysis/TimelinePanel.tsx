import { useMemo } from "react";

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

function shortenDate(raw: string): string {
  if (!raw) return "\u2014";
  const s = raw.trim();
  if (s.length <= 25) return s;
  return s.slice(0, 23) + "\u2026";
}

export function TimelinePanel({
  dates,
  overallDuration,
  startDate,
  endDate,
  submissionDeadline,
}: TimelinePanelProps) {
  const hasAnything = (dates && dates.length > 0) || startDate || endDate || submissionDeadline;

  if (!hasAnything) {
    return (
      <div className="dash-panel">
        <div className="dash-panel-header">
          <span className="dash-panel-title">Key Dates</span>
        </div>
        <div className="dash-panel-body">
          <p className="text-sm text-white/40">No key dates identified.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Key Dates</span>
        {overallDuration && <span className="dash-panel-badge">{overallDuration}</span>}
      </div>

      <div className="dash-panel-body">
        {/* Submission deadline highlight */}
        {submissionDeadline && !/not\s*specified|n\/?a|tbd|unknown/i.test(submissionDeadline) && (
          <div className="flex items-baseline justify-between pb-3 mb-3 border-b border-white/[0.06]">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#ff5a36]/70">Submission deadline</span>
            <span className="text-sm font-bold">{shortenDate(submissionDeadline)}</span>
          </div>
        )}

        {/* Start / End */}
        {(startDate || endDate) && (
          <div className="grid grid-cols-2 gap-4 pb-3 mb-3 border-b border-white/[0.06]">
            {startDate && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1">Start</p>
                <p className="text-sm">{shortenDate(startDate)}</p>
              </div>
            )}
            {endDate && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1">End</p>
                <p className="text-sm">{shortenDate(endDate)}</p>
              </div>
            )}
          </div>
        )}

        {/* Timeline items */}
        {dates && dates.length > 0 && (
          <div className="border-l border-white/[0.08] ml-1 pl-4">
            {dates.map((item, idx) => {
              const dateStr = item.date || item.milestone || "";
              const desc = item.description || item.event || item.label || "";
              return (
                <div key={idx} className="relative pb-4 last:pb-0">
                  <div className="absolute -left-[21px] top-1 h-2 w-2 border border-white/20 bg-black rounded-full" />
                  {dateStr && (
                    <p className="font-mono text-[10px] text-white/40 mb-0.5">{shortenDate(dateStr)}</p>
                  )}
                  <p className="text-sm text-white/70">{desc}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
