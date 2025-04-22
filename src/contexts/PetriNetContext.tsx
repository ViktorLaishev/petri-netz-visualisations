
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
  | { type: 'SET_TOKEN_FLOW'; start: string; end: string }
  | { type: 'START_SIMULATION' }
  | { type: 'UPDATE_TOKEN_ANIMATION'; progress: number }
  | { type: 'COMPLETE_SIMULATION' };

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
        ...state,
        graph: initialGraph(),
        log: [],
        history: [...state.history, { graph: state.graph, log: state.log }]
      };
      
    case 'ADD_PLACE': {
      const newGraph = { ...state.graph };
      newGraph.nodes = [...newGraph.nodes, { id: action.id, type: 'place', tokens: 0 }];
      return {
        ...state,
        graph: newGraph,
        history: [...state.history, { graph: state.graph, log: state.log }],
        log: [...state.log, {
          id: state.log.length + 1,
          timestamp: new Date().toISOString(),
          action: `Added place ${action.id}`
        }]
      };
    }
      
    case 'ADD_TRANSITION': {
      const newGraph = { ...state.graph };
      newGraph.nodes = [...newGraph.nodes, { id: action.id, type: 'transition' }];
      return {
        ...state,
        graph: newGraph,
        history: [...state.history, { graph: state.graph, log: state.log }],
        log: [...state.log, {
          id: state.log.length + 1,
          timestamp: new Date().toISOString(),
          action: `Added transition ${action.id}`
        }]
      };
    }
      
    case 'CONNECT_NODES': {
      const newGraph = { ...state.graph };
      newGraph.edges = [...newGraph.edges, { source: action.source, target: action.target }];
      return {
        ...state,
        graph: newGraph,
        history: [...state.history, { graph: state.graph, log: state.log }],
        log: [...state.log, {
          id: state.log.length + 1,
          timestamp: new Date().toISOString(),
          action: `Connected ${action.source}->${action.target}`
        }]
      };
    }
      
    case 'SET_TOKEN_FLOW': {
      const newGraph = { ...state.graph };
      newGraph.nodes = newGraph.nodes.map(node => {
        if (node.type === 'place') {
          return { ...node, tokens: node.id === action.start ? 1 : 0 };
        }
        return node;
      });
      
      return {
        ...state,
        graph: newGraph,
        history: [...state.history, { graph: state.graph, log: state.log }],
        log: [...state.log, {
          id: state.log.length + 1,
          timestamp: new Date().toISOString(),
          action: `Flow start=${action.start},end=${action.end}`
        }]
      };
    }
      
    case 'START_SIMULATION': {
      // Find start node with tokens
      const startNode = state.graph.nodes.find(n => n.type === 'place' && n.tokens && n.tokens > 0);
      if (!startNode) return state;
      
      // Find path through the graph (simplified)
      const connectedTransition = state.graph.edges.find(e => e.source === startNode.id)?.target;
      if (!connectedTransition) return state;
      
      const endNode = state.graph.edges.find(e => e.source === connectedTransition)?.target;
      if (!endNode) return state;
      
      return {
        ...state,
        simulationActive: true,
        animatingTokens: [
          { sourceId: startNode.id, targetId: endNode, progress: 0 }
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
      
      return {
        ...state,
        graph: newGraph,
        simulationActive: false,
        animatingTokens: [],
        log: [...state.log, {
          id: state.log.length + 1,
          timestamp: new Date().toISOString(),
          action: `Simulation completed`
        }]
      };
    }
      
    case 'APPLY_RULE':
      // Placeholder for rule application logic
      // Would implement abstraction_rule, linear_transition_rule, etc. here
      toast.info(`Applied ${action.rule} on ${action.target}`);
      return state;
      
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
    applyRandomRule: () => {
      // Placeholder for random rule application
      toast.info('Applied random rule');
    },
    generateBatch: (count: number, useRandom: boolean, selectedRules: string[]) => {
      // Placeholder for batch generation
      toast.info(`Generated batch with ${count} rules`);
    },
    setTokenFlow: (start: string, end: string) => 
      dispatch({ type: 'SET_TOKEN_FLOW', start, end }),
    startSimulation: () => {
      dispatch({ type: 'START_SIMULATION' });
      toast.success('Simulation started');
    },
    centerGraph: () => {
      toast.info('Graph centered');
    },
    downloadLog: () => {
      // Placeholder for CSV download
      toast.info('Log downloaded');
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
