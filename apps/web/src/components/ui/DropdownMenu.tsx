import * as React from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
  open: false,
  setOpen: () => {},
})

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

function DropdownMenuTrigger({ children, className, disabled }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { open, setOpen } = React.useContext(DropdownMenuContext)

  return (
    <button
      type="button"
      className={className}
      onClick={() => !disabled && setOpen(!open)}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function DropdownMenuContent({ children, className, align = 'end' }: { children: React.ReactNode; className?: string; align?: 'start' | 'end' }) {
  const { open, setOpen } = React.useContext(DropdownMenuContext)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        align === 'end' ? 'right-0' : 'left-0',
        className
      )}
    >
      {children}
    </div>
  )
}

function DropdownMenuItem({
  children,
  className,
  disabled,
  onSelect,
}: {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onSelect?: () => void
}) {
  const { setOpen } = React.useContext(DropdownMenuContext)

  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      disabled={disabled}
      onClick={() => {
        onSelect?.()
        setOpen(false)
      }}
    >
      {children}
    </button>
  )
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem }
