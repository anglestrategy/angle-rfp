import * as React from "react";
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import gsap from "gsap";

/**
 * GSAP-powered collapsible — no Radix, no overflow:hidden.
 *
 * Uses GSAP's ability to tween to `height: "auto"`, which means:
 *  - No overflow:hidden needed (inner scroll containers work)
 *  - Frame-perfect animation with hardware acceleration
 *  - Works on every browser, every OS
 */

// ── Context ────────────────────────────────────────────────
const CollapsibleCtx = React.createContext<{
  isOpen: boolean;
  toggle: () => void;
}>({ isOpen: false, toggle: () => {} });

// ── Single Section ─────────────────────────────────────────
interface CollapsibleSectionProps {
  value: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

function CollapsibleSection({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
  className,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const toggle = useCallback(() => {
    const next = !isOpen;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, controlledOpen, onOpenChange]);

  return (
    <CollapsibleCtx.Provider value={{ isOpen, toggle }}>
      <div className={cn("", className)}>{children}</div>
    </CollapsibleCtx.Provider>
  );
}

// ── Trigger ────────────────────────────────────────────────
interface CollapsibleTriggerProps {
  children: React.ReactNode;
  className?: string;
}

function CollapsibleTrigger({ children, className }: CollapsibleTriggerProps) {
  const { isOpen, toggle } = React.useContext(CollapsibleCtx);

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex w-full items-center justify-between text-left transition-colors cursor-pointer",
        className
      )}
      aria-expanded={isOpen}
    >
      {children}
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      />
    </button>
  );
}

// ── Content (GSAP animated) ────────────────────────────────
interface CollapsibleContentProps {
  children: React.ReactNode;
  className?: string;
}

function CollapsibleContent({ children, className }: CollapsibleContentProps) {
  const { isOpen } = React.useContext(CollapsibleCtx);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // On first render, just set initial state — no animation
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (isOpen) {
        gsap.set(wrapper, { height: "auto", opacity: 1, overflow: "visible" });
      } else {
        gsap.set(wrapper, { height: 0, opacity: 0, overflow: "hidden" });
      }
      return;
    }

    // Animate open/close
    if (isOpen) {
      // Lock overflow during animation, then release
      gsap.set(wrapper, { overflow: "hidden" });
      gsap.to(wrapper, {
        height: "auto",
        opacity: 1,
        duration: 0.3,
        ease: "power2.out",
        onComplete: () => {
          // Critical: set overflow visible so inner scroll containers work
          gsap.set(wrapper, { height: "auto", overflow: "visible" });
        },
      });
    } else {
      // Lock overflow immediately, then collapse
      gsap.set(wrapper, { overflow: "hidden" });
      gsap.to(wrapper, {
        height: 0,
        opacity: 0,
        duration: 0.25,
        ease: "power2.inOut",
      });
    }
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      style={{ overflow: "hidden", height: 0, opacity: 0 }}
    >
      <div ref={innerRef} className={className}>
        {children}
      </div>
    </div>
  );
}

// ── Group (manages multiple sections, single or multiple mode) ──
interface CollapsibleGroupProps {
  type: "single" | "multiple";
  collapsible?: boolean;
  defaultValue?: string[];
  children: React.ReactNode;
  className?: string;
}

const GroupCtx = React.createContext<{
  openValues: Set<string>;
  toggle: (value: string) => void;
} | null>(null);

function CollapsibleGroup({
  type,
  collapsible = true,
  defaultValue = [],
  children,
  className,
}: CollapsibleGroupProps) {
  const [openValues, setOpenValues] = useState<Set<string>>(
    () => new Set(defaultValue)
  );

  const toggle = useCallback(
    (value: string) => {
      setOpenValues((prev) => {
        const next = new Set(prev);
        if (next.has(value)) {
          if (collapsible || type === "multiple") next.delete(value);
        } else {
          if (type === "single") next.clear();
          next.add(value);
        }
        return next;
      });
    },
    [type, collapsible]
  );

  return (
    <GroupCtx.Provider value={{ openValues, toggle }}>
      <div className={className}>{children}</div>
    </GroupCtx.Provider>
  );
}

// ── Group Section ──────────────────────────────────────────
function CollapsibleGroupSection({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const group = React.useContext(GroupCtx);
  if (!group) throw new Error("CollapsibleGroupSection must be inside CollapsibleGroup");

  const isOpen = group.openValues.has(value);
  const toggle = useCallback(() => group.toggle(value), [group, value]);

  return (
    <CollapsibleCtx.Provider value={{ isOpen, toggle }}>
      <div className={cn("", className)}>{children}</div>
    </CollapsibleCtx.Provider>
  );
}

export {
  CollapsibleSection,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleGroup,
  CollapsibleGroupSection,
};
