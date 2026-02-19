import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { FileText, Plus, Edit2, CheckCircle2, AlertCircle, Loader2, Users } from "lucide-react";
import { 
  usePolicies, 
  useCreatePolicy, 
  useUpdatePolicy,
  usePolicyAgreements,
  useDancers
} from "@/hooks/useData";
import type { Policy, InsertPolicy } from "@server/schema";
import { toast } from "react-hot-toast";
import { validateRequired, safeTrim, formatDate, formatDateTime } from "@/lib/utils-safe";

export default function Policies() {
  const { data: policies = [], isLoading: policiesLoading } = usePolicies();
  const { data: agreements = [], isLoading: agreementsLoading } = usePolicyAgreements();
  const { data: dancers = [], isLoading: dancersLoading } = useDancers();
  
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();

  const [isAddPolicyOpen, setIsAddPolicyOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newPolicy, setNewPolicy] = useState<Partial<InsertPolicy>>({
    requiresSignature: true,
    active: true,
    documentVersion: "1.0"
  });

  const handleSavePolicy = async () => {
    // Validation
    const validation = validateRequired(
      {
        name: safeTrim(newPolicy.name),
        content: safeTrim(newPolicy.content)
      },
      ['name', 'content'],
      {
        name: 'Please enter a policy name',
        content: 'Please enter policy content'
      }
    );

    if (!validation.isValid) {
      validation.errors.forEach(err => toast.error(err));
      return;
    }

    setIsSaving(true);
    try {
      if (editingPolicy) {
        await updatePolicy.mutateAsync({
          id: editingPolicy.id,
          data: {
            name: safeTrim(newPolicy.name)!,
            content: safeTrim(newPolicy.content)!,
            requiresSignature: newPolicy.requiresSignature ?? true,
            active: newPolicy.active ?? true,
            documentVersion: safeTrim(newPolicy.documentVersion) || "1.0"
          }
        });
        toast.success("Policy updated successfully!");
        setEditingPolicy(null);
      } else {
        await createPolicy.mutateAsync({
          name: safeTrim(newPolicy.name)!,
          content: safeTrim(newPolicy.content)!,
          requiresSignature: newPolicy.requiresSignature ?? true,
          active: newPolicy.active ?? true,
          documentVersion: safeTrim(newPolicy.documentVersion) || "1.0"
        });
        toast.success("Policy created successfully!");
      }
      
      setIsAddPolicyOpen(false);
      setNewPolicy({
        requiresSignature: true,
        active: true,
        documentVersion: "1.0"
      });
    } catch (error: any) {
      console.error("Save policy error:", error);
      toast.error(error?.message || "Failed to save policy. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditPolicy = (policy: Policy) => {
    setNewPolicy(policy);
    setEditingPolicy(policy);
    setIsAddPolicyOpen(true);
  };

  const getDancerName = (dancerId: string) => {
    const dancer = dancers.find(d => d.id === dancerId);
    return dancer ? `${dancer.firstName} ${dancer.lastName}` : "Unknown";
  };

  const getPolicyAgreements = (policyId: string) => {
    return agreements.filter(a => a.policyId === policyId);
  };

  const activePolicies = policies.filter(p => p.active);
  const inactivePolicies = policies.filter(p => !p.active);

  if (policiesLoading || agreementsLoading || dancersLoading) {
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
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Policies & Waivers</h1>
              <p className="text-muted-foreground">Manage studio policies and track signed agreements.</p>
            </div>
          </div>
          <Dialog open={isAddPolicyOpen} onOpenChange={setIsAddPolicyOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white" aria-label="Create new policy">
                <Plus className="w-4 h-4 mr-2" /> New Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPolicy ? "Edit Policy" : "Create New Policy"}</DialogTitle>
                <DialogDescription>
                  Create policies, waivers, and other documents that require parent/guardian signatures.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Policy Name</Label>
                  <Input
                    placeholder="e.g. Liability Waiver, Photo Release"
                    value={newPolicy.name || ""}
                    onChange={(e) => setNewPolicy({...newPolicy, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Document Version</Label>
                  <Input
                    placeholder="e.g. 1.0, 2024.1"
                    value={newPolicy.documentVersion || ""}
                    onChange={(e) => setNewPolicy({...newPolicy, documentVersion: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Increment this when you make significant changes to the policy
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Policy Content</Label>
                  <Textarea
                    placeholder="Enter the full text of your policy or waiver..."
                    value={newPolicy.content || ""}
                    onChange={(e) => setNewPolicy({...newPolicy, content: e.target.value})}
                    className="min-h-[200px]"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newPolicy.requiresSignature ?? true}
                      onCheckedChange={(checked) => setNewPolicy({...newPolicy, requiresSignature: checked})}
                      aria-label="Requires signature"
                    />
                    <Label>Requires Signature</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newPolicy.active ?? true}
                      onCheckedChange={(checked) => setNewPolicy({...newPolicy, active: checked})}
                      aria-label="Active policy"
                    />
                    <Label>Active</Label>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSavePolicy}
                  disabled={isSaving}
                  aria-label="Save policy"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingPolicy ? "Update Policy" : "Create Policy"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="bg-white/50 border p-1 h-auto mb-6">
            <TabsTrigger 
              value="active"
              className="py-2 px-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Active Policies
            </TabsTrigger>
            <TabsTrigger 
              value="inactive"
              className="py-2 px-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Inactive
            </TabsTrigger>
            <TabsTrigger 
              value="agreements"
              className="py-2 px-6 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Signed Agreements
            </TabsTrigger>
          </TabsList>

          {/* ACTIVE POLICIES */}
          <TabsContent value="active" className="space-y-4">
            {activePolicies.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No active policies. Create your first policy or waiver to get started.</p>
                </CardContent>
              </Card>
            ) : (
              activePolicies.map(policy => {
                const policyAgreements = getPolicyAgreements(policy.id);
                const signedCount = policyAgreements.length;
                const totalDancers = dancers.length;
                const percentSigned = totalDancers > 0 ? Math.round((signedCount / totalDancers) * 100) : 0;

                return (
                  <Card key={policy.id} className="border-l-4 border-l-primary">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            {policy.name}
                            {policy.requiresSignature && (
                              <Badge variant="secondary" className="text-xs">Requires Signature</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            Version {policy.documentVersion} • Created {formatDate(policy.createdAt.toString())}
                          </CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => openEditPolicy(policy)} aria-label={`Edit ${policy.name}`}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-lg border max-h-32 overflow-y-auto">
                        <p className="text-sm whitespace-pre-wrap">{policy.content}</p>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{signedCount} of {totalDancers} dancers signed</span>
                          <Badge variant={percentSigned === 100 ? "default" : "secondary"} className="ml-2">
                            {percentSigned}%
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* INACTIVE POLICIES */}
          <TabsContent value="inactive" className="space-y-4">
            {inactivePolicies.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p>No inactive policies.</p>
                </CardContent>
              </Card>
            ) : (
              inactivePolicies.map(policy => (
                <Card key={policy.id} className="opacity-60">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {policy.name}
                          <Badge variant="outline">Inactive</Badge>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Version {policy.documentVersion}
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEditPolicy(policy)} aria-label={`Edit ${policy.name}`}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>

          {/* SIGNED AGREEMENTS */}
          <TabsContent value="agreements" className="space-y-4">
            {agreements.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No signed agreements yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {policies.map(policy => {
                  const policyAgreements = getPolicyAgreements(policy.id);
                  if (policyAgreements.length === 0) return null;

                  return (
                    <Card key={policy.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{policy.name}</CardTitle>
                        <CardDescription>{policyAgreements.length} agreements</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {policyAgreements.map(agreement => (
                            <div key={agreement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                              <div>
                                <div className="font-medium">{getDancerName(agreement.dancerId)}</div>
                                <div className="text-sm text-muted-foreground">
                                  Signed by {agreement.signedBy} • {formatDateTime(agreement.signedAt.toString())}
                                </div>
                              </div>
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Digital signature collection is coming in a future update. 
              For now, you can create policies and manually track signed agreements.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
