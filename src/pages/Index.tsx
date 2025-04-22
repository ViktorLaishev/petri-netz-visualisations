
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, PlayCircle, Undo, RefreshCw, Plus, ArrowRight, Download, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import PetriNetGraph from "@/components/PetriNetGraph";
import { PetriNetProvider, usePetriNet } from "@/contexts/PetriNetContext";
import LogTable from "@/components/LogTable";
import TokenCounter from "@/components/TokenCounter";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <PetriNetProvider>
        <div className="container mx-auto p-4">
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Petri Net Flow Visualizer</h1>
            <p className="text-slate-500 dark:text-slate-400">Interactive visualization tool for Petri nets and token flows</p>
          </header>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel - Controls */}
            <div className="lg:col-span-3">
              <ControlPanel />
            </div>
            
            {/* Right Panel - Visualization */}
            <div className="lg:col-span-9">
              <Card className="h-full">
                <CardHeader className="pb-0">
                  <div className="flex justify-between items-center">
                    <CardTitle>Petri Net Visualization</CardTitle>
                    <div className="flex gap-2">
                      <StartSimulationButton />
                      <CenterGraphButton />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="h-[600px] border rounded-md">
                    <PetriNetGraph />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Log Table */}
            <Card>
              <CardHeader className="pb-0">
                <div className="flex justify-between items-center">
                  <CardTitle>Process Log</CardTitle>
                  <DownloadLogButton />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <LogTable />
              </CardContent>
            </Card>
            
            {/* Token Counts */}
            <Card>
              <CardHeader>
                <CardTitle>Token Counts</CardTitle>
              </CardHeader>
              <CardContent>
                <TokenCounter />
              </CardContent>
            </Card>
          </div>
        </div>
      </PetriNetProvider>
    </div>
  );
};

// Control Panel Component
const ControlPanel = () => {
  return (
    <Tabs defaultValue="nodes" className="h-full">
      <TabsList className="grid grid-cols-4">
        <TabsTrigger value="nodes">Nodes</TabsTrigger>
        <TabsTrigger value="rules">Rules</TabsTrigger>
        <TabsTrigger value="flow">Flow</TabsTrigger>
        <TabsTrigger value="batch">Batch</TabsTrigger>
      </TabsList>
      
      <div className="mt-2">
        <Card>
          <CardContent className="pt-6">
            {/* Basic Controls */}
            <div className="mb-4 flex gap-2">
              <UndoButton />
              <ResetButton />
            </div>
            
            <TabsContent value="nodes" className="mt-0">
              <NodeControls />
            </TabsContent>
            
            <TabsContent value="rules" className="mt-0">
              <RuleControls />
            </TabsContent>
            
            <TabsContent value="flow" className="mt-0">
              <FlowControls />
            </TabsContent>
            
            <TabsContent value="batch" className="mt-0">
              <BatchControls />
            </TabsContent>
          </CardContent>
        </Card>
      </div>
    </Tabs>
  );
};

