import React, { createContext, useContext, useState, useReducer, useEffect, ReactNode, useRef } from "react";
import { toast } from "sonner";
import { validateNewPlace, validateNewTransition } from "@/lib/utils";

// Define types
type NodeType = 'place' | 'transition';

interface Node {
  id: string;
  type: NodeType;
  tokens?: number;
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
  generateBatch: (count: number, useRandom: boolean, selectedRules: string[], ruleWeights?: RuleWeight[]) => void;
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
const PetriNetContext = createContext<PetriNetContextType | undefined>(undefined);

// Rule implementations
const applyAbstractionRule = (graph: Graph, targetId: string): Graph => {
  // Implementation of abstraction rule (ψA)
  const newGraph = { ...graph };
  
  // Get target transition node
  const targetNode = newGraph.nodes.find(node => node.id === targetId);
  if (!targetNode || targetNode.type !== 'transition') return newGraph;
  
  // Find all output places of the target transition
  const outputPlaces = newGraph.edges
    .filter(e => e.source === targetId)
    .map(e => e.target)
    .filter(id => newGraph.nodes.find(n => n.id === id)?.type === 'place');
  
  // If no output places, cannot apply rule
  if (outputPlaces.length === 0) {
    toast.error("Target transition has no output places for abstraction");
    return newGraph;
  }
  
  // Create new place and transition
  const placeId = `P${newGraph.nodes.filter(n => n.type === 'place').length}`;
  const transId = `T${newGraph.nodes.filter(n => n.type === 'transition').length}`;
  
  // Add new nodes
  const updatedNodes: Node[] = [...newGraph.nodes, 
    { id: placeId, type: 'place', tokens: 0 },
    { id: transId, type: 'transition' }
  ];
  
  newGraph.nodes = updatedNodes;
  
  // Remove direct edges from target to its outputs
  newGraph.edges = newGraph.edges.filter(e => !(e.source === targetId && outputPlaces.includes(e.target)));
  
  // Add edges for the abstraction pattern:
  // - from target transition to new place
  // - from new place to new transition
  // - from new transition to all original output places
  newGraph.edges = [...newGraph.edges,
    { source: targetId, target: placeId }, // transition -> new place
    { source: placeId, target: transId },  // new place -> new transition
    ...outputPlaces.map(output => ({ source: transId, target: output })) // new transition -> original outputs
  ];
  
  // Final validation
  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error("Cannot apply this rule: it would create invalid connections");
    return graph; // Return original graph
  }
  
  // Verify node connectivity - ensure all nodes are reachable from start
  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }
  
  return newGraph;
};

const applyLinearTransitionRule = (graph: Graph, targetId: string, endNodeId?: string): Graph => {
  // Implementation of linear transition rule (ψT)
  const newGraph = { ...graph };
  
  // Get target place node
  const targetNode = newGraph.nodes.find(node => node.id === targetId);
  if (!targetNode || targetNode.type !== 'place') return newGraph;
  
  // Create new transition
  const transId = `T${newGraph.nodes.filter(n => n.type === 'transition').length}`;
  
  // Add new transition node
  const updatedNodes: Node[] = [
    ...newGraph.nodes, 
    { id: transId, type: 'transition' }
  ];
  
  newGraph.nodes = updatedNodes;
  
  // Connect target place to new transition
  newGraph.edges = [
    ...newGraph.edges, 
    { source: targetId, target: transId }
  ];
  
  // If end node is specified, connect the new transition to it
  if (endNodeId) {
    const endNode = newGraph.nodes.find(node => node.id === endNodeId);
    if (endNode && endNode.type === 'place') {
      newGraph.edges.push({ source: transId, target: endNodeId });
    }
  } else {
    // Create a new output place if no end node is specified
    const placeId = `P${newGraph.nodes.filter(n => n.type === 'place').length}`;
    newGraph.nodes.push({ id: placeId, type: 'place', tokens: 0 });
    newGraph.edges.push({ source: transId, target: placeId });
  }
  
  // Check if this would create invalid patterns
  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error("Cannot apply this rule: it would create invalid connections");
    return graph; // Return original graph
  }
  
  // Verify node connectivity - ensure all nodes are reachable from start
  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }
  
  return newGraph;
};

// Linear Place Rule - Improved based on Python's add_row logic
const applyLinearPlaceRule = (graph: Graph, targetId: string): Graph => {
  // Implementation of linear place rule (ψP) based on add_row
  const newGraph = { ...graph };
  
  // Get target transition node
  const targetNode = newGraph.nodes.find(node => node.id === targetId);
  if (!targetNode || targetNode.type !== 'transition') return newGraph;
  
  // Find all transitions in the graph
  const transitions = newGraph.nodes.filter(n => n.type === 'transition');
  
  // If we have only one transition, we can't create a linear dependent place
  if (transitions.length <= 1) {
    toast.error("Need at least two transitions for linear dependent place rule");
    return newGraph;
  }
  
  // Create new place
  const placeId = `P${newGraph.nodes.filter(n => n.type === 'place').length}`;
  
  // Add new place node
  newGraph.nodes = [
    ...newGraph.nodes, 
    { id: placeId, type: 'place', tokens: 0 }
  ];
  
  // Similar to Python's add_row function, we'll create linear combinations
  // First, try to find valid transitions to connect (input + output)
  const transitionsToConnectFrom: string[] = []; // Will connect TO the new place
  const transitionsToConnectTo: string[] = []; // Will connect FROM the new place
  
  // Always include target transition as input (similar to coefficients in Python)
  transitionsToConnectFrom.push(targetId);
  
  // Find potential output transitions (creating a combination)
  const potentialOutputs = transitions
    .filter(t => t.id !== targetId)
    .map(t => t.id);
  
  // Add at least one random output transition if available
  if (potentialOutputs.length > 0) {
    const randomOutput = potentialOutputs[Math.floor(Math.random() * potentialOutputs.length)];
    transitionsToConnectTo.push(randomOutput);
  }
  
  // Create edges - transitions to new place (inputs)
  const inputEdges = transitionsToConnectFrom.map(transId => ({
    source: transId,
    target: placeId
  }));
  
  // Create edges - new place to transitions (outputs)
  const outputEdges = transitionsToConnectTo.map(transId => ({
    source: placeId,
    target: transId
  }));
  
  // Add all new edges
  newGraph.edges = [...newGraph.edges, ...inputEdges, ...outputEdges];
  
  // Validate if the edges would create a valid petri net
  // This corresponds to validate_matrix in the Python code
  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error("Cannot create a valid linear dependent place configuration");
    return graph; // Return original graph
  }
  
  // Verify node connectivity - ensure all nodes are reachable from start
  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }
  
  return newGraph;
};

