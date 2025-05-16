
import React, { useState } from "react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface PnmlPlace {
  id: string;
  name?: string;
  initialMarking?: number;
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
  const { dispatch } = usePetriNet();  // Extract just the dispatch function
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
      
      return { id, name, initialMarking };
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
    // Convert PNML format to the application's graph format
    const nodes = [
      ...pnmlNet.places.map(place => ({
        id: place.id,
        type: 'place',
        tokens: place.initialMarking || 0
      })),
      ...pnmlNet.transitions.map(transition => ({
        id: transition.id,
        type: 'transition'
      }))
    ];

    const edges = pnmlNet.arcs.map(arc => ({
      source: arc.source,
      target: arc.target,
      // Additional properties if needed
    }));

    // Generate a unique net name based on the file name and timestamp
    const netName = `${fileName.replace('.pnml', '')} (${new Date().toLocaleTimeString()})`;
    
    // Directly update the state with the new graph using ADD_HISTORY_ITEM
    dispatch({
      type: 'ADD_HISTORY_ITEM',
      payload: {
        name: netName,
        graph: {
          nodes,
          edges
        }
      }
    });
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
