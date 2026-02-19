import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Layout } from "@/components/Layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, ChevronRight, Music, DollarSign, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDancers,
  useCreateDancer,
  useUpdateDancer,
  useRoutines,
  useFees,
  useUpdateRoutine,
  useUpdateFee,
} from "@/hooks/useData";
import type { Dancer } from "@server/schema";

const DANCER_LEVEL_OPTIONS = ["mini", "junior", "teen", "senior", "elite"] as const;

export default function Dancers() {
  const { data: dancers = [], isLoading: dancersLoading } = useDancers();
  const { data: routines = [], isLoading: routinesLoading } = useRoutines();
  const { data: fees = [], isLoading: feesLoading } = useFees();
  const createDancer = useCreateDancer();
  const updateDancer = useUpdateDancer();
  const updateRoutine = useUpdateRoutine();
  const updateFee = useUpdateFee();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [editableDancer, setEditableDancer] = useState<any | null>(null);

  const selectedDancer = dancers.find((d) => d.id === selectedDancerId);

  useEffect(() => {
    setEditableDancer(selectedDancer ? { ...selectedDancer } : null);
  }, [selectedDancerId, selectedDancer]);

  const handleAddDancer = async () => {
    const newDancer = {
      firstName: "New",
      lastName: "Dancer",
      age: 5,
      level: "mini" as const,
      status: "Active" as const,
      parentName: "",
      parentPhone: "",
      parentEmail: "",
      studioNotes: "",
    };

    const result = await createDancer.mutateAsync(newDancer);
    setSelectedDancerId(result.id);
  };

  const filteredDancers = (dancers as any[]).filter(
    (d) =>
      d.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.lastName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const dancerRoutines = routines.filter((r) => r.dancerIds?.includes(selectedDancerId || ""));
  const dancerFees = fees.filter((f) => f.dancerId === selectedDancerId);

  const handleSaveDancer = async () => {
    if (!editableDancer) return;

    const parsedAge = Number(editableDancer.age);
    if (!Number.isInteger(parsedAge) || parsedAge < 2 || parsedAge > 25) {
      toast.error("Age is required and must be a whole number between 2 and 25.");
      return;
    }

    if (
      typeof editableDancer.level !== "string" ||
      !DANCER_LEVEL_OPTIONS.includes(editableDancer.level as (typeof DANCER_LEVEL_OPTIONS)[number])
    ) {
      toast.error("Please select a valid level.");
      return;
    }

    try {
      await updateDancer.mutateAsync({
        id: editableDancer.id,
        data: {
          firstName: editableDancer.firstName,
          lastName: editableDancer.lastName,
          age: parsedAge,
          level: editableDancer.level,
          status: editableDancer.status,
          parentName: editableDancer.parentName,
          parentPhone: editableDancer.parentPhone,
          parentEmail: editableDancer.parentEmail,
          emergencyContact: editableDancer.emergencyContact,
          studioNotes: editableDancer.studioNotes,
        },
      });
      toast.success("Dancer updated successfully");
      setSelectedDancerId(null);
    } catch (error: any) {
      console.error("Save dancer error:", error);
      toast.error(error?.message || "Failed to save dancer. Please try again.");
    }
  };

  const toggleRoutinePaid = (routineId: string, dancerId: string) => {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;

    const currentPaid = routine.paidDancerIds || [];
    const newPaid = currentPaid.includes(dancerId)
      ? currentPaid.filter((id) => id !== dancerId)
      : [...currentPaid, dancerId];

    updateRoutine.mutate({ id: routineId, data: { paidDancerIds: newPaid } });
  };

  const toggleFeePaid = (feeId: string) => {
    const fee = fees.find((f) => f.id === feeId);
    if (!fee) return;
    updateFee.mutate({ id: feeId, data: { paid: !fee.paid } });
  };

  if (dancersLoading || routinesLoading || feesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Dancers</h1>
            <p className="text-muted-foreground">Manage your studio roster.</p>
          </div>
          <Button className="bg-primary text-white hover:bg-primary/90" onClick={handleAddDancer}>
            <Plus className="w-4 h-4 mr-2" /> Add Dancer
          </Button>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm">
          <Search className="w-5 h-5 text-muted-foreground ml-2" />
          <Input
            placeholder="Search dancers..."
            className="border-none shadow-none focus-visible:ring-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden group">
          <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDancers.map((dancer) => (
                <TableRow
                  key={dancer.id}
                  className="cursor-pointer hover:bg-secondary/10"
                  onClick={() => setSelectedDancerId(dancer.id)}
                >
                  <TableCell className="font-medium">
                    {dancer.firstName} {dancer.lastName.charAt(0)}.
                  </TableCell>
                  <TableCell>{dancer.age}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-secondary/50 border-secondary-foreground/20 text-foreground font-normal"
                    >
                      {dancer.level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        dancer.status === "Active"
                          ? "bg-green-100 text-green-700 hover:bg-green-100 border-none shadow-none"
                          : "bg-gray-100 text-gray-500 border-none shadow-none"
                      }
                    >
                      {dancer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!selectedDancerId} onOpenChange={(open) => !open && setSelectedDancerId(null)}>
          <DialogContent className="max-w-3xl w-[720px] max-h-[90vh] overflow-y-auto">
            {selectedDancer && (
              <div className="space-y-8 py-2">
                <div className="flex items-center gap-4 border-b pb-4">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                    {selectedDancer.firstName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <DialogHeader className="space-y-1">
                      <DialogTitle className="text-2xl font-display">Edit Dancer Profile</DialogTitle>
                      <DialogDescription>
                        Manage information for {selectedDancer.firstName}.
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                </div>

                {/* General Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">General Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">First Name</label>
                      <Input
                        value={editableDancer?.firstName || ""}
                        onChange={(e) =>
                          setEditableDancer((prev) => (prev ? { ...prev, firstName: e.target.value } : prev))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Last Name</label>
                      <Input
                        value={editableDancer?.lastName || ""}
                        onChange={(e) =>
                          setEditableDancer((prev) => (prev ? { ...prev, lastName: e.target.value } : prev))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Age</label>
                      <Input
                        type="number"
                        min={2}
                        max={25}
                        step={1}
                        value={editableDancer?.age ?? ""}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          setEditableDancer((prev) => {
                            if (!prev) return prev;
                            if (rawValue === "") return { ...prev, age: undefined };
                            const age = Number.parseInt(rawValue, 10);
                            return { ...prev, age: Number.isNaN(age) ? undefined : age };
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Level</label>
                      <Select
                        value={editableDancer?.level}
                        onValueChange={(v) =>
                          setEditableDancer((prev) => (prev ? { ...prev, level: v as any } : prev))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DANCER_LEVEL_OPTIONS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Status</label>
                      <Select
                        value={editableDancer?.status ?? undefined}
                        onValueChange={(v) =>
                          setEditableDancer((prev) => (prev ? { ...prev, status: v as Dancer["status"] } : prev))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Family & Emergency */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Family & Emergency</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Parent/Guardian Name</label>
                      <Input
                        value={editableDancer?.parentName || ""}
                        onChange={(e) =>
                          setEditableDancer((prev) => (prev ? { ...prev, parentName: e.target.value } : prev))
                        }
                        placeholder="e.g. Julia Roberts"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Parent Phone</label>
                      <Input
                        value={editableDancer?.parentPhone || ""}
                        onChange={(e) =>
                          setEditableDancer((prev) => (prev ? { ...prev, parentPhone: e.target.value } : prev))
                        }
                        placeholder="555-0100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Parent Email</label>
                      <Input
                        value={editableDancer?.parentEmail || ""}
                        onChange={(e) =>
                          setEditableDancer((prev) => (prev ? { ...prev, parentEmail: e.target.value } : prev))
                        }
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Emergency Contact</label>
                      <Input
                        value={editableDancer?.emergencyContact || ""}
                        onChange={(e) =>
                          setEditableDancer((prev) => (prev ? { ...prev, emergencyContact: e.target.value } : prev))
                        }
                        placeholder="Name & Phone"
                      />
                    </div>
                  </div>
                </div>

                {/* Studio Notes */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Studio Notes</h3>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Medical / Allergy / Other</label>
                    <textarea
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                      value={editableDancer?.studioNotes || ""}
                      onChange={(e) =>
                        setEditableDancer((prev) => (prev ? { ...prev, studioNotes: e.target.value } : prev))
                      }
                      placeholder="Enter allergies, medical conditions, or other important notes..."
                    />
                  </div>
                </div>

                {/* Routines */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Music className="w-4 h-4" /> Routines
                  </h3>
                  <div className="space-y-2">
                    {dancerRoutines.map((routine) => (
                      <div
                        key={routine.id}
                        className="p-3 border rounded-lg bg-secondary/5 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{routine.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {routine.style} • {routine.type}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">${routine.costumeFee}</Badge>
                          <Switch
                            checked={(routine.paidDancerIds || []).includes(selectedDancer.id)}
                            onCheckedChange={() => toggleRoutinePaid(routine.id, selectedDancer.id)}
                          />
                        </div>
                      </div>
                    ))}
                    {dancerRoutines.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No routines assigned.</p>
                    )}
                  </div>
                </div>

                {/* Fees */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Financial History
                  </h3>
                  <div className="space-y-2">
                    {dancerFees.map((fee) => (
                      <div
                        key={fee.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm"
                      >
                        <div>
                          <p className="font-medium text-sm">{fee.type}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(fee.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold">${fee.amount}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-xs font-medium",
                                fee.paid ? "text-green-600" : "text-muted-foreground",
                              )}
                            >
                              {fee.paid ? "Paid" : "Unpaid"}
                            </span>
                            <Switch
                              checked={fee.paid}
                              onCheckedChange={() => toggleFeePaid(fee.id)}
                              className="data-[state=checked]:bg-green-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button className="w-full bg-primary text-white" onClick={handleSaveDancer}>
                  <Save className="w-4 h-4 mr-2" /> Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}