// Linear Transition Dependency Rule - Improved based on Python's add_column logic
const applyLinearTransitionDependencyRule = (graph: Graph, targetId: string): Graph => {
  // Implementation of linear transition dependency rule based on add_column function
  const newGraph = { ...graph };
  
  // Get target place node
  const targetNode = newGraph.nodes.find(node => node.id === targetId);
  if (!targetNode || targetNode.type !== 'place') return newGraph;
  
  // Find all places in the graph
  const places = newGraph.nodes.filter(n => n.type === 'place');
  
  // If we have only one place, we can't create a linear dependent transition
  if (places.length <= 1) {
    toast.error("Need at least two places for linear dependent transition rule");
    return newGraph;
  }
  
  // Create new transition
  const transId = `T${newGraph.nodes.filter(n => n.type === 'transition').length}`;
  
  // Add new transition node
  newGraph.nodes = [
    ...newGraph.nodes, 
    { id: transId, type: 'transition' }
  ];
  
  // Similar to Python's add_column function, create linear combinations
  // We'll select input and output places for the new transition
  
  // Places that will connect TO the new transition (inputs)
  const placesToConnectFrom: string[] = [];
  
  // Places that will connect FROM the new transition (outputs)
  const placesToConnectTo: string[] = [];
  
  // Always include target place as input
  placesToConnectFrom.push(targetId);
  
  // Find potential output places
  const potentialOutputs = places
    .filter(p => p.id !== targetId)
    .map(p => p.id);
  
  // Add at least one random output place if available
  if (potentialOutputs.length > 0) {
    // Select a random place as output
    const randomPlace = potentialOutputs[Math.floor(Math.random() * potentialOutputs.length)];
    placesToConnectTo.push(randomPlace);
    
    // Optionally add another input place (following linear combination logic)
    const remainingPlaces = potentialOutputs.filter(p => p !== randomPlace);
    if (remainingPlaces.length > 0 && Math.random() > 0.5) {
      const additionalPlace = remainingPlaces[Math.floor(Math.random() * remainingPlaces.length)];
      placesToConnectFrom.push(additionalPlace);
    }
  }
  
  // Create edges from input places to the new transition
  const inputEdges = placesToConnectFrom.map(placeId => ({
    source: placeId,
    target: transId
  }));
  
  // Create edges from the new transition to output places
  const outputEdges = placesToConnectTo.map(placeId => ({
    source: transId,
    target: placeId
  }));
  
  // Add all new edges
  newGraph.edges = [...newGraph.edges, ...inputEdges, ...outputEdges];
  
  // Validate if the edges would create a valid petri net
  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error("Cannot create a valid linear dependent transition configuration");
    return graph; // Return original graph
  }
  
  // Verify node connectivity - ensure all nodes are reachable from start
  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }
  
  return newGraph;
};

const applyDualAbstractionRule = (graph: Graph, targetId: string, endNodeId?: string): Graph => {
  // Implementation of dual abstraction rule (ψD)
  const newGraph = { ...graph };
  
  // Get target transition node
  const targetNode = newGraph.nodes.find(node => node.id === targetId);
  if (!targetNode || targetNode.type !== 'transition') return newGraph;
  
  // Find all input places of the target transition
  const inputPlaces = newGraph.edges
    .filter(e => e.target === targetId)
    .map(e => e.source)
    .filter(id => newGraph.nodes.find(n => n.id === id)?.type === 'place');
    
  // If no input places, cannot apply rule
  if (inputPlaces.length === 0) {
    toast.error("Target transition has no input places for dual abstraction");
    return newGraph;
  }
  
  // Create new place and transition
  const placeId = `P${newGraph.nodes.filter(n => n.type === 'place').length}`;
  const transId = `T${newGraph.nodes.filter(n => n.type === 'transition').length}`;
  
  // Add new nodes
  const updatedNodes: Node[] = [
    ...newGraph.nodes, 
    { id: transId, type: 'transition' },
    { id: placeId, type: 'place', tokens: 0 }
  ];
  
  newGraph.nodes = updatedNodes;
  
  // Remove direct edges from input places to target transition
  newGraph.edges = newGraph.edges.filter(e => !(inputPlaces.includes(e.source) && e.target === targetId));
  
  // Add edges according to the rule:
  // - from input places to new transition
  // - from new transition to new place
  // - from new place to target transition
  
  // Connect all input places to the new transition
  const inputEdges = inputPlaces.map(input => ({ source: input, target: transId }));
  
  // Connect new transition to new place
  const midEdge = { source: transId, target: placeId };
  
  // Connect new place to target or end node
  const finalTarget = endNodeId || targetId;
  const outputEdge = { source: placeId, target: finalTarget };
  
  // Add all new edges to the graph
  newGraph.edges = [
    ...newGraph.edges,
    ...inputEdges,
    midEdge,
    outputEdge
  ];
  
  // Check if this would create invalid patterns
  if (wouldCreateInvalidConnections(newGraph)) {
    toast.error("Cannot apply this rule: it would create invalid connections");
    return graph; // Return original graph
  }
  
  // Verify node connectivity - ensure all nodes are reachable from start
  if (!isConnectedGraph(newGraph)) {
    toast.error("Cannot apply this rule: it would create disconnected nodes");
    return graph;
  }
  
  return newGraph;
};

