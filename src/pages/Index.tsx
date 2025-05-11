import React, { useState } from "react";
import { usePetriNet } from "@/contexts/PetriNetContext";
import PetriNetGraph from "@/components/PetriNetGraph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { LogTable } from "@/components/LogTable";
import { TokenCounter } from "@/components/TokenCounter";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoIcon, UndoIcon, RotateCcwIcon, PlayIcon, PauseIcon, CogIcon, DownloadIcon } from "lucide-react";
import SavePetriNetDialog from "@/components/SavePetriNetDialog";

const Index: React.FC = () => {
  const {
    state,
    addPlace,
    addTransition,
    connectNodes,
    addToken,
    removeToken,
    applyRule,
    applyRandomRule,
    setTokenFlow,
    startSimulation,
    stopSimulation,
    undo,
    reset,
    centerGraph,
    downloadLog,
    generateBatch,
    savePetriNet,
    loadPetriNet,
    deletePetriNet,
    renamePetriNet,
    generateEventLog,
    downloadEventLog,
    savedNets
  } = usePetriNet();
  const [placeId, setPlaceId] = useState("p1");
  const [transitionId, setTransitionId] = useState("t1");
  const [sourceNodeId, setSourceNodeId] = useState("p1");
  const [targetNodeId, setTargetNodeId] = useState("t1");
  const [startPlaceId, setStartPlaceId] = useState("p1");
  const [endPlaceId, setEndPlaceId] = useState("p2");
  const [rule, setRule] = useState("Abstraction ψA");
  const [targetId, setTargetId] = useState("t1");
  const [endNodeId, setEndNodeId] = useState("");
  const [batchCount, setBatchCount] = useState(1);
  const [useRandom, setUseRandom] = useState(false);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [ruleWeights, setRuleWeights] = useState<{ rule: string; weight: number }[]>([]);
  const [isSaveDialogVisible, setIsSaveDialogVisible] = useState(false);
  const [isLoadDialogVisible, setIsLoadDialogVisible] = useState(false);
  const [isRenameDialogVisible, setIsRenameDialogVisible] = useState(false);
  const [selectedNetId, setSelectedNetId] = useState<string | null>(null);
  const [renameNetId, setRenameNetId] = useState<string | null>(null);
  const [renameNetName, setRenameNetName] = useState("");
  
  const rules = ["Abstraction ψA", "Linear Transition ψT", "Linear Place ψP", "Dual Abstraction ψD"];
  
  const handleAddPlace = () => {
    addPlace(placeId);
    setPlaceId((prev) => `p${parseInt(prev.slice(1)) + 1}`);
  };
  
  const handleAddTransition = () => {
    addTransition(transitionId);
    setTransitionId((prev) => `t${parseInt(prev.slice(1)) + 1}`);
  };
  
  const handleConnectNodes = () => {
    connectNodes(sourceNodeId, targetNodeId);
  };
  
  const handleAddToken = () => {
    addToken(startPlaceId);
  };
  
  const handleRemoveToken = () => {
    removeToken(startPlaceId);
  };
  
  const handleSetTokenFlow = () => {
    setTokenFlow(startPlaceId, endPlaceId);
  };
  
  const handleApplyRule = () => {
    applyRule(rule, targetId, endNodeId);
  };
  
  const handleApplyRandomRule = () => {
    applyRandomRule();
  };
  
  const handleGenerateBatch = () => {
    generateBatch(batchCount, useRandom, selectedRules, ruleWeights);
  };
  
  const handleRuleSelect = (rule: string) => {
    setSelectedRules((prev) => {
      if (prev.includes(rule)) {
        return prev.filter((r) => r !== rule);
      } else {
        return [...prev, rule];
      }
    });
  };
  
  const handleRuleWeightChange = (rule: string, weight: number) => {
    setRuleWeights((prev) => {
      const existingRule = prev.find((rw) => rw.rule === rule);
      if (existingRule) {
        return prev.map((rw) => (rw.rule === rule ? { ...rw, weight } : rw));
      } else {
        return [...prev, { rule, weight }];
      }
    });
  };
  
  const handleOpenSaveDialog = () => {
    setIsSaveDialogVisible(true);
  };
  
  const handleCloseSaveDialog = () => {
    setIsSaveDialogVisible(false);
  };
  
  const handleOpenLoadDialog = () => {
    setIsLoadDialogVisible(true);
  };
  
  const handleCloseLoadDialog = () => {
    setIsLoadDialogVisible(false);
  };
  
  const handleLoadPetriNet = (id: string) => {
    loadPetriNet(id);
    handleCloseLoadDialog();
  };
  
  const handleDeletePetriNet = (id: string) => {
    deletePetriNet(id);
  };
  
  const handleOpenRenameDialog = (id: string) => {
    setRenameNetId(id);
    setRenameNetName(savedNets.find(net => net.id === id)?.name || "");
    setIsRenameDialogVisible(true);
  };
  
  const handleCloseRenameDialog = () => {
    setIsRenameDialogVisible(false);
    setRenameNetId(null);
    setRenameNetName("");
  };
  
  const handleRenamePetriNet = () => {
    if (renameNetId) {
      renamePetriNet(renameNetId, renameNetName);
      handleCloseRenameDialog();
    }
  };
  
  const handleGenerateEventLog = async () => {
    try {
      await generateEventLog();
      toast.success("Event log generated successfully!");
    } catch (error) {
      console.error("Error generating event log:", error);
      toast.error("Failed to generate event log.");
    }
  };
  
  const handleDownloadEventLog = () => {
    downloadEventLog();
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Petri Net Editor</h1>
      
      <Tabs defaultValue="graph" className="space-y-4">
        <TabsList>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="control">Control Panel</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="event-log">Event Log</TabsTrigger>
        </TabsList>
        
        <TabsContent value="graph" className="outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Petri Net Graph</CardTitle>
              <CardDescription>Visualize and interact with the Petri Net graph.</CardDescription>
            </CardHeader>
            <CardContent>
              <PetriNetGraph/>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="control" className="outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Control Panel</CardTitle>
              <CardDescription>Add nodes, connect them, and manipulate tokens.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Add Place */}
                <div>
                  <Label htmlFor="placeId">Place ID</Label>
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      id="placeId"
                      value={placeId}
                      onChange={(e) => setPlaceId(e.target.value)}
                    />
                    <Button onClick={handleAddPlace}>Add Place</Button>
                  </div>
                </div>
                
                {/* Add Transition */}
                <div>
                  <Label htmlFor="transitionId">Transition ID</Label>
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      id="transitionId"
                      value={transitionId}
                      onChange={(e) => setTransitionId(e.target.value)}
                    />
                    <Button onClick={handleAddTransition}>Add Transition</Button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Connect Nodes */}
                <div>
                  <Label htmlFor="sourceNodeId">Source Node ID</Label>
                  <Input
                    type="text"
                    id="sourceNodeId"
                    value={sourceNodeId}
                    onChange={(e) => setSourceNodeId(e.target.value)}
                  />
                  <Label htmlFor="targetNodeId">Target Node ID</Label>
                  <Input
                    type="text"
                    id="targetNodeId"
                    value={targetNodeId}
                    onChange={(e) => setTargetNodeId(e.target.value)}
                  />
                  <Button onClick={handleConnectNodes}>Connect Nodes</Button>
                </div>
                
                {/* Add/Remove Token */}
                <div>
                  <Label htmlFor="startPlaceId">Place ID</Label>
                  <Input
                    type="text"
                    id="startPlaceId"
                    value={startPlaceId}
                    onChange={(e) => setStartPlaceId(e.target.value)}
                  />
                  <div className="flex space-x-2">
                    <Button onClick={handleAddToken}>Add Token</Button>
                    <Button onClick={handleRemoveToken}>Remove Token</Button>
                  </div>
                </div>
              </div>
              
              {/* Set Token Flow */}
              <div>
                <Label htmlFor="startPlaceId">Start Place ID</Label>
                <Input
                  type="text"
                  id="startPlaceId"
                  value={startPlaceId}
                  onChange={(e) => setStartPlaceId(e.target.value)}
                />
                <Label htmlFor="endPlaceId">End Place ID</Label>
                <Input
                  type="text"
                  id="endPlaceId"
                  value={endPlaceId}
                  onChange={(e) => setEndPlaceId(e.target.value)}
                />
                <Button onClick={handleSetTokenFlow}>Set Token Flow</Button>
              </div>
              
              {/* Apply Rule */}
              <div>
                <Label htmlFor="rule">Rule</Label>
                <Select onValueChange={setRule}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a rule"/>
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((rule) => (
                      <SelectItem key={rule} value={rule}>{rule}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label htmlFor="targetId">Target ID</Label>
                <Input
                  type="text"
                  id="targetId"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                />
                <Label htmlFor="endNodeId">End Node ID (Optional)</Label>
                <Input
                  type="text"
                  id="endNodeId"
                  value={endNodeId}
                  onChange={(e) => setEndNodeId(e.target.value)}
                />
                <Button onClick={handleApplyRule}>Apply Rule</Button>
              </div>
              
              {/* Apply Random Rule */}
              <div>
                <Button onClick={handleApplyRandomRule}>Apply Random Rule</Button>
              </div>
              
              {/* Generate Batch */}
              <div>
                <Label htmlFor="batchCount">Batch Count</Label>
                <Input
                  type="number"
                  id="batchCount"
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value))}
                />
                <div className="flex items-center space-x-2 mt-2">
                  <Switch id="useRandom" checked={useRandom} onCheckedChange={setUseRandom}/>
                  <Label htmlFor="useRandom">Use Random Rules</Label>
                </div>
                
                {!useRandom && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">Select Rules:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {rules.map((rule) => (
                        <div key={rule} className="flex items-center space-x-2">
                          <Checkbox
                            id={`rule-${rule}`}
                            checked={selectedRules.includes(rule)}
                            onCheckedChange={() => handleRuleSelect(rule)}
                          />
                          <Label htmlFor={`rule-${rule}`}>{rule}</Label>
                        </div>
                      ))}
                    </div>
                    
                    {selectedRules.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">Set Rule Weights:</p>
                        {selectedRules.map((rule) => (
                          <div key={rule} className="flex items-center space-x-2">
                            <Label htmlFor={`weight-${rule}`} className="w-24">{rule}:</Label>
                            <Slider
                              id={`weight-${rule}`}
                              defaultValue={[ruleWeights.find((rw) => rw.rule === rule)?.weight || 0]}
                              max={100}
                              step={1}
                              onValueChange={(value) => handleRuleWeightChange(rule, value[0])}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <Button onClick={handleGenerateBatch}>Generate Batch</Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={startSimulation} disabled={state.simulationActive}>
                      <PlayIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start Simulation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={stopSimulation} disabled={!state.simulationActive}>
                      <PauseIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop Simulation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={undo} disabled={state.history.length <= 1}>
                      <UndoIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Undo</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={reset}>
                      <RotateCcwIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={centerGraph}>
                      <CogIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Center Graph</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={downloadLog}>
                      <DownloadIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download Log</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={handleGenerateEventLog}>
                      <InfoIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Generate Event Log</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={handleDownloadEventLog}>
                      <DownloadIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download Event Log</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={handleOpenSaveDialog}>
                      <InfoIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save Petri Net</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline" size="icon" onClick={handleOpenLoadDialog}>
                      <InfoIcon className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Load Petri Net</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="log" className="outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Action Log</CardTitle>
              <CardDescription>Review the history of actions performed on the Petri Net.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border">
                <LogTable/>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tokens" className="outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Token Counter</CardTitle>
              <CardDescription>See the number of tokens in each place.</CardDescription>
            </CardHeader>
            <CardContent>
              <TokenCounter/>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="event-log" className="outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Event Log</CardTitle>
              <CardDescription>View the generated event log.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border">
                {state.eventLog ? (
                  <LogTable/>
                ) : (
                  <p className="text-muted-foreground">No event log generated yet.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <SavePetriNetDialog isOpen={isSaveDialogVisible} onClose={handleCloseSaveDialog}/>
      
      {/* Load Petri Net Dialog */}
      {isLoadDialogVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Load Petri Net</h2>
            <ul>
              {savedNets.map((net) => (
                <li key={net.id} className="flex justify-between items-center py-2 border-b">
                  <span>{net.name}</span>
                  <div>
                    <Button variant="outline" onClick={() => handleLoadPetriNet(net.id)}>Load</Button>
                    <Button variant="destructive" onClick={() => handleDeletePetriNet(net.id)}>Delete</Button>
                    <Button variant="secondary" onClick={() => handleOpenRenameDialog(net.id)}>Rename</Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={handleCloseLoadDialog}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Rename Petri Net Dialog */}
      {isRenameDialogVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Rename Petri Net</h2>
            <Label htmlFor="renameNetName">New Name</Label>
            <Input
              type="text"
              id="renameNetName"
              value={renameNetName}
              onChange={(e) => setRenameNetName(e.target.value)}
            />
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={handleCloseRenameDialog}>Cancel</Button>
              <Button onClick={handleRenamePetriNet}>Rename</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
