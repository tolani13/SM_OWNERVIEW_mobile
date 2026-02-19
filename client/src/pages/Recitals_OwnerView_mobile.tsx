import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo } from "react";
import { Theater, Plus, Edit2, Ticket, Music, Users, DollarSign, Calendar, MapPin, Clock, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import {
  useRecitals,
  useCreateRecital,
  useUpdateRecital,
  useRecitalLineup,
  useCreateRecitalLineup,
  useUpdateRecitalLineup,
  useRoutines,
  useDancers
} from "@/hooks/useData";
import type { Recital, InsertRecital, RecitalLineup } from "@server/schema";
import { toast } from "react-hot-toast";
import { validateRequired, safeTrim, formatDate, formatCurrency, isValidDate, isPositiveNumber, safeParseNumber } from "@/lib/utils-safe";

export default function Recitals() {
  const { data: recitals = [], isLoading: recitalsLoading } = useRecitals();
  const { data: lineup = [], isLoading: lineupLoading } = useRecitalLineup();
  const { data: routines = [], isLoading: routinesLoading } = useRoutines();
  const { data: dancers = [], isLoading: dancersLoading } = useDancers();

  const createRecital = useCreateRecital();
  const updateRecital = useUpdateRecital();
  const createLineupItem = useCreateRecitalLineup();
  const updateLineupItem = useUpdateRecitalLineup();

  const [selectedRecitalId, setSelectedRecitalId] = useState<string | null>(null);
  const [isAddRecitalOpen, setIsAddRecitalOpen] = useState(false);
  const [editingRecital, setEditingRecital] = useState<Recital | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newRecital, setNewRecital] = useState<Partial<InsertRecital>>({
    status: "Upcoming",
    ticketPrice: "0",
    ticketsAvailable: 0,
    ticketsSold: 0
  });

  const selectedRecital = useMemo(() => 
    recitals.find(r => r.id === selectedRecitalId),
    [recitals, selectedRecitalId]
  );

  const recitalLineup = useMemo(() =>
    lineup
      .filter(l => l.recitalId === selectedRecitalId)
      .sort((a, b) => a.performanceOrder - b.performanceOrder),
    [lineup, selectedRecitalId]
  );

  const getRoutineName = (routineId: string) => {
    const routine = routines.find(r => r.id === routineId);
    return routine ? routine.name : "Unknown";
  };

  const handleSaveRecital = async () => {
    // Validation
    const validation = validateRequired(
      {
        name: safeTrim(newRecital.name),
        date: newRecital.date,
        time: newRecital.time,
        location: safeTrim(newRecital.location)
      },
      ['name', 'date', 'time', 'location'],
      {
        name: 'Please enter a recital name',
        date: 'Please select a date',
        time: 'Please enter a time',
        location: 'Please enter a location'
      }
    );

    if (!validation.isValid) {
      validation.errors.forEach(err => toast.error(err));
      return;
    }

    if (!isValidDate(newRecital.date!)) {
      toast.error('Please enter a valid date');
      return;
    }

    setIsSaving(true);
    try {
      if (editingRecital) {
        await updateRecital.mutateAsync({
          id: editingRecital.id,
          data: {
            ...newRecital,
            name: safeTrim(newRecital.name)!,
            location: safeTrim(newRecital.location)!
          }
        });
        toast.success("Recital updated successfully!");
        setEditingRecital(null);
      } else {
        const created = await createRecital.mutateAsync({
          name: safeTrim(newRecital.name)!,
          date: newRecital.date!,
          time: newRecital.time!,
          location: safeTrim(newRecital.location)!,
          description: safeTrim(newRecital.description) || "",
          ticketPrice: newRecital.ticketPrice || "0",
          ticketsAvailable: newRecital.ticketsAvailable || 0,
          ticketsSold: 0,
          status: "Upcoming"
        });
        toast.success("Recital created successfully!");
      }

      setIsAddRecitalOpen(false);
      setNewRecital({
        status: "Upcoming",
        ticketPrice: "0",
        ticketsAvailable: 0,
        ticketsSold: 0
      });
    } catch (error: any) {
      console.error("Save recital error:", error);
      toast.error(error?.message || "Failed to save recital. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditRecital = (recital: Recital) => {
    setNewRecital(recital);
    setEditingRecital(recital);
    setIsAddRecitalOpen(true);
  };

  const addRoutineToLineup = async (routineId: string) => {
    if (!selectedRecitalId) return;

    const maxOrder = recitalLineup.reduce((max, item) => Math.max(max, item.performanceOrder), 0);

    try {
      await createLineupItem.mutateAsync({
        recitalId: selectedRecitalId,
        routineId,
        performanceOrder: maxOrder + 1,
        act: "Act 1"
      });
      toast.success("Routine added to lineup!");
    } catch (error: any) {
      console.error("Add routine error:", error);
      toast.error(error?.message || "Failed to add routine. Please try again.");
    }
  };

  const moveRoutine = async (lineupItem: RecitalLineup, direction: 'up' | 'down') => {
    const currentIndex = recitalLineup.findIndex(l => l.id === lineupItem.id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === recitalLineup.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetItem = recitalLineup[targetIndex];

    try {
      await updateLineupItem.mutateAsync({
        id: lineupItem.id,
        data: { performanceOrder: targetItem.performanceOrder }
      });
      await updateLineupItem.mutateAsync({
        id: targetItem.id,
        data: { performanceOrder: lineupItem.performanceOrder }
      });
    } catch (error: any) {
      console.error("Move routine error:", error);
      toast.error(error?.message || "Failed to reorder. Please try again.");
    }
  };

  const upcomingRecitals = recitals.filter(r => r.status === "Upcoming");
  const pastRecitals = recitals.filter(r => r.status === "Completed");

  if (recitalsLoading || lineupLoading || routinesLoading || dancersLoading) {
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
          <div className="flex items-center gap-3">
            <Theater className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Recitals</h1>
              <p className="text-muted-foreground">Manage recitals, lineups, and performances.</p>
            </div>
          </div>
          <Dialog open={isAddRecitalOpen} onOpenChange={setIsAddRecitalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white" aria-label="Create new recital">
                <Plus className="w-4 h-4 mr-2" /> New Recital
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingRecital ? "Edit Recital" : "Create New Recital"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Recital Name</Label>
                  <Input
                    placeholder="e.g. Spring Showcase 2025"
                    value={newRecital.name || ""}
                    onChange={(e) => setNewRecital({...newRecital, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newRecital.date || ""}
                      onChange={(e) => setNewRecital({...newRecital, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={newRecital.time || ""}
                      onChange={(e) => setNewRecital({...newRecital, time: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    placeholder="e.g. High School Auditorium"
                    value={newRecital.location || ""}
                    onChange={(e) => setNewRecital({...newRecital, location: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea
                    placeholder="Details about the recital..."
                    value={newRecital.description || ""}
                    onChange={(e) => setNewRecital({...newRecital, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ticket Price</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="pl-9"
                        placeholder="0.00"
                        value={newRecital.ticketPrice || ""}
                        onChange={(e) => setNewRecital({...newRecital, ticketPrice: e.target.value.replace(/[^0-9.]/g, '')})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tickets Available</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={newRecital.ticketsAvailable || ""}
                      onChange={(e) => setNewRecital({...newRecital, ticketsAvailable: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSaveRecital}
                  disabled={isSaving}
                  aria-label="Save recital"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingRecital ? "Update Recital" : "Create Recital"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="bg-white/50 border p-1 h-auto mb-6">
            <TabsTrigger 
              value="upcoming"
              className="py-2 px-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Upcoming
            </TabsTrigger>
            <TabsTrigger 
              value="past"
              className="py-2 px-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Past Recitals
            </TabsTrigger>
          </TabsList>

          {/* UPCOMING RECITALS */}
          <TabsContent value="upcoming" className="space-y-4">
            {upcomingRecitals.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Theater className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming recitals. Create one to get started!</p>
                </CardContent>
              </Card>
            ) : (
              upcomingRecitals.map(recital => {
                const recitalRoutines = lineup.filter(l => l.recitalId === recital.id);
                const ticketsRemaining = recital.ticketsAvailable - recital.ticketsSold;
                const percentSold = recital.ticketsAvailable > 0 
                  ? Math.round((recital.ticketsSold / recital.ticketsAvailable) * 100) 
                  : 0;

                return (
                  <Card 
                    key={recital.id} 
                    className="border-l-4 border-l-primary cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedRecitalId(recital.id)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-xl">{recital.name}</CardTitle>
                          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(recital.date)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {recital.time}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {recital.location}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditRecital(recital); }} aria-label={`Edit ${recital.name}`}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <Music className="w-5 h-5 text-primary" />
                          <div>
                            <div className="text-2xl font-bold">{recitalRoutines.length}</div>
                            <div className="text-xs text-muted-foreground">Routines</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Ticket className="w-5 h-5 text-primary" />
                          <div>
                            <div className="text-2xl font-bold">{recital.ticketsSold}/{recital.ticketsAvailable}</div>
                            <div className="text-xs text-muted-foreground">Tickets Sold</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-primary" />
                          <div>
                            <div className="text-2xl font-bold">{formatCurrency(recital.ticketPrice)}</div>
                            <div className="text-xs text-muted-foreground">Per Ticket</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* PAST RECITALS */}
          <TabsContent value="past" className="space-y-4">
            {pastRecitals.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p>No past recitals.</p>
                </CardContent>
              </Card>
            ) : (
              pastRecitals.map(recital => (
                <Card 
                  key={recital.id}
                  className="opacity-75 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedRecitalId(recital.id)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {recital.name}
                      <Badge variant="outline">Completed</Badge>
                    </CardTitle>
                    <CardDescription>
                      {formatDate(recital.date)} at {recital.time}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* RECITAL DETAIL MODAL */}
        {selectedRecital && (
          <Dialog open={!!selectedRecitalId} onOpenChange={(open) => !open && setSelectedRecitalId(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>{selectedRecital.name} - Lineup</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Performance Order</h3>
                  <Select onValueChange={(routineId) => addRoutineToLineup(routineId)}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Add routine..." />
                    </SelectTrigger>
                    <SelectContent>
                      {routines.map(routine => (
                        <SelectItem key={routine.id} value={routine.id}>
                          {routine.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {recitalLineup.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No routines added yet. Select a routine above to add it to the lineup.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recitalLineup.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                        <div className="font-mono text-sm font-bold text-muted-foreground w-8">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{getRoutineName(item.routineId)}</div>
                          {item.act && (
                            <div className="text-xs text-muted-foreground">{item.act}</div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveRoutine(item, 'up')}
                            disabled={index === 0}
                            aria-label="Move up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveRoutine(item, 'down')}
                            disabled={index === recitalLineup.length - 1}
                            aria-label="Move down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}
