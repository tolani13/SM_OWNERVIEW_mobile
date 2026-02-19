import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Recital } from "@/types/recital";

export type CopyOption =
  | "recital-only"
  | "recital-empty-performances"
  | "recital-with-performances";

interface CopyRecitalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceRecital?: Recital;
  onCopy: (payload: { sourceRecitalId: string; newName: string; option: CopyOption }) => void;
}

export function CopyRecitalDialog({
  open,
  onOpenChange,
  sourceRecital,
  onCopy,
}: CopyRecitalDialogProps) {
  const [newName, setNewName] = useState("");
  const [option, setOption] = useState<CopyOption>("recital-only");

  const defaultName = useMemo(
    () => (sourceRecital ? `${sourceRecital.name} (Copy)` : ""),
    [sourceRecital],
  );

  const canSubmit = Boolean(sourceRecital && newName.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setNewName("");
          setOption("recital-only");
        }
      }}
    >
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Copy Recital</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-gray-700">Copying from</Label>
            <Input value={sourceRecital?.name ?? ""} readOnly className="bg-gray-50" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="copy-recital-name" className="text-gray-700">
              New Recital Name
            </Label>
            <Input
              id="copy-recital-name"
              placeholder={defaultName || "Copied recital name"}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700">Copy Options</Label>
            <Select
              value={option}
              onValueChange={(value) => setOption(value as CopyOption)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recital-only">Recital only</SelectItem>
                <SelectItem value="recital-empty-performances">
                  Recital + empty performances
                </SelectItem>
                <SelectItem value="recital-with-performances">
                  Recital + performances (classes &amp; students)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-primary text-white hover:bg-primary/90"
            disabled={!canSubmit}
            onClick={() => {
              if (!sourceRecital || !newName.trim()) return;

              onCopy({
                sourceRecitalId: sourceRecital.id,
                newName: newName.trim(),
                option,
              });
              onOpenChange(false);
            }}
          >
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