// Enhanced random rule application for Abstraction Rule
const applyRandomAbstractionRule = (graph: Graph): Graph => {
  // Try multiple times to find a valid application
  const MAX_ATTEMPTS = 10;
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Find all transition nodes
    const transitions = graph.nodes.filter(node => node.type === 'transition');
    if (transitions.length === 0) return graph;
    
    // Select a random transition
    const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
    
    // Apply the rule
    const newGraph = applyAbstractionRule(graph, randomTransition.id);
    
    // If successful application (graph changed) and valid
    if (newGraph !== graph && isConnectedGraph(newGraph) && !wouldCreateInvalidConnections(newGraph)) {
      return newGraph;
    }
  }
  
  toast.error("Could not find a valid application for abstraction rule");
  return graph;
};

// Enhanced random rule application for Linear Transition Rule
const applyRandomLinearTransitionRule = (graph: Graph): Graph => {
  // Try multiple times to find a valid application
  const MAX_ATTEMPTS = 10;
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Find all place nodes
    const places = graph.nodes.filter(node => node.type === 'place');
    if (places.length === 0) return graph;
    
    // Select random place
    const randomPlace = places[Math.floor(Math.random() * places.length)];
    
    // Select a random end place (different from start)
    const endPlaces = places.filter(p => p.id !== randomPlace.id);
    let endNodeId = undefined;
    if (endPlaces.length > 0 && Math.random() > 0.5) {
      const randomEndPlace = endPlaces[Math.floor(Math.random() * endPlaces.length)];
      endNodeId = randomEndPlace.id;
    }
    
    // Apply the rule
    const newGraph = applyLinearTransitionRule(graph, randomPlace.id, endNodeId);
    
    // If successful application and valid
    if (newGraph !== graph && isConnectedGraph(newGraph) && !wouldCreateInvalidConnections(newGraph)) {
      return newGraph;
    }
  }
  
  toast.error("Could not find a valid application for linear transition rule");
  return graph;
};

// Enhanced random rule application for Linear Place Rule
const applyRandomLinearPlaceRule = (graph: Graph): Graph => {
  // Try multiple times to find a valid application
  const MAX_ATTEMPTS = 10;
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Find all transition nodes
    const transitions = graph.nodes.filter(node => node.type === 'transition');
    if (transitions.length === 0) return graph;
    
    // Select a random transition
    const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
    
    // Apply the rule
    const newGraph = applyLinearPlaceRule(graph, randomTransition.id);
    
    // If successful application and valid
    if (newGraph !== graph && isConnectedGraph(newGraph) && !wouldCreateInvalidConnections(newGraph)) {
      return newGraph;
    }
  }
  
  toast.error("Could not find a valid application for linear place rule");
  return graph;
};

// Enhanced random rule application for Linear Transition Dependency Rule
const applyRandomLinearTransitionDependencyRule = (graph: Graph): Graph => {
  // Try multiple times to find a valid application
  const MAX_ATTEMPTS = 10;
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Find all place nodes
    const places = graph.nodes.filter(node => node.type === 'place');
    if (places.length === 0) return graph;
    
    // Select a random place
    const randomPlace = places[Math.floor(Math.random() * places.length)];
    
    // Apply the rule
    const newGraph = applyLinearTransitionDependencyRule(graph, randomPlace.id);
    
    // If successful application and valid
    if (newGraph !== graph && isConnectedGraph(newGraph) && !wouldCreateInvalidConnections(newGraph)) {
      return newGraph;
    }
  }
  
  toast.error("Could not find a valid application for linear transition dependency rule");
  return graph;
};

// Enhanced random rule application for Dual Abstraction Rule
const applyRandomDualAbstractionRule = (graph: Graph): Graph => {
  // Try multiple times to find a valid application
  const MAX_ATTEMPTS = 10;
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Find all transition nodes
    const transitions = graph.nodes.filter(node => node.type === 'transition');
    if (transitions.length === 0) return graph;
    
    // Select a random transition
    const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
    
    // Select a random end transition (different from start)
    const endTransitions = transitions.filter(t => t.id !== randomTransition.id);
    let endNodeId = undefined;
    if (endTransitions.length > 0 && Math.random() > 0.5) {
      const randomEndTransition = endTransitions[Math.floor(Math.random() * endTransitions.length)];
      endNodeId = randomEndTransition.id;
    }
    
    // Apply the rule
    const newGraph = applyDualAbstractionRule(graph, randomTransition.id, endNodeId);
    
    // If successful application and valid
    if (newGraph !== graph && isConnectedGraph(newGraph) && !wouldCreateInvalidConnections(newGraph)) {
      return newGraph;
    }
  }
  
  toast.error("Could not find a valid application for dual abstraction rule");
  return graph;
};

