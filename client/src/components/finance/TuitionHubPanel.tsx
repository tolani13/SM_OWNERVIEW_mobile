import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useCreateFee,
  useDancerAccountSummaries,
  useDancerLedger,
  useUpdateFee,
} from "@/hooks/useData";

const FEE_TYPE_LABELS = {
  tuition: "Tuition",
  costume: "Costume",
  competition: "Competition Fee",
  recital: "Recital Fee",
  other: "Misc",
} as const;

type FeeTypeKey = keyof typeof FEE_TYPE_LABELS;

const formatMoney = (value: number) => `$${value.toFixed(2)}`;
const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : "No payments recorded";

const today = () => new Date().toISOString().split("T")[0];

export function TuitionHubPanel() {
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading: accountsLoading } = useDancerAccountSummaries();
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const { data: ledgerData, isLoading: ledgerLoading } = useDancerLedger(selectedDancerId);
  const createFee = useCreateFee();
  const updateFee = useUpdateFee();

  const [isReceivePaymentOpen, setIsReceivePaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentFeeType, setPaymentFeeType] = useState<FeeTypeKey>("tuition");
  const [paymentAccountingCode, setPaymentAccountingCode] = useState("");

  useEffect(() => {
    if (!accounts.length) {
      setSelectedDancerId(null);
      return;
    }

    const selectedStillExists = selectedDancerId && accounts.some((a) => a.dancerId === selectedDancerId);
    if (!selectedStillExists) {
      setSelectedDancerId(accounts[0].dancerId);
    }
  }, [accounts, selectedDancerId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.dancerId === selectedDancerId) ?? null,
    [accounts, selectedDancerId],
  );

  const recentEntries = useMemo(
    () => (ledgerData?.entries ? [...ledgerData.entries].reverse() : []),
    [ledgerData?.entries],
  );

  const resetPaymentState = () => {
    setPaymentAmount("");
    setPaymentDate(today());
    setPaymentFeeType("tuition");
    setPaymentAccountingCode("");
  };

  const handleSubmitPayment = async () => {
    if (!selectedDancerId) return;

    const parsedAmount = Number(paymentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    try {
      let remaining = parsedAmount;
      const unpaidEntries = (ledgerData?.entries ?? [])
        .filter((entry) => entry.amount > entry.paid && entry.amount > 0)
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

      for (const entry of unpaidEntries) {
        const outstanding = entry.amount - entry.paid;
        if (remaining + 0.0001 >= outstanding) {
          await updateFee.mutateAsync({ id: entry.id, data: { paid: true } });
          remaining = Number((remaining - outstanding).toFixed(2));
        }
      }

      await createFee.mutateAsync({
        type: "Payment Received",
        feeType: paymentFeeType,
        accountingCode: paymentAccountingCode.trim() || null,
        amount: parsedAmount.toFixed(2),
        paid: true,
        dueDate: paymentDate,
        dancerId: selectedDancerId,
      });

      await queryClient.invalidateQueries({ queryKey: ["fees"] });
      await queryClient.invalidateQueries({ queryKey: ["finance"] });

      if (remaining > 0) {
        toast.success(`Payment recorded. $${remaining.toFixed(2)} remains as unapplied credit.`);
      } else {
        toast.success("Payment recorded and applied.");
      }

      setIsReceivePaymentOpen(false);
      resetPaymentState();
    } catch (error: any) {
      toast.error(error?.message || "Unable to record payment.");
    }
  };

  if (accountsLoading) {
    return (
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading dancer accounts...
        </CardContent>
      </Card>
    );
  }

  if (!accounts.length) {
    return (
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No dancer accounts available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-2 border-none shadow-sm bg-white overflow-hidden group">
          <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
          <CardHeader>
            <CardTitle className="text-base">Dancer Accounts</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dancer</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => {
                    const isSelected = account.dancerId === selectedDancerId;
                    return (
                      <TableRow
                        key={account.dancerId}
                        className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                        onClick={() => setSelectedDancerId(account.dancerId)}
                      >
                        <TableCell className="font-medium">{account.dancerName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{account.level}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(account.monthlyRate)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMoney(account.currentBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedDancerId(account.dancerId);
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
          </CardContent>
        </Card>

        <Card className="xl:col-span-3 border-none shadow-sm bg-white overflow-hidden group">
          <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
          <CardHeader className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl">{selectedAccount?.dancerName ?? "Select a dancer"}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Last payment: {formatDate(ledgerData?.lastPaymentDate ?? null)}
                </p>
              </div>
              <div className="sm:text-right space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-bold text-primary">
                  {formatMoney(ledgerData?.currentBalance ?? selectedAccount?.currentBalance ?? 0)}
                </p>
                <Button onClick={() => setIsReceivePaymentOpen(true)}>Receive payment</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
            {ledgerLoading ? (
              <div className="text-sm text-muted-foreground py-6">Loading ledger...</div>
            ) : recentEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6">No activity recorded for this dancer.</div>
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
                    {recentEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{FEE_TYPE_LABELS[entry.type]}</span>
                            {entry.accountingCode ? (
                              <span className="text-xs text-muted-foreground">Code: {entry.accountingCode}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(entry.amount)}</TableCell>
                        <TableCell className="text-right">{formatMoney(entry.paid)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatMoney(entry.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isReceivePaymentOpen} onOpenChange={setIsReceivePaymentOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Receive payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Amount</Label>
              <Input
                id="paymentAmount"
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment type</Label>
              <Select value={paymentFeeType} onValueChange={(value) => setPaymentFeeType(value as FeeTypeKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FEE_TYPE_LABELS) as FeeTypeKey[]).map((feeType) => (
                    <SelectItem key={feeType} value={feeType}>
                      {FEE_TYPE_LABELS[feeType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountingCode">Accounting code (optional)</Label>
              <Input
                id="accountingCode"
                value={paymentAccountingCode}
                onChange={(event) => setPaymentAccountingCode(event.target.value)}
                placeholder="QB/Wave code"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsReceivePaymentOpen(false);
                resetPaymentState();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitPayment}>Record payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
