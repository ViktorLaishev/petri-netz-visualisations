
import { Graph, Node } from "@/types/petriNet";
import { toast } from "sonner";
import { 
  isConnectedGraph, 
  allNodesInPathFromStartToEnd, 
  wouldCreateInvalidConnections 
} from "./petriNetUtils";

// Rule implementations
export const applyAbstractionRule = (graph: Graph, targetId: string): Graph => {
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

export const applyLinearTransitionRule = (
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

export const applyLinearPlaceRule = (graph: Graph, targetId: string): Graph => {
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

export const applyLinearTransitionDependencyRule = (
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

export const applyDualAbstractionRule = (
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

// Enhanced random rule application functions
export const applyRandomAbstractionRule = (graph: Graph): Graph => {
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

export const applyRandomLinearTransitionRule = (graph: Graph): Graph => {
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

export const applyRandomLinearPlaceRule = (graph: Graph): Graph => {
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

export const applyRandomLinearTransitionDependencyRule = (graph: Graph): Graph => {
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

export const applyRandomDualAbstractionRule = (graph: Graph): Graph => {
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

// Map rules to their implementations
export const rulesMap = {
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
