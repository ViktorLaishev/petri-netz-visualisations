
export interface Node {
  id: string;
  type: "place" | "transition";
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
  id: string;
  timestamp: string;
  action: string;
}

export interface AnimatingToken {
  id: string;
  source: string;
  target: string;
  progress: number;
  speed: number;
  sourceId?: string;
  targetId?: string;
}

export interface SavedPetriNet {
  id: string;
  name: string;
  graph: Graph;
  timestamp: string;
  log?: LogEntry[];
}

export interface EventLogPath {
  sequence: Node[];
}

export interface EventLog {
  paths: EventLogPath[];
}

export interface PetriNetState {
  graph: Graph;
  history: { graph: Graph; timestamp?: string }[];
  currentHistoryIndex: number;
  log: LogEntry[];
  simulationActive: boolean;
  animatingTokens: AnimatingToken[];
  tokenFlowPath: {
    startPlaceId: string | null;
    endPlaceId: string | null;
  };
  savedNets: SavedPetriNet[];
  currentNetId?: string;
  eventLog: EventLog;
}

export type PetriNetAction =
  | { type: "ADD_NODE"; payload: Node }
  | { type: "ADD_EDGE"; payload: Edge }
  | { type: "UPDATE_TOKENS"; payload: { placeId: string; tokens: number } }
  | { type: "APPLY_RULE"; payload: { newNodes: Node[]; newEdges: Edge[] } }
  | { type: "SET_TOKEN_FLOW"; payload: { startPlaceId: string; endPlaceId: string } }
  | { type: "START_SIMULATION" }
  | { type: "STOP_SIMULATION" }
  | { type: "UPDATE_TOKEN_ANIMATION"; payload: { deltaTime: number } }
  | { type: "ADD_LOG_ENTRY"; payload: LogEntry }
  | { type: "UNDO" }
  | { type: "RESET" }
  | { type: "LOAD_HISTORICAL_STATE"; payload: { graph: Graph; historyIndex: number } }
  | { type: "LOAD_SAVED_NETS"; payload: SavedPetriNet[] }
  | { type: "SAVE_PETRI_NET"; payload: { name: string } }
  | { type: "LOAD_PETRI_NET"; payload: string }
  | { type: "DELETE_PETRI_NET"; payload: string }
  | { type: "RENAME_PETRI_NET"; payload: { id: string; name: string } }
  | { type: "SET_EVENT_LOG"; payload: EventLog };

export interface PetriNetContextType {
  state: PetriNetState;
  dispatch: React.Dispatch<PetriNetAction>;
  addPlace: (id: string) => void;
  addTransition: (id: string) => void;
  connectNodes: (source: string, target: string) => void;
  addToken: (placeId: string) => void;
  removeToken: (placeId: string) => void;
  applyRule: (rule: string, targetId: string, endNodeId?: string) => void;
  applyRandomRule: () => void;
  setTokenFlow: (startPlaceId: string, endPlaceId: string) => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  undo: () => void;
  reset: () => void;
  centerGraph: () => void;
  downloadLog: () => void;
  generateBatch: (count: number, useRandom: boolean, selectedRules?: string[], ruleWeights?: { rule: string; weight: number }[]) => void;
  loadStateFromLog: (logEntryId: string) => void;
  savePetriNet: (name: string) => void;
  loadPetriNet: (id: string) => void;
  deletePetriNet: (id: string) => void;
  renamePetriNet: (id: string, name: string) => void;
  generateEventLog?: () => void;
  downloadEventLog?: () => void;
  savedNets: SavedPetriNet[];
}
