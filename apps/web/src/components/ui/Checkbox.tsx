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
          "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked && "bg-primary text-primary-foreground",
          className
        )}
        onClick={() => onCheckedChange?.(!checked)}
        ref={ref as any}
        {...(props as any)}
      >
        {checked && <Check className="h-3 w-3" />}
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
