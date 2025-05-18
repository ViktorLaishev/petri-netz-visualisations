
import React, { useState } from "react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

// Extended interfaces to support more PNML features
interface PnmlGraphics {
  position?: { x: number; y: number };
  dimension?: { width: number; height: number };
}

interface PnmlPlace {
  id: string;
  name?: string;
  initialMarking?: number;
  graphics?: PnmlGraphics;
}

interface PnmlTransition {
  id: string;
  name?: string;
  graphics?: PnmlGraphics;
}

interface PnmlArc {
  id: string;
  source: string;
  target: string;
  weight?: number;
  graphics?: { positions?: Array<{ x: number; y: number }> };
}

interface PnmlNet {
  id: string;
  type?: string;
  places: PnmlPlace[];
  transitions: PnmlTransition[];
  arcs: PnmlArc[];
}

const PnmlImporter: React.FC = () => {
  const petriNetContext = usePetriNet();
  const [importing, setImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".pnml")) {
      setImporting(true);
      try {
        const content = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "application/xml");

        // Check for parsing errors
        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
          throw new Error("XML parsing error: " + parserError.textContent);
        }

        const parsedNet = parsePnml(xmlDoc);

        if (parsedNet) {
          convertAndImportNet(parsedNet, file.name);
          toast.success(`Imported Petri net: ${file.name}`);
        } else {
          toast.error("Failed to parse PNML file. Invalid format.");
        }
      } catch (error) {
        console.error("Error importing PNML file:", error);
        toast.error(
          `Error importing PNML file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      } finally {
        setImporting(false);
        e.target.value = "";
      }
    } else {
      toast.error("Please select a valid .pnml file");
      e.target.value = "";
    }
  };

  const parsePnml = (xmlDoc: Document): PnmlNet | null => {
    // Find the net element - support both direct net and pnml > net structures
    let netElement = xmlDoc.querySelector("net");
    if (!netElement) {
      // Try to find net inside pnml element
      const pnmlElement = xmlDoc.querySelector("pnml");
      if (pnmlElement) {
        netElement = pnmlElement.querySelector("net");
      }
      if (!netElement) return null;
    }

    const netId = netElement.getAttribute("id") || "imported-net";
    const netType = netElement.getAttribute("type") || undefined;

    // Parse places, only including those with valid IDs
    const places: PnmlPlace[] = [];
    const placeElements = netElement.querySelectorAll("place");
    const validPlaceIds = new Set<string>();

    Array.from(placeElements).forEach((place) => {
      const id = place.getAttribute("id");

      // Skip places without proper IDs
      if (!id) {
        console.warn("Skipping place with missing ID");
        return;
      }

      validPlaceIds.add(id);

      // Parse name
      let name: string | undefined = undefined;
      const nameElement = place.querySelector("name text");
      if (nameElement) {
        name = nameElement.textContent || undefined;
      }

      // Parse initial marking
      let initialMarking = 0;
      const markingElement = place.querySelector("initialMarking text");
      if (markingElement && markingElement.textContent) {
        initialMarking = parseInt(markingElement.textContent.trim(), 10) || 0;
      }

      // Parse graphics information
      const graphics: PnmlGraphics = {};
      const positionElement = place.querySelector("graphics position");
      if (positionElement) {
        const x = parseFloat(positionElement.getAttribute("x") || "0");
        const y = parseFloat(positionElement.getAttribute("y") || "0");
        graphics.position = { x, y };
      }

      const dimensionElement = place.querySelector("graphics dimension");
      if (dimensionElement) {
        const width = parseFloat(
          dimensionElement.getAttribute("width") || "40"
        );
        const height = parseFloat(
          dimensionElement.getAttribute("height") || "40"
        );
        graphics.dimension = { width, height };
      }

      places.push({ id, name, initialMarking, graphics });
    });

    // Parse transitions, only including those with valid IDs
    const transitions: PnmlTransition[] = [];
    const transitionElements = netElement.querySelectorAll("transition");
    const validTransitionIds = new Set<string>();

    Array.from(transitionElements).forEach((transition) => {
      const id = transition.getAttribute("id");

      // Skip transitions without proper IDs
      if (!id) {
        console.warn("Skipping transition with missing ID");
        return;
      }

      validTransitionIds.add(id);

      // Parse name
      let name: string | undefined = undefined;
      const nameElement = transition.querySelector("name text");
      if (nameElement) {
        name = nameElement.textContent || undefined;
      }

      // Parse graphics information
      const graphics: PnmlGraphics = {};
      const positionElement = transition.querySelector("graphics position");
      if (positionElement) {
        const x = parseFloat(positionElement.getAttribute("x") || "0");
        const y = parseFloat(positionElement.getAttribute("y") || "0");
        graphics.position = { x, y };
      }

      const dimensionElement = transition.querySelector("graphics dimension");
      if (dimensionElement) {
        const width = parseFloat(
          dimensionElement.getAttribute("width") || "40"
        );
        const height = parseFloat(
          dimensionElement.getAttribute("height") || "40"
        );
        graphics.dimension = { width, height };
      }

      transitions.push({ id, name, graphics });
    });

    // Parse arcs, only including those with valid source and target IDs
    const arcs: PnmlArc[] = [];
    const arcElements = netElement.querySelectorAll("arc");

    Array.from(arcElements).forEach((arc) => {
      const id = arc.getAttribute("id");
      const source = arc.getAttribute("source");
      const target = arc.getAttribute("target");

      // Skip arcs without proper IDs, source, or target
      if (!id) {
        console.warn("Skipping arc with missing ID");
        return;
      }

      if (!source || !target) {
        console.warn(`Skipping arc ${id} with missing source or target`);
        return;
      }

      // Verify source and target exist in our valid nodes
      if (!validPlaceIds.has(source) && !validTransitionIds.has(source)) {
        console.warn(
          `Skipping arc ${id}: Source node ${source} does not exist`
        );
        return;
      }

      if (!validPlaceIds.has(target) && !validTransitionIds.has(target)) {
        console.warn(
          `Skipping arc ${id}: Target node ${target} does not exist`
        );
        return;
      }

      // Parse weight
      let weight = 1;
      const inscriptionElement = arc.querySelector("inscription text");
      if (inscriptionElement && inscriptionElement.textContent) {
        weight = parseInt(inscriptionElement.textContent.trim(), 10) || 1;
      }

      // Parse arc graphics (positions)
      const graphics: { positions?: Array<{ x: number; y: number }> } = {};
      const positionElements = arc.querySelectorAll("graphics position");
      if (positionElements.length > 0) {
        graphics.positions = Array.from(positionElements).map((pos) => ({
          x: parseFloat(pos.getAttribute("x") || "0"),
          y: parseFloat(pos.getAttribute("y") || "0"),
        }));
      }

      arcs.push({ id, source, target, weight, graphics });
    });

    return { id: netId, type: netType, places, transitions, arcs };
  };

  const convertAndImportNet = (pnmlNet: PnmlNet, fileName: string) => {
    // Check if we have valid data to import
    if (pnmlNet.places.length === 0) {
      toast.error("No valid places found in the PNML file");
      return;
    }

    if (pnmlNet.transitions.length === 0) {
      toast.error("No valid transitions found in the PNML file");
      return;
    }

    // First, determine which nodes are connected in the graph
    // We'll only import nodes that have at least one connection
    const connectedNodes = new Set<string>();

    // Add all nodes that are part of an arc (either source or target)
    pnmlNet.arcs.forEach((arc) => {
      connectedNodes.add(arc.source);
      connectedNodes.add(arc.target);
    });

    // Filter the places and transitions to only include connected nodes
    // This prevents isolated nodes from being imported
    const connectedPlaces = pnmlNet.places.filter((place) =>
      connectedNodes.has(place.id)
    );

    const connectedTransitions = pnmlNet.transitions.filter((transition) =>
      connectedNodes.has(transition.id)
    );

    // If filtering removed all places or transitions, show an error
    if (connectedPlaces.length === 0) {
      toast.error("No connected places found in the PNML file");
      return;
    }

    if (connectedTransitions.length === 0) {
      toast.error("No connected transitions found in the PNML file");
      return;
    }

    // Use the filtered lists for the rest of the import process
    const filteredNet = {
      ...pnmlNet,
      places: connectedPlaces,
      transitions: connectedTransitions,
    };

    // Analyze the net to find start and end places
    const identifySpecialPlaces = () => {
      // Create maps to track incoming and outgoing connections
      const incomingArcs = new Map<string, number>();
      const outgoingArcs = new Map<string, number>();

      // Count arcs for each place
      filteredNet.places.forEach((place) => {
        incomingArcs.set(place.id, 0);
        outgoingArcs.set(place.id, 0);
      });

      pnmlNet.arcs.forEach((arc) => {
        // Check if source is a place
        if (filteredNet.places.some((place) => place.id === arc.source)) {
          outgoingArcs.set(arc.source, (outgoingArcs.get(arc.source) || 0) + 1);
        }

        // Check if target is a place
        if (filteredNet.places.some((place) => place.id === arc.target)) {
          incomingArcs.set(arc.target, (incomingArcs.get(arc.target) || 0) + 1);
        }
      });

      // Find places with initial marking
      const placesWithMarking = filteredNet.places.filter(
        (p) => p.initialMarking && p.initialMarking > 0
      );

      // Start places - prioritize places with tokens, then places with no incoming arcs
      let startPlaces =
        placesWithMarking.length > 0
          ? placesWithMarking
          : filteredNet.places.filter((p) => incomingArcs.get(p.id) === 0);

      // End places - prioritize places with no outgoing arcs
      let endPlaces = filteredNet.places.filter(
        (p) => outgoingArcs.get(p.id) === 0
      );

      // If no clear start/end found, use heuristic approaches
      if (startPlaces.length === 0) {
        // Fallback: use first place
        startPlaces = [filteredNet.places[0]];
      }

      if (endPlaces.length === 0) {
        // Fallback: use last place
        endPlaces = [filteredNet.places[filteredNet.places.length - 1]];
      }

      return {
        startPlace: startPlaces[0],
        endPlace: endPlaces[0],
      };
    };

    const { startPlace, endPlace } = identifySpecialPlaces();

    // Generate a unique net name based on the file name and timestamp
    const netName = `${fileName.replace(
      ".pnml",
      ""
    )} (${new Date().toLocaleTimeString()})`;

    // Create a new net and reset - ensure a clean slate
    petriNetContext.savePetriNet(netName);
    petriNetContext.reset();

    // Create an ID mapping to handle remapping special places
    const idMapping = new Map<string, string>();

    // Track created nodes to ensure we only add valid connections
    const createdNodes = new Set<string>();

    // First add all places using the available context actions
    filteredNet.places.forEach((place) => {
      let newId: string;

      if (place.id === startPlace.id) {
        newId = "P0";
        idMapping.set(place.id, "P0");
      } else if (place.id === endPlace.id) {
        newId = "P_out";
        idMapping.set(place.id, "P_out");
      } else {
        // Keep original ID, but ensure it's valid for the context
        // Remove any special characters that might cause issues
        newId = place.id.replace(/[^a-zA-Z0-9_]/g, "_");
        idMapping.set(place.id, newId);
      }

      // Add place using the available action
      petriNetContext.addPlace(newId);
      createdNodes.add(newId);
    });

    // Then add all transitions using the available context actions
    filteredNet.transitions.forEach((transition) => {
      // Ensure the ID is valid for the context
      const newId = transition.id.replace(/[^a-zA-Z0-9_]/g, "_");
      idMapping.set(transition.id, newId);

      // Add transition using the available action
      petriNetContext.addTransition(newId);
      createdNodes.add(newId);
    });

    // Add all connections using the available actions, ensuring both nodes exist
    let connectionsAdded = 0;
    pnmlNet.arcs.forEach((arc) => {
      const sourceId = idMapping.get(arc.source);
      const targetId = idMapping.get(arc.target);

      if (
        sourceId &&
        targetId &&
        createdNodes.has(sourceId) &&
        createdNodes.has(targetId)
      ) {
        // Connect using available action
        petriNetContext.connectNodes(sourceId, targetId);
        connectionsAdded++;
      } else {
        console.warn(
          `Skipping connection from ${arc.source} to ${arc.target}: One or both nodes not found`
        );
      }
    });

    if (connectionsAdded === 0) {
      toast.warning("No valid connections found in the PNML file");
    } else {
      console.log(`Successfully added ${connectionsAdded} connections`);
    }

    // We need to check if places have initial markings, but can't directly set them
    // due to the context structure, so we'll set token flow from start to end
    if (
      petriNetContext.setTokenFlow &&
      createdNodes.has("P0") &&
      createdNodes.has("P_out")
    ) {
      petriNetContext.setTokenFlow("P0", "P_out");
    }

    // Save the imported net
    petriNetContext.savePetriNet(netName);
    petriNetContext.loadPetriNet(petriNetContext.state.currentNetId);
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
