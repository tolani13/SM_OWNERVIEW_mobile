import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import {
  parentBillingActivity,
  parentBillingSummary,
  parentClassListings,
  parentContacts,
  parentPolicies,
  parentPolicyAgreements,
} from "@/lib/parentPortalMock";
import type { ContactRole, Policy, PolicyAgreement, PolicyType } from "@/types/parentPortal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PolicyCard } from "@/components/PolicyCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const policyTypeLabel: Record<PolicyType, string> = {
  PAYMENT: "Payment",
  ASSUMPTION_OF_RISK: "Risk",
  PHOTO_VIDEO: "Photo/Video",
  MEDICAL_EMERGENCIES: "Medical",
};

const contactRoleLabel: Record<ContactRole, string> = {
  FATHER: "Father",
  MOTHER: "Mother",
  GUARDIAN: "Guardian",
  OTHER: "Other",
};

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

export default function ParentPolicies() {
  const [typeFilter, setTypeFilter] = useState<PolicyType | "ALL">("ALL");
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [agreements, setAgreements] = useState<PolicyAgreement[]>(parentPolicyAgreements);

  const visiblePolicies = useMemo(() => {
    if (typeFilter === "ALL") return parentPolicies;
    return parentPolicies.filter((p) => p.type === typeFilter);
  }, [typeFilter]);

  const hasAgreement = (policyId: string) => agreements.some((a) => a.policyId === policyId);

  const handleAgree = (policy: Policy) => {
    if (hasAgreement(policy.id)) return;
    setAgreements((prev) => [
      ...prev,
      { policyId: policy.id, agreedBy: "Parent User", agreedOn: new Date().toISOString() },
    ]);
  };

  const charges = parentBillingActivity.filter((x) => x.amount > 0).reduce((sum, x) => sum + x.amount, 0);
  const paid = parentBillingActivity.reduce((sum, x) => sum + x.paid, 0);

  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-display font-bold text-black">Policies</h1>
          <p className="text-black/80">
            Parent portal information (policies, billing, contacts, and classes) is consolidated here.
          </p>
        </div>

        <Tabs defaultValue="policies" className="w-full">
          <TabsList className="mb-6 h-auto w-full flex-wrap justify-start gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <TabsTrigger
              value="policies"
              className="rounded-lg border border-transparent px-4 py-2 text-black transition-colors data-[state=active]:border-coral data-[state=active]:bg-coral/10 data-[state=active]:text-coral"
            >
              Policies
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="rounded-lg border border-transparent px-4 py-2 text-black transition-colors data-[state=active]:border-coral data-[state=active]:bg-coral/10 data-[state=active]:text-coral"
            >
              Billing
            </TabsTrigger>
            <TabsTrigger
              value="contacts"
              className="rounded-lg border border-transparent px-4 py-2 text-black transition-colors data-[state=active]:border-coral data-[state=active]:bg-coral/10 data-[state=active]:text-coral"
            >
              Contacts
            </TabsTrigger>
            <TabsTrigger
              value="classes"
              className="rounded-lg border border-transparent px-4 py-2 text-black transition-colors data-[state=active]:border-coral data-[state=active]:bg-coral/10 data-[state=active]:text-coral"
            >
              Classes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="policies" className="space-y-4">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="pt-6">
                <div className="max-w-sm space-y-2">
                  <p className="text-sm font-medium text-coral">Policy Type</p>
                  <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as PolicyType | "ALL")}>
                    <SelectTrigger className="border-slate-300 bg-white text-black focus:ring-2 focus:ring-primary/25 focus:ring-offset-1">
                      <SelectValue placeholder="Filter by policy type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Policy Types</SelectItem>
                      <SelectItem value="PAYMENT">Payment</SelectItem>
                      <SelectItem value="ASSUMPTION_OF_RISK">Assumption of Risk</SelectItem>
                      <SelectItem value="PHOTO_VIDEO">Photo/Video</SelectItem>
                      <SelectItem value="MEDICAL_EMERGENCIES">Medical Emergencies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2 place-items-center">
              {visiblePolicies.map((policy) => {
                const agreed = hasAgreement(policy.id);
                return (
                  <div key={policy.id} className="w-full max-w-xl">
                    <PolicyCard
                      title={policy.title}
                      summary={policy.summary}
                      appliesTo={policy.appliesTo}
                      categoryLabel={policyTypeLabel[policy.type]}
                      status={agreed ? "agreed" : "pending"}
                      onViewFullPolicy={() => setSelectedPolicy(policy)}
                      onToggleAgree={policy.requiresAgreement ? () => handleAgree(policy) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-white shadow-md border border-slate-200">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-black/80">Current Balance</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-black">{currency(parentBillingSummary.totalBalance)}</div></CardContent>
              </Card>
              <Card className="bg-white shadow-md border border-slate-200">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-black/80">Last Payment</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-black">{currency(parentBillingSummary.lastPaymentAmount)}</div>
                  <p className="text-xs text-black/70 mt-1">{dateLabel(parentBillingSummary.lastPaymentDate)}</p>
                </CardContent>
              </Card>
              <Card className="bg-white shadow-md border border-slate-200">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-black/80">Paid / Charged</CardTitle></CardHeader>
                <CardContent><div className="text-lg font-semibold text-black">{currency(paid)} / {currency(charges)}</div></CardContent>
              </Card>
            </div>

            <Card className="bg-white shadow-md border border-slate-200">
              <CardHeader><CardTitle className="text-black">Billing Activity</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-black">Date</TableHead>
                      <TableHead className="text-black">Type</TableHead>
                      <TableHead className="text-black">Description</TableHead>
                      <TableHead className="text-right text-black">Amount</TableHead>
                      <TableHead className="text-right text-black">Paid</TableHead>
                      <TableHead className="text-right text-black">Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parentBillingActivity.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-black">{dateLabel(row.date)}</TableCell>
                        <TableCell><Badge variant="outline">{row.type.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-black">{row.description}</TableCell>
                        <TableCell className="text-right text-black">{currency(row.amount)}</TableCell>
                        <TableCell className="text-right text-black">{currency(row.paid)}</TableCell>
                        <TableCell className="text-right text-black">{currency(row.balanceAfter)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            <Card className="bg-white shadow-md border border-slate-200">
              <CardHeader><CardTitle className="text-black">Contacts</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-black">Name</TableHead>
                      <TableHead className="text-black">Role</TableHead>
                      <TableHead className="text-black">Email</TableHead>
                      <TableHead className="text-black">Phones</TableHead>
                      <TableHead className="text-black">Address</TableHead>
                      <TableHead className="text-black">Pickup</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parentContacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-black">{c.fullName}</TableCell>
                        <TableCell><Badge variant="outline">{contactRoleLabel[c.role]}</Badge></TableCell>
                        <TableCell className="text-black">{c.email}</TableCell>
                        <TableCell className="text-xs text-black/80">
                          <div>{c.mobilePhone ? `M: ${c.mobilePhone}` : ""}</div>
                          <div>{c.workPhone ? `W: ${c.workPhone}` : ""}</div>
                          <div>{c.homePhone ? `H: ${c.homePhone}` : ""}</div>
                        </TableCell>
                        <TableCell className="text-xs text-black">{c.addressLine1}, {c.city}, {c.state} {c.postalCode}</TableCell>
                        <TableCell>
                          <Badge variant={c.isAuthorizedPickup ? "default" : "secondary"}>
                            {c.isAuthorizedPickup ? "Authorized" : "No"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="classes" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {parentClassListings.map((item) => (
                <Card key={item.id} className="bg-white shadow-md border border-slate-200 border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="text-lg text-black">{item.className}</CardTitle>
                    <p className="text-sm text-black/80">{item.forLabel} · {item.sessionLabel}</p>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-black">
                    <div><span className="font-medium text-black">When:</span> {item.scheduleWhen}</div>
                    <div><span className="font-medium text-black">Where:</span> {item.where}</div>
                    <div><span className="font-medium text-black">Teacher:</span> {item.withTeacher}</div>
                    <div><span className="font-medium text-black">Tuition:</span> {currency(item.tuition)} / month</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedPolicy} onOpenChange={(open) => !open && setSelectedPolicy(null)}>
          <DialogContent className="w-full sm:max-w-xl max-h-[85vh] overflow-y-auto">
            {selectedPolicy && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-black">{selectedPolicy.title}</DialogTitle>
                  <DialogDescription className="text-black/80">{selectedPolicy.summary}</DialogDescription>
                </DialogHeader>
                <div className="mt-6 space-y-4">
                  <Badge variant="outline" className="border-coral/40 bg-coral/10 text-coral">{selectedPolicy.appliesTo}</Badge>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedPolicy.bodyHtml }}
                  />
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
