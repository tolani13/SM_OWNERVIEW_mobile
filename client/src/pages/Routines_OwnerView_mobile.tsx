import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, ChevronRight, Music, Save, DollarSign, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  useRoutines,
  useCreateRoutine,
  useUpdateRoutine,
  useDeleteRoutine,
  useDancers,
} from "@/hooks/useData";
import type { InsertRoutine } from "@server/schema";

export default function Routines() {
    const { data: routines = [], isLoading: routinesLoading } = useRoutines();
    const { data: dancers = [], isLoading: dancersLoading } = useDancers();
    const createRoutine = useCreateRoutine();
    const updateRoutineMutation = useUpdateRoutine();
    const deleteRoutine = useDeleteRoutine();

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newRoutine, setNewRoutine] = useState<Partial<InsertRoutine>>({
        name: "",
        style: "Jazz",
        type: "Large Group",
        dancerIds: [],
        costumeFee: "150",
        paidDancerIds: []
    });

    const filteredRoutines = routines.filter(r => 
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.style.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedRoutine = routines.find(r => r.id === selectedRoutineId);

    const updateRoutine = (id: string, field: string, value: any) => {
        updateRoutineMutation.mutate({ id, data: { [field]: value } });
    };

    const handleCreateRoutine = async () => {
        if (!newRoutine.name || !newRoutine.style || !newRoutine.type) return;
        
        await createRoutine.mutateAsync({
            name: newRoutine.name,
            style: newRoutine.style,
            type: newRoutine.type,
            dancerIds: newRoutine.dancerIds || [],
            costumeFee: newRoutine.costumeFee || "0",
            paidDancerIds: newRoutine.paidDancerIds || []
        });
        
        setIsCreateOpen(false);
        setNewRoutine({ name: "", style: "Jazz", type: "Large Group", dancerIds: [], costumeFee: "150", paidDancerIds: [] });
    };

    const toggleDancer = (routineId: string, dancerId: string) => {
        const routine = routines.find(r => r.id === routineId);
        if (!routine) return;
        
        const newDancers = routine.dancerIds?.includes(dancerId)
            ? routine.dancerIds.filter(id => id !== dancerId)
            : [...(routine.dancerIds || []), dancerId];
            
        updateRoutine(routineId, "dancerIds", newDancers);
    };

    const toggleNewRoutineDancer = (dancerId: string) => {
        const currentIds = newRoutine.dancerIds || [];
        const newIds = currentIds.includes(dancerId) 
            ? currentIds.filter(id => id !== dancerId)
            : [...currentIds, dancerId];
        setNewRoutine({ ...newRoutine, dancerIds: newIds });
    };

    const toggleDancerPaid = (routineId: string, dancerId: string) => {
        const routine = routines.find(r => r.id === routineId);
        if (!routine) return;
        
        const currentPaid = routine.paidDancerIds || [];
        const newPaid = currentPaid.includes(dancerId)
            ? currentPaid.filter(id => id !== dancerId)
            : [...currentPaid, dancerId];
            
        updateRoutineMutation.mutate({ id: routineId, data: { paidDancerIds: newPaid } });
    };

    const toggleNewRoutineDancerPaid = (dancerId: string) => {
        const currentPaid = newRoutine.paidDancerIds || [];
        const newPaid = currentPaid.includes(dancerId)
            ? currentPaid.filter(id => id !== dancerId)
            : [...currentPaid, dancerId];
        setNewRoutine({ ...newRoutine, paidDancerIds: newPaid });
    };

    if (routinesLoading || dancersLoading) {
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
                        <h1 className="text-3xl font-display font-bold">Routines</h1>
                        <p className="text-muted-foreground">Manage your studio's repertoire.</p>
                    </div>
                    <Button className="bg-primary text-white hover:bg-primary/90" onClick={() => setIsCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> New Routine
                    </Button>
                </div>

                <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm">
                    <Search className="w-5 h-5 text-muted-foreground ml-2" />
                    <Input 
                        placeholder="Search routines by name or style..." 
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
                                <TableHead>Routine Name</TableHead>
                                <TableHead>Style</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Dancers</TableHead>
                                <TableHead className="text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRoutines.map((routine) => (
                                <TableRow 
                                    key={routine.id} 
                                    className="cursor-pointer hover:bg-secondary/10"
                                    onClick={() => setSelectedRoutineId(routine.id)}
                                >
                                    <TableCell className="font-medium">{routine.name}</TableCell>
                                    <TableCell>{routine.style}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{routine.type || "Unknown"}</Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                                        {(routine.dancerIds || []).length} Dancers
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

                <Dialog open={!!selectedRoutineId} onOpenChange={(open) => !open && setSelectedRoutineId(null)}>
                    <DialogContent className="max-w-3xl w-[720px] max-h-[90vh] overflow-y-auto">
                        {selectedRoutine && (
                            <div className="space-y-8 py-2">
                                <div className="flex items-center justify-between border-b pb-4">
                                    <div>
                                      <DialogHeader className="space-y-1">
                                        <DialogTitle className="text-2xl font-display">Edit Routine</DialogTitle>
                                        <DialogDescription>Update details and cast for {selectedRoutine.name}.</DialogDescription>
                                      </DialogHeader>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        if (!confirm("Delete this routine? This cannot be undone.")) return;
                                        deleteRoutine.mutate(selectedRoutine.id, {
                                          onSuccess: () => setSelectedRoutineId(null),
                                        });
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">General Information</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 col-span-2">
                                            <Label>Routine Name</Label>
                                            <Input 
                                                value={selectedRoutine.name} 
                                                onChange={(e) => updateRoutine(selectedRoutine.id, "name", e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Style</Label>
                                            <Select 
                                                value={selectedRoutine.style} 
                                                onValueChange={(v) => updateRoutine(selectedRoutine.id, "style", v)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {["Jazz", "Lyrical", "Contemporary", "Tap", "Hip Hop", "Ballet", "Open"].map(s => (
                                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Type</Label>
                                            <Select 
                                                value={selectedRoutine.type} 
                                                onValueChange={(v) => updateRoutine(selectedRoutine.id, "type", v)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {["Solo", "Duet", "Trio", "Small Group", "Large Group", "Line", "Production"].map(t => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-semibold text-lg">Cast List</h3>
                                        <Badge variant="secondary">{(selectedRoutine.dancerIds || []).length} Selected</Badge>
                                    </div>
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="grid grid-cols-1 gap-y-3 gap-x-4">
                                                {dancers.map(dancer => {
                                                    const isSelected = selectedRoutine.dancerIds?.includes(dancer.id);
                                                    return (
                                                    <div key={dancer.id} className="flex items-center justify-between p-2 rounded hover:bg-secondary/10">
                                                        <div className="flex items-center space-x-3">
                                                            <Checkbox 
                                                                id={`dancer-${dancer.id}`} 
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleDancer(selectedRoutine.id, dancer.id)}
                                                            />
                                                            <label 
                                                                htmlFor={`dancer-${dancer.id}`}
                                                                className="text-sm font-medium leading-none cursor-pointer"
                                                            >
                                                                {dancer.firstName} {dancer.lastName.charAt(0)}.
                                                            </label>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="flex items-center gap-2">
                                                                <Label htmlFor={`paid-${dancer.id}`} className="text-xs text-muted-foreground">Paid</Label>
                                                                <Switch 
                                                                    id={`paid-${dancer.id}`}
                                                                    checked={(selectedRoutine.paidDancerIds || []).includes(dancer.id)}
                                                                    onCheckedChange={() => toggleDancerPaid(selectedRoutine.id, dancer.id)}
                                                                    className="scale-75 origin-right"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )})}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">Costume Details</h3>
                                    <div className="space-y-2">
                                        <Label>Costume Name</Label>
                                        <Input 
                                            placeholder="e.g. Red Sparkle Dress"
                                            value={selectedRoutine.costumeName || ""} 
                                            onChange={(e) => updateRoutine(selectedRoutine.id, "costumeName", e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Costume Fee Per Dancer</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                type="text"
                                                inputMode="numeric"
                                                className="pl-9"
                                                value={selectedRoutine.costumeFee} 
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9.]/g, '');
                                                    updateRoutine(selectedRoutine.id, "costumeFee", value);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button className="w-full bg-primary text-white" onClick={() => setSelectedRoutineId(null)}>
                                    <Save className="w-4 h-4 mr-2" /> Save Changes
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="max-w-3xl w-[720px] max-h-[90vh] overflow-y-auto">
                        <div className="space-y-8 py-2">
                            <div className="border-b pb-4">
                                <DialogHeader>
                                  <DialogTitle className="text-2xl font-display mb-1">Create Routine</DialogTitle>
                                  <DialogDescription>Add a new routine to your studio.</DialogDescription>
                                </DialogHeader>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">General Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-2">
                                        <Label>Routine Name</Label>
                                        <Input 
                                            value={newRoutine.name} 
                                            onChange={(e) => setNewRoutine({...newRoutine, name: e.target.value})}
                                            placeholder="e.g. Rhythm of the Night"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Style</Label>
                                        <Select 
                                            value={newRoutine.style} 
                                            onValueChange={(v: any) => setNewRoutine({...newRoutine, style: v})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {["Jazz", "Lyrical", "Contemporary", "Tap", "Hip Hop", "Ballet", "Open"].map(s => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <Select 
                                            value={newRoutine.type} 
                                            onValueChange={(v: any) => setNewRoutine({...newRoutine, type: v})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {["Solo", "Duet", "Trio", "Small Group", "Large Group", "Line", "Production"].map(t => (
                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-lg">Cast List</h3>
                                    <Badge variant="secondary">{(newRoutine.dancerIds || []).length} Selected</Badge>
                                </div>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                            {dancers.map(dancer => (
                                                <div key={dancer.id} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`new-dancer-${dancer.id}`} 
                                                        checked={(newRoutine.dancerIds || []).includes(dancer.id)}
                                                        onCheckedChange={() => toggleNewRoutineDancer(dancer.id)}
                                                    />
                                                    <label 
                                                        htmlFor={`new-dancer-${dancer.id}`}
                                                        className="text-sm font-medium leading-none cursor-pointer"
                                                    >
                                                        {dancer.firstName} {dancer.lastName.charAt(0)}.
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Costume Details</h3>
                                <div className="space-y-2">
                                    <Label>Costume Fee Per Dancer</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            type="text"
                                            inputMode="numeric"
                                            className="pl-9"
                                            value={newRoutine.costumeFee} 
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                                setNewRoutine({...newRoutine, costumeFee: value});
                                            }}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button className="w-full bg-primary text-white" onClick={handleCreateRoutine}>
                                <Plus className="w-4 h-4 mr-2" /> Create Routine
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </Layout>
    )
}