// Helper function to check if the graph is connected
// This ensures there are no disconnected nodes after rule application
const isConnectedGraph = (graph: Graph): boolean => {
  if (graph.nodes.length === 0) return true;
  
  // Find start node (place with tokens)
  const startNode = graph.nodes.find(n => n.type === 'place' && n.tokens && n.tokens > 0);
  if (!startNode) {
    // If no tokens, try first place as start
    const firstPlace = graph.nodes.find(n => n.type === 'place');
    if (!firstPlace) return true; // No places in graph
  }
  
  const startId = startNode?.id || graph.nodes.find(n => n.type === 'place')?.id;
  if (!startId) return true; // No places in graph
  
  // BFS to check connectivity
  const visited = new Set<string>();
  const queue: string[] = [startId];
  
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    
    visited.add(nodeId);
    
    // Add all connected nodes to queue
    const outgoing = graph.edges.filter(e => e.source === nodeId).map(e => e.target);
    const incoming = graph.edges.filter(e => e.target === nodeId).map(e => e.source);
    
    [...outgoing, ...incoming].forEach(id => {
      if (!visited.has(id)) {
        queue.push(id);
      }
    });
  }
  
  // All nodes should be visited
  return visited.size === graph.nodes.length;
};

// Function to check if a graph would have invalid connections
const wouldCreateInvalidConnections = (graph: Graph): boolean => {
  // Places shouldn't connect to places
  const placeToPlaceConnections = graph.edges.some(edge => {
    const sourceType = graph.nodes.find(n => n.id === edge.source)?.type;
    const targetType = graph.nodes.find(n => n.id === edge.target)?.type;
    return sourceType === 'place' && targetType === 'place';
  });
  
  // Transitions shouldn't connect to transitions
  const transToTransConnections = graph.edges.some(edge => {
    const sourceType = graph.nodes.find(n => n.id === edge.source)?.type;
    const targetType = graph.nodes.find(n => n.id === edge.target)?.type;
    return sourceType === 'transition' && targetType === 'transition';
  });
  
  // Every place should have at least one input or output (except source/sink)
  const placesWithNoConnections = graph.nodes.filter(node => {
    if (node.type !== 'place') return false;
    
    const hasOutgoing = graph.edges.some(e => e.source === node.id);
    const hasIncoming = graph.edges.some(e => e.target === node.id);
    
    return !hasOutgoing && !hasIncoming;
  });
  
  // Every transition should have at least one input and one output
  const transitionsWithInvalidConnections = graph.nodes.filter(node => {
    if (node.type !== 'transition') return false;
    
    const hasOutgoing = graph.edges.some(e => e.source === node.id);
    const hasIncoming = graph.edges.some(e => e.target === node.id);
    
    return !hasOutgoing || !hasIncoming;
  });
  
  return placeToPlaceConnections || 
         transToTransConnections || 
         placesWithNoConnections.length > 0 ||
         transitionsWithInvalidConnections.length > 0;
};

// Map rules to their implementations
const rulesMap: Record<string, { 
  fn: (graph: Graph, targetId: string, endNodeId?: string) => Graph, 
  targetType: NodeType,
  endNodeType?: NodeType,
  randomFn?: (graph: Graph) => Graph
}> = {
  'Abstraction ψA': { 
    fn: applyAbstractionRule, 
    targetType: 'transition',
    randomFn: applyRandomAbstractionRule
  },
  'Linear Transition ψT': { 
    fn: applyLinearTransitionRule, 
    targetType: 'place', 
    endNodeType: 'place',
    randomFn: applyRandomLinearTransitionRule
  },
  'Linear Place ψP': { 
    fn: applyLinearPlaceRule, 
    targetType: 'transition',
    randomFn: applyRandomLinearPlaceRule
  },
  'Linear Transition Dependency': { 
    fn: applyLinearTransitionDependencyRule, 
    targetType: 'place',
    randomFn: applyRandomLinearTransitionDependencyRule
  },
  'Dual Abstraction ψD': { 
    fn: applyDualAbstractionRule, 
    targetType: 'transition', 
    endNodeType: 'transition',
    randomFn: applyRandomDualAbstractionRule
  },
};

// Create initial graph
const initialGraph = (): Graph => {
  return {
    nodes: [
      { id: 'P0', type: 'place', tokens: 1 },
      { id: 'P_out', type: 'place', tokens: 0 },
      { id: 'T0', type: 'transition' }
    ],
    edges: [
      { source: 'P0', target: 'T0' },
      { source: 'T0', target: 'P_out' }
    ]
  };
};

// Action types for reducer
type ActionType =
  | { type: 'UNDO' }
  | { type: 'RESET' }
  | { type: 'ADD_PLACE'; id: string }
  | { type: 'ADD_TRANSITION'; id: string }
  | { type: 'CONNECT_NODES'; source: string; target: string }
  | { type: 'APPLY_RULE'; rule: string; target: string; endNodeId?: string }
  | { type: 'APPLY_RANDOM_RULE' }
  | { type: 'GENERATE_BATCH'; count: number; useRandom: boolean; selectedRules: string[], ruleWeights?: RuleWeight[] }
  | { type: 'SET_TOKEN_FLOW'; start: string; end: string }
  | { type: 'START_SIMULATION' }
  | { type: 'STOP_SIMULATION' }
  | { type: 'UPDATE_TOKEN_ANIMATION'; progress: number }
  | { type: 'COMPLETE_SIMULATION' }
  | { type: 'CENTER_GRAPH' }
  | { type: 'SET_EVENT_LOG', paths: Path[] }
  | { type: 'SAVE_PETRI_NET', name: string }
  | { type: 'LOAD_PETRI_NET', id: string }
  | { type: 'DELETE_PETRI_NET', id: string }
  | { type: 'RENAME_PETRI_NET', id: string, newName: string };

// Helper function to add to history
const pushHistory = (state: PetriNetState): PetriNetState => {
  return {
    ...state,
    history: [...state.history, { graph: state.graph, log: state.log }]
  };
};

