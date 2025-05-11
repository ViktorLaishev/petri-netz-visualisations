import React, { useRef, useEffect, useState } from "react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import cytoscape from "cytoscape";
import { Maximize, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NodeInfoPopup {
  visible: boolean;
  x: number;
  y: number;
  data: {
    id: string;
    type: string;
    tokens?: number;
    incomingEdges?: number;
    outgoingEdges?: number;
    created?: string;
    source?: string;
    target?: string;
    rule?: string;
  };
}

const PetriNetGraph: React.FC = () => {
  const { state } = usePetriNet();
  const { graph, simulationActive, animatingTokens } = state;
  
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodeInfo, setNodeInfo] = useState<NodeInfoPopup>({
    visible: false,
    x: 0,
    y: 0,
    data: {
      id: "",
      type: "",
    }
  });
  
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
        
        // Show node info when clicking on a node
        cyInstanceRef.current.on('click', 'node', function(e: any) {
          const node = e.target;
          const position = e.renderedPosition;
          const nodeData = node.data();
          const nodeType = nodeData.type || (node.hasClass('place') ? 'place' : 'transition');
          
          // Find connected edges
          const incomingEdges = node.incomers().length;
          const outgoingEdges = node.outgoers().length;
          
          // Look up the creation timestamp from history
          let created = "Unknown";
          for (let i = 0; i < state.history.length; i++) {
            const historyItem = state.history[i];
            const found = historyItem.graph.nodes.find((n: any) => n.id === nodeData.id);
            if (found) {
              created = new Date(historyItem.timestamp).toLocaleString();
              break;
            }
          }
          
          setNodeInfo({
            visible: true,
            x: position.x,
            y: position.y,
            data: {
              id: nodeData.id,
              type: nodeType,
              tokens: nodeData.tokens,
              incomingEdges,
              outgoingEdges,
              created,
            }
          });
        });
        
        // Show edge info when clicking on an edge
        cyInstanceRef.current.on('click', 'edge', function(e: any) {
          const edge = e.target;
          const position = e.renderedPosition;
          const edgeData = edge.data();
          
          // Find the rule that created this edge
          let rule = "Unknown";
          for (let i = 0; i < state.log.length; i++) {
            const logEntry = state.log[i];
            if (logEntry.action.includes(edgeData.source) && logEntry.action.includes(edgeData.target)) {
              rule = logEntry.action;
              break;
            }
          }
          
          // Find the creation timestamp from history
          let created = "Unknown";
          for (let i = 0; i < state.history.length; i++) {
            const historyItem = state.history[i];
            const found = historyItem.graph.edges.find(
              (e: any) => e.source === edgeData.source && e.target === edgeData.target
            );
            if (found) {
              created = new Date(historyItem.timestamp).toLocaleString();
              break;
            }
          }
          
          setNodeInfo({
            visible: true,
            x: position.x,
            y: position.y,
            data: {
              id: edgeData.id,
              type: 'edge',
              source: edgeData.source,
              target: edgeData.target,
              rule,
              created,
            }
          });
        });
        
        // Hide popup when clicking on the background
        cyInstanceRef.current.on('click', function(e: any) {
          if (e.target === cyInstanceRef.current) {
            setNodeInfo({ ...nodeInfo, visible: false });
          }
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
            tokens: node.tokens || 0,
            type: node.type
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
  
  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Give the browser a moment to update the DOM
    setTimeout(() => {
      if (cyInstanceRef.current) {
        cyInstanceRef.current.fit();
        cyInstanceRef.current.center();
      }
    }, 100);
  };
  
  // Close node info popup
  const closeNodeInfo = () => {
    setNodeInfo({ ...nodeInfo, visible: false });
  };
  
  return (
    <>
      <div className={`relative rounded-md bg-white dark:bg-slate-900 overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full'
      }`}>
        <Button
          variant="outline"
          size="sm"
          className="absolute right-2 top-2 z-10"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          <Maximize size={16} />
        </Button>
        
        <div ref={cyRef} className="w-full h-full" />
        
        {nodeInfo.visible && (
          <div
            className="absolute z-10 bg-white dark:bg-slate-800 p-4 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 max-w-xs"
            style={{
              left: `${nodeInfo.x + 10}px`,
              top: `${nodeInfo.y - 20}px`,
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1"
              onClick={closeNodeInfo}
            >
              <X size={14} />
            </Button>
            
            <h3 className="text-sm font-semibold mb-2">{nodeInfo.data.type === 'edge' ? 'Edge' : nodeInfo.data.type} Info</h3>
            
            <div className="text-xs space-y-1">
              <div><span className="font-medium">ID:</span> {nodeInfo.data.id}</div>
              
              {nodeInfo.data.type === 'place' && (
                <>
                  <div><span className="font-medium">Tokens:</span> {nodeInfo.data.tokens || 0}</div>
                  <div><span className="font-medium">Incoming:</span> {nodeInfo.data.incomingEdges}</div>
                  <div><span className="font-medium">Outgoing:</span> {nodeInfo.data.outgoingEdges}</div>
                </>
              )}
              
              {nodeInfo.data.type === 'transition' && (
                <>
                  <div><span className="font-medium">Incoming:</span> {nodeInfo.data.incomingEdges}</div>
                  <div><span className="font-medium">Outgoing:</span> {nodeInfo.data.outgoingEdges}</div>
                </>
              )}
              
              {nodeInfo.data.type === 'edge' && (
                <>
                  <div><span className="font-medium">Source:</span> {nodeInfo.data.source}</div>
                  <div><span className="font-medium">Target:</span> {nodeInfo.data.target}</div>
                  <div><span className="font-medium">Rule:</span> {nodeInfo.data.rule}</div>
                </>
              )}
              
              <div><span className="font-medium">Created:</span> {nodeInfo.data.created}</div>
            </div>
          </div>
        )}
      </div>
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleFullscreen}
        />
      )}
    </>
  );
};

export default PetriNetGraph;
