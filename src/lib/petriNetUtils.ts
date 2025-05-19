
import { Graph, Node, Edge, Path, PathNode, RuleWeight } from "@/types/petriNet";
import { toast } from "sonner";

// Create initial graph - ensuring P0 and P_out exist
export const initialGraph = (): Graph => {
  return {
    nodes: [
      { id: "P0", type: "place", tokens: 1 },
      { id: "P_out", type: "place", tokens: 0 },
      { id: "T0", type: "transition" },
    ],
    edges: [
      { source: "P0", target: "T0" },
      { source: "T0", target: "P_out" },
    ],
  };
};

// Helper function to check if the graph is connected
export const isConnectedGraph = (graph: Graph): boolean => {
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

// Check if all nodes are part of at least one path from P0 to P_out
export const allNodesInPathFromStartToEnd = (graph: Graph): boolean => {
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
export const wouldCreateInvalidConnections = (graph: Graph): boolean => {
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

// Helper function for weighted random selection
export const getWeightedRandomRule = (
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

// Storage keys
const STORAGE_KEY = "petriNetState";
const SAVED_NETS_KEY = "petriNetSavedNets";

// Save state to localStorage
export const saveStateToStorage = (state: any) => {
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
export const loadStateFromStorage = () => {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (error) {
    console.error("Failed to load state from localStorage:", error);
  }
  return undefined;
};

// Save saved nets to localStorage
export const saveSavedNetsToStorage = (savedNets: any) => {
  try {
    localStorage.setItem(SAVED_NETS_KEY, JSON.stringify(savedNets));
  } catch (error) {
    console.error("Failed to save nets to localStorage:", error);
  }
};

// Load saved nets from localStorage
export const loadSavedNetsFromStorage = () => {
  try {
    const savedNets = localStorage.getItem(SAVED_NETS_KEY);
    if (savedNets) {
      return JSON.parse(savedNets);
    }
  } catch (error) {
    console.error("Failed to load saved nets from localStorage:", error);
  }
  return [];
};

// Generate a unique ID
export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to add log entry
export const addLogEntry = (state: any, action: string) => {
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

// Helper function to add to history
export const pushHistory = (state: any) => {
  return {
    ...state,
    history: [...state.history, { graph: state.graph, log: state.log }],
  };
};

export const generateAllPaths = async (graph: Graph): Promise<Path[]> => {
  const startPlace = graph.nodes.find(
    (n) => n.id === "P0" && n.type === "place"
  );
  const endPlace = graph.nodes.find(
    (n) => n.id === "P_out" && n.type === "place"
  );

  if (!startPlace || !endPlace) {
    toast.error("P0 or P_out missing from the graph");
    return [];
  }

  const visitedPaths = new Set<string>();
  const allPaths: Path[] = [];

  const dfs = (currentId: string, currentPath: PathNode[]) => {
    const currentNode = graph.nodes.find((n) => n.id === currentId);
    if (!currentNode) return;

    if (currentNode.type === "place") {
      currentPath = [...currentPath, { id: currentId, type: "place" }];
    }

    if (currentId === endPlace.id) {
      const pathKey = currentPath.map((n) => n.id).join("->");
      if (!visitedPaths.has(pathKey)) {
        visitedPaths.add(pathKey);
        allPaths.push({ sequence: currentPath });
      }
      return;
    }

    const outgoingEdges = graph.edges.filter((e) => e.source === currentId);
    for (const edge of outgoingEdges) {
      dfs(edge.target, [...currentPath]);
    }
  };

  dfs(startPlace.id, []);

  return allPaths;
};
