/**
 * Competition Run Sheet Component
 * Displays competition schedule with PDF import and inline editing
 * Matches screenshot design with Time | Stage | # | Routine | Dancers | Results | Actions
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, FileText, Edit2, Upload, Plus, Trash2, Save, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

// Types matching backend schema
interface RunSheetEntry {
  id?: string;
  entryNumber?: string;
  routineName: string;
  division: string;
  style: string;
  groupSize: string;
  studioName: string;
  performanceTime: string;
  day?: string;
  notes?: string;
  placement?: string;
  award?: string;
}

interface CompetitionRunSheetProps {
  competitionId: string;
  homeStudioName: string; // e.g., "Studio Maestro"
}

export function CompetitionRunSheet({ competitionId, homeStudioName }: CompetitionRunSheetProps) {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<RunSheetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailsModalEntry, setDetailsModalEntry] = useState<RunSheetEntry | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [lastImportMeta, setLastImportMeta] = useState<{
    parser?: string;
    modeRequested?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing run sheet on mount or competition change
  useEffect(() => {
    loadRunSheet();
  }, [competitionId]);

  const loadRunSheet = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/competitions/${competitionId}/run-sheet`);
      if (!response.ok) throw new Error("Failed to load run sheet");
      const data = await response.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load run sheet");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setImportDialogOpen(true);

    // Reset input so selecting the same file again still fires onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportByType = async (type: "runsheet" | "convention") => {
    if (!pendingFile) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append("pdf", pendingFile);

    try {
      if (type === "runsheet") {
        formData.append("mode", "python");
        const response = await fetch(`/api/competitions/${competitionId}/run-sheet/import`, {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to import run sheet PDF");
        }

        const result = await response.json();

        // Show extracted entries for review (not saved yet)
        setEntries(result.entries);
        setLastImportMeta({
          parser: result.parser || "python",
          modeRequested: result.modeRequested || "python",
        });
        queryClient.invalidateQueries({ queryKey: ["run-sheet", competitionId] });

        toast.success(`Run sheet extracted: ${result.entries.length} entries (${result.parser || "python"} parser). Review and save.`);

        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach((warning: string) => toast(warning, { icon: "⚠️" }));
        }
      } else {
        formData.append("type", "convention");

        const response = await fetch(`/api/competitions/${competitionId}/parse-pdf`, {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to import convention PDF");
        }

        const result = await response.json();
        queryClient.invalidateQueries({ queryKey: ["conventionClasses"] });
        queryClient.invalidateQueries({ queryKey: ["conventionClasses", competitionId] });

        toast.success(`Convention classes imported: ${result.savedCount || result.totalParsed || 0} saved.`);

        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach((warning: string) => toast(warning, { icon: "⚠️" }));
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to import PDF");
    } finally {
      setIsLoading(false);
      setImportDialogOpen(false);
      setPendingFile(null);
    }
  };

  const handleSaveAll = async () => {
    if (entries.length === 0) {
      toast.error("No entries to save");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/competitions/${competitionId}/run-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save run sheet");
      }

      const result = await response.json();
      setEntries(result.entries);
      toast.success(`Saved ${result.savedCount} entries`);
    } catch (error: any) {
      toast.error(error.message || "Failed to save run sheet");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateEntry = async (id: string, updates: Partial<RunSheetEntry>) => {
    try {
      const response = await fetch(`/api/run-sheet/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error("Failed to update entry");

      const updated = await response.json();
      setEntries(prev => prev.map(e => e.id === id ? updated : e));
      toast.success("Entry updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update entry");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Delete this entry?")) return;

    try {
      const response = await fetch(`/api/run-sheet/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete entry");

      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success("Entry deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete entry");
    }
  };

  const handleAddEntry = () => {
    const newEntry: RunSheetEntry = {
      entryNumber: "",
      routineName: "New Routine",
      division: "Junior",
      style: "Jazz",
      groupSize: "Solo",
      studioName: homeStudioName,
      performanceTime: "10:00",
      day: "Friday"
    };
    setEntries(prev => [...prev, newEntry]);
  };

  const isHomeStudio = (studioName: string) => {
    return studioName.toLowerCase().includes(homeStudioName.toLowerCase());
  };

  const handleUpdateLocalEntry = (index: number, updates: Partial<RunSheetEntry>) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, ...updates } : e));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handlePDFUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="bg-white"
            disabled={isLoading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import PDF
          </Button>
          <Button
            onClick={handleAddEntry}
            variant="outline"
            className="bg-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </Button>
        </div>
        <Button
          onClick={handleSaveAll}
          className="bg-primary text-white"
          disabled={isSaving || entries.length === 0}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save All
            </>
          )}
        </Button>
      </div>

      {lastImportMeta && (
        <div className="p-3 rounded-lg border bg-amber-50 text-sm text-amber-900 flex flex-wrap gap-3 items-center">
          <span><strong>Import mode:</strong> {lastImportMeta.modeRequested || "python"}</span>
          <span><strong>Parser:</strong> {lastImportMeta.parser || "python"}</span>
          <span className="text-amber-700">Please review extracted rows before saving.</span>
        </div>
      )}

      {/* Run Sheet Table */}
      {entries.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-lg bg-gray-50">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">No entries yet. Import a PDF or add entries manually.</p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import PDF
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-[#FAF8F3]">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F1E8] border-b-2 border-[#E8E2D5]">
              <tr>
                <th className="p-3 text-left font-semibold text-gray-700">Time</th>
                <th className="p-3 text-left font-semibold text-gray-700">Stage</th>
                <th className="p-3 text-center font-semibold text-gray-700">#</th>
                <th className="p-3 text-left font-semibold text-gray-700">Routine</th>
                <th className="p-3 text-left font-semibold text-gray-700">Dancers</th>
                <th className="p-3 text-left font-semibold text-gray-700">Results</th>
                <th className="p-3 text-right font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2D5]">
              {entries.map((entry, index) => {
                const isEditing = editingId === entry.id || !entry.id;
                const isHome = isHomeStudio(entry.studioName);

                return (
                  <tr
                    key={entry.id || index}
                    className={cn(
                      "hover:bg-[#F5F1E8] transition-colors",
                      isHome && "bg-[#FFF9F0]"
                    )}
                  >
                    {/* Time */}
                    <td className="p-3 font-medium text-[#D97706] w-[80px]">
                      {isEditing ? (
                        <Input
                          value={entry.performanceTime}
                          onChange={e => handleUpdateLocalEntry(index, { performanceTime: e.target.value })}
                          className="h-8 w-20 bg-white"
                          placeholder="10:00"
                        />
                      ) : (
                        entry.performanceTime
                      )}
                    </td>

                    {/* Stage */}
                    <td className="p-3 w-[100px]">
                      {isEditing ? (
                        <Input
                          value={entry.day || ""}
                          onChange={e => handleUpdateLocalEntry(index, { day: e.target.value })}
                          className="h-8 w-full bg-white"
                          placeholder="Main"
                        />
                      ) : (
                        <span className="text-gray-600">{entry.day || "-"}</span>
                      )}
                    </td>

                    {/* Entry Number */}
                    <td className="p-3 text-center font-bold text-gray-600 w-[60px]">
                      {isEditing ? (
                        <Input
                          value={entry.entryNumber || ""}
                          onChange={e => handleUpdateLocalEntry(index, { entryNumber: e.target.value })}
                          className="h-8 w-full text-center bg-white"
                          placeholder="#"
                        />
                      ) : (
                        entry.entryNumber || "-"
                      )}
                    </td>

                    {/* Routine */}
                    <td className="p-3 min-w-[250px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {/* Star for home studio */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-5 w-5 p-0 rounded-full",
                              isHome ? "text-[#D97706] hover:text-[#B45309]" : "text-gray-300 hover:text-[#D97706]"
                            )}
                            onClick={() => {
                              const newStudio = isHome ? "Competitor Studio" : homeStudioName;
                              handleUpdateLocalEntry(index, { studioName: newStudio });
                            }}
                            title={isHome ? "Home studio routine" : "Mark as home studio"}
                          >
                            <Star className={cn("w-4 h-4", isHome && "fill-[#D97706]")} />
                          </Button>

                          {/* Routine Name */}
                          {isEditing ? (
                            <Input
                              value={entry.routineName}
                              onChange={e => handleUpdateLocalEntry(index, { routineName: e.target.value })}
                              className="h-8 font-semibold bg-white"
                              placeholder="Routine Name"
                            />
                          ) : (
                            <span className="font-semibold text-gray-900">{entry.routineName}</span>
                          )}
                        </div>

                        {/* Division, Style, Group Size */}
                        <div className="text-xs text-gray-500 ml-7">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input
                                value={entry.division}
                                onChange={e => handleUpdateLocalEntry(index, { division: e.target.value })}
                                className="h-7 text-xs bg-white"
                                placeholder="Division"
                              />
                              <Input
                                value={entry.groupSize}
                                onChange={e => handleUpdateLocalEntry(index, { groupSize: e.target.value })}
                                className="h-7 text-xs bg-white"
                                placeholder="Group Size"
                              />
                              <Input
                                value={entry.style}
                                onChange={e => handleUpdateLocalEntry(index, { style: e.target.value })}
                                className="h-7 text-xs bg-white"
                                placeholder="Style"
                              />
                            </div>
                          ) : (
                            `${entry.division} ${entry.groupSize} ${entry.style}`
                          )}
                        </div>

                        {/* Notes (if present) */}
                        {entry.notes && !isEditing && (
                          <div className="text-xs italic text-gray-600 ml-7 mt-1">
                            {entry.notes}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Dancers (Studio Name) */}
                    <td className="p-3 w-[150px]">
                      {isEditing ? (
                        <Input
                          value={entry.studioName}
                          onChange={e => handleUpdateLocalEntry(index, { studioName: e.target.value })}
                          className="h-8 text-xs bg-white"
                          placeholder="Studio Name"
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{entry.studioName}</span>
                      )}
                    </td>

                    {/* Results */}
                    <td className="p-3 w-[150px]">
                      <div className="space-y-1">
                        {entry.placement && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                            {entry.placement}
                          </Badge>
                        )}
                        {entry.award && (
                          <div className="text-xs text-purple-600 font-medium">{entry.award}</div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Details/Notes Modal */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailsModalEntry(entry)}
                          className={cn("h-8 w-8 p-0", entry.notes && "text-[#D97706]")}
                          title="View/edit details"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>

                        {/* Edit Toggle */}
                        <Button
                          variant={isEditing ? "default" : "ghost"}
                          size="sm"
                          onClick={() => {
                            if (isEditing && entry.id) {
                              handleUpdateEntry(entry.id, entry);
                              setEditingId(null);
                            } else {
                              setEditingId(entry.id || null);
                            }
                          }}
                          className={cn("h-8 w-8 p-0", isEditing && "bg-[#D97706] text-white hover:bg-[#B45309]")}
                          title={isEditing ? "Save" : "Edit"}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        {/* Delete */}
                        {entry.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id!)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={!!detailsModalEntry} onOpenChange={(open) => !open && setDetailsModalEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Entry Details</DialogTitle>
            <DialogDescription>
              {detailsModalEntry?.routineName}
            </DialogDescription>
          </DialogHeader>
          {detailsModalEntry && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Notes / Corrections</Label>
                <Textarea
                  value={detailsModalEntry.notes || ""}
                  onChange={e => setDetailsModalEntry({ ...detailsModalEntry, notes: e.target.value })}
                  placeholder="Enter judges notes, corrections, or comments..."
                  className="min-h-[100px] bg-yellow-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Placement</Label>
                  <Input
                    value={detailsModalEntry.placement || ""}
                    onChange={e => setDetailsModalEntry({ ...detailsModalEntry, placement: e.target.value })}
                    placeholder="1st, 2nd, 3rd..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Award</Label>
                  <Input
                    value={detailsModalEntry.award || ""}
                    onChange={e => setDetailsModalEntry({ ...detailsModalEntry, award: e.target.value })}
                    placeholder="Special award..."
                  />
                </div>
              </div>
              <Button
                onClick={() => {
                  if (detailsModalEntry.id) {
                    handleUpdateEntry(detailsModalEntry.id, detailsModalEntry);
                  } else {
                    // Update local state for unsaved entries
                    const index = entries.findIndex(e => e === detailsModalEntry);
                    if (index !== -1) {
                      handleUpdateLocalEntry(index, detailsModalEntry);
                    }
                  }
                  setDetailsModalEntry(null);
                }}
                className="w-full bg-[#D97706] text-white hover:bg-[#B45309]"
              >
                Save Details
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Type Picker (single Import PDF button routes to 2 flows) */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) setPendingFile(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import PDF As</DialogTitle>
            <DialogDescription>
              Choose what this PDF contains so it can be parsed correctly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Button
              className="w-full justify-start"
              variant="outline"
              disabled={isLoading}
              onClick={() => handleImportByType("runsheet")}
            >
              Competition Run Sheet (Python Parser)
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              disabled={isLoading}
              onClick={() => handleImportByType("convention")}
            >
              Convention Classes (usually 2–3 pages)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
