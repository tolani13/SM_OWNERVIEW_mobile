import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFinanceDancerLedger,
  useFinanceDancers,
  useFinanceEvents,
  useRecordFinancePayment,
  type FinanceDancersQuery,
  type FinanceDancerLevel,
  type FinanceEventPaymentStatus,
  type FinanceSortBy,
  type FinanceSortDir,
} from "@/hooks/useData";
import { cn } from "@/lib/utils";

const LEVEL_OPTIONS: { label: string; value: FinanceDancerLevel }[] = [
  { label: "Mini", value: "mini" },
  { label: "Junior", value: "junior" },
  { label: "Teen", value: "teen" },
  { label: "Senior", value: "senior" },
  { label: "Elite", value: "elite" },
];

const EVENT_STATUS_FILTER_OPTIONS: Array<{ label: string; value: "all" | FinanceEventPaymentStatus }> = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Partial", value: "partial" },
];

const SORT_OPTIONS: Array<{
  label: string;
  value: string;
  sortBy: FinanceSortBy;
  sortDir: FinanceSortDir;
}> = [
  { label: "Last Name A–Z", value: "lastName-asc", sortBy: "lastName", sortDir: "asc" },
  { label: "Last Name Z–A", value: "lastName-desc", sortBy: "lastName", sortDir: "desc" },
  { label: "Age (youngest→oldest)", value: "age-asc", sortBy: "age", sortDir: "asc" },
  { label: "Age (oldest→youngest)", value: "age-desc", sortBy: "age", sortDir: "desc" },
  { label: "Level", value: "level-asc", sortBy: "level", sortDir: "asc" },
  { label: "Balance (high→low)", value: "balance-desc", sortBy: "balance", sortDir: "desc" },
];

const FEE_TYPE_LABELS = {
  tuition: "Tuition",
  costume: "Costume",
  competition: "Competition Fee",
  recital: "Recital Fee",
  other: "Misc",
} as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function formatMoney(value: number): string {
  return currencyFormatter.format(value || 0);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString();
}

function paymentStatusChipClass(status: FinanceEventPaymentStatus | undefined): string {
  if (status === "paid") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (status === "partial") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }

  return "bg-red-100 text-red-700 border-red-200";
}

