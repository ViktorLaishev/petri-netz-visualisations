import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import { toast } from "sonner";
import { validateNewPlace, validateNewTransition } from "@/lib/utils";

// Define types
type NodeType = "place" | "transition";

interface Node {
  id: string;
  type: NodeType;
  tokens?: number;
  description?: string; // New field for description
}

interface Edge {
  source: string;
  target: string;
}

interface Graph {
  nodes: Node[];
  edges: Edge[];
}

interface LogEntry {
  id: number;
  timestamp: string;
  action: string;
}

interface PathNode {
  id: string;
  type: NodeType;
}

interface Path {
  sequence: PathNode[];
  timestamp?: number;
  probability?: number;
}

interface EventLog {
  paths: Path[];
}

interface SavedPetriNet {
  id: string;
  name: string;
  timestamp: number;
  graph: Graph;
  log: LogEntry[];
  eventLog: EventLog;
}

// Added RuleWeight interface for weighted randomization
interface RuleWeight {
  rule: string;
  weight: number; // Weight as a percentage (0-100)
}

interface PetriNetState {
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

interface PetriNetContextType {
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

// Create context
const PetriNetContext = createContext<PetriNetContextType | undefined>(
  undefined
);

// Rule implementations
const applyAbstractionRule = (graph: Graph, targetId: string): Graph => {
  const newGraph = { ...graph };
  const targetNode = newGraph.nodes.find((node) => node.id === targetId);
  if (!targetNode || targetNode.type !== "transition") return newGraph;

  const outputPlaces = newGraph.edges
    .filter((e) => e.source === targetId)
    .map((e) => e.target)
    .filter((id) => newGraph.nodes.find((n) => n.id === id)?.type === "place");

  if (outputPlaces.length === 0) {
    toast.error("Target transition has no output places for abstraction");
    return newGraph;
  }

  const placeId = `P${newGraph.nodes.filter((n) => n.type === "place").length}`;
  const transId = `T${
    newGraph.nodes.filter((n) => n.type === "transition").length
  }`;

  const updatedNodes: Node[] = [
    ...newGraph.nodes,
    { id: placeId, type: "place", tokens: 0 },
    { id: transId, type: "transition" },
  ];

  newGraph.nodes = updatedNodes;
  newGraph.edges = newGraph.edges.filter(
    (e) => !(e.source === targetId && outputPlaces.includes(e.target))
  );
  newGraph.edges = [
    ...newGraph.edges,
    { source: targetId, target: placeId },
    { source: placeId, target: transId },
    ...outputPlaces.map((output) => ({ source: transId, target: output })),
  ];

  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error("Cannot apply this rule: it would create invalid connections");
    return graph;
  }

  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }

  return newGraph;
};

const applyLinearTransitionRule = (
  graph: Graph,
  targetId: string,
  endNodeId?: string
): Graph => {
  const newGraph = { ...graph };
  const targetNode = newGraph.nodes.find((node) => node.id === targetId);
  if (!targetNode || targetNode.type !== "place") return newGraph;

  const transId = `T${
    newGraph.nodes.filter((n) => n.type === "transition").length
  }`;
  const updatedNodes: Node[] = [
    ...newGraph.nodes,
    { id: transId, type: "transition" },
  ];

  newGraph.nodes = updatedNodes;
  newGraph.edges = [...newGraph.edges, { source: targetId, target: transId }];

  if (endNodeId) {
    const endNode = newGraph.nodes.find((node) => node.id === endNodeId);
    if (endNode && endNode.type === "place") {
      newGraph.edges.push({ source: transId, target: endNodeId });
    }
  } else {
    const placeId = `P${
      newGraph.nodes.filter((n) => n.type === "place").length
    }`;
    newGraph.nodes.push({ id: placeId, type: "place", tokens: 0 });
    newGraph.edges.push({ source: transId, target: placeId });
  }

  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error("Cannot apply this rule: it would create invalid connections");
    return graph;
  }

  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }

  return newGraph;
};

const applyLinearPlaceRule = (graph: Graph, targetId: string): Graph => {
  const newGraph = { ...graph };
  const targetNode = newGraph.nodes.find((node) => node.id === targetId);
  if (!targetNode || targetNode.type !== "transition") return newGraph;

  const transitions = newGraph.nodes.filter((n) => n.type === "transition");
  if (transitions.length <= 1) {
    toast.error(
      "Need at least two transitions for linear dependent place rule"
    );
    return newGraph;
  }

  const placeId = `P${newGraph.nodes.filter((n) => n.type === "place").length}`;
  newGraph.nodes = [
    ...newGraph.nodes,
    { id: placeId, type: "place", tokens: 0 },
  ];

  const transitionsToConnectFrom: string[] = [];
  const transitionsToConnectTo: string[] = [];
  transitionsToConnectFrom.push(targetId);

  const potentialOutputs = transitions
    .filter((t) => t.id !== targetId)
    .map((t) => t.id);

  if (potentialOutputs.length > 0) {
    const randomOutput =
      potentialOutputs[Math.floor(Math.random() * potentialOutputs.length)];
    transitionsToConnectTo.push(randomOutput);
  }

  const inputEdges = transitionsToConnectFrom.map((transId) => ({
    source: transId,
    target: placeId,
  }));

  const outputEdges = transitionsToConnectTo.map((transId) => ({
    source: placeId,
    target: transId,
  }));

  newGraph.edges = [...newGraph.edges, ...inputEdges, ...outputEdges];

  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error("Cannot create a valid linear dependent place configuration");
    return graph;
  }

  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }

  return newGraph;
};

