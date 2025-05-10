
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import { toast } from "sonner";
import EventLogTable from "@/components/EventLogTable";

const EventLog: React.FC = () => {
  const { state, generateEventLog, downloadEventLog } = usePetriNet();
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Always regenerate event log when component mounts
  useEffect(() => {
    if (state.graph.nodes.length > 0) {
      handleGenerateEventLog();
    }
  }, []);

  const handleGenerateEventLog = async () => {
    setIsGenerating(true);
    try {
      await generateEventLog();
      toast.success("Event log generated successfully");
    } catch (error) {
      toast.error("Failed to generate event log");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadEventLog = () => {
    downloadEventLog();
    toast.success("Event log downloaded as CSV");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/">
              <Button variant="outline" size="sm" className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Petri Net
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Petri Net Event Log
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              All possible paths for token flows in the current Petri net
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleGenerateEventLog}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Regenerate Log"}
            </Button>
            <Button 
              variant="default" 
              onClick={handleDownloadEventLog}
              disabled={state.eventLog.paths.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Paths</CardTitle>
          </CardHeader>
          <CardContent>
            <EventLogTable />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Paths</p>
                <p className="text-2xl font-bold">{state.eventLog.paths.length}</p>
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                <p className="text-sm text-slate-500 dark:text-slate-400">Transitions</p>
                <p className="text-2xl font-bold">
                  {state.graph.nodes.filter(node => node.type === 'transition').length}
                </p>
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                <p className="text-sm text-slate-500 dark:text-slate-400">Places</p>
                <p className="text-2xl font-bold">
                  {state.graph.nodes.filter(node => node.type === 'place').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EventLog;
