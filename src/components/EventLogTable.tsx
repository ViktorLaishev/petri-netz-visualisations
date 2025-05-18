import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePetriNet } from "@/contexts/PetriNetContext";
import { Badge } from "@/components/ui/badge";

const EventLogTable: React.FC = () => {
  const { state } = usePetriNet();
  const { eventLog } = state;

  if (eventLog.paths.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        No event paths generated yet. Please generate the event log first.
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Path ID</TableHead>
              <TableHead>Sequence</TableHead>
              <TableHead className="w-[120px]">Length</TableHead>
              <TableHead className="w-[120px]">Start</TableHead>
              <TableHead className="w-[120px]">End</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventLog.paths.map((path, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {path.sequence.map((node, i) => (
                      <React.Fragment key={i}>
                        <Badge
                          variant={
                            node.type === "place" ? "default" : "outline"
                          }
                          className={
                            node.type === "place"
                              ? "bg-blue-500"
                              : "bg-green-500 text-white"
                          }
                        >
                          {node.id}
                        </Badge>
                        {i < path.sequence.length - 1 && (
                          <span className="text-slate-400">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{path.sequence.length}</TableCell>
                <TableCell>{path.sequence[0]?.id || "N/A"}</TableCell>
                <TableCell>
                  {path.sequence[path.sequence.length - 1]?.id || "N/A"}
                </TableCell>
              </TableRow>
            ))}
            {eventLog.paths.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  No paths available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default EventLogTable;

// import React from "react";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { usePetriNet } from "@/contexts/PetriNetContext";
// import { Badge } from "@/components/ui/badge";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Button } from "@/components/ui/button";
// import { Download, RefreshCw } from "lucide-react";
// import { toast } from "sonner";

// // Node types to improve type safety
// interface EventNode {
//   id: string;
//   type: "place" | "transition";
// }

// interface EventPath {
//   sequence: EventNode[];
//   timestamp: number;
//   // Additional properties that might be useful
//   probability?: number;
//   duration?: number;
// }

// interface EventLog {
//   paths: EventPath[];
//   generatedAt?: Date;
// }

// const EventLogTable: React.FC = () => {
//   const { state, generateEventLog, exportEventLog } = usePetriNet();
//   const [isGenerating, setIsGenerating] = React.useState(false);
//   const [eventLog, setEventLog] = React.useState<EventLog>({ paths: [] });

//   // Use effect to update the event log when it changes in the context
//   React.useEffect(() => {
//     if (state.eventLog) {
//       setEventLog(state.eventLog);
//     }
//   }, [state.eventLog]);

//   const handleGenerateEventLog = async () => {
//     setIsGenerating(true);
//     try {
//       // Check if generateEventLog exists in your context
//       if (typeof generateEventLog === "function") {
//         await generateEventLog();
//         toast.success("Event log generated successfully");
//       } else {
//         // Fallback implementation if not provided by the context
//         const simulatedPaths = simulateEventPaths();
//         setEventLog({ paths: simulatedPaths, generatedAt: new Date() });
//         toast.success("Event log generated successfully");
//       }
//     } catch (error) {
//       console.error("Error generating event log:", error);
//       toast.error("Failed to generate event log");
//     } finally {
//       setIsGenerating(false);
//     }
//   };

//   // This is a fallback simulation function if your context doesn't provide one
//   const simulateEventPaths = (): EventPath[] => {
//     // Get places and transitions from the Petri net context
//     const places = Object.values(state.places || {});
//     const transitions = Object.values(state.transitions || {});

//     if (places.length === 0 || transitions.length === 0) {
//       toast.warning(
//         "The Petri net doesn't have enough elements to generate paths"
//       );
//       return [];
//     }

//     // Start from initial place (usually P0)
//     const startPlace = places.find((p) => p.id === "P0") || places[0];
//     const endPlace =
//       places.find((p) => p.id === "P_out") || places[places.length - 1];

//     // Use the token flow to generate paths
//     // This is a very simplified simulation - you'll want to replace this
//     // with your actual Petri net traversal logic
//     const paths: EventPath[] = [];

//     // Generate a few example paths
//     const numPaths = Math.min(
//       10,
//       Math.max(3, places.length + transitions.length / 2)
//     );

//     for (let i = 0; i < numPaths; i++) {
//       const path: EventPath = {
//         sequence: [],
//         timestamp: Date.now() - i * 1000 * 60 * 10, // Spread out over time
//       };

//       // Add start place
//       path.sequence.push({ id: startPlace.id, type: "place" });

//       let currentNode = startPlace;
//       let steps = 0;
//       const maxSteps = places.length + transitions.length * 2; // Prevent infinite loops

//       // Simple path generation algorithm
//       while (currentNode.id !== endPlace.id && steps < maxSteps) {
//         // Find a transition connected to this place
//         const connectedTransitions = transitions.filter((t) =>
//           (state.connections || []).some(
//             (c) =>
//               (c.source === currentNode.id && c.target === t.id) ||
//               (t.id === currentNode.id && state.places[c.target])
//           )
//         );

//         if (connectedTransitions.length > 0) {
//           // Select a random transition
//           const nextTransition =
//             connectedTransitions[
//               Math.floor(Math.random() * connectedTransitions.length)
//             ];
//           path.sequence.push({ id: nextTransition.id, type: "transition" });
//           currentNode = nextTransition;

//           // Find a place connected to this transition
//           const connectedPlaces = places.filter((p) =>
//             (state.connections || []).some(
//               (c) =>
//                 (c.source === currentNode.id && c.target === p.id) ||
//                 (p.id === currentNode.id && state.transitions[c.target])
//             )
//           );

//           if (connectedPlaces.length > 0) {
//             // Prefer the end place if it's connected
//             const nextPlace =
//               connectedPlaces.find((p) => p.id === endPlace.id) ||
//               connectedPlaces[
//                 Math.floor(Math.random() * connectedPlaces.length)
//               ];
//             path.sequence.push({ id: nextPlace.id, type: "place" });
//             currentNode = nextPlace;
//           }
//         }

//         steps++;
//       }

//       // Ensure the path ends at the end place if not already
//       if (path.sequence[path.sequence.length - 1]?.id !== endPlace.id) {
//         path.sequence.push({ id: endPlace.id, type: "place" });
//       }

//       // Add probability for demonstration
//       path.probability = Number((1 / (i + 1)).toFixed(2));

//       paths.push(path);
//     }

//     return paths;
//   };

//   const handleExportEventLog = () => {
//     if (eventLog.paths.length === 0) {
//       toast.warning("No event log to export");
//       return;
//     }

//     try {
//       // Check if the context provides an export function
//       if (typeof exportEventLog === "function") {
//         exportEventLog();
//         toast.success("Event log exported successfully");
//       } else {
//         // Fallback export implementation
//         const csvData = convertToCSV(eventLog);
//         downloadCSV(
//           csvData,
//           `event_log_${new Date().toISOString().split("T")[0]}.csv`
//         );
//         toast.success("Event log exported successfully");
//       }
//     } catch (error) {
//       console.error("Error exporting event log:", error);
//       toast.error("Failed to export event log");
//     }
//   };

//   // Helper function to convert event log to CSV format
//   const convertToCSV = (eventLog: EventLog): string => {
//     const headers = [
//       "Path ID",
//       "Sequence",
//       "Length",
//       "Start Node",
//       "End Node",
//       "Probability",
//     ];
//     const rows = eventLog.paths.map((path, index) => [
//       (index + 1).toString(),
//       path.sequence.map((node) => node.id).join(" → "),
//       path.sequence.length.toString(),
//       path.sequence[0]?.id || "N/A",
//       path.sequence[path.sequence.length - 1]?.id || "N/A",
//       path.probability?.toString() || "N/A",
//     ]);

//     return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
//   };

//   // Helper function to download CSV
//   const downloadCSV = (csvContent: string, fileName: string) => {
//     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
//     const link = document.createElement("a");
//     const url = URL.createObjectURL(blob);
//     link.setAttribute("href", url);
//     link.setAttribute("download", fileName);
//     link.style.visibility = "hidden";
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between">
//         <h2 className="text-xl font-bold">Event Log</h2>
//         <div className="space-x-2">
//           <Button
//             variant="outline"
//             size="sm"
//             onClick={handleGenerateEventLog}
//             disabled={isGenerating}
//           >
//             <RefreshCw className="h-4 w-4 mr-2" />
//             {isGenerating ? "Generating..." : "Generate Event Log"}
//           </Button>

//           <Button
//             variant="outline"
//             size="sm"
//             onClick={handleExportEventLog}
//             disabled={eventLog.paths.length === 0}
//           >
//             <Download className="h-4 w-4 mr-2" />
//             Export CSV
//           </Button>
//         </div>
//       </div>

//       {eventLog.generatedAt && (
//         <div className="text-sm text-slate-500 dark:text-slate-400">
//           Generated: {eventLog.generatedAt.toLocaleString()}
//         </div>
//       )}

//       {eventLog.paths.length === 0 ? (
//         <div className="border rounded-md p-8 text-center text-slate-500 dark:text-slate-400">
//           No event paths generated yet. Please generate the event log first.
//         </div>
//       ) : (
//         <div className="border rounded-md">
//           <ScrollArea className="h-[500px]">
//             <Table>
//               <TableHeader className="sticky top-0 bg-background z-10">
//                 <TableRow>
//                   <TableHead className="w-[80px]">Path ID</TableHead>
//                   <TableHead>Sequence</TableHead>
//                   <TableHead className="w-[100px] text-right">Length</TableHead>
//                   <TableHead className="w-[100px]">Start</TableHead>
//                   <TableHead className="w-[100px]">End</TableHead>
//                   <TableHead className="w-[100px] text-right">
//                     Probability
//                   </TableHead>
//                 </TableRow>
//               </TableHeader>
//               <TableBody>
//                 {eventLog.paths.map((path, index) => (
//                   <TableRow key={index}>
//                     <TableCell className="font-medium">{index + 1}</TableCell>
//                     <TableCell>
//                       <div className="flex flex-wrap gap-1">
//                         {path.sequence.map((node, i) => (
//                           <React.Fragment key={i}>
//                             <Badge
//                               variant={
//                                 node.type === "place" ? "default" : "outline"
//                               }
//                               className={
//                                 node.type === "place"
//                                   ? "bg-blue-500 hover:bg-blue-600"
//                                   : "border-green-500 text-green-500 hover:bg-green-100"
//                               }
//                             >
//                               {node.id}
//                             </Badge>
//                             {i < path.sequence.length - 1 && (
//                               <span className="text-slate-400 flex items-center">
//                                 →
//                               </span>
//                             )}
//                           </React.Fragment>
//                         ))}
//                       </div>
//                     </TableCell>
//                     <TableCell className="text-right">
//                       {path.sequence.length}
//                     </TableCell>
//                     <TableCell>{path.sequence[0]?.id || "N/A"}</TableCell>
//                     <TableCell>
//                       {path.sequence[path.sequence.length - 1]?.id || "N/A"}
//                     </TableCell>
//                     <TableCell className="text-right">
//                       {path.probability?.toFixed(2) || "N/A"}
//                     </TableCell>
//                   </TableRow>
//                 ))}
//               </TableBody>
//             </Table>
//           </ScrollArea>
//         </div>
//       )}

//       {eventLog.paths.length > 0 && (
//         <div className="text-sm text-slate-500">
//           Showing {eventLog.paths.length} event paths
//         </div>
//       )}
//     </div>
//   );
// };
