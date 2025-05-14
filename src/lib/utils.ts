
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to check if a new row (place) would create a valid addition
export function validateNewPlace(graph: { nodes: any[], edges: any[] }, newEdges: any[]) {
  const existingEdgePatterns = new Set();
  
  // Store existing edge patterns for quick lookup
  for (const node of graph.nodes.filter(n => n.type === 'place')) {
    const pattern = graph.edges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => e.source === node.id ? `out:${e.target}` : `in:${e.source}`)
      .sort()
      .join(',');
      
    existingEdgePatterns.add(pattern);
  }
  
  // Create pattern for the new place
  const newPattern = newEdges
    .map(e => e.isOutgoing ? `out:${e.target}` : `in:${e.source}`)
    .sort()
    .join(',');
    
  // Check if this pattern already exists
  return !existingEdgePatterns.has(newPattern) && newPattern.length > 0;
}

// Helper function to check if a new column (transition) would create a valid addition
export function validateNewTransition(graph: { nodes: any[], edges: any[] }, newEdges: any[]) {
  const existingEdgePatterns = new Set();
  
  // Store existing transition patterns
  for (const node of graph.nodes.filter(n => n.type === 'transition')) {
    const pattern = graph.edges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => e.source === node.id ? `out:${e.target}` : `in:${e.source}`)
      .sort()
      .join(',');
      
    existingEdgePatterns.add(pattern);
  }
  
  // Create pattern for the new transition
  const newPattern = newEdges
    .map(e => e.isOutgoing ? `out:${e.target}` : `in:${e.source}`)
    .sort()
    .join(',');
    
  // Check if this pattern already exists and ensures it's not empty
  return !existingEdgePatterns.has(newPattern) && newPattern.length > 0;
}

