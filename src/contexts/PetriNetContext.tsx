
import React, { createContext, useContext, useState, useReducer, useEffect, ReactNode } from "react";
import { toast } from "sonner";

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
}

interface PetriNetContextType {
  state: PetriNetState;
  undo: () => void;
  reset: () => void;
  addPlace: (id: string) => void;
  addTransition: (id: string) => void;
  connectNodes: (source: string, target: string) => void;
  applyRule: (rule: string, target: string) => void;
  applyRandomRule: () => void;
  generateBatch: (count: number, useRandom: boolean, selectedRules: string[]) => void;
  setTokenFlow: (start: string, end: string) => void;
  startSimulation: () => void;
  centerGraph: () => void;
  downloadLog: () => void;
}

// Create context
const PetriNetContext = createContext<PetriNetContextType | undefined>(undefined);

// Rule implementations
const applyAbstractionRule = (graph: Graph, targetId: string): Graph => {
  // Implementation of abstraction rule
  const newGraph = { ...graph };
  const placeId = `P${newGraph.nodes.filter(n => n.type === 'place').length}`;
  const transId = `T${newGraph.nodes.filter(n => n.type === 'transition').length}`;
  
  // Add new nodes
  newGraph.nodes = [...newGraph.nodes, 
    { id: placeId, type: 'place', tokens: 0 },
    { id: transId, type: 'transition' }
  ];
  
  // Find outputs of target transition
  const outputs = newGraph.edges
    .filter(e => e.source === targetId)
    .map(e => e.target);
  
  // Remove edges from target to its outputs
  newGraph.edges = newGraph.edges.filter(e => !(e.source === targetId && outputs.includes(e.target)));
  
  // Add edges for the abstraction pattern
  newGraph.edges = [...newGraph.edges,
    { source: targetId, target: placeId },
    { source: placeId, target: transId },
    ...outputs.map(output => ({ source: transId, target: output }))
  ];
  
  return newGraph;
};

const applyLinearTransitionRule = (graph: Graph, targetId: string): Graph => {
  // Implementation of linear transition rule
  const newGraph = { ...graph };
  const transId = `T${newGraph.nodes.filter(n => n.type === 'transition').length}`;
  
  // Add new transition
  newGraph.nodes = [...newGraph.nodes, { id: transId, type: 'transition' }];
  
  // Connect target place to new transition
  newGraph.edges = [...newGraph.edges, { source: targetId, target: transId }];
  
  // Find all output places via existing transitions
  const transitions = newGraph.edges
    .filter(e => e.source === targetId)
    .map(e => e.target);
  
  const outputPlaces = new Set<string>();
  transitions.forEach(transId => {
    newGraph.edges
      .filter(e => e.source === transId && newGraph.nodes.find(n => n.id === e.target)?.type === 'place')
      .forEach(e => outputPlaces.add(e.target));
  });
  
  // Connect new transition to all output places
  outputPlaces.forEach(placeId => {
    newGraph.edges = [...newGraph.edges, { source: transId, target: placeId }];
  });
  
  return newGraph;
};

const applyLinearPlaceRule = (graph: Graph, targetId: string): Graph => {
  // Implementation of linear place rule
  const newGraph = { ...graph };
  const placeId = `P${newGraph.nodes.filter(n => n.type === 'place').length}`;
  
  // Add new place
  newGraph.nodes = [...newGraph.nodes, { id: placeId, type: 'place', tokens: 0 }];
  
  // Find inputs to target transition
  const inputs = newGraph.edges
    .filter(e => e.target === targetId && newGraph.nodes.find(n => n.id === e.source)?.type === 'place')
    .map(e => e.source);
  
  // Remove direct connections from input places to target
  newGraph.edges = newGraph.edges.filter(e => !(inputs.includes(e.source) && e.target === targetId));
  
  // Connect inputs to new place and new place to target
  inputs.forEach(inputId => {
    newGraph.edges = [...newGraph.edges, { source: inputId, target: placeId }];
  });
  
  newGraph.edges = [...newGraph.edges, { source: placeId, target: targetId }];
  
  return newGraph;
};

