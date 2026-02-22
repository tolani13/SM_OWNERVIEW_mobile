import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  BarChart3,
  ExternalLink,
  Link2,
  RotateCcw,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAccountingConnections,
  useAccountingFeeTypeDefaults,
  useAccountingReconciliationSummary,
  useAccountingSyncRecords,
  useActivateAccountingProvider,
  useDisconnectAccountingProvider,
  useRetryFailedAccountingSync,
  useRunAccountingSync,
  useStartAccountingConnect,
  useUpdateAccountingFeeTypeDefault,
  type AccountingConnection,
  type AccountingConnectionStatus,
  type AccountingFeeTypeDefault,
  type AccountingProvider,
  type AccountingSyncRecordStatus,
} from "@/hooks/useData";
import { cn } from "@/lib/utils";

const PROVIDERS: Array<{
  provider: AccountingProvider;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    provider: "quickbooks",
    label: "QuickBooks Online",
    shortLabel: "QuickBooks",
    description:
      "Connect your studio QuickBooks organization to publish invoices and payments from Studio Maestro.",
  },
  {
    provider: "xero",
    label: "Xero",
    shortLabel: "Xero",
    description:
      "Connect your studio Xero organization to standardize accounting sync and reconciliation workflows.",
  },
];

type ProviderActionType = "connect" | "activate" | "disconnect" | "sync";

type FeeTypeKey = AccountingFeeTypeDefault["feeType"];

type MappingFormState = {
  feeType: FeeTypeKey;
  label: string;
  defaultQuickbooksItemId: string;
  defaultQuickbooksAccountId: string;
  defaultXeroRevenueAccountCode: string;
  defaultXeroPaymentAccountCode: string;
  defaultWaveIncomeAccountId: string;
};

const FEE_TYPE_OPTIONS: Array<{ value: FeeTypeKey; label: string }> = [
  { value: "tuition", label: "Tuition" },
  { value: "costume", label: "Costume" },
  { value: "competition", label: "Competition" },
  { value: "recital", label: "Recital" },
  { value: "other", label: "Other" },
];

function mapDefaultToFormRow(defaults: AccountingFeeTypeDefault): MappingFormState {
  return {
    feeType: defaults.feeType,
    label: defaults.label || defaults.feeType,
    defaultQuickbooksItemId: defaults.defaultQuickbooksItemId || "",
    defaultQuickbooksAccountId: defaults.defaultQuickbooksAccountId || "",
    defaultXeroRevenueAccountCode: defaults.defaultXeroRevenueAccountCode || "",
    defaultXeroPaymentAccountCode: defaults.defaultXeroPaymentAccountCode || "",
    defaultWaveIncomeAccountId: defaults.defaultWaveIncomeAccountId || "",
  };
}