const applyLinearTransitionDependencyRule = (
  graph: Graph,
  targetId: string
): Graph => {
  const newGraph = { ...graph };
  const targetNode = newGraph.nodes.find((node) => node.id === targetId);
  if (!targetNode || targetNode.type !== "place") return newGraph;

  const places = newGraph.nodes.filter((n) => n.type === "place");
  if (places.length <= 1) {
    toast.error(
      "Need at least two places for linear dependent transition rule"
    );
    return newGraph;
  }

  const transId = `T${
    newGraph.nodes.filter((n) => n.type === "transition").length
  }`;
  newGraph.nodes = [...newGraph.nodes, { id: transId, type: "transition" }];

  const placesToConnectFrom: string[] = [];
  const placesToConnectTo: string[] = [];
  placesToConnectFrom.push(targetId);

  const potentialOutputs = places
    .filter((p) => p.id !== targetId)
    .map((p) => p.id);

  if (potentialOutputs.length > 0) {
    const randomPlace =
      potentialOutputs[Math.floor(Math.random() * potentialOutputs.length)];
    placesToConnectTo.push(randomPlace);

    const remainingPlaces = potentialOutputs.filter((p) => p !== randomPlace);
    if (remainingPlaces.length > 0 && Math.random() > 0.5) {
      const additionalPlace =
        remainingPlaces[Math.floor(Math.random() * remainingPlaces.length)];
      placesToConnectFrom.push(additionalPlace);
    }
  }

  const inputEdges = placesToConnectFrom.map((placeId) => ({
    source: placeId,
    target: transId,
  }));

  const outputEdges = placesToConnectTo.map((placeId) => ({
    source: transId,
    target: placeId,
  }));

  newGraph.edges = [...newGraph.edges, ...inputEdges, ...outputEdges];

  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error(
      "Cannot create a valid linear dependent transition configuration"
    );
    return graph;
  }

  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }

  return newGraph;
};

const applyDualAbstractionRule = (
  graph: Graph,
  targetId: string,
  endNodeId?: string
): Graph => {
  const newGraph = { ...graph };
  const targetNode = newGraph.nodes.find((node) => node.id === targetId);
  if (!targetNode || targetNode.type !== "transition") return newGraph;

  const inputPlaces = newGraph.edges
    .filter((e) => e.target === targetId)
    .map((e) => e.source)
    .filter((id) => newGraph.nodes.find((n) => n.id === id)?.type === "place");

  if (inputPlaces.length === 0) {
    toast.error("Target transition has no input places for dual abstraction");
    return newGraph;
  }

  const placeId = `P${newGraph.nodes.filter((n) => n.type === "place").length}`;
  const transId = `T${
    newGraph.nodes.filter((n) => n.type === "transition").length
  }`;

  const updatedNodes: Node[] = [
    ...newGraph.nodes,
    { id: transId, type: "transition" },
    { id: placeId, type: "place", tokens: 0 },
  ];

  newGraph.nodes = updatedNodes;
  newGraph.edges = newGraph.edges.filter(
    (e) => !(inputPlaces.includes(e.source) && e.target === targetId)
  );

  const inputEdges = inputPlaces.map((input) => ({
    source: input,
    target: transId,
  }));
  const midEdge = { source: transId, target: placeId };
  const finalTarget = endNodeId || targetId;
  const outputEdge = { source: placeId, target: finalTarget };

  newGraph.edges = [...newGraph.edges, ...inputEdges, midEdge, outputEdge];

  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error("Cannot apply this rule: it would create invalid connections");
    return graph;
  }

  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }

  return newGraph;
};

// Enhanced random rule application for Abstraction Rule
const applyRandomAbstractionRule = (graph: Graph): Graph => {
  const MAX_ATTEMPTS = 15;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const transitions = graph.nodes.filter(
      (node) => node.type === "transition"
    );
    if (transitions.length === 0) return graph;

    const randomTransition =
      transitions[Math.floor(Math.random() * transitions.length)];
    const newGraph = applyAbstractionRule(graph, randomTransition.id);

    if (
      newGraph !== graph &&
      isConnectedGraph(newGraph) &&
      !wouldCreateInvalidConnections(newGraph) &&
      allNodesInPathFromStartToEnd(newGraph)
    ) {
      return newGraph;
    }
  }

  toast.error("Could not find a valid application for abstraction rule");
  return graph;
};