export function TuitionHubPanel() {
  const [selectedSort, setSelectedSort] = useState<string>("lastName-asc");
  const [selectedLevels, setSelectedLevels] = useState<FinanceDancerLevel[]>([]);
  const [competitionOnly, setCompetitionOnly] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [eventPaymentStatus, setEventPaymentStatus] = useState<"all" | FinanceEventPaymentStatus>("all");
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);

  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentDescription, setPaymentDescription] = useState<string>("");

  const sortOption = SORT_OPTIONS.find((option) => option.value === selectedSort) ?? SORT_OPTIONS[0];

  const dancersQuery = useMemo<FinanceDancersQuery>(
    () => ({
      sortBy: sortOption.sortBy,
      sortDir: sortOption.sortDir,
      levels: selectedLevels.length ? selectedLevels : undefined,
      isCompetitionDancer: competitionOnly ? true : undefined,
      eventId: selectedEventId !== "all" ? selectedEventId : undefined,
      eventPaymentStatus: eventPaymentStatus !== "all" ? eventPaymentStatus : undefined,
    }),
    [competitionOnly, eventPaymentStatus, selectedEventId, selectedLevels, sortOption.sortBy, sortOption.sortDir],
  );

  const { data: events = [] } = useFinanceEvents();
  const { data: dancers = [], isLoading: dancersLoading } = useFinanceDancers(dancersQuery);
  const {
    data: ledger,
    isLoading: ledgerLoading,
  } = useFinanceDancerLedger(selectedDancerId);
  const recordPayment = useRecordFinancePayment();

  useEffect(() => {
    if (!dancers.length) {
      setSelectedDancerId(null);
      return;
    }

    if (!selectedDancerId || !dancers.some((dancer) => dancer.id === selectedDancerId)) {
      setSelectedDancerId(dancers[0].id);
    }
  }, [dancers, selectedDancerId]);

  const selectedDancer = useMemo(
    () => dancers.find((dancer) => dancer.id === selectedDancerId) ?? null,
    [dancers, selectedDancerId],
  );

  const orderedLedgerEntries = useMemo(() => {
    if (!ledger?.entries?.length) return [];
    return [...ledger.entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [ledger?.entries]);

  const toggleLevel = (value: FinanceDancerLevel, checked: boolean) => {
    setSelectedLevels((prev) => {
      if (checked) {
        if (prev.includes(value)) return prev;
        return [...prev, value];
      }
      return prev.filter((entry) => entry !== value);
    });
  };

  const selectedEventNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const event of events) {
      map.set(event.id, event.name);
    }
    return map;
  }, [events]);

  const handleRecordPayment = async () => {
    const amount = Number(paymentAmount);
    if (!selectedDancerId) {
      toast.error("Select a dancer account first.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    try {
      await recordPayment.mutateAsync({
        dancerId: selectedDancerId,
        amount,
        date: paymentDate,
        description: paymentDescription.trim() || "Payment received",
      });

      toast.success("Payment recorded.");
      setIsRecordPaymentOpen(false);
      setPaymentAmount("");
      setPaymentDescription("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
    } catch (error: any) {
      toast.error(error?.message || "Unable to record payment.");
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3 border-none shadow-sm bg-white overflow-hidden group">
          <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="w-full sm:w-56">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sort</Label>
                  <Select value={selectedSort} onValueChange={setSelectedSort}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-56">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Event</Label>
                  <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All events</SelectItem>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-44">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                  <Select
                    value={eventPaymentStatus}
                    onValueChange={(value) => setEventPaymentStatus(value as "all" | FinanceEventPaymentStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_STATUS_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                <div className="flex flex-wrap gap-4">
                  {LEVEL_OPTIONS.map((levelOption) => {
                    const checked = selectedLevels.includes(levelOption.value);
                    return (
                      <label
                        key={levelOption.value}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => toggleLevel(levelOption.value, Boolean(isChecked))}
                        />
                        <span>{levelOption.label}</span>
                      </label>
                    );
                  })}
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <Checkbox checked={competitionOnly} onCheckedChange={(v) => setCompetitionOnly(Boolean(v))} />
                  <span>Competition dancers only</span>
                </label>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {dancersLoading ? (
              <div className="text-sm text-muted-foreground py-8">Loading dancers...</div>
            ) : dancers.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8">No dancers matched the current filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dancer</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead className="text-right">Current Balance</TableHead>
                      <TableHead>Event Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dancers.map((dancer) => {
                      const isSelected = dancer.id === selectedDancerId;

                      const statusChips = events.map((event) => {
                        const status = dancer.eventStatuses[event.id] ?? "unpaid";
                        return (
                          <Badge
                            key={`${dancer.id}-${event.id}`}
                            variant="outline"
                            className={cn("text-[10px] px-2 py-0.5", paymentStatusChipClass(status))}
                          >
                            {event.name.split(" ")[0]}: {status}
                          </Badge>
                        );
                      });

                      return (
                        <TableRow
                          key={dancer.id}
                          className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                          onClick={() => setSelectedDancerId(dancer.id)}
                        >
                          <TableCell className="font-medium">
                            {dancer.firstName} {dancer.lastName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {dancer.level}
                            </Badge>
                          </TableCell>
                          <TableCell>{dancer.age ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatMoney(dancer.currentBalance)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">{statusChips}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedDancerId(dancer.id);
                              }}
                            >
                              View account
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden group">
            <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
            <CardHeader className="space-y-3">
              <CardTitle>{selectedDancer ? `${selectedDancer.firstName} ${selectedDancer.lastName}` : "Select a dancer"}</CardTitle>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Current balance:{" "}
                  <span className="font-semibold text-foreground">
                    {formatMoney(ledger?.currentBalance ?? selectedDancer?.currentBalance ?? 0)}
                  </span>
                </p>
                <p>
                  Last payment date: <span className="font-medium text-foreground">{formatDate(ledger?.lastPaymentDate)}</span>
                </p>
              </div>
              <Button disabled={!selectedDancerId} onClick={() => setIsRecordPaymentOpen(true)}>
                Record payment
              </Button>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden group">
            <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {ledgerLoading ? (
                <div className="text-sm text-muted-foreground py-6">Loading ledger...</div>
              ) : !orderedLedgerEntries.length ? (
                <div className="text-sm text-muted-foreground py-6">No transactions recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderedLedgerEntries.map((entry) => {
                        const isPayment = entry.type === "payment";
                        const label = FEE_TYPE_LABELS[entry.feeType] ?? "Misc";

                        return (
                          <TableRow key={entry.id}>
                            <TableCell>{formatDate(entry.date)}</TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium">{label}</p>
                                <p className="text-xs text-muted-foreground capitalize">{entry.type}</p>
                                {entry.eventId ? (
                                  <p className="text-xs text-muted-foreground">
                                    {selectedEventNameById.get(entry.eventId) ?? entry.eventName ?? "Event"}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatMoney(entry.amount)}</TableCell>
                            <TableCell className="text-right">{isPayment ? formatMoney(entry.amount) : "—"}</TableCell>
                            <TableCell className="text-right font-semibold">{formatMoney(entry.runningBalance)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-date">Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-description">Description</Label>
              <Input
                id="payment-description"
                value={paymentDescription}
                onChange={(event) => setPaymentDescription(event.target.value)}
                placeholder="Optional note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={recordPayment.isPending}>
              {recordPayment.isPending ? "Saving..." : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
