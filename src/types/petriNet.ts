
// Define types for Petri Net
export type NodeType = "place" | "transition";

export interface Node {
  id: string;
  type: NodeType;
  tokens?: number;
}

export interface Edge {
  source: string;
  target: string;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

export interface LogEntry {
  id: number;
  timestamp: string;
  action: string;
}

export interface PathNode {
  id: string;
  type: NodeType;
}

export interface Path {
  sequence: PathNode[];
  timestamp?: number;
  probability?: number;
}

export interface EventLog {
  paths: Path[];
}

export interface SavedPetriNet {
  id: string;
  name: string;
  timestamp: number;
  graph: Graph;
  log: LogEntry[];
  eventLog: EventLog;
}

// For weighted randomization
export interface RuleWeight {
  rule: string;
  weight: number; // Weight as a percentage (0-100)
}

export interface PetriNetState {
  graph: Graph;
  log: LogEntry[];
  history: { graph: Graph; log: LogEntry[] }[];
  simulationActive: boolean;
  animatingTokens: {
    sourceId: string;
    targetId: string;
    progress: number;
  }[];
  eventLog: EventLog;
  savedNets: SavedPetriNet[];
  currentNetId: string | null;
}

export interface PetriNetContextType {
  state: PetriNetState;
  undo: () => void;
  reset: () => void;
  addPlace: (id: string) => void;
  addTransition: (id: string) => void;
  connectNodes: (source: string, target: string) => void;
  applyRule: (rule: string, target: string, endNodeId?: string) => void;
  applyRandomRule: () => void;
  generateBatch: (
    count: number,
    useRandom: boolean,
    selectedRules: string[],
    ruleWeights?: RuleWeight[]
  ) => void;
  setTokenFlow: (start: string, end: string) => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  centerGraph: () => void;
  downloadLog: () => void;
  generateEventLog: () => Promise<void>;
  downloadEventLog: () => void;
  savePetriNet: (name: string) => void;
  loadPetriNet: (id: string) => void;
  deletePetriNet: (id: string) => void;
  renamePetriNet: (id: string, newName: string) => void;
  savedNets: SavedPetriNet[];
}

// Action types for reducer
export type ActionType =
  | { type: "UNDO" }
  | { type: "RESET" }
  | { type: "ADD_PLACE"; id: string }
  | { type: "ADD_TRANSITION"; id: string }
  | { type: "CONNECT_NODES"; source: string; target: string }
  | { type: "APPLY_RULE"; rule: string; target: string; endNodeId?: string }
  | { type: "APPLY_RANDOM_RULE" }
  | {
      type: "GENERATE_BATCH";
      count: number;
      useRandom: boolean;
      selectedRules: string[];
      ruleWeights?: RuleWeight[];
    }
  | { type: "SET_TOKEN_FLOW"; start: string; end: string }
  | { type: "START_SIMULATION" }
  | { type: "STOP_SIMULATION" }
  | { type: "UPDATE_TOKEN_ANIMATION"; progress: number }
  | { type: "COMPLETE_SIMULATION" }
  | { type: "CENTER_GRAPH" }
  | { type: "SET_EVENT_LOG"; paths: Path[] }
  | { type: "SAVE_PETRI_NET"; name: string }
  | { type: "LOAD_PETRI_NET"; id: string }
  | { type: "DELETE_PETRI_NET"; id: string }
  | { type: "RENAME_PETRI_NET"; id: string; newName: string };