// Enhanced random rule application for Linear Transition Rule
const applyRandomLinearTransitionRule = (graph: Graph): Graph => {
  const MAX_ATTEMPTS = 15;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const places = graph.nodes.filter((node) => node.type === "place");
    if (places.length === 0) return graph;

    const validStartPlaces = places.filter((p) => p.id !== "P_out");
    if (validStartPlaces.length === 0) return graph;

    const randomPlace =
      validStartPlaces[Math.floor(Math.random() * validStartPlaces.length)];
    const endPlaces = places.filter(
      (p) => p.id !== randomPlace.id && p.id !== "P0"
    );
    let endNodeId = undefined;
    if (endPlaces.length > 0 && Math.random() > 0.5) {
      const randomEndPlace =
        endPlaces[Math.floor(Math.random() * endPlaces.length)];
      endNodeId = randomEndPlace.id;
    }

    const newGraph = applyLinearTransitionRule(
      graph,
      randomPlace.id,
      endNodeId
    );

    if (
      newGraph !== graph &&
      isConnectedGraph(newGraph) &&
      !wouldCreateInvalidConnections(newGraph) &&
      allNodesInPathFromStartToEnd(newGraph)
    ) {
      return newGraph;
    }
  }

  toast.error("Could not find a valid application for linear transition rule");
  return graph;
};

// Enhanced random rule application for Linear Place Rule
const applyRandomLinearPlaceRule = (graph: Graph): Graph => {
  const MAX_ATTEMPTS = 15;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const transitions = graph.nodes.filter(
      (node) => node.type === "transition"
    );
    if (transitions.length === 0) return graph;

    const randomTransition =
      transitions[Math.floor(Math.random() * transitions.length)];
    const newGraph = applyLinearPlaceRule(graph, randomTransition.id);

    if (
      newGraph !== graph &&
      isConnectedGraph(newGraph) &&
      !wouldCreateInvalidConnections(newGraph) &&
      allNodesInPathFromStartToEnd(newGraph)
    ) {
      return newGraph;
    }
  }

  toast.error("Could not find a valid application for linear place rule");
  return graph;
};

// Enhanced random rule application for Linear Transition Dependency Rule
const applyRandomLinearTransitionDependencyRule = (graph: Graph): Graph => {
  const MAX_ATTEMPTS = 15;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const places = graph.nodes.filter((node) => node.type === "place");
    if (places.length === 0) return graph;

    const validPlaces = places.filter((p) => p.id !== "P0" && p.id !== "P_out");
    if (validPlaces.length === 0) return graph;

    const randomPlace =
      validPlaces[Math.floor(Math.random() * validPlaces.length)];
    const newGraph = applyLinearTransitionDependencyRule(graph, randomPlace.id);

    if (
      newGraph !== graph &&
      isConnectedGraph(newGraph) &&
      !wouldCreateInvalidConnections(newGraph) &&
      allNodesInPathFromStartToEnd(newGraph)
    ) {
      return newGraph;
    }
  }

  toast.error(
    "Could not find a valid application for linear transition dependency rule"
  );
  return graph;
};

// Enhanced random rule application for Dual Abstraction Rule
const applyRandomDualAbstractionRule = (graph: Graph): Graph => {
  const MAX_ATTEMPTS = 15;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const transitions = graph.nodes.filter(
      (node) => node.type === "transition"
    );
    if (transitions.length === 0) return graph;

    const randomTransition =
      transitions[Math.floor(Math.random() * transitions.length)];
    const endTransitions = transitions.filter(
      (t) => t.id !== randomTransition.id
    );
    let endNodeId = undefined;
    if (endTransitions.length > 0 && Math.random() > 0.5) {
      const randomEndTransition =
        endTransitions[Math.floor(Math.random() * endTransitions.length)];
      endNodeId = randomEndTransition.id;
    }

    const newGraph = applyDualAbstractionRule(
      graph,
      randomTransition.id,
      endNodeId
    );

    if (
      newGraph !== graph &&
      isConnectedGraph(newGraph) &&
      !wouldCreateInvalidConnections(newGraph) &&
      allNodesInPathFromStartToEnd(newGraph)
    ) {
      return newGraph;
    }
  }

  toast.error("Could not find a valid application for dual abstraction rule");
  return graph;
};

// Helper function to check if the graph is connected
const isConnectedGraph = (graph: Graph): boolean => {
  if (graph.nodes.length === 0) return true;

  const startNode = graph.nodes.find((n) => n.id === "P0");
  if (!startNode) {
    return false; // P0 must exist
  }

  const visited = new Set<string>();
  const queue: string[] = [startNode.id];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;

    visited.add(nodeId);

    const outgoing = graph.edges
      .filter((e) => e.source === nodeId)
      .map((e) => e.target);
    const incoming = graph.edges
      .filter((e) => e.target === nodeId)
      .map((e) => e.source);

    [...outgoing, ...incoming].forEach((id) => {
      if (!visited.has(id)) {
        queue.push(id);
      }
    });
  }

  return visited.size === graph.nodes.length;
};

