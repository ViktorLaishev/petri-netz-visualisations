
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { RefreshCw, Undo, FileText, Save, FolderOpen, Play, Square, Maximize, ZoomIn, HelpCircle, Minimize } from "lucide-react";
import { toast } from "sonner";
import PetriNetGraph from "@/components/PetriNetGraph";
import { usePetriNet } from "@/contexts/PetriNetContext";
import LogTable from "@/components/LogTable";
import TokenCounter from "@/components/TokenCounter";
import SavePetriNetDialog from "@/components/SavePetriNetDialog";
import ThemeToggle from "@/components/ThemeToggle";

const Index = () => {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const { state } = usePetriNet();
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const graphContainerRef = useRef(null);

  const openSaveDialog = () => {
    setIsSaveDialogOpen(true);
  };

  const closeSaveDialog = () => {
    setIsSaveDialogOpen(false);
  };

  const toggleGraphFullscreen = () => {
    if (!graphContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      graphContainerRef.current.requestFullscreen().catch(err => {
        toast.error("Error attempting to enable fullscreen mode:", err.message);
      });
      setIsGraphFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsGraphFullscreen(false);
      }
    }
  };

  // Handle fullscreen change events from browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsGraphFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-4">
        <header className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Petri Net Flow Visualizer
                {state.currentNetId && (
                  <Badge variant="outline" className="ml-3">
                    {state.savedNets.find(net => net.id === state.currentNetId)?.name || "Unnamed Net"}
                  </Badge>
                )}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">Interactive visualization tool for Petri nets and token flows</p>
            </div>
            <div className="flex gap-2 items-center">
              <ThemeToggle />
              <Link to="/event-log">
                <Button variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  View Event Log
                </Button>
              </Link>
              <Link to="/saved-nets">
                <Button variant="outline" className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Saved Nets
                </Button>
              </Link>
              <Button variant="default" className="gap-2" onClick={openSaveDialog}>
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
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
                    <StopSimulationButton />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={toggleGraphFullscreen}
                    >
                      {isGraphFullscreen ? (
                        <Minimize className="h-4 w-4 mr-2" />
                      ) : (
                        <Maximize className="h-4 w-4 mr-2" />
                      )}
                      {isGraphFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    </Button>
                    <CenterGraphButton />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div 
                  ref={graphContainerRef} 
                  className="h-[600px] border rounded-md"
                >
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
                <CardTitle>Change Log</CardTitle>
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

      {/* Save Dialog */}
      <SavePetriNetDialog isOpen={isSaveDialogOpen} onClose={closeSaveDialog} />
    </div>
  );
};

