
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
import { PetriNetProvider } from "@/contexts/PetriNetContext";
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
                      <Button variant="outline" size="sm" onClick={() => toast.info("Graph centered")}>
                        <ZoomIn className="h-4 w-4 mr-2" />
                        Center
                      </Button>
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
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
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
              <Button variant="outline" className="w-1/2" size="sm">
                <Undo className="h-4 w-4 mr-2" />
                Undo
              </Button>
              <Button variant="outline" className="w-1/2" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
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
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="new-place">New Place</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input id="new-place" placeholder="Place name" />
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>
      
      <div>
        <Label htmlFor="new-transition">New Transition</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input id="new-transition" placeholder="Transition name" />
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>
      
      <Separator />
      
      <div>
        <Label>Connect Nodes</Label>
        <div className="space-y-2 mt-1">
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="From node" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dummy">Sample Node</SelectItem>
            </SelectContent>
          </Select>
          
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="To node" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dummy">Sample Node</SelectItem>
            </SelectContent>
          </Select>
          
          <Button className="w-full" size="sm">
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
  return (
    <div className="space-y-4">
      <div>
        <Label>Select Rule</Label>
        <Select>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Choose rule" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="abstraction">Abstraction ψA</SelectItem>
            <SelectItem value="linear-transition">Linear Transition ψT</SelectItem>
            <SelectItem value="linear-place">Linear Place ψP</SelectItem>
            <SelectItem value="dual-abstraction">Dual Abstraction ψD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Target Node</Label>
        <Select>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select target" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dummy">Sample Target</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="pt-1 space-y-2">
        <Button className="w-full" size="sm">Apply Rule</Button>
        <Button variant="outline" className="w-full" size="sm">Apply Random Rule</Button>
      </div>
    </div>
  );
};

// Flow Controls Component
const FlowControls = () => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Start Place</Label>
        <Select>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select start" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dummy">Sample Place</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>End Place</Label>
        <Select>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select end" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dummy">Sample Place</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="pt-1 space-y-2">
        <Button className="w-full" size="sm">Set Token Flow</Button>
        <StartSimulationButton className="w-full" size="sm" />
      </div>
    </div>
  );
};

// Batch Controls Component
const BatchControls = () => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Number of Rules</Label>
        <Input type="number" min={1} defaultValue={1} className="mt-1" />
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox id="random-rules" />
        <Label htmlFor="random-rules">Use random rules</Label>
      </div>
      
      <div>
        <Label>Select Rules</Label>
        <ScrollArea className="h-24 border rounded-md p-2 mt-1">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="rule-abstraction" />
              <Label htmlFor="rule-abstraction">Abstraction ψA</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="rule-linear-transition" />
              <Label htmlFor="rule-linear-transition">Linear Transition ψT</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="rule-linear-place" />
              <Label htmlFor="rule-linear-place">Linear Place ψP</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="rule-dual-abstraction" />
              <Label htmlFor="rule-dual-abstraction">Dual Abstraction ψD</Label>
            </div>
          </div>
        </ScrollArea>
      </div>
      
      <Button className="w-full" size="sm">Generate</Button>
    </div>
  );
};

// Start Simulation Button Component
const StartSimulationButton = ({ className = "", size = "default" }) => {
  return (
    <Button 
      variant="default" 
      className={`bg-green-600 hover:bg-green-700 ${className}`}
      size={size}
      onClick={() => toast.success("Simulation started")}
    >
      <PlayCircle className="h-4 w-4 mr-2" />
      Start Simulation
    </Button>
  );
};

export default Index;
