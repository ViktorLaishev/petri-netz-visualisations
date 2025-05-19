
import { 
  ActionType, 
  PetriNetState, 
  RuleWeight 
} from "@/types/petriNet";
import { 
  initialGraph, 
  pushHistory, 
  addLogEntry, 
  saveStateToStorage,
  saveSavedNetsToStorage, 
  generateId, 
  getWeightedRandomRule,
  isConnectedGraph, 
  allNodesInPathFromStartToEnd, 
  wouldCreateInvalidConnections 
} from "./petriNetUtils";
import { rulesMap } from "./petriNetRules";
import { toast } from "sonner";

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
            type: "place",
            tokens: 0,
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
            type: "transition",
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
      const newSavedNet = {
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

export default petriNetReducer;
