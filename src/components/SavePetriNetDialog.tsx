
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePetriNet } from "@/contexts/PetriNetContext";

interface SavePetriNetDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SavePetriNetDialog: React.FC<SavePetriNetDialogProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState("");
  const { dispatch } = usePetriNet();

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please enter a name for your Petri net");
      return;
    }

    dispatch({
      type: "SAVE_PETRI_NET",
      payload: { name }
    });
    toast.success(`Petri net "${name}" saved successfully`);
    setName("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Petri Net</DialogTitle>
          <DialogDescription>
            Enter a name to save the current Petri net configuration
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              placeholder="My Petri Net"
              className="col-span-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SavePetriNetDialog;
