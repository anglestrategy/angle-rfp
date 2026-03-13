import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "shadcn-card rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-card-foreground shadow-[var(--glass-outer-glow)] card-lift relative shrink-0",
  {
    variants: {
      variant: {
        default: "",
        elevated: "hover:-translate-y-1",
        risk: "border-l-4 border-l-primary",
        success: "border-l-4 border-l-green-600",
        warning: "border-l-4 border-l-yellow-500",
        info: "border-l-4 border-l-blue-500",
        inset: "bg-[hsl(var(--background))] border-[var(--glass-border)]",
        accent: "glass-panel-accent",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    >
      {/* Glass highlight shine */}
      <div
        className="absolute top-0 left-0 right-0 h-[40%] pointer-events-none z-0 opacity-60"
        style={{ background: "var(--glass-highlight)" }}
      />
      {/* Warm rim glow on hover */}
      <div
        className="absolute inset-[-1px] rounded-[inherit] pointer-events-none z-[-1] opacity-0 hover-parent-rim transition-opacity duration-400"
        style={{
          background: "linear-gradient(160deg, transparent 40%, var(--glass-rim) 70%, var(--glass-rim-strong) 100%)",
        }}
      />
      {props.children}
    </div>
  )
);
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 px-5 py-4 relative z-[1]", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-5 pb-4 pt-0 relative z-[1]", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 relative z-[1]", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