// Helper function to add log entry
const addLogEntry = (state: PetriNetState, action: string): PetriNetState => {
  const newEntry = {
    id: state.log.length + 1,
    timestamp: new Date().toISOString(),
    action
  };
  
  return {
    ...state,
    log: [...state.log, newEntry]
  };
};

// Storage keys
const STORAGE_KEY = 'petriNetState';
const SAVED_NETS_KEY = 'petriNetSavedNets';

// Save state to localStorage
const saveStateToStorage = (state: PetriNetState) => {
  try {
    // Don't save simulation active state or animating tokens
    const stateToSave = {
      ...state,
      simulationActive: false,
      animatingTokens: []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
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
    console.error('Failed to load state from localStorage:', error);
  }
  return undefined;
};

// Save saved nets to localStorage
const saveSavedNetsToStorage = (savedNets: SavedPetriNet[]) => {
  try {
    localStorage.setItem(SAVED_NETS_KEY, JSON.stringify(savedNets));
  } catch (error) {
    console.error('Failed to save nets to localStorage:', error);
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
    console.error('Failed to load saved nets from localStorage:', error);
  }
  return [];
};

// Generate a unique ID
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function for weighted random selection
const getWeightedRandomRule = (selectedRules: string[], ruleWeights?: RuleWeight[]): string => {
  // If no weights are provided, select randomly
  if (!ruleWeights || ruleWeights.length === 0) {
    return selectedRules[Math.floor(Math.random() * selectedRules.length)];
  }
  
  // Calculate total assigned weight and find which rules have weights
  const weightedRules: { [key: string]: number } = {};
  let totalAssignedWeight = 0;
  
  // First, collect all assigned weights
  for (const ruleWeight of ruleWeights) {
    if (selectedRules.includes(ruleWeight.rule)) {
      weightedRules[ruleWeight.rule] = ruleWeight.weight;
      totalAssignedWeight += ruleWeight.weight;
    }
  }
  
  // Find unweighted rules
  const unweightedRules = selectedRules.filter(rule => !Object.keys(weightedRules).includes(rule));
  
  // If total assigned weight exceeds 100%, normalize it to 100%
  if (totalAssignedWeight > 100) {
    const normalizationFactor = 100 / totalAssignedWeight;
    Object.keys(weightedRules).forEach(rule => {
      weightedRules[rule] *= normalizationFactor;
    });
    totalAssignedWeight = 100;
  }
  
  // Distribute remaining weight among unweighted rules
  const remainingWeight = 100 - totalAssignedWeight;
  if (unweightedRules.length > 0) {
    const weightPerUnweighted = remainingWeight / unweightedRules.length;
    unweightedRules.forEach(rule => {
      weightedRules[rule] = weightPerUnweighted;
    });
  }
  
  // Build weight ranges for selection
  const weightRanges: { rule: string; min: number; max: number }[] = [];
  let currentWeightMin = 0;
  
  Object.entries(weightedRules).forEach(([rule, weight]) => {
    const min = currentWeightMin;
    const max = currentWeightMin + weight;
    weightRanges.push({ rule, min, max });
    currentWeightMin = max;
  });
  
  // Select a random value between 0 and 100
  const randomValue = Math.random() * 100;
  
  // Find which range the random value falls into
  for (const range of weightRanges) {
    if (randomValue >= range.min && randomValue < range.max) {
      return range.rule;
    }
  }
  
  // Fallback (should not happen if weights are properly calculated)
  return selectedRules[0];
};

// Reducer function
const petriNetReducer = (state: PetriNetState, action: ActionType): PetriNetState => {
  let newState: PetriNetState;
  
  switch (action.type) {
    case 'UNDO':
      if (state.history.length === 0) return state;
      const previousState = state.history[state.history.length - 1];
      return {
        ...state,
        graph: previousState.graph,
        log: previousState.log,
        history: state.history.slice(0, -1)
      };
      
    case 'RESET':
      newState = {
        ...pushHistory(state),
        graph: initialGraph(),
        log: [],
        currentNetId: null,
      };
      saveStateToStorage(newState);
      return newState;
      
    case 'ADD_PLACE': {
      // Check if place already exists
      if (state.graph.nodes.some(n => n.id === action.id)) {
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
            type: "place" as NodeType, // type-safe assignment
            tokens: 0,
          }
        ]
      };
      
      newState = addLogEntry({
        ...newState,
        graph: newGraph
      }, `Added place ${action.id}`);
      
      saveStateToStorage(newState);
      return newState;
    }
      
    case 'ADD_TRANSITION': {
      // Check if transition already exists
      if (state.graph.nodes.some(n => n.id === action.id)) {
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
            type: "transition" as NodeType // type-safe assignment
          }
        ]
      };
      
      newState = addLogEntry({
        ...newState,
        graph: newGraph
      }, `Added transition ${action.id}`);
      
      saveStateToStorage(newState);
      return newState;
    }
      
    case 'CONNECT_NODES': {
      // Check if edge already exists
      if (state.graph.edges.some(e => e.source === action.source && e.target === action.target)) {
        toast.error(`Edge from ${action.source} to ${action.target} already exists`);
        return state;
      }
      
      // Check if source and target are the same
      if (action.source === action.target) {
        toast.error("Cannot connect a node to itself");
        return state;
      }
      
      // Validate node types (place to transition or transition to place)
      const sourceNode = state.graph.nodes.find(n => n.id === action.source);
      const targetNode = state.graph.nodes.find(n => n.id === action.target);
      
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
        edges: [...newState.graph.edges, { source: action.source, target: action.target }]
      };
      
      newState = addLogEntry({
        ...newState,
        graph: newGraph
      }, `Connected ${action.source}->${action.target}`);
      
      saveStateToStorage(newState);
      return newState;
    }
      
    case 'APPLY_RULE': {
      const { rule, target, endNodeId } = action;
      const ruleInfo = rulesMap[rule];
      
      if (!ruleInfo) {
        toast.error(`Unknown rule: ${rule}`);
        return state;
      }
      
      // Check if target exists and has the correct type
      const targetNode = state.graph.nodes.find(n => n.id === target);
      if (!targetNode) {
        toast.error(`Target node ${target} not found`);
        return state;
      }
      
      if (targetNode.type !== ruleInfo.targetType) {
        toast.error(`Rule ${rule} requires a ${ruleInfo.targetType} target, but ${target} is a ${targetNode.type}`);
        return state;
      }
      
      // Check end node if specified and if the rule supports it
      if (endNodeId && ruleInfo.endNodeType) {
        const endNode = state.graph.nodes.find(n => n.id === endNodeId);
        if (!endNode) {
          toast.error(`End node ${endNodeId} not found`);
          return state;
        }
        
        if (endNode.type !== ruleInfo.endNodeType) {
          toast.error(`Rule ${rule} requires a ${ruleInfo.endNodeType} end node, but ${endNodeId} is a ${endNode.type}`);
          return state;
        }
      }
      
      let newState = pushHistory(state);
      const newGraph = ruleInfo.fn(newState.graph, target, endNodeId);
      
      // If the graph didn't change, the rule couldn't be applied
      if (newGraph === newState.graph) {
        return state;
      }
      
      newState = addLogEntry({
        ...newState,
        graph: newGraph
      }, `Applied ${rule} on ${target}${endNodeId ? ` to ${endNodeId}` : ''}`);
      
      saveStateToStorage(newState);
      return newState;
    }
    
    case 'APPLY_RANDOM_RULE': {
      // Select a random rule
      const ruleNames = Object.keys(rulesMap);
      const randomRule = ruleNames[Math.floor(Math.random() * ruleNames.length)];
      const ruleInfo = rulesMap[randomRule];
      
      // Use the dedicated random function if available
      if (ruleInfo.randomFn) {
        let newState = pushHistory(state);
        const newGraph = ruleInfo.randomFn(newState.graph);
        
        // If the graph didn't change, the rule couldn't be applied
        if (newGraph === newState.graph) {
          return state;
        }
        
        newState = addLogEntry({
          ...newState,
          graph: newGraph
        }, `Random ${randomRule} applied`);
        
        saveStateToStorage(newState);
        return newState;
      } else {
        // Fall back to the old implementation if no random function is available
        // Find valid targets for this rule
        const validTargets = state.graph.nodes.filter(n => n.type === ruleInfo.targetType);
        
        if (validTargets.length === 0) {
          toast.error(`No valid targets for rule ${randomRule}`);
          return state;
        }
        
        // Select a random target
        const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
        
        let newState = pushHistory(state);
        const newGraph = ruleInfo.fn(newState.graph, randomTarget.id);
        
        // If the graph didn't change, the rule couldn't be applied
        if (newGraph === newState.graph) {
          return state;
        }
        
        newState = addLogEntry({
          ...newState,
          graph: newGraph
        }, `Random ${randomRule} on ${randomTarget.id}`);
        
        saveStateToStorage(newState);
        return newState;
      }
    }
      
    case 'GENERATE_BATCH': {
      const { count, useRandom, selectedRules, ruleWeights } = action;
      let newState = pushHistory(state);
      let newGraph = { ...newState.graph };
      
      for (let i = 0; i < count; i++) {
        if (useRandom) {
          // Apply random rule using the dedicated random functions
          const ruleNames = Object.keys(rulesMap);
          const randomRule = ruleNames[Math.floor(Math.random() * ruleNames.length)];
          const ruleInfo = rulesMap[randomRule];
          
          if (ruleInfo.randomFn) {
            const tempGraph = ruleInfo.randomFn(newGraph);
            
            // Only update if rule application was successful
            if (tempGraph !== newGraph) {
              newGraph = tempGraph;
              newState = addLogEntry(newState, `Batch random ${randomRule} applied`);
            }
          } else {
            // Fall back to the old implementation
            const validTargets = newGraph.nodes.filter(n => n.type === ruleInfo.targetType);
            
            if (validTargets.length > 0) {
              const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
              const tempGraph = ruleInfo.fn(newGraph, randomTarget.id);
              
              // Only update if rule application was successful
              if (tempGraph !== newGraph) {
                newGraph = tempGraph;
                newState = addLogEntry(newState, `Batch random ${randomRule} on ${randomTarget.id}`);
              }
            }
          }
        } else if (selectedRules.length > 0) {
          // Apply selected rules with weights
          const selectedRule = getWeightedRandomRule(selectedRules, ruleWeights);
          const ruleInfo = rulesMap[selectedRule];
          
          if (ruleInfo) {
            if (ruleInfo.randomFn) {
              const tempGraph = ruleInfo.randomFn(newGraph);
              
              // Only update if rule application was successful
              if (tempGraph !== newGraph) {
                newGraph = tempGraph;
                newState = addLogEntry(newState, `Batch ${selectedRule} applied`);
              }
            } else {
              // Fall back to the old implementation
              const validTargets = newGraph.nodes.filter(n => n.type === ruleInfo.targetType);
              
              if (validTargets.length > 0) {
                const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
                const tempGraph = ruleInfo.fn(newGraph, randomTarget.id);
                
                // Only update if rule application was successful
                if (tempGraph !== newGraph) {
                  newGraph = tempGraph;
                  newState = addLogEntry(newState, `Batch ${selectedRule} on ${randomTarget.id}`);
                }
              }
            }
          }
        }
      }
      
      newState = {
        ...newState,
        graph: newGraph
      };
      
      saveStateToStorage(newState);
      return newState;
    }
      
    case 'SET_TOKEN_FLOW': {
      const { start, end } = action;
      
      // Validate start and end nodes
      const startNode = state.graph.nodes.find(n => n.id === start && n.type === 'place');
      if (!startNode) {
        toast.error(`Start node ${start} is not a valid place`);
        return state;
      }
      
      const endNode = state.graph.nodes.find(n => n.id === end && n.type === 'place');
      if (!endNode) {
        toast.error(`End node ${end} is not a valid place`);
        return state;
      }
      
      let newState = pushHistory(state);
      const newGraph = {
        ...newState.graph,
        nodes: newState.graph.nodes.map(node => {
          if (node.type === 'place') {
            return { ...node, tokens: node.id === start ? 1 : 0 };
          }
          return node;
        })
      };
      
      newState = addLogEntry({
        ...newState,
        graph: newGraph
      }, `Flow start=${start},end=${end}`);
      
      saveStateToStorage(newState);
      return newState;
    }
      
    case 'START_SIMULATION': {
      // Find start node with tokens
      const startNode = state.graph.nodes.find(n => n.type === 'place' && n.tokens && n.tokens > 0);
      if (!startNode) {
        toast.error("No start node with tokens found");
        return state;
      }
      
      // Find path through the graph
      const outgoingEdges = state.graph.edges.filter(e => e.source === startNode.id);
      if (outgoingEdges.length === 0) {
        toast.error(`Start node ${startNode.id} has no outgoing edges`);
        return state;
      }
      
      const transition = outgoingEdges[0].target;
      const outgoingFromTransition = state.graph.edges.filter(e => e.source === transition);
      
      if (outgoingFromTransition.length === 0) {
        toast.error(`Transition ${transition} has no outgoing edges`);
        return state;
      }
      
      const targetPlace = outgoingFromTransition[0].target;
      
      return {
        ...state,
        simulationActive: true,
        animatingTokens: [
          { sourceId: startNode.id, targetId: targetPlace, progress: 0 }
        ]
      };
    }
      
    case 'STOP_SIMULATION': {
      // Instantly clear animation and highlight, reset simulation mode
      return {
        ...state,
        simulationActive: false,
        animatingTokens: []
      };
    }
      
    case 'UPDATE_TOKEN_ANIMATION': {
      return {
        ...state,
        animatingTokens: state.animatingTokens.map(token => ({
          ...token,
          progress: action.progress
        }))
      };
    }
      
    case 'COMPLETE_SIMULATION': {
      // Update token positions after animation
      const newGraph = { ...state.graph };
      
      state.animatingTokens.forEach(anim => {
        newGraph.nodes = newGraph.nodes.map(node => {
          if (node.id === anim.sourceId) {
            return { ...node, tokens: 0 };
          }
          if (node.id === anim.targetId) {
            return { ...node, tokens: (node.tokens || 0) + 1 };
          }
          return node;
        });
      });
      
      newState = addLogEntry({
        ...state,
        graph: newGraph,
        simulationActive: false,
        animatingTokens: []
      }, `Simulation completed`);
      
      saveStateToStorage(newState);
      return newState;
    }
    
    case 'CENTER_GRAPH': {
      // Dispatch custom event to center the graph
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('petrinetCenterGraph'));
      }
      return state;
    }
    
    case 'SET_EVENT_LOG': {
      newState = {
        ...state,
        eventLog: {
          paths: action.paths
        }
      };
      
      saveStateToStorage(newState);
      return newState;
    }
    
    case 'SAVE_PETRI_NET': {
      const id = generateId();
      const newSavedNet: SavedPetriNet = {
        id,
        name: action.name,
        timestamp: Date.now(),
        graph: state.graph,
        log: state.log,
        eventLog: state.eventLog
      };
      
      const updatedSavedNets = [...state.savedNets, newSavedNet];
      
      newState = {
        ...state,
        savedNets: updatedSavedNets,
        currentNetId: id
      };
      
      saveSavedNetsToStorage(updatedSavedNets);
      saveStateToStorage(newState);
      return newState;
    }
    
    case 'LOAD_PETRI_NET': {
      const netToLoad = state.savedNets.find(net => net.id === action.id);
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
        currentNetId: netToLoad.id
      };
      
      saveStateToStorage(newState);
      return newState;
    }
    
    case 'DELETE_PETRI_NET': {
      const updatedSavedNets = state.savedNets.filter(net => net.id !== action.id);
      
      newState = {
        ...state,
        savedNets: updatedSavedNets,
        currentNetId: state.currentNetId === action.id ? null : state.currentNetId
      };
      
      saveSavedNetsToStorage(updatedSavedNets);
      saveStateToStorage(newState);
      return newState;
    }
    
    case 'RENAME_PETRI_NET': {
      const updatedSavedNets = state.savedNets.map(net => 
        net.id === action.id ? { ...net, name: action.newName } : net
      );
      
      newState = {
        ...state,
        savedNets: updatedSavedNets
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
export const PetriNetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load the saved nets first
  const initialSavedNets = loadSavedNetsFromStorage();
  
  // Try to load the initial state from localStorage or use the default initial state
  const savedState = loadStateFromStorage();
  const initialState: PetriNetState = savedState || {
    graph: initialGraph(),
    log: [],
    history: [],
    simulationActive: false,
    animatingTokens: [],
    eventLog: { paths: [] },
    savedNets: initialSavedNets,
    currentNetId: null
  };

  // Ensure savedNets are loaded even if the main state was loaded
  if (savedState && !savedState.savedNets) {
    initialState.savedNets = initialSavedNets;
  }

  const [state, dispatch] = useReducer(petriNetReducer, initialState);
  
  // Animation effect for token movement
  useEffect(() => {
    if (state.simulationActive && state.animatingTokens.length > 0) {
      let animationFrame: number;
      let startTime: number | null = null;
      const animationDuration = 2000; // 2 seconds for animation
      
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        dispatch({ type: 'UPDATE_TOKEN_ANIMATION', progress });
        
        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          dispatch({ type: 'COMPLETE_SIMULATION' });
        }
      };
      
      animationFrame = requestAnimationFrame(animate);
      
      return () => {
        cancelAnimationFrame(animationFrame);
      };
    }
  }, [state.simulationActive, state.animatingTokens]);
  
  // Find all possible paths in the Petri net
  const generateAllPaths = async (graph: Graph): Promise<Path[]> => {
    // Find all place nodes that have no incoming edges (potential start points)
    const startPlaces = graph.nodes.filter(node => 
      node.type === 'place' && 
      !graph.edges.some(edge => edge.target === node.id)
    );
    
    // If no start places found, use places with tokens
    const places = startPlaces.length > 0 
      ? startPlaces 
      : graph.nodes.filter(node => node.type === 'place' && (node.tokens && node.tokens > 0));
      
    // If still no places, use the first place
    const startNodes = places.length > 0 
      ? places 
      : graph.nodes.filter(node => node.type === 'place').slice(0, 1);
      
    if (startNodes.length === 0) return [];
    
    const allPaths: Path[] = [];
    
    // For each start node, find all possible paths
    for (const startNode of startNodes) {
      const paths = findPathsFromNode(graph, startNode.id, []);
      allPaths.push(...paths);
    }
    
    return allPaths;
  };
  
  // Helper function to find paths from a node
  const findPathsFromNode = (graph: Graph, nodeId: string, visited: string[]): Path[] => {
    // Check if we've already visited this node to prevent cycles
    if (visited.includes(nodeId)) {
      return [];
    }
    
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return [];
    
    const newVisited = [...visited, nodeId];
    const outgoingEdges = graph.edges.filter(edge => edge.source === nodeId);
    
    // If no outgoing edges, this is a leaf node, return a path with just this node
    if (outgoingEdges.length === 0) {
      return [{
        sequence: newVisited.map(id => {
          const n = graph.nodes.find(n => n.id === id);
          return { id, type: n?.type || 'place' };
        })
      }];
    }
    
    const paths: Path[] = [];
    
    // For each outgoing edge, recursively find paths
    for (const edge of outgoingEdges) {
      const targetPaths = findPathsFromNode(graph, edge.target, newVisited);
      paths.push(...targetPaths);
    }
    
    return paths;
  };
  
  // Context value
  const value = {
    state,
    undo: () => dispatch({ type: 'UNDO' }),
    reset: () => dispatch({ type: 'RESET' }),
    addPlace: (id: string) => dispatch({ type: 'ADD_PLACE', id }),
    addTransition: (id: string) => dispatch({ type: 'ADD_TRANSITION', id }),
    connectNodes: (source: string, target: string) => 
      dispatch({ type: 'CONNECT_NODES', source, target }),
    applyRule: (rule: string, target: string, endNodeId?: string) => 
      dispatch({ type: 'APPLY_RULE', rule, target, endNodeId }),
    applyRandomRule: () => dispatch({ type: 'APPLY_RANDOM_RULE' }),
    generateBatch: (count: number, useRandom: boolean, selectedRules: string[], ruleWeights?: RuleWeight[]) => 
      dispatch({ type: 'GENERATE_BATCH', count, useRandom, selectedRules, ruleWeights }),
    setTokenFlow: (start: string, end: string) => 
      dispatch({ type: 'SET_TOKEN_FLOW', start, end }),
    startSimulation: () => dispatch({ type: 'START_SIMULATION' }),
    stopSimulation: () => dispatch({ type: 'STOP_SIMULATION' }),
    centerGraph: () => dispatch({ type: 'CENTER_GRAPH' }),
    downloadLog: () => {
      // Create CSV from log entries
      const headers = "ID,Timestamp,Action\n";
      const rows = state.log.map(entry => `${entry.id},"${entry.timestamp}","${entry.action}"`).join("\n");
      const csv = headers + rows;
      
      // Create and trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'petri_net_log.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    generateEventLog: async () => {
      try {
        const paths = await generateAllPaths(state.graph);
        dispatch({ type: 'SET_EVENT_LOG', paths });
        return Promise.resolve();
      } catch (error) {
        console.error("Error generating event log:", error);
        return Promise.reject(error);
      }
    },
    downloadEventLog: () => {
      // Create CSV from event log paths
      const headers = "Path ID,Sequence,Length,Start,End\n";
      const rows = state.eventLog.paths.map((path, index) => {
        const sequence = path.sequence.map(node => node.id).join(" → ");
        const length = path.sequence.length;
        const start = path.sequence[0]?.id || "N/A";
        const end = path.sequence[path.sequence.length - 1]?.id || "N/A";
        
        return `${index + 1},"${sequence}",${length},"${start}","${end}"`;
      }).join("\n");
      
      const csv = headers + rows;
      
      // Create and trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'petri_net_event_log.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    savePetriNet: (name: string) => dispatch({ type: 'SAVE_PETRI_NET', name }),
    loadPetriNet: (id: string) => dispatch({ type: 'LOAD_PETRI_NET', id }),
    deletePetriNet: (id: string) => dispatch({ type: 'DELETE_PETRI_NET', id }),
    renamePetriNet: (id: string, newName: string) => 
      dispatch({ type: 'RENAME_PETRI_NET', id, newName }),
    savedNets: state.savedNets
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
    throw new Error('usePetriNet must be used within a PetriNetProvider');
  }
  return context;
};