function emptyFormState(feeType: FeeTypeKey): MappingFormState {
  const label = FEE_TYPE_OPTIONS.find((option) => option.value === feeType)?.label || feeType;
  return {
    feeType,
    label,
    defaultQuickbooksItemId: "",
    defaultQuickbooksAccountId: "",
    defaultXeroRevenueAccountCode: "",
    defaultXeroPaymentAccountCode: "",
    defaultWaveIncomeAccountId: "",
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return parsed.toLocaleString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function connectionStatusClass(status: AccountingConnectionStatus | undefined): string {
  if (status === "connected") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (status === "error") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  return "bg-gray-100 text-gray-700 border-gray-200";
}

function syncStatusClass(status: AccountingSyncRecordStatus): string {
  if (status === "synced") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (status === "failed") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (status === "pending") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }

  return "bg-gray-100 text-gray-700 border-gray-200";
}

export function FinanceAccountingPanel() {
  const { data: connections = [], isLoading: connectionsLoading, refetch: refetchConnections } =
    useAccountingConnections();
  const { data: syncRecords = [], isLoading: syncLoading, refetch: refetchSyncRecords } =
    useAccountingSyncRecords({ limit: 12 });
  const {
    data: feeTypeDefaults = [],
    isLoading: defaultsLoading,
    refetch: refetchFeeTypeDefaults,
  } = useAccountingFeeTypeDefaults();
  const {
    data: reconciliationSummary,
    isLoading: reconciliationLoading,
    refetch: refetchReconciliation,
  } = useAccountingReconciliationSummary();

  const startConnect = useStartAccountingConnect();
  const activateProvider = useActivateAccountingProvider();
  const disconnectProvider = useDisconnectAccountingProvider();
  const runSync = useRunAccountingSync();
  const updateFeeTypeDefault = useUpdateAccountingFeeTypeDefault();
  const retryFailedSync = useRetryFailedAccountingSync();

  const [providerAction, setProviderAction] = useState<{
    provider: AccountingProvider;
    type: ProviderActionType;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedFeeType, setSelectedFeeType] = useState<FeeTypeKey>("tuition");
  const [mappingForm, setMappingForm] = useState<MappingFormState>(emptyFormState("tuition"));
  const [savingMapping, setSavingMapping] = useState(false);

  const connectionsByProvider = useMemo(() => {
    const map = new Map<AccountingProvider, AccountingConnection>();
    for (const connection of connections) {
      map.set(connection.provider, connection);
    }
    return map;
  }, [connections]);

  const activeConnection = useMemo(
    () => connections.find((connection) => connection.isActive && connection.status === "connected") ?? null,
    [connections],
  );

  const feeTypeDefaultsMap = useMemo(() => {
    const map = new Map<FeeTypeKey, AccountingFeeTypeDefault>();
    for (const row of feeTypeDefaults) {
      map.set(row.feeType, row);
    }
    return map;
  }, [feeTypeDefaults]);

  const syncSummary = useMemo(() => {
    let synced = 0;
    let failed = 0;
    let pending = 0;

    for (const record of syncRecords) {
      if (record.status === "synced") synced += 1;
      else if (record.status === "failed") failed += 1;
      else if (record.status === "pending") pending += 1;
    }

    return { synced, failed, pending };
  }, [syncRecords]);

  const isProviderBusy = (provider: AccountingProvider): boolean => providerAction?.provider === provider;

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchConnections(), refetchSyncRecords()]);
      await refetchFeeTypeDefaults();
      await refetchReconciliation();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const result = await retryFailedSync.mutateAsync({});
      toast.success(
        `Retry complete — Retried: ${result.retried}, Synced: ${result.synced}, Failed: ${result.failed}, Skipped: ${result.skipped}.`,
      );
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message || "Unable to retry failed sync records.");
    }
  };

  const loadMappingIntoForm = (feeType: FeeTypeKey) => {
    const existing = feeTypeDefaultsMap.get(feeType);
    if (existing) {
      setMappingForm(mapDefaultToFormRow(existing));
      return;
    }

    setMappingForm(emptyFormState(feeType));
  };

  const openMappingDialog = () => {
    setSelectedFeeType((current) => {
      const nextType = current || "tuition";
      loadMappingIntoForm(nextType);
      return nextType;
    });
    setMappingDialogOpen(true);
  };

  const handleFeeTypeSelection = (value: string) => {
    const feeType = value as FeeTypeKey;
    setSelectedFeeType(feeType);
    loadMappingIntoForm(feeType);
  };

  const handleSaveMapping = async () => {
    try {
      setSavingMapping(true);

      await updateFeeTypeDefault.mutateAsync({
        feeType: selectedFeeType,
        label: mappingForm.label,
        defaultQuickbooksItemId: mappingForm.defaultQuickbooksItemId || null,
        defaultQuickbooksAccountId: mappingForm.defaultQuickbooksAccountId || null,
        defaultXeroRevenueAccountCode: mappingForm.defaultXeroRevenueAccountCode || null,
        defaultXeroPaymentAccountCode: mappingForm.defaultXeroPaymentAccountCode || null,
        defaultWaveIncomeAccountId: mappingForm.defaultWaveIncomeAccountId || null,
      });

      toast.success(`Updated accounting mappings for ${selectedFeeType}.`);
      await refetchFeeTypeDefaults();
      setMappingDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Unable to update accounting mapping settings.");
    } finally {
      setSavingMapping(false);
    }
  };

  const handleConnect = async (provider: AccountingProvider) => {
    try {
      setProviderAction({ provider, type: "connect" });
      const payload = await startConnect.mutateAsync({ provider, activateOnConnect: true });

      const popup = window.open(payload.authUrl, `${provider}-oauth`, "width=1100,height=760");

      if (!popup) {
        toast("Popup blocked. Redirecting to provider authorization...", { icon: "ℹ️" });
        window.location.assign(payload.authUrl);
        return;
      }

      toast.success(
        `${provider === "quickbooks" ? "QuickBooks" : "Xero"} authorization opened. Complete sign-in, then return to Finance.`,
      );

      const pollId = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(pollId);
          void refreshAll();
          toast.success("Connection status refreshed.");
        }
      }, 1200);

      window.setTimeout(() => window.clearInterval(pollId), 5 * 60 * 1000);
    } catch (error: any) {
      toast.error(error?.message || "Unable to start provider connection.");
    } finally {
      setProviderAction(null);
    }
  };

  const handleActivate = async (provider: AccountingProvider) => {
    try {
      setProviderAction({ provider, type: "activate" });
      await activateProvider.mutateAsync(provider);
      toast.success(
        `${provider === "quickbooks" ? "QuickBooks" : "Xero"} is now the active accounting destination.`,
      );
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message || "Unable to set active provider.");
    } finally {
      setProviderAction(null);
    }
  };

  const handleDisconnect = async (provider: AccountingProvider) => {
    const approved = window.confirm(
      `Disconnect ${provider === "quickbooks" ? "QuickBooks" : "Xero"}? Existing sync records remain available for audit history.`,
    );

    if (!approved) return;

    try {
      setProviderAction({ provider, type: "disconnect" });
      await disconnectProvider.mutateAsync(provider);
      toast.success(`${provider === "quickbooks" ? "QuickBooks" : "Xero"} connection removed.`);
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message || "Unable to disconnect provider.");
    } finally {
      setProviderAction(null);
    }
  };

  const handleRunSync = async (provider: AccountingProvider) => {
    try {
      setProviderAction({ provider, type: "sync" });
      const result = await runSync.mutateAsync({ provider, limit: 100 });

      toast.success(
        `Sync complete — Synced: ${result.synced}, Failed: ${result.failed}, Skipped: ${result.skipped}.`,
      );
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message || "Unable to run accounting sync.");
    } finally {
      setProviderAction(null);
    }
  };

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden group">
      <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Accounting Integrations
            </CardTitle>
            <CardDescription className="max-w-4xl leading-relaxed">
              Studio Maestro supports secure, studio-managed connectivity with QuickBooks Online and Xero.
              Authorized administrators may connect their organization’s accounting platform directly
              within Finance to streamline reconciliation, standardize posting workflows, and maintain
              audit-ready sync visibility.
            </CardDescription>
            <p className="text-sm text-muted-foreground">
              Your studio may connect either provider and select one active accounting destination for synchronization.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={refreshing || connectionsLoading || syncLoading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Active destination: {activeConnection ? PROVIDERS.find((p) => p.provider === activeConnection.provider)?.label : "Not set"}
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Recent synced records: {syncSummary.synced}
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Pending: {syncSummary.pending}
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Failed: {syncSummary.failed}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={openMappingDialog}
            disabled={defaultsLoading}
          >
            Configure fee mappings
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-0">
        <div className="grid md:grid-cols-2 gap-4">
          {PROVIDERS.map((providerMeta) => {
            const connection = connectionsByProvider.get(providerMeta.provider);
            const status = connection?.status ?? "disconnected";
            const isConnected = status === "connected";
            const isBusy = isProviderBusy(providerMeta.provider);

            return (
              <div key={providerMeta.provider} className="rounded-lg border bg-secondary/10 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-sm">{providerMeta.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{providerMeta.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={cn("capitalize", connectionStatusClass(status))}>
                      {status}
                    </Badge>
                    {connection?.isActive ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        Active
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Tenant / Realm: {connection?.tenantName || connection?.tenantId || connection?.realmId || "Not linked"}
                  </p>
                  <p>Last synced: {formatDateTime(connection?.lastSyncedAt ?? null)}</p>
                  <p>Token status: {connection?.hasAccessToken ? "Available" : "Not available"}</p>
                  {connection?.lastError ? (
                    <p className="text-red-600 flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span className="break-words">{connection.lastError}</span>
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {!isConnected ? (
                    <Button
                      size="sm"
                      onClick={() => handleConnect(providerMeta.provider)}
                      disabled={isBusy}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {status === "error" ? "Reconnect" : "Connect"}
                    </Button>
                  ) : (
                    <>
                      {!connection?.isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivate(providerMeta.provider)}
                          disabled={isBusy}
                        >
                          <Link2 className="w-4 h-4 mr-2" />
                          Set active
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRunSync(providerMeta.provider)}
                        disabled={isBusy}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Run sync
                      </Button>
                    </>
                  )}

                  {(isConnected || status === "error") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => handleDisconnect(providerMeta.provider)}
                      disabled={isBusy}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border bg-secondary/10 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Reconciliation snapshot
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Quick view of synced totals versus outstanding transactions waiting to sync.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryFailed}
              disabled={retryFailedSync.isPending}
            >
              <RotateCcw className={cn("w-4 h-4 mr-2", retryFailedSync.isPending && "animate-spin")} />
              Retry failed
            </Button>
          </div>

          {reconciliationLoading || !reconciliationSummary ? (
            <p className="text-xs text-muted-foreground">Loading reconciliation summary...</p>
          ) : (
            <>
              <div className="grid md:grid-cols-4 gap-3">
                <div className="rounded border bg-white p-3">
                  <p className="text-[11px] text-muted-foreground">Synced charges</p>
                  <p className="text-sm font-semibold">{formatCurrency(reconciliationSummary.syncedTotals.charges)}</p>
                </div>
                <div className="rounded border bg-white p-3">
                  <p className="text-[11px] text-muted-foreground">Synced payments</p>
                  <p className="text-sm font-semibold">{formatCurrency(reconciliationSummary.syncedTotals.payments)}</p>
                </div>
                <div className="rounded border bg-white p-3">
                  <p className="text-[11px] text-muted-foreground">Net posted</p>
                  <p className="text-sm font-semibold">{formatCurrency(reconciliationSummary.syncedTotals.net)}</p>
                </div>
                <div className="rounded border bg-white p-3">
                  <p className="text-[11px] text-muted-foreground">Outstanding to sync</p>
                  <p className="text-sm font-semibold">{formatCurrency(reconciliationSummary.outstanding.total)}</p>
                </div>
              </div>

              {reconciliationSummary.outstanding.items.length > 0 ? (
                <div className="rounded border bg-white">
                  <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
                    Recent outstanding items ({reconciliationSummary.outstanding.count})
                  </div>
                  <div className="max-h-48 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Fee Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reconciliationSummary.outstanding.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}…</TableCell>
                            <TableCell className="capitalize">{item.type}</TableCell>
                            <TableCell className="capitalize">{item.feeType}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("capitalize", syncStatusClass(item.syncStatus))}>
                                {item.syncStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(Number(item.amount || 0))}</TableCell>
                            <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-green-700">No outstanding items. Sync queue is clean.</p>
              )}
            </>
          )}
        </div>

        <div className="rounded-lg border bg-white">
          <div className="px-4 py-3 border-b">
            <p className="font-medium text-sm">Recent synchronization activity</p>
            <p className="text-xs text-muted-foreground mt-1">
              Latest accounting sync outcomes across providers for audit and reconciliation follow-up.
            </p>
          </div>

          <div className="overflow-x-auto">
            {syncLoading ? (
              <div className="text-sm text-muted-foreground px-4 py-6">Loading sync activity...</div>
            ) : !syncRecords.length ? (
              <div className="text-sm text-muted-foreground px-4 py-6">
                No sync records yet. Connect a provider and run sync to begin publishing transactions.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Updated</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>External ID</TableHead>
                    <TableHead>Error / Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncRecords.map((record) => {
                    const providerLabel = PROVIDERS.find((provider) => provider.provider === record.provider)?.shortLabel;

                    return (
                      <TableRow key={record.id}>
                        <TableCell>{formatDateTime(record.updatedAt)}</TableCell>
                        <TableCell>{providerLabel}</TableCell>
                        <TableCell className="font-mono text-xs">{record.transactionId.slice(0, 8)}…</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("capitalize", syncStatusClass(record.status))}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{record.externalObjectId || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] break-words">
                          {record.lastError || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Accounting mapping settings</DialogTitle>
              <DialogDescription>
                Configure provider-specific default mapping fields for each Studio Maestro fee type.
                These defaults are used when creating sync-ready transactions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Fee type</Label>
                <Select value={selectedFeeType} onValueChange={handleFeeTypeSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fee type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="mapping-label">Display label</Label>
                  <Input
                    id="mapping-label"
                    value={mappingForm.label}
                    onChange={(event) =>
                      setMappingForm((prev) => ({
                        ...prev,
                        label: event.target.value,
                      }))
                    }
                    placeholder="e.g. Competition Fee"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qb-item-id">QuickBooks item ID</Label>
                  <Input
                    id="qb-item-id"
                    value={mappingForm.defaultQuickbooksItemId}
                    onChange={(event) =>
                      setMappingForm((prev) => ({
                        ...prev,
                        defaultQuickbooksItemId: event.target.value,
                      }))
                    }
                    placeholder="QuickBooks item reference"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qb-account-id">QuickBooks account ID</Label>
                  <Input
                    id="qb-account-id"
                    value={mappingForm.defaultQuickbooksAccountId}
                    onChange={(event) =>
                      setMappingForm((prev) => ({
                        ...prev,
                        defaultQuickbooksAccountId: event.target.value,
                      }))
                    }
                    placeholder="QuickBooks account reference"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="xero-revenue-code">Xero revenue account code</Label>
                  <Input
                    id="xero-revenue-code"
                    value={mappingForm.defaultXeroRevenueAccountCode}
                    onChange={(event) =>
                      setMappingForm((prev) => ({
                        ...prev,
                        defaultXeroRevenueAccountCode: event.target.value,
                      }))
                    }
                    placeholder="e.g. 200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="xero-payment-code">Xero payment account code</Label>
                  <Input
                    id="xero-payment-code"
                    value={mappingForm.defaultXeroPaymentAccountCode}
                    onChange={(event) =>
                      setMappingForm((prev) => ({
                        ...prev,
                        defaultXeroPaymentAccountCode: event.target.value,
                      }))
                    }
                    placeholder="e.g. 090"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="wave-income-account-id">Wave income account ID (optional)</Label>
                  <Input
                    id="wave-income-account-id"
                    value={mappingForm.defaultWaveIncomeAccountId}
                    onChange={(event) =>
                      setMappingForm((prev) => ({
                        ...prev,
                        defaultWaveIncomeAccountId: event.target.value,
                      }))
                    }
                    placeholder="Wave income account reference"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMappingDialogOpen(false)} disabled={savingMapping}>
                Cancel
              </Button>
              <Button onClick={handleSaveMapping} disabled={savingMapping}>
                {savingMapping ? "Saving..." : "Save mapping"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}