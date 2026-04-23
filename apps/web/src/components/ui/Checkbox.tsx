import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        className={cn(
          "h-[18px] w-[18px] shrink-0 rounded-md border-2 border-primary ring-offset-background transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "hover:border-[hsl(var(--primary))]/80 hover:scale-110 active:scale-95",
          checked && "bg-primary text-primary-foreground shadow-sm",
          className
        )}
        onClick={() => onCheckedChange?.(!checked)}
        ref={ref as any}
        {...(props as any)}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
