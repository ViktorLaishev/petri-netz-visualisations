import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePetriNet, checkTraceConformance } from "@/contexts/PetriNetContext";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const EventLogTable: React.FC = () => {
  const { state } = usePetriNet();
  const { eventLog, graph } = state;

  // Check if P0 and P_out exist in the graph
  const hasP0 = graph.nodes.some((node) => node.id === "P0");
  const hasPOut = graph.nodes.some((node) => node.id === "P_out");
  const missingRequiredNodes = !hasP0 || !hasPOut;

  // Check for potential cycles (simple heuristic)
  const hasPotentialCycles = (): boolean => {
    const nodesWithPotentialCycles = new Set<string>();
    for (const edge1 of graph.edges) {
      for (const edge2 of graph.edges) {
        if (edge1.source === edge2.target && edge1.target === edge2.source) {
          nodesWithPotentialCycles.add(edge1.source);
          nodesWithPotentialCycles.add(edge1.target);
        }
      }
    }
    return nodesWithPotentialCycles.size > 0;
  };

  const potentialCycleDetected = hasPotentialCycles();

  const validCount = eventLog.paths.filter((path) =>
    checkTraceConformance(
      graph,
      path.sequence.map((n) => n.id)
    )
  ).length;

  const totalCount = eventLog.paths.length;

  if (eventLog.paths.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        {missingRequiredNodes ? (
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <p>
              Event log generation requires both P0 and P_out nodes in your
              Petri net.
            </p>
            {!hasP0 && <p className="text-sm">Missing: P0 (start node)</p>}
            {!hasPOut && <p className="text-sm">Missing: P_out (end node)</p>}
          </div>
        ) : potentialCycleDetected ? (
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <p>
              Your Petri net may contain cycles, which can cause problems during
              event log generation.
            </p>
            <p className="text-sm">
              Try simplifying your model or ensuring there are no loops between
              nodes.
            </p>
          </div>
        ) : (
          "No event paths generated yet. Please generate the event log first."
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="p-3 border-b text-sm text-gray-600 bg-slate-50 dark:bg-slate-900">
        ✅ {validCount} / {totalCount} traces conform to the model
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Path ID</TableHead>
              <TableHead>Sequence</TableHead>
              <TableHead className="w-[120px]">
                <div className="flex items-center gap-1">
                  Length
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 opacity-70" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">
                          The number of nodes in this path. Paths with too many
                          nodes may cause performance issues.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead className="w-[120px]">Start</TableHead>
              <TableHead className="w-[120px]">End</TableHead>
              <TableHead className="w-[130px]">Conformance</TableHead>
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
                <TableCell>
                  {checkTraceConformance(
                    graph,
                    path.sequence.map((n) => n.id)
                  ) ? (
                    <span className="text-green-500 font-medium">✅ Valid</span>
                  ) : (
                    <span className="text-red-500 font-medium">❌ Invalid</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default EventLogTable;
