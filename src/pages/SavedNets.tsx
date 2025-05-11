
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePetriNet } from "@/contexts/PetriNetContext";
import { ArrowLeft, Save, Trash } from "lucide-react";

const SavedNets = () => {
  const { savedNets, loadPetriNet, deletePetriNet, renamePetriNet } = usePetriNet();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setNewName(currentName);
  };

  const handleRename = (id: string) => {
    if (!newName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    
    renamePetriNet(id, newName);
    toast.success("Petri net renamed successfully");
    setEditingId(null);
    setNewName("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setNewName("");
  };

  const handleLoad = (id: string) => {
    loadPetriNet(id);
    toast.success("Petri net loaded successfully");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-4">
        <header className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Saved Petri Nets
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                Manage your saved Petri net configurations
              </p>
            </div>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Editor
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedNets.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">No saved Petri nets yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Go back to the editor and save a Petri net to see it here
                </p>
                <Link to="/" className="block mt-4">
                  <Button variant="default">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Editor
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            savedNets.map((net) => (
              <Card key={net.id} className="relative">
                <CardHeader>
                  {editingId === net.id ? (
                    <div className="flex mb-2">
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                        className="mr-2"
                      />
                      <Button size="sm" onClick={() => handleRename(net.id)}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelRename}
                        className="ml-2"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <CardTitle
                      className="cursor-pointer hover:text-blue-500"
                      onClick={() => handleStartRename(net.id, net.name)}
                    >
                      {net.name}
                    </CardTitle>
                  )}
                  <CardDescription>
                    Saved on {new Date(net.timestamp).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    <p>{net.graph.nodes.length} nodes, {net.graph.edges.length} edges</p>
                    <p>{net.log.length} log entries</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="default" className="w-full" onClick={() => handleLoad(net.id)}>
                      Load
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Petri Net</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{net.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => {
                              deletePetriNet(net.id);
                              toast.success(`Deleted "${net.name}" successfully`);
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedNets;