// Control Panel Component
const ControlPanel = () => {
  return (
    <Tabs defaultValue="rules" className="h-full">
      <TabsList className="grid grid-cols-3">
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

// Rule Controls Component - Updated to support selecting end nodes
const RuleControls = () => {
  const { state, applyRule, applyRandomRule } = usePetriNet();
  const [selectedRule, setSelectedRule] = useState("");
  const [targetNode, setTargetNode] = useState("");
  const [endNode, setEndNode] = useState("");

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

  // Get valid end nodes based on the selected rule
  const getEndNodeOptions = () => {
    if (!selectedRule) return [];
    
    // Only Linear Transition and Dual Abstraction rules support end nodes
    if (selectedRule === "Linear Transition ψT") {
      return state.graph.nodes
        .filter(node => node.type === 'place')
        .map(node => ({
          label: node.id,
          value: node.id
        }));
    } else if (selectedRule === "Dual Abstraction ψD") {
      return state.graph.nodes
        .filter(node => node.type === 'transition')
        .map(node => ({
          label: node.id,
          value: node.id
        }));
    }
    
    return [];
  };

  // Check if the selected rule supports end nodes
  const supportsEndNode = () => {
    return selectedRule === "Linear Transition ψT" || selectedRule === "Dual Abstraction ψD";
  };

  const handleApplyRule = () => {
    if (selectedRule && targetNode) {
      // Only include endNode if the rule supports it and an end node is selected
      const endNodeToUse = supportsEndNode() && endNode && endNode !== "none" ? endNode : undefined;
      applyRule(selectedRule, targetNode, endNodeToUse);
      toast.success(`Applied ${selectedRule} on ${targetNode}${endNodeToUse ? ` to ${endNodeToUse}` : ''}`);
    } else {
      toast.error("Please select both a rule and a target");
    }
  };

  // Reset end node when rule changes
  useEffect(() => {
    setEndNode("");
  }, [selectedRule]);

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
        <Label>Start Node</Label>
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
              <SelectItem value="no-valid-targets" disabled>
                {!selectedRule ? "Select a rule first" : "No valid targets"}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      
      {/* Show end node selection only for rules that support it */}
      {supportsEndNode() && (
        <div>
          <Label>End Node</Label>
          <Select value={endNode} onValueChange={setEndNode}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select end node (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (default behavior)</SelectItem>
              {getEndNodeOptions().map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
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

// Batch Controls Component with weighted randomization
const BatchControls = () => {
  const { generateBatch } = usePetriNet();
  const [count, setCount] = useState(1);
  const [useRandom, setUseRandom] = useState(true);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [useWeights, setUseWeights] = useState(false);
  const [ruleWeights, setRuleWeights] = useState<{ rule: string; weight: number }[]>([]);
  
  // List of all available rules
  const availableRules = [
    "Abstraction ψA", 
    "Linear Transition ψT", 
    "Linear Place ψP", 
    "Dual Abstraction ψD"
  ];

  // Calculate total weight assigned
  const totalWeight = ruleWeights.reduce((acc, rw) => acc + rw.weight, 0);
  
  // Calculate remaining weight for unassigned rules
  const assignedRulesCount = ruleWeights.length;
  const unassignedRulesCount = selectedRules.length - assignedRulesCount;
  const remainingWeight = Math.max(0, 100 - totalWeight);
  const weightPerUnassignedRule = unassignedRulesCount > 0 ? (remainingWeight / unassignedRulesCount) : 0;

  // Handle rule selection
  const handleRuleSelection = (rule: string, checked: boolean) => {
    if (checked) {
      setSelectedRules(prev => [...prev, rule]);
    } else {
      setSelectedRules(prev => prev.filter(r => r !== rule));
      // Also remove any weights assigned to this rule
      setRuleWeights(prev => prev.filter(rw => rw.rule !== rule));
    }
  };

  // Handle weight change
  const handleWeightChange = (rule: string, weight: number) => {
    const existingWeightIndex = ruleWeights.findIndex(rw => rw.rule === rule);
    
    if (existingWeightIndex >= 0) {
      // Update existing weight
      setRuleWeights(prev => 
        prev.map((rw, idx) => 
          idx === existingWeightIndex ? { ...rw, weight } : rw
        )
      );
    } else {
      // Add new weight
      setRuleWeights(prev => [...prev, { rule, weight }]);
    }
  };

  // Reset weight for a rule
  const resetWeight = (rule: string) => {
    setRuleWeights(prev => prev.filter(rw => rw.rule !== rule));
  };

  // Get the weight for a rule
  const getRuleWeight = (rule: string): number | undefined => {
    const weightEntry = ruleWeights.find(rw => rw.rule === rule);
    return weightEntry?.weight;
  };

  // Handle generate batch
  const handleGenerate = () => {
    generateBatch(count, useRandom, selectedRules, useWeights ? ruleWeights : undefined);
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
      
      {!useRandom && (
        <>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium mb-1">Select Rules</Label>
              {selectedRules.length > 0 && (
                <div className="flex items-center space-x-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="text-muted-foreground">
                        <HelpCircle size={14} />
                      </TooltipTrigger>
                      <TooltipContent className="w-72 p-2">
                        <p>Set the probability weight for each rule. The total weight should not exceed 100%. 
                        Any remaining weight will be distributed evenly among rules without specific weights.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="use-weights" 
                      checked={useWeights}
                      onCheckedChange={setUseWeights}
                    />
                    <Label htmlFor="use-weights" className="text-xs">Use weights</Label>
                  </div>
                </div>
              )}
            </div>
            
            <ScrollArea className="h-48 border rounded-md p-2 mt-1">
              <div className="space-y-3 pr-3">
                {availableRules.map(rule => (
                  <div key={rule} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id={`rule-${rule}`} 
                          checked={selectedRules.includes(rule)}
                          onCheckedChange={(checked) => handleRuleSelection(rule, !!checked)}
                        />
                        <Label htmlFor={`rule-${rule}`} className="text-sm">{rule}</Label>
                      </div>
                      {selectedRules.includes(rule) && useWeights && (
                        <div className="text-xs text-muted-foreground">
                          {getRuleWeight(rule) !== undefined ? (
                            <span>
                              {getRuleWeight(rule)}%
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-5 px-1 ml-1" 
                                onClick={() => resetWeight(rule)}
                              >
                                ×
                              </Button>
                            </span>
                          ) : (
                            <span>{weightPerUnassignedRule.toFixed(1)}% (auto)</span>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedRules.includes(rule) && useWeights && (
                      <div className="pl-6 pr-2">
                        <Slider
                          value={[getRuleWeight(rule) || 0]}
                          min={0}
                          max={100}
                          step={5}
                          onValueChange={(values) => handleWeightChange(rule, values[0])}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {useWeights && selectedRules.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Total assigned:</span>
                  <span className={totalWeight > 100 ? "text-red-500 font-medium" : "font-medium"}>
                    {totalWeight}%
                  </span>
                </div>
                {totalWeight > 100 && (
                  <div className="text-xs text-red-500">
                    Total exceeds 100%. Weights will be normalized.
                  </div>
                )}
                {unassignedRulesCount > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {remainingWeight}% will be distributed among {unassignedRulesCount} unweighted rule(s)
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      
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
      <Play className="h-4 w-4 mr-2" />
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
      <FileText className="h-4 w-4 mr-2" />
      Download CSV
    </Button>
  );
};

const StopSimulationButton = ({ className = "" }) => {
  const { stopSimulation } = usePetriNet();
  return (
    <Button
      variant="destructive"
      className={`bg-red-600 hover:bg-red-700 ${className}`}
      onClick={() => {
        stopSimulation();
        // Don't toast here; feedback provided by animation change
      }}
    >
      <Square className="h-4 w-4 mr-2" />
      Stop Simulation
    </Button>
  );
};

export default Index;