// NEW FUNCTION: Check if all nodes are part of at least one path from P0 to P_out
const allNodesInPathFromStartToEnd = (graph: Graph): boolean => {
  if (graph.nodes.length === 0) return true;

  if (
    !graph.nodes.some((n) => n.id === "P0") ||
    !graph.nodes.some((n) => n.id === "P_out")
  ) {
    return false;
  }

  const reachableFromStart = new Set<string>();
  const queueFromStart: string[] = ["P0"];

  while (queueFromStart.length > 0) {
    const current = queueFromStart.shift()!;
    if (reachableFromStart.has(current)) continue;
    reachableFromStart.add(current);

    const outgoing = graph.edges
      .filter((e) => e.source === current)
      .map((e) => e.target);
    outgoing.forEach((next) => {
      if (!reachableFromStart.has(next)) {
        queueFromStart.push(next);
      }
    });
  }

  const canReachEnd = new Set<string>();
  const queueToEnd: string[] = ["P_out"];

  while (queueToEnd.length > 0) {
    const current = queueToEnd.shift()!;
    if (canReachEnd.has(current)) continue;
    canReachEnd.add(current);

    const incoming = graph.edges
      .filter((e) => e.target === current)
      .map((e) => e.source);
    incoming.forEach((prev) => {
      if (!canReachEnd.has(prev)) {
        queueToEnd.push(prev);
      }
    });
  }

  for (const node of graph.nodes) {
    if (!reachableFromStart.has(node.id) || !canReachEnd.has(node.id)) {
      return false;
    }
  }

  return true;
};

// Function to check if a graph would have invalid connections
const wouldCreateInvalidConnections = (graph: Graph): boolean => {
  const hasP0 = graph.nodes.some((n) => n.id === "P0");
  const hasPOut = graph.nodes.some((n) => n.id === "P_out");

  if (!hasP0 || !hasPOut) {
    return true; // Both P0 and P_out must exist
  }

  const placeToPlaceConnections = graph.edges.some((edge) => {
    const sourceType = graph.nodes.find((n) => n.id === edge.source)?.type;
    const targetType = graph.nodes.find((n) => n.id === edge.target)?.type;
    return sourceType === "place" && targetType === "place";
  });

  const transToTransConnections = graph.edges.some((edge) => {
    const sourceType = graph.nodes.find((n) => n.id === edge.source)?.type;
    const targetType = graph.nodes.find((n) => n.id === edge.target)?.type;
    return sourceType === "transition" && targetType === "transition";
  });

  const placesWithNoConnections = graph.nodes.filter((node) => {
    if (node.type !== "place") return false;

    const hasOutgoing = graph.edges.some((e) => e.source === node.id);
    const hasIncoming = graph.edges.some((e) => e.target === node.id);

    if (node.id === "P0" && hasOutgoing) return false;
    if (node.id === "P_out" && hasIncoming) return false;

    return !hasOutgoing && !hasIncoming;
  });

  const transitionsWithInvalidConnections = graph.nodes.filter((node) => {
    if (node.type !== "transition") return false;

    const hasOutgoing = graph.edges.some((e) => e.source === node.id);
    const hasIncoming = graph.edges.some((e) => e.target === node.id);

    return !hasOutgoing || !hasIncoming;
  });

  let hasPathFromP0ToPOut = false;

  if (
    hasP0 &&
    hasPOut &&
    !placeToPlaceConnections &&
    !transToTransConnections
  ) {
    hasPathFromP0ToPOut = allNodesInPathFromStartToEnd(graph);
  }

  return (
    placeToPlaceConnections ||
    transToTransConnections ||
    placesWithNoConnections.length > 0 ||
    transitionsWithInvalidConnections.length > 0 ||
    !hasPathFromP0ToPOut
  );
};

// Map rules to their implementations
const rulesMap: Record<
  string,
  {
    fn: (graph: Graph, targetId: string, endNodeId?: string) => Graph;
    targetType: NodeType;
    endNodeType?: NodeType;
    randomFn?: (graph: Graph) => Graph;
  }
> = {
  "Abstraction ψA": {
    fn: applyAbstractionRule,
    targetType: "transition",
    randomFn: applyRandomAbstractionRule,
  },
  "Linear Transition ψT": {
    fn: applyLinearTransitionRule,
    targetType: "place",
    endNodeType: "place",
    randomFn: applyRandomLinearTransitionRule,
  },
  "Linear Place ψP": {
    fn: applyLinearPlaceRule,
    targetType: "transition",
    randomFn: applyRandomLinearPlaceRule,
  },
  "Linear Transition Dependency": {
    fn: applyLinearTransitionDependencyRule,
    targetType: "place",
    randomFn: applyRandomLinearTransitionDependencyRule,
  },
  "Dual Abstraction ψD": {
    fn: applyDualAbstractionRule,
    targetType: "transition",
    endNodeType: "transition",
    randomFn: applyRandomDualAbstractionRule,
  },
};

