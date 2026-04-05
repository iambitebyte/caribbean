import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchVersion } from "@/lib/api"

interface LogoDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function LogoDialog({ isOpen, onClose }: LogoDialogProps) {
  const [version, setVersion] = useState<string>("")

  useEffect(() => {
    if (isOpen) {
      fetchVersion().then((data) => setVersion(data.version)).catch(() => {})
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Caribbean</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-8">
          <img src="/img/caribbean-logo.png" alt="Caribbean" className="w-48 h-auto" />
          <p className="mt-4 text-muted-foreground">
            Openclaw Caribbean Dashboard{version ? ` v${version}` : ""}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
