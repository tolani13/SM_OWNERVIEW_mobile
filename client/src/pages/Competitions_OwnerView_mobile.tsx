import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, MapPin, Edit2, CheckCircle2, Plus, Users, DollarSign, Loader2, Trash2 } from "lucide-react";
import { CompetitionRunSheet } from "@/components/CompetitionRunSheet";
import { useState, useMemo, useRef, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  useCompetitions, 
  useCreateCompetition, 
  useUpdateCompetition,
  useDeleteCompetition,
  useConventionClasses, 
  useCreateConventionClass, 
  useUpdateConventionClass, 
  useRoutines, 
  useDancers,
  useCompetitionRegistrations,
  useCreateCompetitionRegistration,
  useDeleteCompetitionRegistration,
  useGenerateCompetitionFees,
  useFees
} from "@/hooks/useData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Competition, ConventionClass, InsertConventionClass, Routine, Dancer } from "@server/schema";
import { toast } from "react-hot-toast";

const DEFAULT_FEE_STRUCTURE = {
  solo: "0",
  duetTrio: "0",
  group: "0",
  largeGroup: "0",
  line: "0",
  production: "0",
  photoFee: "0"
};

export default function Competitions() {
    const queryClient = useQueryClient();
    const { data: competitions = [], isLoading: competitionsLoading } = useCompetitions();
    const { data: conventionClasses = [], isLoading: conventionClassesLoading } = useConventionClasses();
    const { data: routines = [], isLoading: routinesLoading } = useRoutines();
    const { data: dancers = [], isLoading: dancersLoading } = useDancers();

    const createCompetition = useCreateCompetition();
    const deleteCompetition = useDeleteCompetition();
    const createConventionClass = useCreateConventionClass();
    const updateConventionClass = useUpdateConventionClass();

    const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
    const [isAddCompOpen, setIsAddCompOpen] = useState(false);
    const conventionPdfInputRef = useRef<HTMLInputElement>(null);
    const [isImportingConventionPdf, setIsImportingConventionPdf] = useState(false);
    
    // Form state for new competition
    const [newCompName, setNewCompName] = useState("");
    const [newCompLocation, setNewCompLocation] = useState("");
    const [newCompStartDate, setNewCompStartDate] = useState("");
    const [newCompEndDate, setNewCompEndDate] = useState("");

    const handleAddCompetition = async () => {
        if (!newCompName || !newCompStartDate || !newCompEndDate) return;
        
        await createCompetition.mutateAsync({
            name: newCompName,
            location: newCompLocation || "TBD",
            startDate: newCompStartDate,
            endDate: newCompEndDate,
            status: "Upcoming",
            conventionFee: "0",
            paymentDeadline: undefined,
            feeStructure: DEFAULT_FEE_STRUCTURE
        });
        
        setIsAddCompOpen(false);
        setNewCompName("");
        setNewCompLocation("");
        setNewCompStartDate("");
        setNewCompEndDate("");
    };

    const upcomingComps = useMemo(() => 
        competitions.filter(c => c.status === "Upcoming"), 
        [competitions]
    );
    
    const completedComps = useMemo(() => 
        competitions.filter(c => c.status === "Completed"), 
        [competitions]
    );
    
    // Derived state for the modal
    const selectedComp = useMemo(() => 
        competitions.find(c => c.id === selectedCompId),
        [competitions, selectedCompId]
    );

    const {
      data: runSheetEntries = [],
      isLoading: runSheetLoading,
      isError: runSheetError,
    } = useQuery({
      queryKey: ["run-sheet", selectedCompId],
      queryFn: async () => {
        if (!selectedCompId) return [];
        const res = await fetch(`/api/competitions/${selectedCompId}/run-sheet`);
        if (!res.ok) throw new Error("Failed to load run sheet");
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      },
      enabled: !!selectedCompId,
      staleTime: 30_000,
    });

    const compConventionClasses = useMemo(() =>
        conventionClasses
            .filter((cc: ConventionClass) => cc.competitionId === selectedCompId)
            .sort((a: ConventionClass, b: ConventionClass) => (a.startTime || "").localeCompare(b.startTime || "")),
        [conventionClasses, selectedCompId]
    );

    const handleUpdateConventionClass = (id: string, updates: Partial<InsertConventionClass>) => {
        updateConventionClass.mutate({ id, data: updates });
    };

    const addConventionClass = async () => {
        if (!selectedCompId) return;
        
        await createConventionClass.mutateAsync({
            competitionId: selectedCompId,
            day: "Saturday",
            startTime: "09:00",
            endTime: "10:00",
            className: "New Class",
            instructor: "TBD",
            room: "Ballroom A",
            level: "All Levels"
        });
    };

    const handleConventionPdfUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedCompId) return;

        setIsImportingConventionPdf(true);
        const formData = new FormData();
        formData.append("pdf", file);
        formData.append("type", "convention");

        try {
            const response = await fetch(`/api/competitions/${selectedCompId}/parse-pdf`, {
                method: "POST",
                body: formData,
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Failed to import convention PDF");
            }

            queryClient.invalidateQueries({ queryKey: ["conventionClasses"] });
            queryClient.invalidateQueries({ queryKey: ["conventionClasses", selectedCompId] });

            toast.success(`Convention classes imported: ${result.savedCount || result.totalParsed || 0} saved.`);

            if (result.warnings?.length) {
                result.warnings.forEach((warning: string) => toast(warning, { icon: "⚠️" }));
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to import convention PDF");
        } finally {
            setIsImportingConventionPdf(false);
            event.target.value = "";
        }
    };

    if (competitionsLoading || conventionClassesLoading || routinesLoading || dancersLoading) {
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
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-display font-bold">Competitions</h1>
                        <p className="text-muted-foreground">View schedule and results.</p>
                    </div>
                    <Button className="bg-primary text-white hover:bg-primary/90" onClick={() => setIsAddCompOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Add Competition
                    </Button>
                </div>

                {/* Upcoming Section */}
                <section>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-primary" /> Upcoming
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {upcomingComps.map(comp => (
                            <CompetitionCard 
                                key={comp.id} 
                                comp={comp} 
                                onClick={() => setSelectedCompId(comp.id)} 
                            />
                        ))}
                    </div>
                </section>

                {/* Completed Section */}
                <section>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="w-5 h-5" /> Completed
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity">
                        {completedComps.map(comp => (
                            <CompetitionCard 
                                key={comp.id} 
                                comp={comp} 
                                onClick={() => setSelectedCompId(comp.id)} 
                            />
                        ))}
                    </div>
                </section>

                {/* Add Competition Modal */}
                <Dialog open={isAddCompOpen} onOpenChange={setIsAddCompOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Competition</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="e.g. Starbound Nationals" />
                            </div>
                            <div className="space-y-2">
                                <Label>Location</Label>
                                <Input value={newCompLocation} onChange={e => setNewCompLocation(e.target.value)} placeholder="City, State" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input type="date" value={newCompStartDate} onChange={e => setNewCompStartDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input type="date" value={newCompEndDate} onChange={e => setNewCompEndDate(e.target.value)} />
                                </div>
                            </div>
                            <Button className="w-full bg-primary text-white" onClick={handleAddCompetition}>Save Competition</Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Detail Modal */}
                <Dialog open={!!selectedCompId} onOpenChange={(open) => !open && setSelectedCompId(null)}>
                    <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                        {selectedComp && (
                            <>
                                <div className="p-6 border-b bg-secondary/20 flex items-center justify-between gap-4">
                                    <DialogHeader className="space-y-1">
                                        <DialogTitle className="text-2xl font-display">{selectedComp.name}</DialogTitle>
                                        <DialogDescription className="flex items-center gap-4 mt-1">
                                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {selectedComp.location}</span>
                                            <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /> {new Date(selectedComp.startDate).toLocaleDateString()}</span>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={async () => {
                                        if (!selectedCompId) return;
                                        if (!confirm("Delete this competition? This cannot be undone.")) return;
                                        await deleteCompetition.mutateAsync(selectedCompId);
                                        setSelectedCompId(null);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                                    </Button>
                                </div>
                                
                                <Tabs defaultValue="registration" className="flex-1 flex flex-col overflow-hidden">
                                    <div className="px-6 pt-4 border-b">
                                        <TabsList className="bg-transparent border-b-0 p-0 h-auto gap-6">
                                            <TabsTrigger value="registration" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 font-semibold">Registration & Fees</TabsTrigger>
                                            <TabsTrigger value="runsheet" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 font-semibold">Run Sheet</TabsTrigger>
                                            <TabsTrigger value="convention" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 font-semibold">Convention Classes</TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <TabsContent value="registration" className="flex-1 overflow-hidden p-0 m-0">
                                        <ScrollArea className="h-full">
                                            <div className="p-6">
                                                <RegistrationTab competition={selectedComp} routines={routines} dancers={dancers} />
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="runsheet" className="flex-1 overflow-hidden p-0 m-0">
                                        <ScrollArea className="h-full">
                                            <div className="p-6 space-y-4">
                                              <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold">Run Sheet</h3>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => setSelectedCompId(selectedComp.id)}
                                                >
                                                  Refresh
                                                </Button>
                                              </div>

                                              {runSheetLoading && (
                                                <div className="text-muted-foreground">Loading run sheet…</div>
                                              )}

                                              {runSheetError && (
                                                <div className="text-red-500 text-sm">Failed to load run sheet.</div>
                                              )}

                                              {!runSheetLoading && !runSheetError && runSheetEntries.length === 0 && (
                                                <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                                                  No run sheet entries yet. Import a PDF below or add entries manually.
                                                </div>
                                              )}

                                              {!runSheetLoading && runSheetEntries.length > 0 && (
                                                <div className="border rounded-lg overflow-hidden">
                                                  <table className="w-full text-sm">
                                                    <thead className="bg-secondary/30 border-b">
                                                      <tr>
                                                        <th className="p-3 text-left font-semibold">Time</th>
                                                        <th className="p-3 text-left font-semibold">#</th>
                                                        <th className="p-3 text-left font-semibold">Routine</th>
                                                        <th className="p-3 text-left font-semibold">Division</th>
                                                        <th className="p-3 text-left font-semibold">Style</th>
                                                        <th className="p-3 text-left font-semibold">Group</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                      {runSheetEntries.map((e: any, idx: number) => (
                                                        <tr key={e.id || idx} className="hover:bg-gray-50">
                                                          <td className="p-3 font-mono text-primary">{e.performanceTime || "-"}</td>
                                                          <td className="p-3">{e.entryNumber || "-"}</td>
                                                          <td className="p-3 font-semibold">{e.routineName || "(untitled)"}</td>
                                                          <td className="p-3 text-muted-foreground">{e.division || "-"}</td>
                                                          <td className="p-3 text-muted-foreground">{e.style || "-"}</td>
                                                          <td className="p-3 text-muted-foreground">{e.groupSize || "-"}</td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              )}

                                              {/* Full editor (import/review/save) below */}
                                              <CompetitionRunSheet 
                                                competitionId={selectedComp.id} 
                                                homeStudioName="Studio Maestro" 
                                              />
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="convention" className="flex-1 overflow-hidden p-0 m-0">
                                        <div className="p-4 border-b bg-gray-50 flex items-center justify-between gap-3">
                                            <input
                                                ref={conventionPdfInputRef}
                                                type="file"
                                                accept=".pdf"
                                                onChange={handleConventionPdfUpload}
                                                className="hidden"
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isImportingConventionPdf || !selectedCompId}
                                                onClick={() => conventionPdfInputRef.current?.click()}
                                            >
                                                {isImportingConventionPdf ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        Importing...
                                                    </>
                                                ) : (
                                                    "Import Convention PDF"
                                                )}
                                            </Button>
                                            <Button size="sm" onClick={addConventionClass} className="bg-primary text-white" disabled={isImportingConventionPdf}>
                                                <Plus className="w-4 h-4 mr-2" /> Add Class
                                            </Button>
                                        </div>
                                        <ScrollArea className="h-full">
                                            <div className="p-6">
                                                <ConventionTable classes={compConventionClasses} onUpdate={handleUpdateConventionClass} />
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                </Tabs>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </Layout>
    )
}

function CompetitionCard({ comp, onClick }: { comp: Competition, onClick: () => void }) {
    return (
        <Card className="cursor-pointer group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-none bg-white shadow-sm overflow-hidden" onClick={onClick}>
            <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center font-bold text-lg text-primary">
                        {comp.name.charAt(0)}
                    </div>
                    <Badge variant={comp.status === "Upcoming" ? "default" : "secondary"}>
                        {comp.status}
                    </Badge>
                </div>
                <h3 className="text-xl font-bold mb-1">{comp.name}</h3>
                <p className="text-muted-foreground text-sm flex items-center gap-1 mb-4">
                    <MapPin className="w-4 h-4" /> {comp.location}
                </p>
                <div className="text-xs font-medium text-muted-foreground bg-secondary/30 p-2 rounded-md inline-block">
                    {new Date(comp.startDate).toLocaleDateString()} - {new Date(comp.endDate).toLocaleDateString()}
                </div>
            </CardContent>
        </Card>
    )
}

function RegistrationTab({ 
  competition, 
  routines, 
  dancers 
}: { 
  competition: Competition, 
  routines: Routine[], 
  dancers: Dancer[] 
}) {
  const { data: registrationsData = [] } = useCompetitionRegistrations(competition.id);
  const registrations = registrationsData as any[];
  const { data: fees = [] } = useFees();
  const createRegistration = useCreateCompetitionRegistration();
  const deleteRegistration = useDeleteCompetitionRegistration();
  const generateFees = useGenerateCompetitionFees();
  const updateCompetition = useUpdateCompetition();

  const [feeStructure, setFeeStructure] = useState(competition.feeStructure || DEFAULT_FEE_STRUCTURE);
  const [conventionFee, setConventionFee] = useState(competition.conventionFee || "0");
  const [paymentDeadline, setPaymentDeadline] = useState(competition.paymentDeadline || "");

    const competitionTeamDancers = useMemo(() => dancers.filter(d => d.status === "Active" || (d as any).active), [dancers]);

  const handleSaveFeeStructure = () => {
    updateCompetition.mutate({
      id: competition.id,
      data: {
        feeStructure,
        conventionFee,
        paymentDeadline
      }
    });
  };

  const toggleDancerRoutine = async (dancerId: string, routineId: string) => {
    const existing = registrations.find(r => r.dancerId === dancerId && r.routineId === routineId);
    
    if (existing) {
      await deleteRegistration.mutateAsync(existing.id);
    } else {
      await createRegistration.mutateAsync({
        competitionId: competition.id,
        dancerId,
        routineId
      });
    }
  };

  const getDancerRoutines = (dancerId: string) => {
    return routines.filter(r => (r.dancerIds || []).includes(dancerId));
  };

  const getDancerRegisteredRoutines = (dancerId: string) => {
    return registrations.filter(r => r.dancerId === dancerId).map(r => r.routineId);
  };

  const calculateDancerTotal = (dancerId: string) => {
    const dancerRegs = registrations.filter(r => r.dancerId === dancerId);
    let total = 0;

    // Convention fee
    if (parseFloat(conventionFee) > 0) {
      total += parseFloat(conventionFee);
    }

    // Entry fees per routine
    for (const reg of dancerRegs) {
      const routine = routines.find(r => r.id === reg.routineId);
      if (!routine) continue;

      let feeAmount = 0;
      if (routine.type === "Solo") feeAmount = parseFloat(feeStructure.solo);
      else if (routine.type === "Duet" || routine.type === "Trio") feeAmount = parseFloat(feeStructure.duetTrio);
      else if (routine.type === "Small Group") feeAmount = parseFloat(feeStructure.group);
      else if (routine.type === "Large Group") feeAmount = parseFloat(feeStructure.largeGroup);
      else if (routine.type === "Line") feeAmount = parseFloat(feeStructure.line);
      else if (routine.type === "Production") feeAmount = parseFloat(feeStructure.production);

      total += feeAmount;
    }

    // Photo fee
    if (dancerRegs.length > 0 && parseFloat(feeStructure.photoFee || "0") > 0) {
      total += parseFloat(feeStructure.photoFee || "0");
    }

    return total;
  };

  const handleGenerateFees = async () => {
    await generateFees.mutateAsync(competition.id);
  };

  const competitionFees = useMemo(() => fees.filter(f => f.competitionId === competition.id), [fees, competition.id]);
  const feesGenerated = competitionFees.length > 0;

  return (
    <div className="space-y-8">
      {/* Fee Structure Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Fee Structure
          </CardTitle>
          <CardDescription>Set the entry fees for this competition</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Convention Fee</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  className="pl-9"
                  value={conventionFee}
                  onChange={e => setConventionFee(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Solo</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  className="pl-9"
                  value={feeStructure.solo}
                  onChange={e => setFeeStructure({...feeStructure, solo: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duet/Trio</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  className="pl-9"
                  value={feeStructure.duetTrio}
                  onChange={e => setFeeStructure({...feeStructure, duetTrio: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Small Group</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  className="pl-9"
                  value={feeStructure.group}
                  onChange={e => setFeeStructure({...feeStructure, group: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Large Group</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  className="pl-9"
                  value={feeStructure.largeGroup}
                  onChange={e => setFeeStructure({...feeStructure, largeGroup: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Line</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  className="pl-9"
                  value={feeStructure.line}
                  onChange={e => setFeeStructure({...feeStructure, line: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Production</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  className="pl-9"
                  value={feeStructure.production}
                  onChange={e => setFeeStructure({...feeStructure, production: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Photo Fee (Optional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  className="pl-9"
                  value={feeStructure.photoFee || "0"}
                  onChange={e => setFeeStructure({...feeStructure, photoFee: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment Deadline</Label>
            <Input 
              type="date"
              value={paymentDeadline}
              onChange={e => setPaymentDeadline(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveFeeStructure} className="bg-primary text-white">
            Save Fee Structure
          </Button>
        </CardContent>
      </Card>

      {/* Dancer Registration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Dancer Registration
          </CardTitle>
          <CardDescription>Select which dancers are competing and assign their routines</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {competitionTeamDancers.map(dancer => {
              const dancerRoutines = getDancerRoutines(dancer.id);
              const registeredRoutineIds = getDancerRegisteredRoutines(dancer.id);
              
              return (
                <div key={dancer.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{dancer.firstName} {dancer.lastName}</h4>
                    <Badge variant="secondary">{dancerRoutines.length} Available Routines</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {dancerRoutines.map(routine => (
                      <div key={routine.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`${dancer.id}-${routine.id}`}
                          checked={registeredRoutineIds.includes(routine.id)}
                          onCheckedChange={() => toggleDancerRoutine(dancer.id, routine.id)}
                        />
                        <label 
                          htmlFor={`${dancer.id}-${routine.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {routine.name} ({routine.type})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Fee Summary Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Fee Summary
              </CardTitle>
              <CardDescription>Projected fees per dancer</CardDescription>
            </div>
            {!feesGenerated && (
              <Button 
                onClick={handleGenerateFees} 
                className="bg-primary text-white"
                disabled={generateFees.isPending}
              >
                {generateFees.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Fees"
                )}
              </Button>
            )}
            {feesGenerated && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Fees Generated
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 border-b">
                <tr>
                  <th className="p-3 text-left font-semibold">Dancer</th>
                  <th className="p-3 text-left font-semibold">Routines</th>
                  <th className="p-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {competitionTeamDancers.filter(d => getDancerRegisteredRoutines(d.id).length > 0).map(dancer => {
                  const registeredRoutineIds = getDancerRegisteredRoutines(dancer.id);
                  const total = calculateDancerTotal(dancer.id);
                  
                  return (
                    <tr key={dancer.id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium">{dancer.firstName} {dancer.lastName}</td>
                      <td className="p-3 text-muted-foreground">{registeredRoutineIds.length} routines</td>
                      <td className="p-3 text-right font-bold text-primary">${total.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConventionTable({ classes, onUpdate }: { classes: ConventionClass[], onUpdate: (id: string, updates: Partial<InsertConventionClass>) => void }) {
    const [editingId, setEditingId] = useState<string | null>(null);

    if (classes.length === 0) return <div className="text-center p-8 text-muted-foreground">No convention classes scheduled.</div>;

    return (
        <div className="space-y-4">
            {classes.map(cls => {
                const isEditing = editingId === cls.id;
                return (
                    <div key={cls.id} className="flex items-center p-4 border rounded-lg bg-white shadow-sm border-l-4 border-l-orange-300 hover:shadow-md transition-all">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                {isEditing ? (
                                    <Input className="w-24 h-8 font-mono" value={cls.startTime} onChange={e => onUpdate(cls.id, { startTime: e.target.value })} />
                                ) : (
                                    <Badge variant="outline" className="font-mono bg-orange-50 text-orange-700 border-orange-200">{cls.startTime}</Badge>
                                )}
                                
                                {isEditing ? (
                                    <Input className="h-8 font-semibold w-48" value={cls.className} onChange={e => onUpdate(cls.id, { className: e.target.value })} />
                                ) : (
                                    <h4 className="font-semibold text-lg">{cls.className}</h4>
                                )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" /> 
                                    {isEditing ? (
                                        <Input className="h-6 w-32 text-xs" value={cls.instructor} onChange={e => onUpdate(cls.id, { instructor: e.target.value })} />
                                    ) : cls.instructor}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> 
                                    {isEditing ? (
                                        <Input className="h-6 w-24 text-xs" value={cls.room} onChange={e => onUpdate(cls.id, { room: e.target.value })} />
                                    ) : cls.room}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                             {isEditing ? (
                                <Input className="h-8 w-24 text-xs" value={cls.level || ""} onChange={e => onUpdate(cls.id, { level: e.target.value })} />
                            ) : (
                                <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200 text-sm px-3 py-1">
                                    {cls.level}
                                </Badge>
                            )}
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setEditingId(isEditing ? null : cls.id)}
                                className={isEditing ? "bg-primary text-white" : ""}
                            >
                                <Edit2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}