// Create initial graph - returning empty arrays instead of predefined nodes
const initialGraph = (): Graph => {
  return {
    nodes: [],
    edges: [],
  };
};

// Action types for reducer
type ActionType =
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

// Helper function to add to history
const pushHistory = (state: PetriNetState): PetriNetState => {
  return {
    ...state,
    history: [...state.history, { graph: state.graph, log: state.log }],
  };
};

// Helper function to add log entry
const addLogEntry = (state: PetriNetState, action: string): PetriNetState => {
  const newEntry = {
    id: state.log.length + 1,
    timestamp: new Date().toISOString(),
    action,
  };

  return {
    ...state,
    log: [...state.log, newEntry],
  };
};

// Storage keys
const STORAGE_KEY = "petriNetState";
const SAVED_NETS_KEY = "petriNetSavedNets";

// Save state to localStorage
const saveStateToStorage = (state: PetriNetState) => {
  try {
    const stateToSave = {
      ...state,
      simulationActive: false,
      animatingTokens: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (error) {
    console.error("Failed to save state to localStorage:", error);
  }
};

// Load state from localStorage
const loadStateFromStorage = (): PetriNetState | undefined => {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      return JSON.parse(savedState) as PetriNetState;
    }
  } catch (error) {
    console.error("Failed to load state from localStorage:", error);
  }
  return undefined;
};

// Save saved nets to localStorage
const saveSavedNetsToStorage = (savedNets: SavedPetriNet[]) => {
  try {
    localStorage.setItem(SAVED_NETS_KEY, JSON.stringify(savedNets));
  } catch (error) {
    console.error("Failed to save nets to localStorage:", error);
  }
};

// Load saved nets from localStorage
const loadSavedNetsFromStorage = (): SavedPetriNet[] => {
  try {
    const savedNets = localStorage.getItem(SAVED_NETS_KEY);
    if (savedNets) {
      return JSON.parse(savedNets) as SavedPetriNet[];
    }
  } catch (error) {
    console.error("Failed to load saved nets from localStorage:", error);
  }
  return [];
};

// Generate a unique ID
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function for weighted random selection
const getWeightedRandomRule = (
  selectedRules: string[],
  ruleWeights?: RuleWeight[]
): string => {
  if (!ruleWeights || ruleWeights.length === 0) {
    return selectedRules[Math.floor(Math.random() * selectedRules.length)];
  }

  const weightedRules: { [key: string]: number } = {};
  let totalAssignedWeight = 0;

  for (const ruleWeight of ruleWeights) {
    if (selectedRules.includes(ruleWeight.rule)) {
      weightedRules[ruleWeight.rule] = ruleWeight.weight;
      totalAssignedWeight += ruleWeight.weight;
    }
  }

  const unweightedRules = selectedRules.filter(
    (rule) => !Object.keys(weightedRules).includes(rule)
  );

  if (totalAssignedWeight > 100) {
    const normalizationFactor = 100 / totalAssignedWeight;
    Object.keys(weightedRules).forEach((rule) => {
      weightedRules[rule] *= normalizationFactor;
    });
    totalAssignedWeight = 100;
  }

  const remainingWeight = 100 - totalAssignedWeight;
  if (unweightedRules.length > 0) {
    const weightPerUnweighted = remainingWeight / unweightedRules.length;
    unweightedRules.forEach((rule) => {
      weightedRules[rule] = weightPerUnweighted;
    });
  }

  const weightRanges: { rule: string; min: number; max: number }[] = [];
  let currentWeightMin = 0;

  Object.entries(weightedRules).forEach(([rule, weight]) => {
    const min = currentWeightMin;
    const max = currentWeightMin + weight;
    weightRanges.push({ rule, min, max });
    currentWeightMin = max;
  });

  const randomValue = Math.random() * 100;

  for (const range of weightRanges) {
    if (randomValue >= range.min && randomValue < range.max) {
      return range.rule;
    }
  }

  return selectedRules[0];
};

