import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { Settings, Plus, Trash2, Loader2 } from "lucide-react";
import { useStudioSettings, useCreateStudioSettings, useUpdateStudioSettings } from "@/hooks/useData";
import { toast } from "react-hot-toast";
import { validateRequired, safeTrim, isPositiveNumber, safeParseNumber } from "@/lib/utils-safe";

type AgeGroup = {
  minAge: number;
  maxAge: number;
  groupName: string;
};

const DEFAULT_AGE_GROUPS: AgeGroup[] = [
  { minAge: 5, maxAge: 8, groupName: "Minis" },
  { minAge: 9, maxAge: 11, groupName: "Juniors" },
  { minAge: 12, maxAge: 14, groupName: "Teens" },
  { minAge: 15, maxAge: 18, groupName: "Seniors" }
];

export default function StudioSettings() {
  const { data: settings = [], isLoading } = useStudioSettings();
  const createSettings = useCreateStudioSettings();
  const updateSettings = useUpdateStudioSettings();

  const currentSettings = settings[0]; // Should only ever be one record

  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>(DEFAULT_AGE_GROUPS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentSettings?.ageGroupConfig) {
      setAgeGroups(currentSettings.ageGroupConfig as AgeGroup[]);
    }
  }, [currentSettings]);

  const addAgeGroup = () => {
    setAgeGroups([...ageGroups, { minAge: 0, maxAge: 0, groupName: "" }]);
  };

  const updateAgeGroup = (index: number, field: keyof AgeGroup, value: string | number) => {
    const newGroups = [...ageGroups];
    if (field === 'groupName') {
      newGroups[index][field] = value as string;
    } else {
      newGroups[index][field] = value as number;
    }
    setAgeGroups(newGroups);
  };

  const removeAgeGroup = (index: number) => {
    if (ageGroups.length <= 1) {
      toast.error("You must have at least one age group");
      return;
    }
    setAgeGroups(ageGroups.filter((_, i) => i !== index));
  };

  const handleSaveAgeGroups = async () => {
    // Validate all age groups
    for (let i = 0; i < ageGroups.length; i++) {
      const group = ageGroups[i];
      
      if (!group.groupName?.trim()) {
        toast.error(`Please enter a name for age group ${i + 1}`);
        return;
      }

      if (!isPositiveNumber(group.minAge) || group.minAge < 0) {
        toast.error(`Please enter a valid minimum age for ${group.groupName}`);
        return;
      }

      if (!isPositiveNumber(group.maxAge) || group.maxAge < 0) {
        toast.error(`Please enter a valid maximum age for ${group.groupName}`);
        return;
      }

      if (group.maxAge < group.minAge) {
        toast.error(`Maximum age must be greater than minimum age for ${group.groupName}`);
        return;
      }
    }

    // Sort by minAge
    const sortedGroups = [...ageGroups].sort((a, b) => a.minAge - b.minAge);

    setIsSaving(true);
    try {
      if (currentSettings) {
        await updateSettings.mutateAsync({
          id: currentSettings.id,
          data: { ageGroupConfig: sortedGroups }
        });
      } else {
        await createSettings.mutateAsync({
          ageGroupConfig: sortedGroups
        });
      }
      toast.success("Age groups saved successfully!");
    } catch (error: any) {
      console.error("Save age groups error:", error);
      toast.error(error?.message || "Failed to save age groups. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (confirm("Reset to default age groups? This will overwrite your current configuration.")) {
      setAgeGroups(DEFAULT_AGE_GROUPS);
    }
  };

  if (isLoading) {
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
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-display font-bold">Studio Settings</h1>
            <p className="text-muted-foreground">Configure your studio's age groups and preferences.</p>
          </div>
        </div>

        <Tabs defaultValue="age-groups" className="w-full">
          <TabsList className="bg-white/50 border p-1 h-auto mb-6">
            <TabsTrigger 
              value="age-groups"
              className="py-2 px-6 rounded-md data-[state=active]:bg-[#FF9F7F] data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Age Groups
            </TabsTrigger>
            <TabsTrigger 
              value="general"
              className="py-2 px-6 rounded-md data-[state=active]:bg-[#FF9F7F] data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              General Settings
            </TabsTrigger>
          </TabsList>

          {/* AGE GROUPS TAB */}
          <TabsContent value="age-groups" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Age Group Configuration</CardTitle>
                <CardDescription>
                  Define age groups for dancers. These are used throughout the system for class assignments and competitions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {ageGroups.map((group, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 border rounded-lg bg-white">
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Group Name</Label>
                          <Input
                            placeholder="e.g. Minis"
                            value={group.groupName}
                            onChange={(e) => updateAgeGroup(index, 'groupName', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Min Age</Label>
                          <Input
                            type="number"
                            min="0"
                            value={group.minAge}
                            onChange={(e) => updateAgeGroup(index, 'minAge', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Max Age</Label>
                          <Input
                            type="number"
                            min="0"
                            value={group.maxAge}
                            onChange={(e) => updateAgeGroup(index, 'maxAge', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAgeGroup(index)}
                        disabled={ageGroups.length <= 1}
                        aria-label={`Remove ${group.groupName || 'age group'}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={addAgeGroup}
                    aria-label="Add age group"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Age Group
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetToDefaults}
                    aria-label="Reset to defaults"
                  >
                    Reset to Defaults
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    className="w-full bg-primary text-white"
                    onClick={handleSaveAgeGroups}
                    disabled={isSaving}
                    aria-label="Save age groups"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Age Groups'
                    )}
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Age groups are calculated based on the dancer's date of birth. 
                    When you add a dancer, their age group will be automatically assigned based on these ranges.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* GENERAL SETTINGS TAB */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Studio Information</CardTitle>
                <CardDescription>
                  Basic information about your studio (Coming Soon)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center p-8 text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Studio name, address, contact info, and other general settings will be available here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
