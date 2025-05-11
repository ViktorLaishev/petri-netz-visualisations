
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePetriNet } from "@/contexts/PetriNetContext";
import { Badge } from "@/components/ui/badge";

const EventLogTable: React.FC = () => {
  const { state } = usePetriNet();
  const { eventLog } = state;

  if (!eventLog || eventLog.paths.length === 0) {
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
                          variant={node.type === 'place' ? "default" : "outline"}
                          className={node.type === 'place' ? "bg-blue-500" : "bg-green-500 text-white"}
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
                <TableCell>{path.sequence[path.sequence.length - 1]?.id || "N/A"}</TableCell>
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