// Reducer function
const petriNetReducer = (
  state: PetriNetState,
  action: ActionType
): PetriNetState => {
  let newState: PetriNetState;

  switch (action.type) {
    case "UNDO":
      if (state.history.length === 0) return state;
      const previousState = state.history[state.history.length - 1];
      return {
        ...state,
        graph: previousState.graph,
        log: previousState.log,
        history: state.history.slice(0, -1),
      };

    case "RESET":
      newState = {
        ...pushHistory(state),
        graph: initialGraph(),
        log: [],
        currentNetId: null,
      };
      saveStateToStorage(newState);
      return newState;

    case "ADD_PLACE": {
      if (state.graph.nodes.some((n) => n.id === action.id)) {
        toast.error(`Place ${action.id} already exists`);
        return state;
      }

      let newState = pushHistory(state);
      const newGraph = {
        ...newState.graph,
        nodes: [
          ...newState.graph.nodes,
          {
            id: action.id,
            type: "place" as NodeType,
            tokens: 0,
            description: "New Place",
          },
        ],
      };

      newState = addLogEntry(
        {
          ...newState,
          graph: newGraph,
        },
        `Added place ${action.id}`
      );

      saveStateToStorage(newState);
      return newState;
    }

    case "ADD_TRANSITION": {
      if (state.graph.nodes.some((n) => n.id === action.id)) {
        toast.error(`Transition ${action.id} already exists`);
        return state;
      }

      let newState = pushHistory(state);
      const newGraph = {
        ...newState.graph,
        nodes: [
          ...newState.graph.nodes,
          {
            id: action.id,
            type: "transition" as NodeType,
            description: "New Transition",
          },
        ],
      };

      newState = addLogEntry(
        {
          ...newState,
          graph: newGraph,
        },
        `Added transition ${action.id}`
      );

      saveStateToStorage(newState);
      return newState;
    }

    case "CONNECT_NODES": {
      if (
        state.graph.edges.some(
          (e) => e.source === action.source && e.target === action.target
        )
      ) {
        toast.error(
          `Edge from ${action.source} to ${action.target} already exists`
        );
        return state;
      }

      if (action.source === action.target) {
        toast.error("Cannot connect a node to itself");
        return state;
      }

      const sourceNode = state.graph.nodes.find((n) => n.id === action.source);
      const targetNode = state.graph.nodes.find((n) => n.id === action.target);

      if (!sourceNode || !targetNode) {
        toast.error("Source or target node not found");
        return state;
      }

      if (sourceNode.type === targetNode.type) {
        toast.error(`Cannot connect ${sourceNode.type} to ${targetNode.type}`);
        return state;
      }

      let newState = pushHistory(state);
      const newGraph = {
        ...newState.graph,
        edges: [
          ...newState.graph.edges,
          { source: action.source, target: action.target },
        ],
      };

      newState = addLogEntry(
        {
          ...newState,
          graph: newGraph,
        },
        `Connected ${action.source}->${action.target}`
      );

      saveStateToStorage(newState);
      return newState;
    }

    case "APPLY_RULE": {
      const { rule, target, endNodeId } = action;
      const ruleInfo = rulesMap[rule];

      if (!ruleInfo) {
        toast.error(`Unknown rule: ${rule}`);
        return state;
      }

      const targetNode = state.graph.nodes.find((n) => n.id === target);
      if (!targetNode) {
        toast.error(`Target node ${target} not found`);
        return state;
      }

      if (targetNode.type !== ruleInfo.targetType) {
        toast.error(
          `Rule ${rule} requires a ${ruleInfo.targetType} target, but ${target} is a ${targetNode.type}`
        );
        return state;
      }

      if (endNodeId && ruleInfo.endNodeType) {
        const endNode = state.graph.nodes.find((n) => n.id === endNodeId);
        if (!endNode) {
          toast.error(`End node ${endNodeId} not found`);
          return state;
        }

        if (endNode.type !== ruleInfo.endNodeType) {
          toast.error(
            `Rule ${rule} requires a ${ruleInfo.endNodeType} end node, but ${endNodeId} is a ${endNode.type}`
          );
          return state;
        }
      }

      let newState = pushHistory(state);
      const newGraph = ruleInfo.fn(newState.graph, target, endNodeId);

      if (newGraph === newState.graph) {
        return state;
      }

      if (
        !isConnectedGraph(newGraph) ||
        !allNodesInPathFromStartToEnd(newGraph)
      ) {
        toast.error(`Rule application would create an invalid Petri net`);
        return state;
      }

      newState = addLogEntry(
        {
          ...newState,
          graph: newGraph,
        },
        `Applied ${rule} on ${target}${endNodeId ? ` to ${endNodeId}` : ""}`
      );

      saveStateToStorage(newState);
      return newState;
    }

    case "APPLY_RANDOM_RULE": {
      const ruleNames = Object.keys(rulesMap);
      const randomRule =
        ruleNames[Math.floor(Math.random() * ruleNames.length)];
      const ruleInfo = rulesMap[randomRule];

      if (ruleInfo.randomFn) {
        let newState = pushHistory(state);
        const newGraph = ruleInfo.randomFn(newState.graph);

        if (newGraph === newState.graph) {
          return state;
        }

        if (
          !isConnectedGraph(newGraph) ||
          !allNodesInPathFromStartToEnd(newGraph)
        ) {
          toast.error(
            `Random rule application would create an invalid Petri net`
          );
          return state;
        }

        newState = addLogEntry(
          {
            ...newState,
            graph: newGraph,
          },
          `Random ${randomRule} applied`
        );

        saveStateToStorage(newState);
        return newState;
      } else {
        toast.error("No random application function available for this rule");
        return state;
      }
    }

    case "GENERATE_BATCH": {
      const { count, useRandom, selectedRules, ruleWeights } = action;
      let newState = pushHistory(state);
      let newGraph = { ...newState.graph };

      let successCount = 0;
      const MAX_ATTEMPTS = count * 3;

      for (
        let attempt = 0;
        attempt < MAX_ATTEMPTS && successCount < count;
        attempt++
      ) {
        let tempGraph;

        if (useRandom) {
          const ruleNames = Object.keys(rulesMap);
          const randomRule =
            ruleNames[Math.floor(Math.random() * ruleNames.length)];
          const ruleInfo = rulesMap[randomRule];

          if (ruleInfo.randomFn) {
            tempGraph = ruleInfo.randomFn(newGraph);
          }
        } else if (selectedRules.length > 0) {
          const selectedRule = getWeightedRandomRule(
            selectedRules,
            ruleWeights
          );
          const ruleInfo = rulesMap[selectedRule];

          if (ruleInfo && ruleInfo.randomFn) {
            tempGraph = ruleInfo.randomFn(newGraph);
          }
        }

        if (
          tempGraph &&
          tempGraph !== newGraph &&
          isConnectedGraph(tempGraph) &&
          !wouldCreateInvalidConnections(tempGraph) &&
          allNodesInPathFromStartToEnd(tempGraph)
        ) {
          newGraph = tempGraph;
          newState = addLogEntry(
            newState,
            `Batch rule application #${successCount + 1} successful`
          );
          successCount++;
        }
      }

      if (successCount === 0) {
        toast.error("Could not apply any rules successfully");
        return state;
      } else if (successCount < count) {
        toast.warning(
          `Only applied ${successCount}/${count} rules successfully`
        );
      }

      newState = {
        ...newState,
        graph: newGraph,
      };

      saveStateToStorage(newState);
      return newState;
    }

    case "SET_TOKEN_FLOW": {
      const { start, end } = action;

      const startNode = state.graph.nodes.find(
        (n) => n.id === start && n.type === "place"
      );
      if (!startNode) {
        toast.error(`Start node ${start} is not a valid place`);
        return state;
      }

      const endNode = state.graph.nodes.find(
        (n) => n.id === end && n.type === "place"
      );
      if (!endNode) {
        toast.error(`End node ${end} is not a valid place`);
        return state;
      }

      let newState = pushHistory(state);
      const newGraph = {
        ...newState.graph,
        nodes: newState.graph.nodes.map((node) => {
          if (node.type === "place") {
            return { ...node, tokens: node.id === start ? 1 : 0 };
          }
          return node;
        }),
      };

      newState = addLogEntry(
        {
          ...newState,
          graph: newGraph,
        },
        `Flow start=${start},end=${end}`
      );

      saveStateToStorage(newState);
      return newState;
    }

    case "START_SIMULATION": {
      const startNode = state.graph.nodes.find(
        (n) => n.type === "place" && n.tokens && n.tokens > 0
      );
      if (!startNode) {
        toast.error("No start node with tokens found");
        return state;
      }

      const outgoingEdges = state.graph.edges.filter(
        (e) => e.source === startNode.id
      );
      if (outgoingEdges.length === 0) {
        toast.error(`Start node ${startNode.id} has no outgoing edges`);
        return state;
      }

      const transition = outgoingEdges[0].target;
      const outgoingFromTransition = state.graph.edges.filter(
        (e) => e.source === transition
      );

      if (outgoingFromTransition.length === 0) {
        toast.error(`Transition ${transition} has no outgoing edges`);
        return state;
      }

      const targetPlace = outgoingFromTransition[0].target;

      return {
        ...state,
        simulationActive: true,
        animatingTokens: [
          { sourceId: startNode.id, targetId: targetPlace, progress: 0 },
        ],
      };
    }

    case "STOP_SIMULATION": {
      return {
        ...state,
        simulationActive: false,
        animatingTokens: [],
      };
    }

    case "UPDATE_TOKEN_ANIMATION": {
      return {
        ...state,
        animatingTokens: state.animatingTokens.map((token) => ({
          ...token,
          progress: action.progress,
        })),
      };
    }

    case "COMPLETE_SIMULATION": {
      const newGraph = { ...state.graph };

      state.animatingTokens.forEach((anim) => {
        newGraph.nodes = newGraph.nodes.map((node) => {
          if (node.id === anim.sourceId) {
            return { ...node, tokens: 0 };
          }
          if (node.id === anim.targetId) {
            return { ...node, tokens: (node.tokens || 0) + 1 };
          }
          return node;
        });
      });

      newState = addLogEntry(
        {
          ...state,
          graph: newGraph,
          simulationActive: false,
          animatingTokens: [],
        },
        `Simulation completed`
      );

      saveStateToStorage(newState);
      return newState;
    }

    case "CENTER_GRAPH": {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("petrinetCenterGraph"));
      }
      return state;
    }

    case "SET_EVENT_LOG": {
      newState = {
        ...state,
        eventLog: {
          paths: action.paths,
        },
      };

      saveStateToStorage(newState);
      return newState;
    }

    case "SAVE_PETRI_NET": {
      const id = generateId();
      const newSavedNet: SavedPetriNet = {
        id,
        name: action.name,
        timestamp: Date.now(),
        graph: state.graph,
        log: state.log,
        eventLog: state.eventLog,
      };

      const updatedSavedNets = [...state.savedNets, newSavedNet];

      newState = {
        ...state,
        savedNets: updatedSavedNets,
        currentNetId: id,
      };

      saveSavedNetsToStorage(updatedSavedNets);
      saveStateToStorage(newState);
      return newState;
    }

    case "LOAD_PETRI_NET": {
      const netToLoad = state.savedNets.find((net) => net.id === action.id);
      if (!netToLoad) {
        toast.error("Could not find the requested Petri net");
        return state;
      }

      newState = {
        ...state,
        graph: netToLoad.graph,
        log: netToLoad.log,
        eventLog: netToLoad.eventLog,
        history: [],
        currentNetId: netToLoad.id,
      };

      saveStateToStorage(newState);
      return newState;
    }

    case "DELETE_PETRI_NET": {
      const updatedSavedNets = state.savedNets.filter(
        (net) => net.id !== action.id
      );

      newState = {
        ...state,
        savedNets: updatedSavedNets,
        currentNetId:
          state.currentNetId === action.id ? null : state.currentNetId,
      };

      saveSavedNetsToStorage(updatedSavedNets);
      saveStateToStorage(newState);
      return newState;
    }

    case "RENAME_PETRI_NET": {
      const updatedSavedNets = state.savedNets.map((net) =>
        net.id === action.id ? { ...net, name: action.newName } : net
      );

      newState = {
        ...state,
        savedNets: updatedSavedNets,
      };

      saveSavedNetsToStorage(updatedSavedNets);
      saveStateToStorage(newState);
      return newState;
    }

    default:
      return state;
  }
};

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

  const generateAllPaths = async (graph: Graph): Promise<Path[]> => {
    const startPlace = graph.nodes.find(
      (n) => n.id === "P0" && n.type === "place"
    );
    const endPlace = graph.nodes.find(
      (n) => n.id === "P_out" && n.type === "place"
    );

    if (!startPlace || !endPlace) {
      throw new Error("P0 or P_out missing from the graph");
    }

    const visitedPaths = new Set<string>();
    const allPaths: Path[] = [];
    const MAX_PATH_LENGTH = 100; // Safety limit to prevent infinite recursion
    const MAX_PATHS = 1000; // Maximum number of paths to generate

    const dfs = (
      currentId: string, 
      currentPath: PathNode[], 
      visited: Set<string> = new Set()
    ) => {
      // Safety check 1: Prevent stack overflow by limiting path length
      if (currentPath.length > MAX_PATH_LENGTH) {
        return;
      }
      
      // Safety check 2: Prevent too many paths
      if (allPaths.length >= MAX_PATHS) {
        return;
      }

      // Safety check 3: Detect cycles
      if (visited.has(currentId)) {
        return;
      }
      
      const currentNode = graph.nodes.find((n) => n.id === currentId);
      if (!currentNode) return;
      
      // Clone visited set for this branch (don't modify the parent's set)
      const newVisited = new Set(visited);
      newVisited.add(currentId);

      let newPath = [...currentPath];
      if (currentNode.type === "place") {
        newPath = [...newPath, { id: currentId, type: "place" }];
      }

      if (currentId === endPlace.id) {
        const pathKey = newPath.map((n) => n.id).join("->");
        if (!visitedPaths.has(pathKey)) {
          visitedPaths.add(pathKey);
          allPaths.push({ sequence: newPath });
        }
        return;
      }

      const outgoingEdges = graph.edges.filter((e) => e.source === currentId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, newPath, newVisited);
      }
    };

    try {
      dfs(startPlace.id, [], new Set());
      
      // If we found too many paths, add a warning path
      if (allPaths.length >= MAX_PATHS) {
        allPaths.push({
          sequence: [
            { id: "Warning", type: "place" },
            { id: "TooManyPaths", type: "transition" },
            { id: "LimitReached", type: "place" }
          ]
        });
      }
      
      return allPaths;
    } catch (error) {
      console.error("Path generation error:", error);
      throw error;
    }
  };

  const value = {
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

        if (paths.length === 0) {
          throw new Error("No valid paths found from P0 to P_out");
        }

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

// We can't modify this file as it's read-only, but in a real-world scenario,
// we would need to update the context to include:
// 1. A new updateNodeDescription function
// 2. Update the Node type to include a description field

// Since we can't modify the context directly, we'll simulate this functionality
// by adding a custom event listener in our components to handle this.
