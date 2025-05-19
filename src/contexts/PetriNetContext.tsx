
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import { toast } from "sonner";
import petriNetReducer from "@/lib/petriNetReducer";
import { 
  initialGraph, 
  loadStateFromStorage, 
  loadSavedNetsFromStorage,
  saveStateToStorage,
  saveSavedNetsToStorage,
  generateAllPaths
} from "@/lib/petriNetUtils";
import { 
  PetriNetState,
  PetriNetContextType,
  RuleWeight,
  Path
} from "@/types/petriNet";

// Create context
const PetriNetContext = createContext<PetriNetContextType | undefined>(
  undefined
);

// Provider component
export const PetriNetProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const initialSavedNets = loadSavedNetsFromStorage();
  const savedState = loadStateFromStorage();
  const initialState: PetriNetState = savedState || {
    graph: initialGraph(),
    log: [],
    history: [],
    simulationActive: false,
    animatingTokens: [],
    eventLog: { paths: [] },
    savedNets: initialSavedNets,
    currentNetId: null,
  };

  if (savedState && !savedState.savedNets) {
    initialState.savedNets = initialSavedNets;
  }

  const [state, dispatch] = useReducer(petriNetReducer, initialState);

  useEffect(() => {
    if (state.simulationActive && state.animatingTokens.length > 0) {
      let animationFrame: number;
      let startTime: number | null = null;
      const animationDuration = 2000; // 2 seconds for animation

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);

        dispatch({ type: "UPDATE_TOKEN_ANIMATION", progress });

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          dispatch({ type: "COMPLETE_SIMULATION" });
        }
      };

      animationFrame = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(animationFrame);
      };
    }
  }, [state.simulationActive, state.animatingTokens]);

  const findPathsFromNode = (
    graph,
    nodeId: string,
    visited: string[]
  ): Path[] => {
    if (visited.includes(nodeId)) {
      return [];
    }

    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return [];

    const newVisited = [...visited, nodeId];
    const outgoingEdges = graph.edges.filter((edge) => edge.source === nodeId);

    if (outgoingEdges.length === 0) {
      return [
        {
          sequence: newVisited.map((id) => {
            const n = graph.nodes.find((n) => n.id === id);
            return { id, type: n?.type || "place" };
          }),
        },
      ];
    }

    const paths: Path[] = [];

    for (const edge of outgoingEdges) {
      const targetPaths = findPathsFromNode(graph, edge.target, newVisited);
      paths.push(...targetPaths);
    }

    return paths;
  };

  const value: PetriNetContextType = {
    state,
    undo: () => dispatch({ type: "UNDO" }),
    reset: () => dispatch({ type: "RESET" }),
    addPlace: (id: string) => dispatch({ type: "ADD_PLACE", id }),
    addTransition: (id: string) => dispatch({ type: "ADD_TRANSITION", id }),
    connectNodes: (source: string, target: string) =>
      dispatch({ type: "CONNECT_NODES", source, target }),
    applyRule: (rule: string, target: string, endNodeId?: string) =>
      dispatch({ type: "APPLY_RULE", rule, target, endNodeId }),
    applyRandomRule: () => dispatch({ type: "APPLY_RANDOM_RULE" }),
    generateBatch: (
      count: number,
      useRandom: boolean,
      selectedRules: string[],
      ruleWeights?: RuleWeight[]
    ) =>
      dispatch({
        type: "GENERATE_BATCH",
        count,
        useRandom,
        selectedRules,
        ruleWeights,
      }),
    setTokenFlow: (start: string, end: string) =>
      dispatch({ type: "SET_TOKEN_FLOW", start, end }),
    startSimulation: () => dispatch({ type: "START_SIMULATION" }),
    stopSimulation: () => dispatch({ type: "STOP_SIMULATION" }),
    centerGraph: () => dispatch({ type: "CENTER_GRAPH" }),
    downloadLog: () => {
      const headers = "ID,Timestamp,Action\n";
      const rows = state.log
        .map((entry) => `${entry.id},"${entry.timestamp}","${entry.action}"`)
        .join("\n");
      const csv = headers + rows;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "petri_net_log.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    generateEventLog: async () => {
      try {
        const paths = await generateAllPaths(state.graph);
        const timestamp = Date.now();

        // Assign additional metadata: probability and synthetic timestamps
        const enrichedPaths: Path[] = paths.map((p, i) => {
          return {
            ...p,
            timestamp: timestamp + i * 1000 * 30, // 30-second offset
            probability: Number((1 / paths.length).toFixed(4)),
          };
        });

        dispatch({ type: "SET_EVENT_LOG", paths: enrichedPaths });
        return Promise.resolve();
      } catch (error) {
        console.error("Failed to generate event log:", error);
        return Promise.reject(error);
      }
    },
    downloadEventLog: () => {
      const headers = "Path ID,Sequence,Length,Start,End\n";
      const rows = state.eventLog.paths
        .map((path, index) => {
          const sequence = path.sequence.map((node) => node.id).join(" → ");
          const length = path.sequence.length;
          const start = path.sequence[0]?.id || "N/A";
          const end = path.sequence[path.sequence.length - 1]?.id || "N/A";

          return `${index + 1},"${sequence}",${length},"${start}","${end}"`;
        })
        .join("\n");

      const csv = headers + rows;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "petri_net_event_log.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    savePetriNet: (name: string) => dispatch({ type: "SAVE_PETRI_NET", name }),
    loadPetriNet: (id: string) => dispatch({ type: "LOAD_PETRI_NET", id }),
    deletePetriNet: (id: string) => dispatch({ type: "DELETE_PETRI_NET", id }),
    renamePetriNet: (id: string, newName: string) =>
      dispatch({ type: "RENAME_PETRI_NET", id, newName }),
    savedNets: state.savedNets,
  };

  return (
    <PetriNetContext.Provider value={value}>
      {children}
    </PetriNetContext.Provider>
  );
};

// Custom hook
export const usePetriNet = () => {
  const context = useContext(PetriNetContext);
  if (context === undefined) {
    throw new Error("usePetriNet must be used within a PetriNetProvider");
  }
  return context;
};
