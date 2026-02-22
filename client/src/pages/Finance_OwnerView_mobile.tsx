import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Edit2,
  Plus,
  Calendar,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TuitionHubPanel } from "@/components/finance/TuitionHubPanel";
import { FinanceAccountingPanel } from "@/components/finance/FinanceAccountingPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useFees, useUpdateFee, useCreateFee, useDancers, useCompetitions, useRoutines, useUpdateRoutine } from "@/hooks/useData";
import type { Fee } from "@server/schema";

const parseAmount = (amount: string | number | undefined): number => {
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") return parseFloat(amount) || 0;
  return 0;
};

const TUITION_RATES: Record<string, number> = {
  Mini: 120,
  Junior: 150,
  Teen: 175,
  Senior: 200,
  Elite: 225,
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getDancerName = (dancerId: string | undefined, dancers: any[]) => {
  if (!dancerId) return "Unknown";
  const dancer = dancers.find((d) => d.id === dancerId);
  return dancer ? `${dancer.firstName} ${dancer.lastName}` : "Unknown";
};

const getRoutineName = (routineId: string | undefined, routines: any[]) => {
  if (!routineId) return "Unknown";
  const routine = routines.find((r) => r.id === routineId);
  return routine ? routine.name : "Unknown";
};

// Helper to get month index in a timezone-safe way
const getMonthIndexFromDueDate = (dueDate: any): number => {
  if (!dueDate) return -1;
  const d = new Date(dueDate);
  // Use UTC month so "YYYY-MM-01T00:00:00.000Z" stays in its intended month
  return d.getUTCMonth();
};

export default function Finance() {
  const { data: fees = [], isLoading: feesLoading } = useFees();
  const { data: dancers = [], isLoading: dancersLoading } = useDancers();
  const { data: competitions = [], isLoading: competitionsLoading } = useCompetitions();
  const { data: routines = [], isLoading: routinesLoading } = useRoutines();
  const updateFee = useUpdateFee();
  const createFee = useCreateFee();
  const updateRoutine = useUpdateRoutine();

  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);

  // Tuition State
  const [tuitionRates, setTuitionRates] = useState(TUITION_RATES);
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false);
  const [rateEffectiveDate, setRateEffectiveDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [paidOverrides, setPaidOverrides] = useState<Record<string, boolean>>({});

  // Costume Edit State
  const [editingCostumeFee, setEditingCostumeFee] = useState<{
    feeId: string;
    costumeName: string;
    amount: number;
  } | null>(null);

  // Tuition Grid Logic
  const [tuitionMatrix, setTuitionMatrix] = useState<
    Record<string, Record<number, any>>
  >({});

  // Build tuition matrix from fees and dancers (fixed month alignment)
  useEffect(() => {
    const matrix: Record<string, Record<number, any>> = {};

    dancers.forEach((dancer) => {
      matrix[dancer.id] = {};
      MONTHS.forEach((_, index) => {
        const existing = fees.find(
          (f: Fee) =>
            f.dancerId === dancer.id &&
            f.type === "Tuition" &&
            getMonthIndexFromDueDate(f.dueDate) === index,
        );

        if (existing) {
          const paid = paidOverrides[existing.id] ?? existing.paid;
          matrix[dancer.id][index] = { ...existing, paid };
        } else {
          const dancerLevel = (dancer as any).level as string | undefined;
          const rate = dancerLevel ? tuitionRates[dancerLevel] ?? 0 : 0;
          matrix[dancer.id][index] = {
            id: `virt-tuition-${dancer.id}-${index}`,
            type: "Tuition",
            amount: rate,
            paid: false,
            // store an ISO date; month interpreted via getUTCMonth above
            dueDate: new Date(2024, index, 1).toISOString(),
            dancerId: dancer.id,
            isVirtual: true,
          };
        }
      });
    });

    setTuitionMatrix(matrix);
  }, [fees, tuitionRates, dancers, paidOverrides]);

  const toggleFeePaid = (id: string) => {
    const fee = fees.find((f) => f.id === id);
    const currentPaid = paidOverrides[id] ?? fee?.paid ?? false;
    setPaidOverrides((prev) => ({ ...prev, [id]: !currentPaid }));
    if (!fee) return;
    updateFee.mutate({ id, data: { paid: !currentPaid } });
  };

  if (feesLoading || dancersLoading || competitionsLoading || routinesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  const hasAnyData = fees.length > 0 || dancers.length > 0;

  const renderEmptyFinance = () => (
    <Layout>
      <div className="flex items-center justify-center h-72">
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-xl font-semibold">No finance data yet</h2>
          <p className="text-muted-foreground text-sm">
            Add dancers and fees to see tuition, competition, and costume tracking.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/dancers">Add a dancer</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/competitions">Go to competitions</a>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );

  if (!hasAnyData) {
    return renderEmptyFinance();
  }

  const toggleTuitionMonth = (dancerId: string, monthIndex: number) => {
    const fee = tuitionMatrix[dancerId]?.[monthIndex];
    if (!fee) return;

    if (fee.isVirtual) {
      createFee.mutate({
        type: "Tuition",
        amount: String(fee.amount),
        paid: true,
        dueDate: fee.dueDate,
        dancerId: fee.dancerId,
      });
      setTuitionMatrix((prev) => ({
        ...prev,
        [dancerId]: {
          ...(prev[dancerId] || {}),
          [monthIndex]: { ...fee, paid: true },
        },
      }));
    } else {
      toggleFeePaid(fee.id);
      setTuitionMatrix((prev) => ({
        ...prev,
        [dancerId]: {
          ...(prev[dancerId] || {}),
          [monthIndex]: { ...fee, paid: !fee.paid },
        },
      }));
    }
  };

  // Tuition Summary Stats
  const allTuitionFees = Object.values(tuitionMatrix).flatMap((m) =>
    Object.values(m),
  );
  const totalTuitionProjected = allTuitionFees.reduce(
    (sum, f: any) => sum + parseAmount(f.amount),
    0,
  );
  const totalTuitionPaid = allTuitionFees
    .filter((f: any) => f.paid)
    .reduce((sum, f: any) => sum + parseAmount(f.amount), 0);
  const percentPaid =
    Math.round((totalTuitionPaid / totalTuitionProjected) * 100) || 0;

  // Comp Fees
  const compFees = fees.filter((f) => f.type === "Competition");

  // Costume Fees
  const costumeFees = fees.filter((f) => f.type === "Costume");

  const costumeFeesByDancer = dancers
    .map((dancer) => {
      const dFees = costumeFees.filter((f) => f.dancerId === dancer.id);
      if (dFees.length === 0) return null;

      const total = dFees.reduce(
        (sum, f) => sum + parseAmount(f.amount),
        0,
      );
      const paid = dFees
        .filter((f) => f.paid)
        .reduce((sum, f) => sum + parseAmount(f.amount), 0);
      const unpaid = total - paid;

      return {
        dancer,
        fees: dFees,
        total,
        paid,
        unpaid,
      };
    })
    .filter(Boolean) as any[];

  const selectedComp = competitions.find((c) => c.id === selectedCompId);
  const selectedCompEntries = compFees.filter(
    (f) => f.competitionId === selectedCompId,
  );
  const compTotal = selectedCompEntries.reduce(
    (s, f) => s + parseAmount(f.amount),
    0,
  );
  const compPaid = selectedCompEntries
    .filter((f) => f.paid)
    .reduce((s, f) => s + parseAmount(f.amount), 0);
  const compUnpaid = compTotal - compPaid;

  const handleSaveCostume = () => {
    if (!editingCostumeFee) return;

    updateFee.mutate({
      id: editingCostumeFee.feeId,
      data: { amount: String(editingCostumeFee.amount) },
    });

    const fee = fees.find((f) => f.id === editingCostumeFee.feeId);
    if (fee && fee.routineId) {
      updateRoutine.mutate({
        id: fee.routineId,
        data: { costumeName: editingCostumeFee.costumeName },
      });
    }

    setEditingCostumeFee(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Finance</h1>
          <p className="text-muted-foreground">
            Track studio tuition, costumes, and competition fees.
          </p>
        </div>

        <FinanceAccountingPanel />

        <Tabs defaultValue="studio" className="w-full">
          <TabsList className="bg-white/50 border p-1 h-auto mb-6">
            <TabsTrigger
              value="studio"
              className="py-2 px-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Tuition
            </TabsTrigger>
            <TabsTrigger
              value="competitions"
              className="py-2 px-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Comp Fees
            </TabsTrigger>
            <TabsTrigger
              value="costumes"
              className="py-2 px-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Costumes
            </TabsTrigger>
          </TabsList>

          {/* TUITION TAB */}
          <TabsContent
            value="studio"
            className="animate-in fade-in slide-in-from-bottom-2"
          >
            <Card className="border-none shadow-sm bg-white overflow-hidden group">
              <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
              <CardHeader className="pb-4">
                <CardTitle>Dancer Finance Hub</CardTitle>
              </CardHeader>
              <CardContent>
                <TuitionHubPanel />
              </CardContent>
            </Card>

            <Card className="mt-6 border-none shadow-sm bg-white overflow-hidden group">
              <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Tuition Snapshot & Monthly Rates</CardTitle>
                  <CardDescription>
                    Projected annual tuition and active rates by level.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRateDialogOpen(true)}
                >
                  <Edit2 className="w-3 h-3 mr-2" /> Manage Rates
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-primary/5 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Annual Tuition Projected
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        ${totalTuitionProjected.toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Collected YTD: <span className="font-semibold text-foreground">${totalTuitionPaid.toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                      <span>Collection progress</span>
                      <span>{percentPaid}%</span>
                    </div>
                    <Progress value={percentPaid} className="h-2" indicatorClassName="bg-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(tuitionRates).map(([level, rate]) => (
                    <div key={level} className="rounded-lg border bg-secondary/15 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{level}</p>
                      <p className="text-base font-semibold text-foreground">${rate}/mo</p>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground text-right">
                  Effective as of: {new Date(rateEffectiveDate).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMP FEES TAB */}
          <TabsContent
            value="competitions"
            className="animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions.map((comp) => {
                        const feesForComp = compFees.filter(
                          (f) => f.competitionId === comp.id,
                        );
                if (feesForComp.length === 0) return null;

                const total = feesForComp.reduce(
                  (sum, f) => sum + parseAmount(f.amount),
                  0,
                );
                        const paid = feesForComp
                          .filter((f) => paidOverrides[f.id] ?? f.paid)
                  .reduce(
                    (sum, f) => sum + parseAmount(f.amount),
                    0,
                  );

                return (
                  <Card
                    key={comp.id}
                    className="border-none shadow-sm bg-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => setSelectedCompId(comp.id)}
                  >
                    <div className="h-2 bg-blue-500 w-full group-hover:h-3 transition-all" />
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">
                        {comp.name}
                      </CardTitle>
                      <CardDescription>
                        {new Date(comp.startDate).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 mt-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-bold text-blue-700">
                            ${total.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Paid</span>
                          <span className="text-green-600 font-medium">
                            ${paid.toFixed(2)}
                          </span>
                        </div>
                        <div className="pt-2 border-t text-[10px] text-muted-foreground text-center">
                          {feesForComp.length} fee entries linked
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* COSTUMES TAB */}
          <TabsContent
            value="costumes"
            className="animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="grid gap-6">
              {costumeFeesByDancer.map((group) => (
                <Card
                  key={group.dancer.id}
                  className="border-none shadow-sm bg-white border-l-4 border-l-pink-400 group overflow-hidden"
                >
                  <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
                  <CardHeader className="bg-secondary/10 pb-4 border-b border-gray-100">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border flex items-center justify-center font-bold text-pink-500">
                          {group.dancer.firstName.charAt(0)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {group.dancer.firstName} {group.dancer.lastName}
                          </CardTitle>
                          <CardDescription>
                            {group.dancer.level}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Total Due
                        </p>
                        <p className="font-bold text-lg text-pink-600">
                          ${group.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                      {group.fees.map((fee: Fee) => {
                        const routine = routines.find(
                          (r) => r.id === fee.routineId,
                        );
                        const paid = paidOverrides[fee.id] ?? fee.paid ?? false;

                        return (
                          <div
                            key={fee.id}
                            className="flex items-center justify-between p-4 hover:bg-gray-50 group"
                          >
                            <div className="flex items-center gap-4">
                              {fee.paid ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">
                                    {routine?.name || "Unknown Routine"}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-5 px-1 bg-pink-50 text-pink-700 border-pink-100"
                                  >
                                    {routine?.costumeName || "No Costume Name"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Routine: {routine?.type} {routine?.style}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right mr-2">
                                <span className="text-sm font-semibold block">
                                  ${fee.amount}
                                </span>
                                <button
                                  onClick={() =>
                                    setEditingCostumeFee({
                                      feeId: fee.id,
                                      costumeName:
                                        routine?.costumeName || "",
                                      amount: parseAmount(fee.amount),
                                    })
                                  }
                                  className="text-[10px] text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 justify-end ml-auto"
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </button>
                              </div>
                              <Switch
                                checked={paid}
                                onCheckedChange={() => toggleFeePaid(fee.id)}
                                className="data-[state=checked]:bg-green-500"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {group.unpaid > 0 && (
                      <div className="bg-red-50 p-3 text-center border-t border-red-100 text-red-700 text-sm font-medium">
                        Outstanding Balance: ${group.unpaid.toFixed(2)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Competition Fee Modal */}
        <Dialog
          open={!!selectedCompId}
          onOpenChange={(open) => !open && setSelectedCompId(null)}
        >
          <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
            {selectedComp && (
              <div className="bg-[#FAF9F6]">
                <div className="p-8 pb-6 border-b border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-display font-bold text-foreground border-b-2 border-blue-500/50 inline-block">
                        {selectedComp.name}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2">
                        {new Date(selectedComp.startDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}{" "}
                        • {selectedComp.location}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCompId(null)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-8">
                    <div className="bg-white p-4 rounded-xl text-center shadow-sm border border-gray-50">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                        Total Fees
                      </p>
                      <p className="text-xl font-bold">
                        ${compTotal.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl text-center shadow-sm border border-gray-50">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-green-600 mb-1">
                        Collected
                      </p>
                      <p className="text-xl font-bold text-green-600">
                        ${compPaid.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl text-center shadow-sm border border-gray-50">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-red-600 mb-1">
                        Outstanding
                      </p>
                      <p className="text-xl font-bold text-red-600">
                        ${compUnpaid.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-8 pt-4">
                  <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider font-bold text-muted-foreground pb-4 px-4">
                    <div className="col-span-6">Dancer / Routine</div>
                    <div className="col-span-2 text-center">Fee Type</div>
                    <div className="col-span-2 text-center">Amount</div>
                    <div className="col-span-2 text-right">Paid</div>
                  </div>
                  <div className="space-y-1">
                        {selectedCompEntries.map((fee) => {
                          const paid = paidOverrides[fee.id] ?? fee.paid;
                          return (
                      <div
                        key={fee.id}
                        className="grid grid-cols-12 items-center p-4 bg-white rounded-xl shadow-sm border border-gray-50 hover:border-blue-500/20 transition-all"
                      >
                        <div className="col-span-6 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <DollarSign className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">
                              {getDancerName(fee.dancerId, dancers)}
                            </p>
                            {fee.routineId && (
                              <p className="text-[10px] text-muted-foreground">
                                Routine:{" "}
                                {getRoutineName(fee.routineId, routines)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="col-span-2 text-center text-xs font-medium text-muted-foreground">
                          {fee.routineId ? "Routine" : "Entry"}
                        </div>
                        <div className="col-span-2 text-center font-bold text-sm">
                          ${parseAmount(fee.amount).toFixed(2)}
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <Switch
                            checked={paid}
                            onCheckedChange={() => toggleFeePaid(fee.id)}
                            className="data-[state=checked]:bg-green-500"
                          />
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Costume Dialog */}
        <Dialog
          open={!!editingCostumeFee}
          onOpenChange={(open) => !open && setEditingCostumeFee(null)}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Costume Details</DialogTitle>
            </DialogHeader>
            {editingCostumeFee && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="costumeName" className="text-right">
                    Costume Name
                  </Label>
                  <Input
                    id="costumeName"
                    value={editingCostumeFee.costumeName}
                    onChange={(e) =>
                      setEditingCostumeFee({
                        ...editingCostumeFee,
                        costumeName: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">
                    Fee Amount
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={editingCostumeFee.amount}
                    onChange={(e) =>
                      setEditingCostumeFee({
                        ...editingCostumeFee,
                        amount: parseFloat(e.target.value),
                      })
                    }
                    className="col-span-3"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" onClick={handleSaveCostume}>
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Tuition Rates Dialog */}
        <Dialog open={isRateDialogOpen} onOpenChange={setIsRateDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Manage Tuition Rates</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex flex-col gap-2 mb-4">
                <Label htmlFor="effectiveDate">Rates Effective As Of</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={rateEffectiveDate}
                    onChange={(e) => setRateEffectiveDate(e.target.value)}
                  />
                </div>
              </div>

              {Object.entries(tuitionRates).map(([level, rate]) => (
                <div
                  key={level}
                  className="grid grid-cols-4 items-center gap-4"
                >
                  <Label
                    htmlFor={`rate-${level}`}
                    className="text-right capitalize"
                  >
                    {level}
                  </Label>
                  <div className="col-span-3 relative">
                    <DollarSign className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      id={`rate-${level}`}
                      type="number"
                      value={rate}
                      onChange={(e) =>
                        setTuitionRates({
                          ...tuitionRates,
                          [level]: parseInt(e.target.value) || 0,
                        })
                      }
                      className="pl-8"
                    />
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="submit" onClick={() => setIsRateDialogOpen(false)}>
                Update Rates
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
