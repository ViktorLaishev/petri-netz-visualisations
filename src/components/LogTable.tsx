
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePetriNet } from "@/contexts/PetriNetContext";

const LogTable: React.FC = () => {
  const { state, loadStateFromLog } = usePetriNet();
  
  const handleLogEntryClick = (logEntryId: string) => {
    loadStateFromLog(logEntryId);
  };
  
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.log.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                  No actions recorded yet
                </TableCell>
              </TableRow>
            ) : (
              state.log.map((entry) => (
                <TableRow 
                  key={entry.id} 
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => handleLogEntryClick(entry.id)}
                >
                  <TableCell className="font-medium">{entry.id}</TableCell>
                  <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{entry.action}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LogTable;
