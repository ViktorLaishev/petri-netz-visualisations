import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { usePetriNet } from "@/contexts/PetriNetContext";
import { toast } from "sonner";
import { saveNodeDescription, getNodeDescription } from "@/utils/nodeUtils";

interface NodeDetailsDialogProps {
  nodeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NodeDetailsDialog = ({
  nodeId,
  open,
  onOpenChange,
}: NodeDetailsDialogProps) => {
  const { state } = usePetriNet();
  const [description, setDescription] = useState("");

  // Find the selected node
  const node = nodeId ? state.graph.nodes.find((n) => n.id === nodeId) : null;

  // Calculate metrics for this node
  const incomingEdges = nodeId
    ? state.graph.edges.filter((e) => e.target === nodeId)
    : [];
  const outgoingEdges = nodeId
    ? state.graph.edges.filter((e) => e.source === nodeId)
    : [];

  // Count occurrences in event log paths
  const pathOccurrences = React.useMemo(() => {
    if (!nodeId) return 0;

    let count = 0;
    state.eventLog.paths.forEach((path) => {
      path.sequence.forEach((node) => {
        if (node.id === nodeId) count++;
      });
    });
    return count;
  }, [nodeId, state.eventLog.paths]);

  useEffect(() => {
    if (nodeId) {
      // Load description from our utility
      const savedDescription = getNodeDescription(nodeId);
      setDescription(savedDescription || "");
    }
  }, [nodeId]);

  const handleSave = () => {
    if (nodeId) {
      if (saveNodeDescription(nodeId, description)) {
        toast.success("Node description saved");
        onOpenChange(false);
      }
    }
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {node.id}
            <Badge
              variant={node.type === "place" ? "default" : "outline"}
              className={
                node.type === "place"
                  ? "bg-blue-500"
                  : "bg-green-500 text-white"
              }
            >
              {node.type}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Connection Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md">
              <p className="text-sm font-medium mb-1">Connections</p>
              <p className="text-xl font-bold">
                {incomingEdges.length + outgoingEdges.length}
              </p>
              <div className="text-xs text-slate-500 mt-1">
                <span>{incomingEdges.length} incoming</span> •{" "}
                <span>{outgoingEdges.length} outgoing</span>
              </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md">
              <p className="text-sm font-medium mb-1">Event Log</p>
              <p className="text-xl font-bold">{pathOccurrences}</p>
              <div className="text-xs text-slate-500 mt-1">
                occurrences in all paths
              </div>
            </div>
          </div>

          {/* NEW: Incoming and Outgoing IDs */}
          <div className="grid gap-2">
            <p className="text-sm font-medium text-slate-500">Incoming From:</p>
            <ul className="text-sm text-slate-700 dark:text-slate-300 list-disc list-inside ml-2">
              {incomingEdges.map((e, idx) => (
                <li key={`in-${idx}`}>{e.source}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium text-slate-500">Outgoing To:</p>
            <ul className="text-sm text-slate-700 dark:text-slate-300 list-disc list-inside ml-2">
              {outgoingEdges.map((e, idx) => (
                <li key={`out-${idx}`}>{e.target}</li>
              ))}
            </ul>
          </div>

          {/* Description Field */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add a description for this node..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NodeDetailsDialog;
