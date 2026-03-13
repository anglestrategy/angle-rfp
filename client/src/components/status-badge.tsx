import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "complete":
      return { label: "Complete", className: "bg-green-500/20 text-green-400 no-default-hover-elevate" };
    case "error":
      return { label: "Error", className: "bg-red-500/20 text-red-400 no-default-hover-elevate" };
    case "uploading":
      return { label: "Uploading", className: "bg-yellow-500/20 text-yellow-400 no-default-hover-elevate" };
    case "parsing":
      return { label: "Parsing", className: "bg-yellow-500/20 text-yellow-400 no-default-hover-elevate" };
    case "extracting":
      return { label: "Extracting", className: "bg-yellow-500/20 text-yellow-400 no-default-hover-elevate" };
    case "scoring":
      return { label: "Scoring", className: "bg-yellow-500/20 text-yellow-400 no-default-hover-elevate" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground no-default-hover-elevate" };
  }
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent text-xs", config.className, className)}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}
