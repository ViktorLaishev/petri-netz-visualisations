
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle } from "lucide-react";

interface UserManualDialogProps {
  trigger?: React.ReactNode;
}

const UserManualDialog = ({ trigger }: UserManualDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            User Manual
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Petri Net Flow Visualizer User Manual</DialogTitle>
          <DialogDescription>
            Learn how to use the Petri Net Flow Visualizer application
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="flow">Token Flow</TabsTrigger>
            <TabsTrigger value="batch">Batch Operations</TabsTrigger>
          </TabsList>
          <ScrollArea className="h-[60vh] mt-2 pr-4">
            <TabsContent value="overview" className="space-y-4">
              <div className="text-sm space-y-4">
                <h3 className="text-lg font-semibold">What is a Petri Net?</h3>
                <p>
                  A Petri Net is a mathematical modeling language used to describe distributed systems.
                  It consists of places (circles), transitions (rectangles), and tokens (dots within places).
                </p>
                
                <h3 className="text-lg font-semibold">Basic Actions</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Undo:</strong> Revert the last change made to the Petri net.</li>
                  <li><strong>Reset:</strong> Reset the Petri net to its default state.</li>
                  <li><strong>Save:</strong> Save the current Petri net for later use.</li>
                  <li><strong>Center:</strong> Center the visualization in the display area.</li>
                  <li><strong>Fullscreen:</strong> View the visualization in fullscreen mode.</li>
                </ul>
                
                <h3 className="text-lg font-semibold">Navigation</h3>
                <p>
                  Use the tabs at the top of the page to navigate to different sections:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Event Log:</strong> View a detailed log of all actions performed.</li>
                  <li><strong>Saved Nets:</strong> Access and load previously saved Petri nets.</li>
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="rules" className="space-y-4">
              <div className="text-sm space-y-4">
                <h3 className="text-lg font-semibold">Applying Rules</h3>
                <p>
                  Rules are transformations that can be applied to the Petri net to modify its structure.
                  To apply a rule:
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Select the desired rule from the dropdown in the Rules tab.</li>
                  <li>Select a start node for the rule application.</li>
                  <li>For Linear Transition and Dual Abstraction, optionally select an end node.</li>
                  <li>Click "Apply Rule" to transform the net.</li>
                </ol>
                
                <h3 className="text-lg font-semibold">Available Rules</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Abstraction ψA:</strong> Simplifies the net by abstracting a transition and its connected places.</li>
                  <li><strong>Linear Transition ψT:</strong> Models a sequence of transitions between places.</li>
                  <li><strong>Linear Place ψP:</strong> Creates a linear sequence of places connected by transitions.</li>
                  <li><strong>Dual Abstraction ψD:</strong> Creates dual abstractions between transitions.</li>
                </ul>
                
                <h3 className="text-lg font-semibold">Random Rule Application</h3>
                <p>
                  Click "Apply Random Rule" to let the system automatically select and apply a rule to a random valid node.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="flow" className="space-y-4">
              <div className="text-sm space-y-4">
                <h3 className="text-lg font-semibold">Setting Token Flow</h3>
                <p>
                  Token flow visualizes the movement of tokens from one place to another in the Petri net.
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to the "Flow" tab in the control panel.</li>
                  <li>Select a start place from the dropdown.</li>
                  <li>Select an end place from the dropdown.</li>
                  <li>Click "Set Token Flow" to visualize the token movement.</li>
                </ol>
                
                <h3 className="text-lg font-semibold">Interpreting Token Flow</h3>
                <p>
                  The visualization will highlight the path that tokens take from the start place to the end place.
                  Places and transitions involved in the token flow will be emphasized in the visualization.
                </p>
                
                <h3 className="text-lg font-semibold">Token Counter</h3>
                <p>
                  The Token Counter section at the bottom of the page displays the current distribution of tokens 
                  across all places in the Petri net.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="batch" className="space-y-4">
              <div className="text-sm space-y-4">
                <h3 className="text-lg font-semibold">Batch Rule Application</h3>
                <p>
                  Batch operations allow you to apply multiple rules at once to rapidly evolve your Petri net.
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to the "Batch" tab in the control panel.</li>
                  <li>Specify the number of rules to apply.</li>
                  <li>Choose whether to use random rules or select specific ones.</li>
                  <li>If selecting specific rules, check the rules you want to apply.</li>
                  <li>Optionally, use weights to control the probability of each rule.</li>
                  <li>Click "Generate" to apply the batch of rules.</li>
                </ol>
                
                <h3 className="text-lg font-semibold">Using Weights</h3>
                <p>
                  When "Use weights" is enabled:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Adjust the slider to set the probability weight for each selected rule.</li>
                  <li>Rules with higher weights will be chosen more frequently.</li>
                  <li>The total weight is displayed at the bottom, with any remaining percentage distributed among unweighted rules.</li>
                </ul>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default UserManualDialog;
