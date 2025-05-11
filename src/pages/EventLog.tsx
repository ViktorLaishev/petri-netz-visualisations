
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { usePetriNet } from "@/contexts/PetriNetContext";
import EventLogTable from "@/components/EventLogTable";

export default function EventLog() {
  const { state, generateEventLog, downloadEventLog } = usePetriNet();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleRegenerateLog = async () => {
    if (!generateEventLog) return;
    
    setIsGenerating(true);
    try {
      await generateEventLog();
      toast.success("Event log generated successfully");
    } catch (error) {
      console.error("Failed to generate event log:", error);
      toast.error("Failed to generate event log");
    } finally {
      setIsGenerating(false);
    }
  };

  const currentNetName = state.currentNetId 
    ? state.savedNets.find(net => net.id === state.currentNetId)?.name || "Current Petri Net" 
    : "Current Petri Net";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-4">
        <header className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Event Log - {currentNetName}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">View all possible paths through your Petri net</p>
            </div>
            <div className="flex gap-2">
              <Link to="/">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Editor
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <Card>
          <CardHeader className="pb-0">
            <div className="flex justify-between items-center">
              <CardTitle>Possible Paths</CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleRegenerateLog} 
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating..." : "Regenerate Log"}
                </Button>
                {downloadEventLog && (
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => {
                      downloadEventLog();
                      toast.success("Event log downloaded");
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <EventLogTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
