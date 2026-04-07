import { useEffect, useRef, useState, type ReactNode } from "react";

interface MasonryProps {
  children: ReactNode[];
  columns?: number;
  gap?: number;
  className?: string;
}

/**
 * JS-based masonry layout. Measures children after mount and assigns
 * each to the shortest column. Does NOT re-measure on expand/collapse
 * so collapsible sections won't cause reflow jumps.
 */
export function Masonry({ children, columns = 2, gap = 16, className = "" }: MasonryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnAssignments, setColumnAssignments] = useState<number[] | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wait for children to render and measure
    const raf = requestAnimationFrame(() => {
      const items = Array.from(container.querySelectorAll<HTMLElement>(":scope > [data-masonry-item]"));
      if (items.length === 0) return;

      const heights = new Array(columns).fill(0);
      const assignments: number[] = [];

      for (const item of items) {
        // Find the shortest column
        let shortest = 0;
        for (let c = 1; c < columns; c++) {
          if (heights[c] < heights[shortest]) shortest = c;
        }
        assignments.push(shortest);
        heights[shortest] += item.offsetHeight + gap;
      }

      setColumnAssignments(assignments);
    });

    return () => cancelAnimationFrame(raf);
  }, [children.length, columns, gap]);

  // First render: show items in a hidden measurer to get heights
  if (!columnAssignments) {
    return (
      <div ref={containerRef} className={className}>
        {children.map((child, i) => (
          <div key={i} data-masonry-item className="mb-4">
            {child}
          </div>
        ))}
      </div>
    );
  }

  // Second render: distribute into columns
  const cols: ReactNode[][] = Array.from({ length: columns }, () => []);
  children.forEach((child, i) => {
    const col = columnAssignments[i] ?? (i % columns);
    cols[col].push(
      <div key={i} style={{ marginBottom: gap }}>
        {child}
      </div>
    );
  });

  return (
    <div
      className={className}
      style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap, alignItems: "start" }}
    >
      {cols.map((colChildren, colIdx) => (
        <div key={colIdx}>
          {colChildren}
        </div>
      ))}
    </div>
  );
}
