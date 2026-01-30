import { Layout } from "@/components/Layout";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Plus, ChevronRight, Music, DollarSign, Save } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDancers, useCreateDancer, useUpdateDancer, useRoutines, useFees, useUpdateRoutine, useUpdateFee } from "@/hooks/useData";
import type { Dancer, Routine, Fee } from "@server/schema";

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

  const handleAddDancer = async () => {
    const newDancer = {
        firstName: "New",
        lastName: "Dancer",
        age: 5,
        level: "Mini" as const,
        status: "Active" as const,
        parentName: "",
        parentPhone: "",
        parentEmail: "",
        studioNotes: ""
    };
    
    const result = await createDancer.mutateAsync(newDancer);
    setSelectedDancerId(result.id);
  };

  const filteredDancers = dancers.filter(d => 
    d.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedDancer = dancers.find(d => d.id === selectedDancerId);
  const dancerRoutines = routines.filter(r => r.dancerIds?.includes(selectedDancerId || ""));
  const dancerFees = fees.filter(f => f.dancerId === selectedDancerId);

  const handleUpdateDancer = (id: string, field: string, value: any) => {
    updateDancer.mutate({ id, data: { [field]: value } });
  };

  const toggleRoutinePaid = (routineId: string, dancerId: string) => {
      const routine = routines.find(r => r.id === routineId);
      if (!routine) return;
      
      const currentPaid = routine.paidDancerIds || [];
      const newPaid = currentPaid.includes(dancerId)
          ? currentPaid.filter(id => id !== dancerId)
          : [...currentPaid, dancerId];
      
      updateRoutine.mutate({ id: routineId, data: { paidDancerIds: newPaid } });
  };

  const toggleFeePaid = (feeId: string) => {
      const fee = fees.find(f => f.id === feeId);
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
                                <Badge variant="outline" className="bg-secondary/50 border-secondary-foreground/20 text-foreground font-normal">
                                    {dancer.level}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge className={dancer.status === "Active" ? "bg-green-100 text-green-700 hover:bg-green-100 border-none shadow-none" : "bg-gray-100 text-gray-500 border-none shadow-none"}>
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

        {/* Dancer Details & Edit Sheet */}
        <Sheet open={!!selectedDancerId} onOpenChange={(open) => !open && setSelectedDancerId(null)}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                {selectedDancer && (
                    <div className="space-y-8 py-6">
                        <div className="flex items-center gap-4 border-b pb-6">
                            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                                {selectedDancer.firstName.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <SheetTitle className="text-2xl font-display">Edit Dancer Profile</SheetTitle>
                                <SheetDescription>Manage information for {selectedDancer.firstName}.</SheetDescription>
                            </div>
                        </div>

                        {/* Basic Info Form */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">General Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">First Name</label>
                                    <Input 
                                        value={selectedDancer.firstName} 
                                        onChange={(e) => handleUpdateDancer(selectedDancer.id, "firstName", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Last Name</label>
                                    <Input 
                                        value={selectedDancer.lastName} 
                                        onChange={(e) => handleUpdateDancer(selectedDancer.id, "lastName", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Age</label>
                                    <Input 
                                        type="number"
                                        value={selectedDancer.age} 
                                        onChange={(e) => handleUpdateDancer(selectedDancer.id, "age", parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Level</label>
                                    <Select 
                                        value={selectedDancer.level} 
                                        onValueChange={(v) => handleUpdateDancer(selectedDancer.id, "level", v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Mini">Mini</SelectItem>
                                            <SelectItem value="Junior">Junior</SelectItem>
                                            <SelectItem value="Teen">Teen</SelectItem>
                                            <SelectItem value="Senior">Senior</SelectItem>
                                            <SelectItem value="Elite">Elite</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Status</label>
                                    <Select 
                                        value={selectedDancer.status} 
                                        onValueChange={(v) => handleUpdateDancer(selectedDancer.id, "status", v)}
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

                        {/* Parent & Emergency Contact */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Family & Emergency</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Parent/Guardian Name</label>
                                    <Input 
                                        value={selectedDancer.parentName || ""} 
                                        onChange={(e) => handleUpdateDancer(selectedDancer.id, "parentName", e.target.value)}
                                        placeholder="e.g. Julia Roberts"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Parent Phone</label>
                                    <Input 
                                        value={selectedDancer.parentPhone || ""} 
                                        onChange={(e) => handleUpdateDancer(selectedDancer.id, "parentPhone", e.target.value)}
                                        placeholder="555-0100"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Parent Email</label>
                                    <Input 
                                        value={selectedDancer.parentEmail || ""} 
                                        onChange={(e) => handleUpdateDancer(selectedDancer.id, "parentEmail", e.target.value)}
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Emergency Contact</label>
                                    <Input 
                                        value={selectedDancer.emergencyContact || ""} 
                                        onChange={(e) => handleUpdateDancer(selectedDancer.id, "emergencyContact", e.target.value)}
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
                                    value={selectedDancer.studioNotes || ""} 
                                    onChange={(e) => handleUpdateDancer(selectedDancer.id, "studioNotes", e.target.value)}
                                    placeholder="Enter allergies, medical conditions, or other important notes..."
                                />
                            </div>
                        </div>

                        {/* Routines Section */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Music className="w-4 h-4" /> Routines
                            </h3>
                            <div className="space-y-2">
                                {dancerRoutines.map(routine => (
                                    <div key={routine.id} className="p-3 border rounded-lg bg-secondary/5 flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{routine.name}</p>
                                            <p className="text-xs text-muted-foreground">{routine.style} • {routine.type}</p>
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
                                {dancerRoutines.length === 0 && <p className="text-sm text-muted-foreground italic">No routines assigned.</p>}
                            </div>
                        </div>

                        {/* Fees Snapshot */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Financial History
                            </h3>
                            <div className="space-y-2">
                                {dancerFees.map(fee => (
                                    <div key={fee.id} className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm">
                                        <div>
                                            <p className="font-medium text-sm">{fee.type}</p>
                                            <p className="text-xs text-muted-foreground">Due: {new Date(fee.dueDate).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold">${fee.amount}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={cn("text-xs font-medium", fee.paid ? "text-green-600" : "text-muted-foreground")}>{fee.paid ? "Paid" : "Unpaid"}</span>
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

                        <Button className="w-full bg-primary text-white" onClick={() => setSelectedDancerId(null)}>
                           <Save className="w-4 h-4 mr-2" /> Save Changes
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}
