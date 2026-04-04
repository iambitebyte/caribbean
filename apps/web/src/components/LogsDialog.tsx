import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { RefreshCw, X, Download } from "lucide-react"

interface LogsDialogProps {
  isOpen: boolean
  onClose: () => void
  node: any
  logs: string
  loading: boolean
  error: string | null
}

export function LogsDialog({ isOpen, onClose, node, logs, loading, error }: LogsDialogProps) {
  const handleDownload = () => {
    if (!logs || !node) return;
    
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw-logs-${node.name || node.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Logs - {node?.name || 'unknown'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={handleDownload}
                disabled={!logs || loading}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4 bg-muted rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          ) : logs ? (
            <pre className="p-4 text-sm whitespace-pre-wrap break-words font-mono">
              {logs}
            </pre>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No logs available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
