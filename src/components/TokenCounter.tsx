
import React from "react";
import { Badge } from "@/components/ui/badge";
import { usePetriNet } from "@/contexts/PetriNetContext";

const TokenCounter: React.FC = () => {
  const { state } = usePetriNet();
  
  // Get places with tokens
  const placeTokens = state.graph.nodes
    .filter(node => node.type === 'place')
    .map(place => ({
      id: place.id,
      tokens: place.tokens || 0
    }));
  
  return (
    <div className="space-y-2">
      {placeTokens.length === 0 ? (
        <p className="text-muted-foreground">No places in the network</p>
      ) : (
        <ul className="space-y-2">
          {placeTokens.map(place => (
            <li key={place.id} className="flex justify-between items-center">
              <span className="font-medium">{place.id}</span>
              <Badge variant={place.tokens > 0 ? "default" : "outline"}>
                {place.tokens} token{place.tokens !== 1 ? 's' : ''}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TokenCounter;
