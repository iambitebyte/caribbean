import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { RefreshCw, X } from "lucide-react"

interface ConfigDialogProps {
  isOpen: boolean
  onClose: () => void
  node: any
  config: unknown
  loading: boolean
  error: string | null
}

export function ConfigDialog({ isOpen, onClose, node, config, loading, error }: ConfigDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Configuration - {node?.name || 'unknown'}
            </DialogTitle>
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

        <div className="flex-1 overflow-auto mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          ) : config ? (
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
              <code>{JSON.stringify(config, null, 2)}</code>
            </pre>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No configuration data available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
