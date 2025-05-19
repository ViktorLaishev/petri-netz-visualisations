import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Download, AlertTriangle, BarChart, Activity } from "lucide-react";
import { toast } from "sonner";
import { usePetriNet } from "@/contexts/PetriNetContext";
import EventLogTable from "@/components/EventLogTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function EventLog() {
  const { state, generateEventLog, downloadEventLog } = usePetriNet();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("paths");

  // Generate event log on component mount if it's empty
  useEffect(() => {
    if (state.eventLog.paths.length === 0) {
      handleRegenerateLog();
    }
  }, [state.graph]);

  const handleRegenerateLog = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      await generateEventLog();
      toast.success("Event log generated successfully");
    } catch (error) {
      console.error("Failed to generate event log:", error);
      if (error instanceof RangeError && error.message.includes("Maximum call stack size exceeded")) {
        setGenerationError(
          "Failed to generate event log: The Petri net has too many possible paths or contains cycles. " +
          "Try simplifying the model or ensure there are no loops in the path finding."
        );
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        setGenerationError(
          "Failed to generate event log. Please ensure your Petri net has a valid path from P0 to P_out."
        );
      }
      toast.error("Failed to generate event log");
    } finally {
      setIsGenerating(false);
    }
  };

  const currentNetName = state.currentNetId 
    ? state.savedNets.find(net => net.id === state.currentNetId)?.name || "Current Petri Net" 
    : "Current Petri Net";

  // Calculate event log metrics
  const calculateMetrics = () => {
    const { paths } = state.eventLog;
    if (!paths || paths.length === 0) return null;

    // Path length statistics
    const pathLengths = paths.map(path => path.sequence.length);
    const avgPathLength = pathLengths.reduce((sum, len) => sum + len, 0) / pathLengths.length;
    const maxPathLength = Math.max(...pathLengths);
    const minPathLength = Math.min(...pathLengths);

    // Node frequency statistics
    const nodeFrequency: Record<string, number> = {};
    const placeFrequency: Record<string, number> = {};
    const transitionFrequency: Record<string, number> = {};

    paths.forEach(path => {
      path.sequence.forEach(node => {
        nodeFrequency[node.id] = (nodeFrequency[node.id] || 0) + 1;
        
        if (node.type === 'place') {
          placeFrequency[node.id] = (placeFrequency[node.id] || 0) + 1;
        } else if (node.type === 'transition') {
          transitionFrequency[node.id] = (transitionFrequency[node.id] || 0) + 1;
        }
      });
    });

    // Get top nodes by frequency
    const topNodes = Object.entries(nodeFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Count places and transitions
    const totalPlaces = Object.keys(placeFrequency).length;
    const totalTransitions = Object.keys(transitionFrequency).length;

    return {
      totalPaths: paths.length,
      avgPathLength,
      maxPathLength,
      minPathLength,
      topNodes,
      totalPlaces,
      totalTransitions
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-4">
        <header className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Event Log - {currentNetName}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">View and analyze all possible paths through your Petri net</p>
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

        {generationError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{generationError}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="paths">Paths</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRegenerateLog} 
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Regenerate Log"}
              </Button>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  if (state.eventLog.paths.length === 0) {
                    toast.error("No event log to download. Please generate the log first.");
                    return;
                  }
                  downloadEventLog();
                  toast.success("Event log downloaded");
                }}
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </div>
          
          <TabsContent value="paths" className="mt-4">
            <Card>
              <CardHeader className="pb-0">
                <CardTitle>Possible Paths</CardTitle>
                <CardDescription>All possible execution paths through your Petri net</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <EventLogTable />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    Event Log Statistics
                  </CardTitle>
                  <CardDescription>
                    Overview of all paths in your event log
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md">
                        <p className="text-sm font-medium mb-1">Total Paths</p>
                        <p className="text-2xl font-bold">{metrics.totalPaths}</p>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md">
                        <p className="text-sm font-medium mb-1">Avg. Path Length</p>
                        <p className="text-2xl font-bold">{metrics.avgPathLength.toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md">
                        <p className="text-sm font-medium mb-1">Shortest Path</p>
                        <p className="text-2xl font-bold">{metrics.minPathLength}</p>
                        <p className="text-xs text-slate-500">nodes</p>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md">
                        <p className="text-sm font-medium mb-1">Longest Path</p>
                        <p className="text-2xl font-bold">{metrics.maxPathLength}</p>
                        <p className="text-xs text-slate-500">nodes</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      No metrics available. Generate an event log first.
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Node Activity
                  </CardTitle>
                  <CardDescription>
                    Most frequently visited nodes in paths
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics && metrics.topNodes.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md">
                          <p className="text-sm font-medium mb-1">Places</p>
                          <p className="text-2xl font-bold">{metrics.totalPlaces}</p>
                          <p className="text-xs text-slate-500">total in paths</p>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md">
                          <p className="text-sm font-medium mb-1">Transitions</p>
                          <p className="text-2xl font-bold">{metrics.totalTransitions}</p>
                          <p className="text-xs text-slate-500">total in paths</p>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-2">Most Active Nodes</h3>
                        <div className="space-y-3">
                          {metrics.topNodes.map(([nodeId, frequency], index) => {
                            const node = state.graph.nodes.find(n => n.id === nodeId);
                            const nodeType = node?.type || "unknown";
                            return (
                              <div key={nodeId} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-2 rounded-md">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{index + 1}.</span>
                                  <Badge
                                    variant={nodeType === "place" ? "default" : "outline"}
                                    className={
                                      nodeType === "place"
                                        ? "bg-blue-500"
                                        : "bg-green-500 text-white"
                                    }
                                  >
                                    {nodeId}
                                  </Badge>
                                </div>
                                <div className="text-sm font-medium">
                                  {frequency} occurrences
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      No node activity data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