const applyDualAbstractionRule = (graph: Graph, targetId: string): Graph => {
  // First apply abstraction, then linear transition
  let newGraph = applyAbstractionRule(graph, targetId);
  const newPlace = newGraph.nodes.filter(n => n.type === 'place').pop()?.id;
  
  if (newPlace) {
    newGraph = applyLinearTransitionRule(newGraph, newPlace);
  }
  
  return newGraph;
};

// Map rules to their implementations
const rulesMap: Record<string, { fn: (graph: Graph, targetId: string) => Graph, targetType: NodeType }> = {
  'Abstraction ψA': { fn: applyAbstractionRule, targetType: 'transition' },
  'Linear Transition ψT': { fn: applyLinearTransitionRule, targetType: 'place' },
  'Linear Place ψP': { fn: applyLinearPlaceRule, targetType: 'transition' },
  'Dual Abstraction ψD': { fn: applyDualAbstractionRule, targetType: 'transition' },
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
  | { type: 'APPLY_RULE'; rule: string; target: string }
  | { type: 'APPLY_RANDOM_RULE' }
  | { type: 'GENERATE_BATCH'; count: number; useRandom: boolean; selectedRules: string[] }
  | { type: 'SET_TOKEN_FLOW'; start: string; end: string }
  | { type: 'START_SIMULATION' }
  | { type: 'UPDATE_TOKEN_ANIMATION'; progress: number }
  | { type: 'COMPLETE_SIMULATION' }
  | { type: 'CENTER_GRAPH' };

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

// Reducer function
const petriNetReducer = (state: PetriNetState, action: ActionType): PetriNetState => {
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
      return {
        ...pushHistory(state),
        graph: initialGraph(),
        log: [],
      };
      
    case 'ADD_PLACE': {
      // Check if place already exists
      if (state.graph.nodes.some(n => n.id === action.id)) {
        toast.error(`Place ${action.id} already exists`);
        return state;
      }
      
      const newState = pushHistory(state);
      const newGraph = {
        ...newState.graph,
        nodes: [...newState.graph.nodes, { id: action.id, type: 'place', tokens: 0 }]
      };
      
      return addLogEntry({
        ...newState,
        graph: newGraph
      }, `Added place ${action.id}`);
    }
      
    case 'ADD_TRANSITION': {
      // Check if transition already exists
      if (state.graph.nodes.some(n => n.id === action.id)) {
        toast.error(`Transition ${action.id} already exists`);
        return state;
      }
      
      const newState = pushHistory(state);
      const newGraph = {
        ...newState.graph,
        nodes: [...newState.graph.nodes, { id: action.id, type: 'transition' }]
      };
      
      return addLogEntry({
        ...newState,
        graph: newGraph
      }, `Added transition ${action.id}`);
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
      
      const newState = pushHistory(state);
      const newGraph = {
        ...newState.graph,
        edges: [...newState.graph.edges, { source: action.source, target: action.target }]
      };
      
      return addLogEntry({
        ...newState,
        graph: newGraph
      }, `Connected ${action.source}->${action.target}`);
    }
      
    case 'APPLY_RULE': {
      const { rule, target } = action;
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
      
      const newState = pushHistory(state);
      const newGraph = ruleInfo.fn(newState.graph, target);
      
      return addLogEntry({
        ...newState,
        graph: newGraph
      }, `Applied ${rule} on ${target}`);
    }
    
    case 'APPLY_RANDOM_RULE': {
      // Select a random rule
      const ruleNames = Object.keys(rulesMap);
      const randomRule = ruleNames[Math.floor(Math.random() * ruleNames.length)];
      const ruleInfo = rulesMap[randomRule];
      
      // Find valid targets for this rule
      const validTargets = state.graph.nodes.filter(n => n.type === ruleInfo.targetType);
      
      if (validTargets.length === 0) {
        toast.error(`No valid targets for rule ${randomRule}`);
        return state;
      }
      
      // Select a random target
      const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
      
      const newState = pushHistory(state);
      const newGraph = ruleInfo.fn(newState.graph, randomTarget.id);
      
      return addLogEntry({
        ...newState,
        graph: newGraph
      }, `Random ${randomRule} on ${randomTarget.id}`);
    }
      
    case 'GENERATE_BATCH': {
      const { count, useRandom, selectedRules } = action;
      let newState = pushHistory(state);
      let newGraph = { ...newState.graph };
      
      for (let i = 0; i < count; i++) {
        if (useRandom) {
          // Apply random rule
          const ruleNames = Object.keys(rulesMap);
          const randomRule = ruleNames[Math.floor(Math.random() * ruleNames.length)];
          const ruleInfo = rulesMap[randomRule];
          
          // Find valid targets
          const validTargets = newGraph.nodes.filter(n => n.type === ruleInfo.targetType);
          
          if (validTargets.length > 0) {
            const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
            newGraph = ruleInfo.fn(newGraph, randomTarget.id);
            newState = addLogEntry(newState, `Batch random ${randomRule} on ${randomTarget.id}`);
          }
        } else if (selectedRules.length > 0) {
          // Apply selected rules
          const randomRuleIdx = Math.floor(Math.random() * selectedRules.length);
          const selectedRule = selectedRules[randomRuleIdx];
          const ruleInfo = rulesMap[selectedRule];
          
          if (ruleInfo) {
            const validTargets = newGraph.nodes.filter(n => n.type === ruleInfo.targetType);
            
            if (validTargets.length > 0) {
              const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
              newGraph = ruleInfo.fn(newGraph, randomTarget.id);
              newState = addLogEntry(newState, `Batch ${selectedRule} on ${randomTarget.id}`);
            }
          }
        }
      }
      
      return {
        ...newState,
        graph: newGraph
      };
    }
      
    case 'SET_TOKEN_FLOW': {
      const { start, end } = action;
      
      // Validate start and end nodes
      const startNode = state.graph.nodes.find(n => n.id === start);
      const endNode = state.graph.nodes.find(n => n.id === end);
      
      if (!startNode || startNode.type !== 'place') {
        toast.error(`Start node ${start} is not a valid place`);
        return state;
      }
      
      if (!endNode || endNode.type !== 'place') {
        toast.error(`End node ${end} is not a valid place`);
        return state;
      }
      
      const newState = pushHistory(state);
      const newGraph = {
        ...newState.graph,
        nodes: newState.graph.nodes.map(node => {
          if (node.type === 'place') {
            return { ...node, tokens: node.id === start ? 1 : 0 };
          }
          return node;
        })
      };
      
      return addLogEntry({
        ...newState,
        graph: newGraph
      }, `Flow start=${start},end=${end}`);
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
      
      return addLogEntry({
        ...state,
        graph: newGraph,
        simulationActive: false,
        animatingTokens: []
      }, `Simulation completed`);
    }
    
    case 'CENTER_GRAPH': {
      return state; // Actual centering is handled in the component
    }
      
    default:
      return state;
  }
};

// Provider component
export const PetriNetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(petriNetReducer, {
    graph: initialGraph(),
    log: [],
    history: [],
    simulationActive: false,
    animatingTokens: []
  });
  
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
  
  // Context value
  const value = {
    state,
    undo: () => dispatch({ type: 'UNDO' }),
    reset: () => dispatch({ type: 'RESET' }),
    addPlace: (id: string) => dispatch({ type: 'ADD_PLACE', id }),
    addTransition: (id: string) => dispatch({ type: 'ADD_TRANSITION', id }),
    connectNodes: (source: string, target: string) => 
      dispatch({ type: 'CONNECT_NODES', source, target }),
    applyRule: (rule: string, target: string) => 
      dispatch({ type: 'APPLY_RULE', rule, target }),
    applyRandomRule: () => dispatch({ type: 'APPLY_RANDOM_RULE' }),
    generateBatch: (count: number, useRandom: boolean, selectedRules: string[]) => 
      dispatch({ type: 'GENERATE_BATCH', count, useRandom, selectedRules }),
    setTokenFlow: (start: string, end: string) => 
      dispatch({ type: 'SET_TOKEN_FLOW', start, end }),
    startSimulation: () => dispatch({ type: 'START_SIMULATION' }),
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
    }
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
