import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { petriNetReducer, initialState, handleLoadHistoricalState } from "@/reducers/PetriNetReducer";
import { PetriNetState, PetriNetAction, Node, Edge } from "@/types/PetriNet";

interface PetriNetContextType {
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
}

const PetriNetContext = createContext<PetriNetContextType | undefined>(undefined);

export const usePetriNet = () => {
  const context = useContext(PetriNetContext);
  if (!context) {
    throw new Error("usePetriNet must be used within a PetriNetProvider");
  }
  return context;
};

export const PetriNetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(petriNetReducer, initialState);
  
  // Load saved nets from localStorage on initial render
  useEffect(() => {
    const savedNets = localStorage.getItem("petriNets");
    if (savedNets) {
      dispatch({
        type: "LOAD_SAVED_NETS",
        payload: JSON.parse(savedNets)
      });
    }
  }, []);
  
  // Save nets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("petriNets", JSON.stringify(state.savedNets));
  }, [state.savedNets]);
  
  // Animation loop for token movement
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp: number;
    
    const animate = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const deltaTime = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      
      if (state.simulationActive && state.animatingTokens.length > 0) {
        // Update token positions
        dispatch({
          type: "UPDATE_TOKEN_ANIMATION",
          payload: { deltaTime }
        });
        
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    if (state.simulationActive && state.animatingTokens.length > 0) {
      animationFrameId = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [state.simulationActive, state.animatingTokens]);
  
  // Helper function to add a log entry
  const addLogEntry = useCallback((action: string) => {
    dispatch({
      type: "ADD_LOG_ENTRY",
      payload: {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        action
      }
    });
  }, []);
  
  // Add a place to the graph
  const addPlace = useCallback((id: string) => {
    if (state.graph.nodes.some(node => node.id === id)) {
      console.error(`Place with ID ${id} already exists`);
      return;
    }
    
    dispatch({
      type: "ADD_NODE",
      payload: {
        id,
        type: "place",
        tokens: 0
      }
    });
    
    addLogEntry(`Added place: ${id}`);
  }, [state.graph.nodes, addLogEntry]);
  
  // Add a transition to the graph
  const addTransition = useCallback((id: string) => {
    if (state.graph.nodes.some(node => node.id === id)) {
      console.error(`Transition with ID ${id} already exists`);
      return;
    }
    
    dispatch({
      type: "ADD_NODE",
      payload: {
        id,
        type: "transition"
      }
    });
    
    addLogEntry(`Added transition: ${id}`);
  }, [state.graph.nodes, addLogEntry]);
  
  // Connect two nodes with an edge
  const connectNodes = useCallback((source: string, target: string) => {
    // Check if nodes exist
    const sourceNode = state.graph.nodes.find(node => node.id === source);
    const targetNode = state.graph.nodes.find(node => node.id === target);
    
    if (!sourceNode || !targetNode) {
      console.error("Source or target node not found");
      return;
    }
    
    // Check if edge already exists
    if (state.graph.edges.some(edge => edge.source === source && edge.target === target)) {
      console.error(`Edge from ${source} to ${target} already exists`);
      return;
    }
    
    // Check if connecting same type of nodes (place-place or transition-transition)
    if (sourceNode.type === targetNode.type) {
      console.error(`Cannot connect ${sourceNode.type} to ${targetNode.type}`);
      return;
    }
    
    dispatch({
      type: "ADD_EDGE",
      payload: {
        source,
        target
      }
    });
    
    addLogEntry(`Connected ${source} to ${target}`);
  }, [state.graph.nodes, state.graph.edges, addLogEntry]);
  
  // Add a token to a place
  const addToken = useCallback((placeId: string) => {
    const place = state.graph.nodes.find(node => node.id === placeId && node.type === "place");
    
    if (!place) {
      console.error(`Place ${placeId} not found`);
      return;
    }
    
    dispatch({
      type: "UPDATE_TOKENS",
      payload: {
        placeId,
        tokens: (place.tokens || 0) + 1
      }
    });
    
    addLogEntry(`Added token to ${placeId}`);
  }, [state.graph.nodes, addLogEntry]);
  
  // Remove a token from a place
  const removeToken = useCallback((placeId: string) => {
    const place = state.graph.nodes.find(node => node.id === placeId && node.type === "place");
    
    if (!place) {
      console.error(`Place ${placeId} not found`);
      return;
    }
    
    if (!place.tokens || place.tokens <= 0) {
      console.error(`Place ${placeId} has no tokens to remove`);
      return;
    }
    
    dispatch({
      type: "UPDATE_TOKENS",
      payload: {
        placeId,
        tokens: place.tokens - 1
      }
    });
    
    addLogEntry(`Removed token from ${placeId}`);
  }, [state.graph.nodes, addLogEntry]);
  
  // Apply a rule to the graph
  const applyRule = useCallback((rule: string, targetId: string, endNodeId?: string) => {
    const targetNode = state.graph.nodes.find(node => node.id === targetId);
    
    if (!targetNode) {
      console.error(`Target node ${targetId} not found`);
      return;
    }
    
    // Check if endNode exists when provided
    if (endNodeId) {
      const endNode = state.graph.nodes.find(node => node.id === endNodeId);
      if (!endNode) {
        console.error(`End node ${endNodeId} not found`);
        return;
      }
    }
    
    let newNodes: Node[] = [];
    let newEdges: Edge[] = [];
    
    // Apply the selected rule
    switch (rule) {
      case "Abstraction ψA": {
        // Abstraction rule applies to transitions
        if (targetNode.type !== "transition") {
          console.error("Abstraction rule can only be applied to transitions");
          return;
        }
        
        // Find incoming and outgoing edges
        const incomingEdges = state.graph.edges.filter(edge => edge.target === targetId);
        const outgoingEdges = state.graph.edges.filter(edge => edge.source === targetId);
        
        // Create new place
        const newPlaceId = `p${state.graph.nodes.length + 1}`;
        newNodes.push({
          id: newPlaceId,
          type: "place",
          tokens: 0
        });
        
        // Connect incoming places to new place
        incomingEdges.forEach(edge => {
          newEdges.push({
            source: edge.source,
            target: newPlaceId
          });
        });
        
        // Connect new place to outgoing places
        outgoingEdges.forEach(edge => {
          newEdges.push({
            source: newPlaceId,
            target: edge.target
          });
        });
        
        break;
      }
      
      case "Linear Transition ψT": {
        // Linear Transition rule applies to places
        if (targetNode.type !== "place") {
          console.error("Linear Transition rule can only be applied to places");
          return;
        }
        
        // Find outgoing edges
        const outgoingEdges = state.graph.edges.filter(edge => edge.source === targetId);
        
        if (outgoingEdges.length === 0) {
          console.error("Place must have at least one outgoing transition");
          return;
        }
        
        // Create new transition and place
        const newTransitionId = `t${state.graph.nodes.length + 1}`;
        const newPlaceId = endNodeId || `p${state.graph.nodes.length + 2}`;
        
        // If endNodeId is provided, check if it's a place
        if (endNodeId) {
          const endNode = state.graph.nodes.find(node => node.id === endNodeId);
          if (endNode?.type !== "place") {
            console.error("End node must be a place for Linear Transition rule");
            return;
          }
        } else {
          // Only add new place if we're not using an existing end node
          newNodes.push({
            id: newPlaceId,
            type: "place",
            tokens: 0
          });
        }
        
        // Add new transition
        newNodes.push({
          id: newTransitionId,
          type: "transition"
        });
        
        // Connect source place to new transition
        newEdges.push({
          source: targetId,
          target: newTransitionId
        });
        
        // Connect new transition to new place
        newEdges.push({
          source: newTransitionId,
          target: newPlaceId
        });
        
        break;
      }
      
      case "Linear Place ψP": {
        // Linear Place rule applies to transitions
        if (targetNode.type !== "transition") {
          console.error("Linear Place rule can only be applied to transitions");
          return;
        }
        
        // Find incoming edges
        const incomingEdges = state.graph.edges.filter(edge => edge.target === targetId);
        
        if (incomingEdges.length === 0) {
          console.error("Transition must have at least one incoming place");
          return;
        }
        
        // Create new place and transition
        const newPlaceId = `p${state.graph.nodes.length + 1}`;
        const newTransitionId = `t${state.graph.nodes.length + 2}`;
        
        newNodes.push({
          id: newPlaceId,
          type: "place",
          tokens: 0
        });
        
        newNodes.push({
          id: newTransitionId,
          type: "transition"
        });
        
        // Connect new place to new transition
        newEdges.push({
          source: newPlaceId,
          target: newTransitionId
        });
        
        // Connect new transition to target transition's outgoing places
        const outgoingEdges = state.graph.edges.filter(edge => edge.source === targetId);
        outgoingEdges.forEach(edge => {
          newEdges.push({
            source: newTransitionId,
            target: edge.target
          });
        });
        
        break;
      }
      
      case "Dual Abstraction ψD": {
        // Dual Abstraction rule applies to transitions
        if (targetNode.type !== "transition") {
          console.error("Dual Abstraction rule can only be applied to transitions");
          return;
        }
        
        // Find incoming and outgoing edges
        const incomingEdges = state.graph.edges.filter(edge => edge.target === targetId);
        const outgoingEdges = state.graph.edges.filter(edge => edge.source === targetId);
        
        if (incomingEdges.length === 0 || outgoingEdges.length === 0) {
          console.error("Transition must have at least one incoming and one outgoing edge");
          return;
        }
        
        // Create new transition or use provided end node
        const newTransitionId = endNodeId || `t${state.graph.nodes.length + 1}`;
        
        // If endNodeId is provided, check if it's a transition
        if (endNodeId) {
          const endNode = state.graph.nodes.find(node => node.id === endNodeId);
          if (endNode?.type !== "transition") {
            console.error("End node must be a transition for Dual Abstraction rule");
            return;
          }
        } else {
          // Only add new transition if we're not using an existing end node
          newNodes.push({
            id: newTransitionId,
            type: "transition"
          });
        }
        
        // Connect incoming places to new transition
        incomingEdges.forEach(edge => {
          newEdges.push({
            source: edge.source,
            target: newTransitionId
          });
        });
        
        // Connect target transition to outgoing places
        outgoingEdges.forEach(edge => {
          if (!endNodeId) {
            // Only add these edges if we're not using an existing end node
            newEdges.push({
              source: newTransitionId,
              target: edge.target
            });
          }
        });
        
        break;
      }
      
      default:
        console.error(`Unknown rule: ${rule}`);
        return;
    }
    
    dispatch({
      type: "APPLY_RULE",
      payload: {
        newNodes,
        newEdges
      }
    });
    
    addLogEntry(`Applied ${rule} to ${targetId}${endNodeId ? ` with end node ${endNodeId}` : ''}`);
  }, [state.graph.nodes, state.graph.edges, addLogEntry]);
  
  // Apply a random rule to the graph
  const applyRandomRule = useCallback(() => {
    const rules = ["Abstraction ψA", "Linear Transition ψT", "Linear Place ψP", "Dual Abstraction ψD"];
    const randomRule = rules[Math.floor(Math.random() * rules.length)];
    
    // Find valid targets for the selected rule
    let validTargets: Node[] = [];
    
    switch (randomRule) {
      case "Abstraction ψA":
      case "Linear Place ψP":
      case "Dual Abstraction ψD":
        validTargets = state.graph.nodes.filter(node => node.type === "transition");
        break;
      case "Linear Transition ψT":
        validTargets = state.graph.nodes.filter(node => node.type === "place");
        break;
    }
    
    if (validTargets.length === 0) {
      console.error(`No valid targets for ${randomRule}`);
      return;
    }
    
    const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
    applyRule(randomRule, randomTarget.id);
  }, [state.graph.nodes, applyRule]);
  
  // Set token flow from start place to end place
  const setTokenFlow = useCallback((startPlaceId: string, endPlaceId: string) => {
    const startPlace = state.graph.nodes.find(node => node.id === startPlaceId && node.type === "place");
    const endPlace = state.graph.nodes.find(node => node.id === endPlaceId && node.type === "place");
    
    if (!startPlace || !endPlace) {
      console.error("Start or end place not found");
      return;
    }
    
    dispatch({
      type: "SET_TOKEN_FLOW",
      payload: {
        startPlaceId,
        endPlaceId
      }
    });
    
    // Add token to start place if it doesn't have any
    if (!startPlace.tokens || startPlace.tokens === 0) {
      dispatch({
        type: "UPDATE_TOKENS",
        payload: {
          placeId: startPlaceId,
          tokens: 1
        }
      });
    }
    
    addLogEntry(`Set token flow from ${startPlaceId} to ${endPlaceId}`);
  }, [state.graph.nodes, addLogEntry]);
  
  // Start simulation
  const startSimulation = useCallback(() => {
    if (state.simulationActive) {
      return; // Already running
    }
    
    dispatch({ type: "START_SIMULATION" });
    addLogEntry("Started simulation");
  }, [state.simulationActive, addLogEntry]);
  
  // Stop simulation
  const stopSimulation = useCallback(() => {
    if (!state.simulationActive) {
      return; // Already stopped
    }
    
    dispatch({ type: "STOP_SIMULATION" });
    addLogEntry("Stopped simulation");
  }, [state.simulationActive, addLogEntry]);
  
  // Undo last action
  const undo = useCallback(() => {
    if (state.history.length <= 1) {
      console.error("Nothing to undo");
      return;
    }
    
    dispatch({ type: "UNDO" });
    addLogEntry("Undid last action");
  }, [state.history.length, addLogEntry]);
  
  // Reset to initial state
  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    addLogEntry("Reset to initial state");
  }, [addLogEntry]);
  
  // Center the graph
  const centerGraph = useCallback(() => {
    // Dispatch a custom event that the graph component will listen for
    window.dispatchEvent(new CustomEvent("petrinetCenterGraph"));
  }, []);
  
  // Download log as CSV
  const downloadLog = useCallback(() => {
    if (state.log.length === 0) {
      console.error("No log entries to download");
      return;
    }
    
    // Create CSV content
    const headers = ["ID", "Timestamp", "Action"];
    const rows = state.log.map(entry => [
      entry.id,
      new Date(entry.timestamp).toLocaleString(),
      entry.action
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `petri-net-log-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [state.log]);
  
  // Generate a batch of rules
  const generateBatch = useCallback((
    count: number, 
    useRandom: boolean, 
    selectedRules?: string[], 
    ruleWeights?: { rule: string; weight: number }[]
  ) => {
    if (count <= 0) {
      console.error("Count must be positive");
      return;
    }
    
    // Apply rules one by one
    for (let i = 0; i < count; i++) {
      if (useRandom) {
        applyRandomRule();
      } else if (selectedRules && selectedRules.length > 0) {
        // Select a rule based on weights if provided
        let rule: string;
        
        if (ruleWeights && ruleWeights.length > 0) {
          // Calculate total weight
          const totalWeight = ruleWeights.reduce((sum, rw) => sum + rw.weight, 0);
          
          // Normalize weights if total exceeds 100
          const normalizer = totalWeight > 100 ? 100 / totalWeight : 1;
          
          // Create a map of rules to normalized weights
          const weightMap = new Map<string, number>();
          ruleWeights.forEach(rw => {
            weightMap.set(rw.rule, rw.weight * normalizer);
          });
          
          // Distribute remaining weight to unweighted rules
          const weightedRules = new Set(ruleWeights.map(rw => rw.rule));
          const unweightedRules = selectedRules.filter(r => !weightedRules.has(r));
          
          if (unweightedRules.length > 0) {
            const remainingWeight = Math.max(0, 100 - (totalWeight * normalizer));
            const weightPerRule = remainingWeight / unweightedRules.length;
            unweightedRules.forEach(r => {
              weightMap.set(r, weightPerRule);
            });
          }
          
          // Select a rule based on weights
          const random = Math.random() * 100;
          let cumulativeWeight = 0;
          
          for (const [r, weight] of weightMap.entries()) {
            cumulativeWeight += weight;
            if (random <= cumulativeWeight) {
              rule = r;
              break;
            }
          }
          
          // Fallback to random selection if weights don't add up
          if (!rule) {
            rule = selectedRules[Math.floor(Math.random() * selectedRules.length)];
          }
        } else {
          // Simple random selection without weights
          rule = selectedRules[Math.floor(Math.random() * selectedRules.length)];
        }
        
        // Find valid targets for the selected rule
        let validTargets: Node[] = [];
        
        switch (rule) {
          case "Abstraction ψA":
          case "Linear Place ψP":
          case "Dual Abstraction ψD":
            validTargets = state.graph.nodes.filter(node => node.type === "transition");
            break;
          case "Linear Transition ψT":
            validTargets = state.graph.nodes.filter(node => node.type === "place");
            break;
        }
        
        if (validTargets.length === 0) {
          console.error(`No valid targets for ${rule}`);
          continue;
        }
        
        const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
        applyRule(rule, randomTarget.id);
      }
    }
    
    addLogEntry(`Generated batch of ${count} rules`);
  }, [applyRandomRule, applyRule, addLogEntry]);
  
  // Load state from log entry
  const loadStateFromLog = (logEntryId: string) => {
    // Find the index of the log entry
    const logIndex = state.log.findIndex(entry => entry.id === logEntryId);
    
    if (logIndex >= 0) {
      // Get the corresponding history state (which is one less than log entry index
      // because first log entry happens after the first history state)
      const historyIndex = Math.min(logIndex, state.history.length - 1);
      
      if (historyIndex >= 0 && historyIndex < state.history.length) {
        // Load the historical state
        const historicalState = state.history[historyIndex];
        
        // Update the current graph to match the historical state
        // but keep the rest of the current state intact
        dispatch({
          type: 'LOAD_HISTORICAL_STATE',
          payload: {
            graph: historicalState.graph,
            historyIndex
          }
        });
        
        // Add a log entry for this action
        addLogEntry(`Loaded state from action: ${state.log[logIndex].action}`);
        
        // Stop any ongoing simulation
        if (state.simulationActive) {
          stopSimulation();
        }
      }
    }
  };
  
  return (
    <PetriNetContext.Provider
      value={{
        state,
        dispatch,
        addPlace,
        addTransition,
        connectNodes,
        addToken,
        removeToken,
        applyRule,
        applyRandomRule,
        setTokenFlow,
        startSimulation,
        stopSimulation,
        undo,
        reset,
        centerGraph,
        downloadLog,
        generateBatch,
        loadStateFromLog
      }}
    >
      {children}
    </PetriNetContext.Provider>
  );
};
