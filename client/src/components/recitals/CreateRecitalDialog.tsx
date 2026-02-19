import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface CreateRecitalInput {
  name: string;
  date: string;
}

interface CreateRecitalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: CreateRecitalInput) => void;
}

export function CreateRecitalDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateRecitalDialogProps) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  const handleSave = () => {
    if (!name.trim() || !date) return;

    onCreate({
      name: name.trim(),
      date,
    });

    setName("");
    setDate("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setName("");
          setDate("");
        }
      }}
    >
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Create Recital</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-recital-name" className="text-gray-700">
              Recital Name
            </Label>
            <Input
              id="create-recital-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Spring Showcase 2026"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-recital-date" className="text-gray-700">
              Recital Date
            </Label>
            <Input
              id="create-recital-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-primary text-white hover:bg-primary/90"
            onClick={handleSave}
            disabled={!name.trim() || !date}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
