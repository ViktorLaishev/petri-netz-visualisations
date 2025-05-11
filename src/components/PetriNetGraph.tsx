
import React, { useRef, useEffect } from "react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import cytoscape from "cytoscape";

const PetriNetGraph: React.FC = () => {
  const { state, stopSimulation } = usePetriNet();
  const { graph, simulationActive, animatingTokens } = state;
  
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<any>(null);
  
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
              'width': 2
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
          }
        ],
        layout: {
          name: 'breadthfirst',
          directed: true,
          padding: 50,
          spacingFactor: 1.5
        },
        wheelSensitivity: 0.2,
        minZoom: 0.5,
        maxZoom: 2
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
      }
      
      return () => {
        if (cyInstanceRef.current) {
          cyInstanceRef.current.destroy();
        }
      };
    }
  }, []);
  
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
            tokens: node.tokens || 0
          },
          classes: [
            node.type,
            node.tokens && node.tokens > 0 ? 'has-token' : ''
          ].filter(Boolean).join(' ')
        })),
        ...graph.edges.map(edge => ({
          data: { 
            id: `${edge.source}-${edge.target}`, 
            source: edge.source, 
            target: edge.target
          }
        }))
      ];
      
      cy.elements().remove();
      cy.add(elements);
      
      // Apply layout if elements exist
      if (elements.length > 0) {
        cy.layout({ 
          name: 'breadthfirst',
          directed: true,
          padding: 50,
          spacingFactor: 1.5
        }).run();
        
        cy.fit(undefined, 50);
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
    <div 
      ref={cyRef} 
      className="w-full h-full rounded-md bg-white dark:bg-slate-900 overflow-hidden"
    />
  );
};

export default PetriNetGraph;
