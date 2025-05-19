import React, { useRef, useEffect, useState } from "react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import NodeDetailsDialog from "./NodeDetailsDialog";

// Register the fcose layout algorithm with cytoscape
// Fix the registration process to avoid the hasOwnProperty error
if (!cytoscape.layouts || !Object.prototype.hasOwnProperty.call(cytoscape.layouts, 'fcose')) {
  cytoscape.use(fcose);
}

const PetriNetGraph: React.FC = () => {
  const { state } = usePetriNet();
  const { graph, simulationActive, animatingTokens } = state;
  
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<any>(null);
  
  // State for node details dialog
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Initialize cytoscape instance
  useEffect(() => {
    if (cyRef.current) {
      cyInstanceRef.current = cytoscape({
        container: cyRef.current,
        elements: [],
        style: [
          {
            selector: '.place',
            style: {
              'shape': 'ellipse',
              'background-color': '#60a5fa',
              'color': 'black',
              'label': 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '12px',
              'width': '40px',
              'height': '40px',
              'border-width': '2px',
              'border-color': '#94a3b8'
            }
          },
          {
            selector: '.transition',
            style: {
              'shape': 'rectangle',
              'background-color': '#4ade80',
              'color': 'black',
              'label': 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '12px',
              'width': '40px',
              'height': '30px',
              'border-width': '2px',
              'border-color': '#94a3b8'
            }
          },
          {
            selector: 'edge',
            style: {
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 1,
              'line-color': '#60a5fa',
              'target-arrow-color': '#60a5fa',
              'width': 2,
              'control-point-step-size': 40, // Helps curves be more pronounced
              'edge-distances': 'intersection' // Start and end at node boundaries
            }
          },
          {
            selector: '.token',
            style: {
              'shape': 'ellipse',
              'background-color': '#f43f5e',
              'width': '15px',
              'height': '15px',
              'z-index': 999
            }
          },
          {
            selector: '.has-token',
            style: {
              'border-width': 3,
              'border-color': '#f43f5e',
              'border-style': 'solid'
            }
          },
          {
            selector: '.active-path',
            style: {
              'line-color': '#f43f5e',
              'target-arrow-color': '#f43f5e',
              'width': 3,
              'line-style': 'dashed'
            }
          },
          {
            selector: '.highlighted',
            style: {
              'background-color': '#f43f5e',
              'color': 'white'
            }
          },
          {
            selector: '.newly-added',
            style: {
              'background-color': '#f59e0b',
              'color': 'black',
              'border-width': 3,
              'border-color': '#f59e0b',
              'border-style': 'dashed'
            }
          },
          {
            selector: 'edge.parallel',
            style: {
              'curve-style': 'unbundled-bezier',
              'control-point-distances': [40],
              'control-point-weights': [0.5]
            }
          }
        ],
        layout: {
          name: 'fcose', 
          idealEdgeLength: 150, // Increased for better spacing
          nodeSeparation: 120,  // Increased for better spacing
          randomize: true,      // Randomize initial positions for better layout
          animate: false,
          padding: 80,           // Increased padding
          nodeRepulsion: 8000,   // Increased to push nodes further apart
          edgeElasticity: 0.55,  // Increased to make edges more flexible
          gravity: 0.25,
          quality: 'proof',
          // Important settings for avoiding overlaps
          nodeDimensionsIncludeLabels: true,
          preventOverlap: true,
          packComponents: true,  // Pack disconnected components together
          fit: true              // Fit the graph to the viewport
        },
        wheelSensitivity: 0.5, // Adjusted for better zoom control
        minZoom: 0.3,
        maxZoom: 2.5
      });
      
      // Add interaction for better UX
      if (cyInstanceRef.current) {
        // Highlight connected edges when hovering over nodes
        cyInstanceRef.current.on('mouseover', 'node', function(e: any) {
          const node = e.target;
          const connectedEdges = node.connectedEdges();
          connectedEdges.addClass('active-path');
        });
        
        cyInstanceRef.current.on('mouseout', 'node', function(e: any) {
          const node = e.target;
          const connectedEdges = node.connectedEdges();
          connectedEdges.removeClass('active-path');
        });
        
        // Handle double-click on place nodes to open details dialog
        cyInstanceRef.current.on('dblclick', 'node.place', function(e: any) {
          const node = e.target;
          setSelectedNodeId(node.id());
          setIsDialogOpen(true);
        });
      }
      
      return () => {
        if (cyInstanceRef.current) {
          cyInstanceRef.current.destroy();
        }
      };
    }
  }, []);
  
  // Function to detect and mark parallel edges
  const markParallelEdges = (cy: any) => {
    // Create a map to track edges between the same nodes
    const edgePairs = new Map();
    
    // Collect all edges
    cy.edges().forEach((edge: any) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      const pairKey = `${sourceId}-${targetId}`;
      const reversePairKey = `${targetId}-${sourceId}`;
      
      if (edgePairs.has(pairKey)) {
        edgePairs.get(pairKey).push(edge);
      } else if (edgePairs.has(reversePairKey)) {
        edgePairs.get(reversePairKey).push(edge);
      } else {
        edgePairs.set(pairKey, [edge]);
      }
    });
    
    // Mark edges as parallel if there's more than one between the same nodes
    edgePairs.forEach((edges) => {
      if (edges.length > 1) {
        edges.forEach((edge: any, i: number) => {
          edge.addClass('parallel');
          
          // Apply different curvatures for parallel edges
          if (i % 2 === 0) {
            edge.style({
              'control-point-distances': [60 * (i + 1)] // Increased control point distance
            });
          } else {
            edge.style({
              'control-point-distances': [-60 * (i + 1)] // Increased control point distance
            });
          }
        });
      }
    });
  };
  
  // Generate a unique ID for each net to ensure different layouts
  const graphId = useRef(Date.now().toString());
  
  // Update graph elements
  useEffect(() => {
    if (cyInstanceRef.current) {
      const cy = cyInstanceRef.current;
      
      // Convert graph data to cytoscape format
      const elements = [
        ...graph.nodes.map(node => ({
          data: { 
            id: node.id, 
            label: node.id,
            tokens: node.tokens || 0,
            description: node.description || "" // Include description in data
          },
          classes: [
            node.type,
            node.tokens && node.tokens > 0 ? 'has-token' : '',
            node.description ? 'has-description' : ''
          ].filter(Boolean).join(' ')
        })),
        ...graph.edges.map((edge, index) => ({
          data: { 
            id: `${edge.source}-${edge.target}-${index}`, // Ensure unique edge IDs
            source: edge.source, 
            target: edge.target
          }
        }))
      ];
      
      cy.elements().remove();
      cy.add(elements);
      
      // Generate new graph ID when nodes change to ensure different layouts
      if (graph.nodes.length > 0) {
        graphId.current = Date.now().toString();
      }
      
      // Apply layout if elements exist
      if (elements.length > 0) {
        cy.layout({ 
          name: 'fcose',
          idealEdgeLength: 150,
          nodeSeparation: 120,
          randomize: true, // Use randomization to get different layouts each time
          animate: false,
          padding: 80,
          nodeRepulsion: 8000,
          edgeElasticity: 0.55,
          quality: 'proof',
          nodeDimensionsIncludeLabels: true,
          preventOverlap: true,
          // Use the graph ID as a random seed to get different layouts for different nets
          randomSeed: graphId.current 
        }).run();
        
        // Mark parallel edges after layout is applied
        markParallelEdges(cy);
        
        // Fit and center the graph with padding
        cy.fit(undefined, 60);
        cy.center();
      }

      // Highlight the most recently added elements
      const lastHistoryItem = state.history[state.history.length - 1];
      if (lastHistoryItem) {
        // Find nodes that exist in current graph but not in previous
        const prevNodeIds = new Set(lastHistoryItem.graph.nodes.map(n => n.id));
        const newNodes = graph.nodes.filter(n => !prevNodeIds.has(n.id));
        
        // Highlight new nodes
        newNodes.forEach(node => {
          const cyNode = cy.getElementById(node.id);
          if (cyNode) {
            cyNode.addClass('newly-added');
            setTimeout(() => {
              cyNode.removeClass('newly-added');
            }, 3000); // Remove highlight after 3 seconds
          }
        });
        
        // Highlight new edges
        const prevEdgeIds = new Set(
          lastHistoryItem.graph.edges.map(e => `${e.source}-${e.target}`)
        );
        
        graph.edges.forEach(edge => {
          const edgeId = `${edge.source}-${edge.target}`;
          if (!prevEdgeIds.has(edgeId)) {
            const cyEdge = cy.getElementById(edgeId);
            if (cyEdge) {
              cyEdge.addClass('active-path');
              setTimeout(() => {
                cyEdge.removeClass('active-path');
              }, 3000); // Remove highlight after 3 seconds
            }
          }
        });
      }
    }
  }, [graph.nodes, graph.edges, state.history]);
  
  // Handle animation
  useEffect(() => {
    if (!simulationActive && cyInstanceRef.current) {
      // Remove any animated tokens and highlights when simulation is stopped
      const cy = cyInstanceRef.current;
      cy.elements('.animated-token').remove();
      cy.elements('.active-path').removeClass('active-path');
      return;
    }

    if (simulationActive && animatingTokens.length > 0 && cyInstanceRef.current) {
      const cy = cyInstanceRef.current;
      animatingTokens.forEach(token => {
        const { sourceId, targetId, progress } = token;
        const sourceNode = cy.getElementById(sourceId);
        const targetNode = cy.getElementById(targetId);

        if (sourceNode.length && targetNode.length) {
          const sourcePos = sourceNode.position();
          const targetPos = targetNode.position();

          const xPos = sourcePos.x + (targetPos.x - sourcePos.x) * progress;
          const yPos = sourcePos.y + (targetPos.y - sourcePos.y) * progress;

          cy.elements('.animated-token').remove();

          if (progress < 1) {
            cy.add({
              group: 'nodes',
              data: { id: 'animated-token' },
              classes: 'token animated-token',
              position: { x: xPos, y: yPos }
            });
          }

          // Find path between source and target
          const path = findShortestPath(sourceId, targetId, graph);
          
          // Highlight path
          if (path && path.length > 1) {
            for (let i = 0; i < path.length - 1; i++) {
              const edgeId = `${path[i]}-${path[i+1]}`;
              cy.getElementById(edgeId).addClass('active-path');
            }
          } else {
            // Fallback to direct edge highlighting
            const edgesBySource = graph.edges.filter(e => e.source === sourceId);
            const connectedTransition = edgesBySource.length > 0 ? edgesBySource[0].target : null;

            if (connectedTransition) {
              cy.getElementById(`${sourceId}-${connectedTransition}`).addClass('active-path');
              const edgesToTarget = graph.edges.filter(e => e.source === connectedTransition && e.target === targetId);
              if (edgesToTarget.length > 0) {
                cy.getElementById(`${connectedTransition}-${targetId}`).addClass('active-path');
              }
            }
          }
        }
      });

      if (animatingTokens[0].progress >= 1) {
        cy.elements('.animated-token').remove();
        cy.elements('.active-path').removeClass('active-path');
      }
    }
  }, [simulationActive, animatingTokens, graph.edges, graph]);
  
  // Helper function to find shortest path in the graph
  const findShortestPath = (startId: string, endId: string, graph: { nodes: any[], edges: any[] }) => {
    // Simple BFS to find shortest path
    const visited = new Set<string>();
    const queue: { id: string, path: string[] }[] = [{ id: startId, path: [startId] }];
    
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      
      if (id === endId) {
        return path;
      }
      
      if (!visited.has(id)) {
        visited.add(id);
        
        // Find all neighbors
        const outgoingEdges = graph.edges.filter(e => e.source === id);
        for (const edge of outgoingEdges) {
          if (!visited.has(edge.target)) {
            queue.push({ id: edge.target, path: [...path, edge.target] });
          }
        }
      }
    }
    
    return null; // No path found
  };
  
  // Add effect to handle centerGraph command
  useEffect(() => {
    // Create a method to center and fit the graph
    const centerAndFitGraph = () => {
      if (cyInstanceRef.current) {
        cyInstanceRef.current.fit(undefined, 50);
        cyInstanceRef.current.center();
      }
    };
    
    // Add an event listener for the centerGraph action
    window.addEventListener('petrinetCenterGraph', centerAndFitGraph);
    
    // Clean up the event listener
    return () => {
      window.removeEventListener('petrinetCenterGraph', centerAndFitGraph);
    };
  }, []);
  
  return (
    <>
      <div 
        ref={cyRef} 
        className="w-full h-full rounded-md bg-white dark:bg-slate-900 overflow-hidden"
      />
      
      {/* Node details dialog */}
      <NodeDetailsDialog 
        nodeId={selectedNodeId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
};

export default PetriNetGraph;
