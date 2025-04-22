
import React, { useRef, useEffect, useState } from "react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import cytoscape from "cytoscape";

const PetriNetGraph: React.FC = () => {
  const { state } = usePetriNet();
  const { graph, simulationActive, animatingTokens } = state;
  
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<any>(null);
  
  // Initialize cytospace instance
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
              'background-color': 'hsl(var(--primary))',
              'color': 'hsl(var(--primary-foreground))',
              'label': 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '12px',
              'width': '40px',
              'height': '40px',
              'border-width': '2px',
              'border-color': 'hsl(var(--border))'
            }
          },
          {
            selector: '.transition',
            style: {
              'shape': 'rectangle',
              'background-color': 'hsl(var(--accent))', 
              'color': 'hsl(var(--accent-foreground))',
              'label': 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '12px',
              'width': '40px',
              'height': '30px',
              'border-width': '2px',
              'border-color': 'hsl(var(--border))'
            }
          },
          {
            selector: 'edge',
            style: {
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 1,
              'line-color': 'hsl(var(--primary))',
              'target-arrow-color': 'hsl(var(--primary))',
              'width': 2
            }
          },
          {
            selector: '.token',
            style: {
              'shape': 'ellipse',
              'background-color': 'hsl(var(--destructive))',
              'width': '15px',
              'height': '15px',
              'z-index': 999
            }
          },
          {
            selector: '.has-token',
            style: {
              'border-width': 3,
              'border-color': 'hsl(var(--destructive))',
              'border-style': 'solid'
            }
          },
          {
            selector: '.active-path',
            style: {
              'line-color': 'hsl(var(--destructive))',
              'target-arrow-color': 'hsl(var(--destructive))',
              'width': 3,
              'line-style': 'dashed'
            }
          },
          {
            selector: '.highlighted',
            style: {
              'background-color': 'hsl(var(--destructive))',
              'color': 'hsl(var(--destructive-foreground))'
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
    }
  }, [graph.nodes, graph.edges]);
  
  // Handle animation
  useEffect(() => {
    if (simulationActive && animatingTokens.length > 0 && cyInstanceRef.current) {
      const cy = cyInstanceRef.current;
      
      // Animation for each token
      animatingTokens.forEach(token => {
        const { sourceId, targetId, progress } = token;
        const sourceNode = cy.getElementById(sourceId);
        const targetNode = cy.getElementById(targetId);
        
        if (sourceNode.length && targetNode.length) {
          // Find the path (simplified)
          const sourcePos = sourceNode.position();
          const targetPos = targetNode.position();
          
          // Calculate position along path based on progress
          const xPos = sourcePos.x + (targetPos.x - sourcePos.x) * progress;
          const yPos = sourcePos.y + (targetPos.y - sourcePos.y) * progress;
          
          // Remove any existing token nodes
          cy.elements('.animated-token').remove();
          
          // Add token at the calculated position
          if (progress < 1) {
            cy.add({
              group: 'nodes',
              data: { id: 'animated-token' },
              classes: 'token animated-token',
              position: { x: xPos, y: yPos }
            });
          }
          
          // Highlight path
          const connectedTransition = graph.edges.find(e => e.source === sourceId)?.target;
          
          if (connectedTransition) {
            cy.getElementById(`${sourceId}-${connectedTransition}`).addClass('active-path');
            cy.getElementById(`${connectedTransition}-${targetId}`).addClass('active-path');
          }
        }
      });
      
      // Clean up animation elements when complete
      if (animatingTokens[0].progress >= 1) {
        cy.elements('.animated-token').remove();
        cy.elements('.active-path').removeClass('active-path');
      }
    }
  }, [simulationActive, animatingTokens, graph.edges]);
  
  return (
    <div 
      ref={cyRef} 
      className="w-full h-full rounded-md bg-white dark:bg-slate-900 overflow-hidden"
    />
  );
};

export default PetriNetGraph;
