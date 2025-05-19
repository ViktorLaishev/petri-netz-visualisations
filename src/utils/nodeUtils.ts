
// This utility helps us work with node descriptions without modifying the context
// In a real application, these functions should be integrated into the PetriNetContext

import { toast } from "sonner";

// Store node descriptions in local storage
export const saveNodeDescription = (nodeId: string, description: string) => {
  try {
    // Get existing descriptions
    const descriptionsJson = localStorage.getItem('nodeDescriptions');
    const descriptions = descriptionsJson ? JSON.parse(descriptionsJson) : {};
    
    // Update description for this node
    descriptions[nodeId] = description;
    
    // Save back to local storage
    localStorage.setItem('nodeDescriptions', JSON.stringify(descriptions));
    
    // Dispatch a custom event to notify components
    window.dispatchEvent(new CustomEvent('nodeDescriptionUpdated', { 
      detail: { nodeId, description } 
    }));
    
    return true;
  } catch (error) {
    console.error("Failed to save node description:", error);
    toast.error("Failed to save node description");
    return false;
  }
};

// Get description for a specific node
export const getNodeDescription = (nodeId: string): string => {
  try {
    const descriptionsJson = localStorage.getItem('nodeDescriptions');
    const descriptions = descriptionsJson ? JSON.parse(descriptionsJson) : {};
    return descriptions[nodeId] || "";
  } catch (error) {
    console.error("Failed to get node description:", error);
    return "";
  }
};

// Get all stored descriptions
export const getAllNodeDescriptions = (): Record<string, string> => {
  try {
    const descriptionsJson = localStorage.getItem('nodeDescriptions');
    return descriptionsJson ? JSON.parse(descriptionsJson) : {};
  } catch (error) {
    console.error("Failed to get all node descriptions:", error);
    return {};
  }
};
