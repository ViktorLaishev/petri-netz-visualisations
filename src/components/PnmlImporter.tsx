
import React, { useState } from "react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface PnmlPlace {
  id: string;
  name?: string;
  initialMarking?: number;
  isStartPlace?: boolean;
  isEndPlace?: boolean;
}

interface PnmlTransition {
  id: string;
  name?: string;
}

interface PnmlArc {
  id: string;
  source: string;
  target: string;
  weight?: number;
}

interface PnmlNet {
  id: string;
  type?: string;
  places: PnmlPlace[];
  transitions: PnmlTransition[];
  arcs: PnmlArc[];
}

const PnmlImporter: React.FC = () => {
  // Get both state and all methods from the context
  const petriNetContext = usePetriNet();
  const [importing, setImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.pnml')) {
      setImporting(true);
      try {
        const content = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "application/xml");
        const parsedNet = parsePnml(xmlDoc);
        
        if (parsedNet) {
          // First reset the petri net to ensure we're starting fresh
          petriNetContext.reset();
          // Now import the PNML model
          convertAndImportNet(parsedNet, file.name);
          toast.success(`Imported Petri net: ${file.name}`);
        } else {
          toast.error("Failed to parse PNML file. Invalid format.");
        }
      } catch (error) {
        console.error("Error importing PNML file:", error);
        toast.error("Error importing PNML file. Please check the console for details.");
      } finally {
        setImporting(false);
        // Reset the input to allow importing the same file again
        e.target.value = '';
      }
    } else {
      toast.error("Please select a valid .pnml file");
      e.target.value = '';
    }
  };

  const parsePnml = (xmlDoc: Document): PnmlNet | null => {
    // Find the net element
    const netElement = xmlDoc.querySelector("net");
    if (!netElement) return null;

    const netId = netElement.getAttribute("id") || "imported-net";
    const netType = netElement.getAttribute("type") || undefined;

    // Parse places
    const placeElements = netElement.querySelectorAll("place");
    const places: PnmlPlace[] = Array.from(placeElements).map(place => {
      const id = place.getAttribute("id") || `place-${Math.random().toString(36).slice(2, 9)}`;
      const nameElement = place.querySelector("name text");
      const name = nameElement ? nameElement.textContent || undefined : undefined;
      
      // Parse initial marking if exists
      let initialMarking = 0;
      const markingElement = place.querySelector("initialMarking text");
      if (markingElement && markingElement.textContent) {
        initialMarking = parseInt(markingElement.textContent, 10) || 0;
      }

      // Identify start and end places based on connections and markup
      const isStartPlace = place.hasAttribute("initialMarking") && !place.hasAttribute("targetof");
      const isEndPlace = !place.hasAttribute("initialMarking") && !place.hasAttribute("sourceof");
      
      return { id, name, initialMarking, isStartPlace, isEndPlace };
    });

    // Parse transitions
    const transitionElements = netElement.querySelectorAll("transition");
    const transitions: PnmlTransition[] = Array.from(transitionElements).map(transition => {
      const id = transition.getAttribute("id") || `transition-${Math.random().toString(36).slice(2, 9)}`;
      const nameElement = transition.querySelector("name text");
      const name = nameElement ? nameElement.textContent || undefined : undefined;
      
      return { id, name };
    });

    // Parse arcs
    const arcElements = netElement.querySelectorAll("arc");
    const arcs: PnmlArc[] = Array.from(arcElements).map(arc => {
      const id = arc.getAttribute("id") || `arc-${Math.random().toString(36).slice(2, 9)}`;
      const source = arc.getAttribute("source") || "";
      const target = arc.getAttribute("target") || "";
      
      let weight = 1;
      const inscriptionElement = arc.querySelector("inscription text");
      if (inscriptionElement && inscriptionElement.textContent) {
        weight = parseInt(inscriptionElement.textContent, 10) || 1;
      }
      
      return { id, source, target, weight };
    });

    return { id: netId, type: netType, places, transitions, arcs };
  };

  const convertAndImportNet = (pnmlNet: PnmlNet, fileName: string) => {
    // Find start and end places
    const startPlace = pnmlNet.places.find(p => p.isStartPlace || p.initialMarking > 0);
    const endPlace = pnmlNet.places.find(p => p.isEndPlace);
    
    // Set default start place as the first place if none is marked
    const startPlaceId = startPlace ? startPlace.id : (pnmlNet.places[0]?.id || 'P0');
    
    // Set default end place as the last place if none is marked
    const endPlaceId = endPlace ? endPlace.id : (pnmlNet.places[pnmlNet.places.length - 1]?.id || 'P_out');
    
    // Generate a unique net name based on the file name and timestamp
    const netName = `${fileName.replace('.pnml', '')} (${new Date().toLocaleTimeString()})`;
    
    // Create a completely new net (this will be our active net)
    petriNetContext.reset(); // Reset again to ensure we're completely clear
    petriNetContext.savePetriNet(netName);
    
    // First add all places and transitions to ensure they exist
    pnmlNet.places.forEach(place => {
      // If this is the start place, add it as P0
      if (place.id === startPlaceId) {
        // Add the start place as P0
        petriNetContext.addPlace('P0');
      }
      // If this is the end place, add it as P_out
      else if (place.id === endPlaceId) {
        // Add the end place as P_out
        petriNetContext.addPlace('P_out');
      }
      else {
        petriNetContext.addPlace(place.id);
      }
    });
    
    pnmlNet.transitions.forEach(transition => {
      petriNetContext.addTransition(transition.id);
    });
    
    // Now add all connections, remapping start and end place IDs as needed
    pnmlNet.arcs.forEach(arc => {
      let sourceId = arc.source === startPlaceId ? 'P0' : arc.source;
      let targetId = arc.target === endPlaceId ? 'P_out' : arc.target;
      
      // Connect the nodes, taking care to use the remapped IDs
      petriNetContext.connectNodes(sourceId, targetId);
    });
    
    // Set initial token to the start place (P0)
    petriNetContext.state.graph.nodes.forEach(node => {
      if (node.id === 'P0') {
        petriNetContext.setTokens(node.id, 1);
      }
    });
    
    // We need to update the current net ID so it remains as the active net
    petriNetContext.savePetriNet(netName);
    petriNetContext.loadPetriNet(netName);
  };

  return (
    <div>
      <input
        id="pnml-file-input"
        type="file"
        accept=".pnml"
        onChange={handleFileChange}
        className="hidden"
      />
      <label htmlFor="pnml-file-input">
        <Button 
          variant="outline" 
          className="gap-2 cursor-pointer" 
          disabled={importing}
          asChild
        >
          <span>
            <Upload className="h-4 w-4" />
            {importing ? "Importing..." : "Import PNML"}
          </span>
        </Button>
      </label>
    </div>
  );
};

export default PnmlImporter;
