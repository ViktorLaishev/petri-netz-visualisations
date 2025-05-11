
import { PetriNetState, PetriNetAction, Graph } from "@/types/PetriNet";
import { v4 as uuidv4 } from "uuid";

// Define the initial state
export const initialState: PetriNetState = {
  graph: {
    nodes: [],
    edges: []
  },
  history: [{ graph: { nodes: [], edges: [] } }],
  currentHistoryIndex: 0,
  log: [],
  simulationActive: false,
  animatingTokens: [],
  tokenFlowPath: {
    startPlaceId: null,
    endPlaceId: null
  },
  savedNets: []
};

// Helper function to create a deep copy of the graph
const deepCopyGraph = (graph: Graph): Graph => {
  return {
    nodes: JSON.parse(JSON.stringify(graph.nodes)),
    edges: JSON.parse(JSON.stringify(graph.edges))
  };
};

// Handle loading historical state
export const handleLoadHistoricalState = (state: PetriNetState, action: PetriNetAction): PetriNetState => {
  if (action.type !== "LOAD_HISTORICAL_STATE") return state;
  
  return {
    ...state,
    graph: action.payload.graph,
    currentHistoryIndex: action.payload.historyIndex
  };
};

// Petri Net Reducer
export const petriNetReducer = (state: PetriNetState, action: PetriNetAction): PetriNetState => {
  switch (action.type) {
    case "ADD_NODE": {
      const newGraph = deepCopyGraph(state.graph);
      newGraph.nodes.push(action.payload);
      
      // Add to history
      const newHistory = state.history.slice(0, state.currentHistoryIndex + 1);
      newHistory.push({ graph: newGraph });
      
      return {
        ...state,
        graph: newGraph,
        history: newHistory,
        currentHistoryIndex: newHistory.length - 1
      };
    }
    
    case "ADD_EDGE": {
      const newGraph = deepCopyGraph(state.graph);
      newGraph.edges.push(action.payload);
      
      // Add to history
      const newHistory = state.history.slice(0, state.currentHistoryIndex + 1);
      newHistory.push({ graph: newGraph });
      
      return {
        ...state,
        graph: newGraph,
        history: newHistory,
        currentHistoryIndex: newHistory.length - 1
      };
    }
    
    case "UPDATE_TOKENS": {
      const newGraph = deepCopyGraph(state.graph);
      const placeIndex = newGraph.nodes.findIndex(
        node => node.id === action.payload.placeId && node.type === "place"
      );
      
      if (placeIndex !== -1) {
        newGraph.nodes[placeIndex] = {
          ...newGraph.nodes[placeIndex],
          tokens: action.payload.tokens
        };
      }
      
      // Add to history
      const newHistory = state.history.slice(0, state.currentHistoryIndex + 1);
      newHistory.push({ graph: newGraph });
      
      return {
        ...state,
        graph: newGraph,
        history: newHistory,
        currentHistoryIndex: newHistory.length - 1
      };
    }
    
    case "APPLY_RULE": {
      const newGraph = deepCopyGraph(state.graph);
      
      // Add new nodes
      action.payload.newNodes.forEach(node => {
        newGraph.nodes.push(node);
      });
      
      // Add new edges
      action.payload.newEdges.forEach(edge => {
        newGraph.edges.push(edge);
      });
      
      // Add to history
      const newHistory = state.history.slice(0, state.currentHistoryIndex + 1);
      newHistory.push({ graph: newGraph });
      
      return {
        ...state,
        graph: newGraph,
        history: newHistory,
        currentHistoryIndex: newHistory.length - 1
      };
    }
    
    case "SET_TOKEN_FLOW": {
      return {
        ...state,
        tokenFlowPath: {
          startPlaceId: action.payload.startPlaceId,
          endPlaceId: action.payload.endPlaceId
        }
      };
    }
    
    case "START_SIMULATION": {
      return {
        ...state,
        simulationActive: true
      };
    }
    
    case "STOP_SIMULATION": {
      return {
        ...state,
        simulationActive: false,
        animatingTokens: []
      };
    }
    
    case "UPDATE_TOKEN_ANIMATION": {
      // Update token animation logic
      // This would be more complex in a real implementation
      return {
        ...state,
        animatingTokens: state.animatingTokens.map(token => ({
          ...token,
          progress: Math.min(1, token.progress + token.speed * action.payload.deltaTime / 1000)
        })).filter(token => token.progress < 1)
      };
    }
    
    case "ADD_LOG_ENTRY": {
      return {
        ...state,
        log: [...state.log, action.payload]
      };
    }
    
    case "UNDO": {
      if (state.currentHistoryIndex <= 0) return state;
      
      const newIndex = state.currentHistoryIndex - 1;
      return {
        ...state,
        graph: deepCopyGraph(state.history[newIndex].graph),
        currentHistoryIndex: newIndex
      };
    }
    
    case "RESET": {
      return {
        ...initialState,
        savedNets: state.savedNets,
        log: [
          ...state.log,
          {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            action: "Reset to initial state"
          }
        ]
      };
    }
    
    case "LOAD_HISTORICAL_STATE": {
      return handleLoadHistoricalState(state, action);
    }
    
    case "LOAD_SAVED_NETS": {
      return {
        ...state,
        savedNets: action.payload
      };
    }
    
    case "SAVE_PETRI_NET": {
      const newSavedNet = {
        id: uuidv4(),
        name: action.payload.name,
        graph: deepCopyGraph(state.graph),
        timestamp: new Date().toISOString()
      };
      
      return {
        ...state,
        savedNets: [...state.savedNets, newSavedNet]
      };
    }
    
    case "LOAD_PETRI_NET": {
      const savedNet = state.savedNets.find(net => net.id === action.payload);
      
      if (!savedNet) return state;
      
      const newGraph = deepCopyGraph(savedNet.graph);
      
      // Add to history
      const newHistory = [{ graph: newGraph }];
      
      return {
        ...state,
        graph: newGraph,
        history: newHistory,
        currentHistoryIndex: 0
      };
    }
    
    case "DELETE_PETRI_NET": {
      return {
        ...state,
        savedNets: state.savedNets.filter(net => net.id !== action.payload)
      };
    }
    
    case "RENAME_PETRI_NET": {
      return {
        ...state,
        savedNets: state.savedNets.map(net => 
          net.id === action.payload.id 
            ? { ...net, name: action.payload.name } 
            : net
        )
      };
    }
    
    default:
      return state;
  }
};
