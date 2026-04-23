import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "destructive" | "secondary" | "blue" | "warning" | "info"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80 shadow-sm": variant === "default",
          "border-transparent bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/80 shadow-sm": variant === "success",
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 shadow-sm": variant === "destructive",
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
          "border-transparent bg-[hsl(var(--blue))] text-[hsl(var(--blue-foreground))] hover:bg-[hsl(var(--blue))]/80 shadow-sm": variant === "blue",
          "border-transparent bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))]/80 shadow-sm": variant === "warning",
          "border-transparent bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))] hover:bg-[hsl(var(--info))]/80 shadow-sm": variant === "info",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