// Node Controls Component
const NodeControls = () => {
  const { state, addPlace, addTransition, connectNodes } = usePetriNet();
  const [newPlace, setNewPlace] = useState("");
  const [newTransition, setNewTransition] = useState("");
  const [fromNode, setFromNode] = useState("");
  const [toNode, setToNode] = useState("");

  // Get all nodes for the connect dropdown
  const nodeOptions = state.graph.nodes.map(node => ({
    label: node.id,
    value: node.id
  }));

  const handleAddPlace = () => {
    if (newPlace) {
      addPlace(newPlace);
      setNewPlace("");
      toast.success(`Added place: ${newPlace}`);
    } else {
      toast.error("Please enter a place name");
    }
  };

  const handleAddTransition = () => {
    if (newTransition) {
      addTransition(newTransition);
      setNewTransition("");
      toast.success(`Added transition: ${newTransition}`);
    } else {
      toast.error("Please enter a transition name");
    }
  };

  const handleConnect = () => {
    if (fromNode && toNode) {
      connectNodes(fromNode, toNode);
      toast.success(`Connected ${fromNode} -> ${toNode}`);
    } else {
      toast.error("Please select both from and to nodes");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="new-place">New Place</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input 
            id="new-place" 
            placeholder="Place name" 
            value={newPlace} 
            onChange={(e) => setNewPlace(e.target.value)} 
          />
          <Button size="sm" onClick={handleAddPlace}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>
      
      <div>
        <Label htmlFor="new-transition">New Transition</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input 
            id="new-transition" 
            placeholder="Transition name" 
            value={newTransition} 
            onChange={(e) => setNewTransition(e.target.value)} 
          />
          <Button size="sm" onClick={handleAddTransition}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>
      
      <Separator />
      
      <div>
        <Label>Connect Nodes</Label>
        <div className="space-y-2 mt-1">
          <Select value={fromNode} onValueChange={setFromNode}>
            <SelectTrigger>
              <SelectValue placeholder="From node" />
            </SelectTrigger>
            <SelectContent>
              {nodeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              {nodeOptions.length === 0 && (
                <SelectItem value="dummy" disabled>No nodes available</SelectItem>
              )}
            </SelectContent>
          </Select>
          
          <Select value={toNode} onValueChange={setToNode}>
            <SelectTrigger>
              <SelectValue placeholder="To node" />
            </SelectTrigger>
            <SelectContent>
              {nodeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              {nodeOptions.length === 0 && (
                <SelectItem value="dummy" disabled>No nodes available</SelectItem>
              )}
            </SelectContent>
          </Select>
          
          <Button className="w-full" size="sm" onClick={handleConnect}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Connect
          </Button>
        </div>
      </div>
    </div>
  );
};

// Rule Controls Component
const RuleControls = () => {
  const { state, applyRule, applyRandomRule } = usePetriNet();
  const [selectedRule, setSelectedRule] = useState("");
  const [targetNode, setTargetNode] = useState("");

  // Get valid targets based on the selected rule
  const getTargetOptions = () => {
    if (!selectedRule) return [];
    
    // Determine node type required for the selected rule
    let requiredType = "";
    if (selectedRule.includes("Abstraction") || selectedRule.includes("Linear Place")) {
      requiredType = "transition";
    } else if (selectedRule.includes("Linear Transition")) {
      requiredType = "place";
    }
    
    // Filter nodes by the required type
    return state.graph.nodes
      .filter(node => node.type === requiredType)
      .map(node => ({
        label: node.id,
        value: node.id
      }));
  };

  const handleApplyRule = () => {
    if (selectedRule && targetNode) {
      applyRule(selectedRule, targetNode);
      toast.success(`Applied ${selectedRule} on ${targetNode}`);
    } else {
      toast.error("Please select both a rule and a target");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Select Rule</Label>
        <Select value={selectedRule} onValueChange={setSelectedRule}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Choose rule" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Abstraction ψA">Abstraction ψA</SelectItem>
            <SelectItem value="Linear Transition ψT">Linear Transition ψT</SelectItem>
            <SelectItem value="Linear Place ψP">Linear Place ψP</SelectItem>
            <SelectItem value="Dual Abstraction ψD">Dual Abstraction ψD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Target Node</Label>
        <Select value={targetNode} onValueChange={setTargetNode}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select target" />
          </SelectTrigger>
          <SelectContent>
            {getTargetOptions().map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            {getTargetOptions().length === 0 && (
              <SelectItem value="dummy" disabled>
                {!selectedRule ? "Select a rule first" : "No valid targets"}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      
      <div className="pt-1 space-y-2">
        <Button 
          className="w-full" 
          size="sm"
          onClick={handleApplyRule}
        >
          Apply Rule
        </Button>
        <Button 
          variant="outline" 
          className="w-full" 
          size="sm"
          onClick={() => {
            applyRandomRule();
            toast.success("Applied random rule");
          }}
        >
          Apply Random Rule
        </Button>
      </div>
    </div>
  );
};

// Flow Controls Component
const FlowControls = () => {
  const { state, setTokenFlow } = usePetriNet();
  const [startPlace, setStartPlace] = useState("");
  const [endPlace, setEndPlace] = useState("");

  // Get all places for the flow dropdowns
  const placeOptions = state.graph.nodes
    .filter(node => node.type === 'place')
    .map(node => ({
      label: node.id,
      value: node.id
    }));

  const handleSetTokenFlow = () => {
    if (startPlace && endPlace) {
      setTokenFlow(startPlace, endPlace);
      toast.success(`Set token flow from ${startPlace} to ${endPlace}`);
    } else {
      toast.error("Please select both start and end places");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Start Place</Label>
        <Select value={startPlace} onValueChange={setStartPlace}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select start" />
          </SelectTrigger>
          <SelectContent>
            {placeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            {placeOptions.length === 0 && (
              <SelectItem value="dummy" disabled>No places available</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>End Place</Label>
        <Select value={endPlace} onValueChange={setEndPlace}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select end" />
          </SelectTrigger>
          <SelectContent>
            {placeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            {placeOptions.length === 0 && (
              <SelectItem value="dummy" disabled>No places available</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      
      <div className="pt-1 space-y-2">
        <Button 
          className="w-full" 
          size="sm"
          onClick={handleSetTokenFlow}
        >
          Set Token Flow
        </Button>
        <StartSimulationButton className="w-full" />
      </div>
    </div>
  );
};

// Batch Controls Component
const BatchControls = () => {
  const { generateBatch } = usePetriNet();
  const [count, setCount] = useState(1);
  const [useRandom, setUseRandom] = useState(true);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);

  const handleGenerate = () => {
    generateBatch(count, useRandom, selectedRules);
    toast.success(`Generated batch with ${count} rules`);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Number of Rules</Label>
        <Input 
          type="number" 
          min={1} 
          defaultValue={1} 
          className="mt-1"
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value) || 1)}
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="random-rules" 
          checked={useRandom} 
          onCheckedChange={(checked) => setUseRandom(!!checked)} 
        />
        <Label htmlFor="random-rules">Use random rules</Label>
      </div>
      
      <div>
        <Label>Select Rules</Label>
        <ScrollArea className="h-24 border rounded-md p-2 mt-1">
          <div className="space-y-2">
            {["Abstraction ψA", "Linear Transition ψT", "Linear Place ψP", "Dual Abstraction ψD"].map(rule => (
              <div key={rule} className="flex items-center space-x-2">
                <Checkbox 
                  id={`rule-${rule}`} 
                  checked={selectedRules.includes(rule)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedRules(prev => [...prev, rule]);
                    } else {
                      setSelectedRules(prev => prev.filter(r => r !== rule));
                    }
                  }}
                />
                <Label htmlFor={`rule-${rule}`}>{rule}</Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      
      <Button 
        className="w-full" 
        size="sm"
        onClick={handleGenerate}
        disabled={!useRandom && selectedRules.length === 0}
      >
        Generate
      </Button>
    </div>
  );
};

// Utility Button Components
const UndoButton = () => {
  const { undo } = usePetriNet();
  
  return (
    <Button 
      variant="outline" 
      className="w-1/2" 
      size="sm"
      onClick={() => {
        undo();
        toast.info("Undid last action");
      }}
    >
      <Undo className="h-4 w-4 mr-2" />
      Undo
    </Button>
  );
};

const ResetButton = () => {
  const { reset } = usePetriNet();
  
  return (
    <Button 
      variant="outline" 
      className="w-1/2" 
      size="sm"
      onClick={() => {
        reset();
        toast.info("Reset to default state");
      }}
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Reset
    </Button>
  );
};

const StartSimulationButton = ({ className = "" }) => {
  const { startSimulation } = usePetriNet();
  
  return (
    <Button 
      variant="default" 
      className={`bg-green-600 hover:bg-green-700 ${className}`}
      onClick={() => {
        startSimulation();
        toast.success("Simulation started");
      }}
    >
      <PlayCircle className="h-4 w-4 mr-2" />
      Start Simulation
    </Button>
  );
};

const CenterGraphButton = () => {
  const { centerGraph } = usePetriNet();
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => {
        centerGraph();
        toast.info("Graph centered");
      }}
    >
      <ZoomIn className="h-4 w-4 mr-2" />
      Center
    </Button>
  );
};

const DownloadLogButton = () => {
  const { downloadLog } = usePetriNet();
  
  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => {
        downloadLog();
        toast.success("Log downloaded");
      }}
    >
      <Download className="h-4 w-4 mr-2" />
      Download CSV
    </Button>
  );
};

export default Index;
