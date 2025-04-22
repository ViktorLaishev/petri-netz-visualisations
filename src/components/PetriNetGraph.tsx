
import React, { useRef, useEffect, useState } from "react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import cytoscape from "cytoscape";

const PetriNetGraph: React.FC = () => {
  const { state } = usePetriNet();
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
              'background-color': '#60a5fa',  // Direct color values instead of hsl variables
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
              'background-color': '#4ade80',  // Direct green color
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
              'line-color': '#60a5fa',  // Direct blue color
              'target-arrow-color': '#60a5fa',
              'width': 2
            }
          },
          {
            selector: '.token',
            style: {
              'shape': 'ellipse',
              'background-color': '#f43f5e',  // Direct red color
              'width': '15px',
              'height': '15px',
              'z-index': 999
            }
          },
          {
            selector: '.has-token',
            style: {
              'border-width': 3,
              'border-color': '#f43f5e',  // Direct red color
              'border-style': 'solid'
            }
          },
          {
            selector: '.active-path',
            style: {
              'line-color': '#f43f5e',  // Direct red color
              'target-arrow-color': '#f43f5e',  // Direct red color
              'width': 3,
              'line-style': 'dashed'
            }
          },
          {
            selector: '.highlighted',
            style: {
              'background-color': '#f43f5e',  // Direct red color
              'color': 'white'
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
          const edgesBySource = graph.edges.filter(e => e.source === sourceId);
          const connectedTransition = edgesBySource.length > 0 ? edgesBySource[0].target : null;
          
          if (connectedTransition) {
            // Highlight edge from source to transition
            cy.getElementById(`${sourceId}-${connectedTransition}`).addClass('active-path');
            
            // Find edge from transition to target
            const edgesToTarget = graph.edges.filter(e => e.source === connectedTransition && e.target === targetId);
            if (edgesToTarget.length > 0) {
              cy.getElementById(`${connectedTransition}-${targetId}`).addClass('active-path');
            }
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
