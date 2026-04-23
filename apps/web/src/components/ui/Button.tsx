import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost" | "success"
  size?: "default" | "sm" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] shadow-md hover:shadow-lg": variant === "default",
            "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98] shadow-md hover:shadow-lg": variant === "destructive",
            "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent active:scale-[0.98] shadow-sm hover:shadow-md": variant === "outline",
            "hover:bg-accent hover:text-accent-foreground active:scale-[0.98]": variant === "ghost",
            "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90 active:scale-[0.98] shadow-md hover:shadow-lg": variant === "success",
          },
          {
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3 text-xs": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
