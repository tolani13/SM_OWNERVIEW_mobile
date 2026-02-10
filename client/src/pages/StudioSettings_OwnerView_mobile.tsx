import { useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "react-hot-toast";
import { Layout } from "@/components/Layout";
import { SectionNav, type SettingsSection } from "@/components/settings/SectionNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "studio-profile", label: "Studio Profile", description: "Name, contact, and address" },
  { id: "branding", label: "Branding", description: "Logo and brand display" },
  { id: "notifications", label: "Notifications", description: "Email and push preferences" },
  { id: "scheduling", label: "Scheduling", description: "Calendar defaults and buffers" },
  { id: "tuition", label: "Tuition", description: "Default rates and billing timing" },
  { id: "competition", label: "Competition", description: "Registration and run-sheet defaults" },
  { id: "recitals", label: "Recitals", description: "Show templates and reminders" },
  { id: "attendance", label: "Attendance", description: "Sign-in behavior and grace period" },
  { id: "staff", label: "Staff", description: "Teacher permissions and visibility" },
  { id: "parent-portal", label: "Parent Portal", description: "What parents can view" },
  { id: "integrations", label: "Integrations", description: "Payments and sync options" },
  { id: "documents", label: "Documents", description: "Policy and release defaults" },
  { id: "security", label: "Security", description: "Session and account rules" },
];

type SectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

type SettingsFormState = {
  studioName: string;
  studioEmail: string;
  studioPhone: string;
  studioAddress: string;
  primaryColor: string;
  logoUrl: string;
  emailAnnouncements: boolean;
  smsReminders: boolean;
  autoWaitlist: boolean;
  classBufferMinutes: number;
  monthlyTuitionMini: string;
  monthlyTuitionJunior: string;
  monthlyTuitionTeen: string;
  monthlyTuitionSenior: string;
  compDeadlineDays: number;
  recitalDefaultVenue: string;
  attendanceGraceMinutes: number;
  staffCanEditFinance: boolean;
  parentCanViewBalances: boolean;
  stripeConnected: boolean;
  defaultPolicyText: string;
  requireMfaForAdmins: boolean;
  sessionTimeoutMinutes: number;
};

const DEFAULT_STATE: SettingsFormState = {
  studioName: "Studio Maestro Dance",
  studioEmail: "admin@studiomaestro.com",
  studioPhone: "(555) 010-1200",
  studioAddress: "123 Main Street, Palm Springs, CA",
  primaryColor: "#FF9F7F",
  logoUrl: "",
  emailAnnouncements: true,
  smsReminders: false,
  autoWaitlist: true,
  classBufferMinutes: 10,
  monthlyTuitionMini: "125",
  monthlyTuitionJunior: "145",
  monthlyTuitionTeen: "165",
  monthlyTuitionSenior: "185",
  compDeadlineDays: 14,
  recitalDefaultVenue: "Main Theater",
  attendanceGraceMinutes: 15,
  staffCanEditFinance: false,
  parentCanViewBalances: true,
  stripeConnected: false,
  defaultPolicyText: "All tuition is due on the 1st of each month.",
  requireMfaForAdmins: true,
  sessionTimeoutMinutes: 60,
};

export default function StudioSettings() {
  const [activeSection, setActiveSection] = useState<SectionId>(SETTINGS_SECTIONS[0].id);
  const [form, setForm] = useState<SettingsFormState>(DEFAULT_STATE);

  const activeSectionMeta = useMemo(
    () => SETTINGS_SECTIONS.find((item) => item.id === activeSection),
    [activeSection],
  );

  const saveSection = () => {
    toast.success(`${activeSectionMeta?.label ?? "Settings"} saved (local mock state).`);
  };

  const renderSection = () => {
    switch (activeSection) {
      case "studio-profile":
        return (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Studio Name</Label>
              <Input value={form.studioName} onChange={(e) => setForm({ ...form, studioName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.studioEmail} onChange={(e) => setForm({ ...form, studioEmail: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.studioPhone} onChange={(e) => setForm({ ...form, studioPhone: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input value={form.studioAddress} onChange={(e) => setForm({ ...form, studioAddress: e.target.value })} />
            </div>
          </div>
        );
      case "branding":
        return (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <Input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." />
            </div>
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Email Announcements</Label>
              <Switch checked={form.emailAnnouncements} onCheckedChange={(v) => setForm({ ...form, emailAnnouncements: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>SMS Reminders</Label>
              <Switch checked={form.smsReminders} onCheckedChange={(v) => setForm({ ...form, smsReminders: v })} />
            </div>
          </div>
        );
      case "scheduling":
        return (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Enable Auto Waitlist</Label>
              <Switch checked={form.autoWaitlist} onCheckedChange={(v) => setForm({ ...form, autoWaitlist: v })} />
            </div>
            <div className="space-y-2">
              <Label>Class Buffer Minutes</Label>
              <Input type="number" value={form.classBufferMinutes} onChange={(e) => setForm({ ...form, classBufferMinutes: Number(e.target.value || 0) })} />
            </div>
          </div>
        );
      case "tuition":
        return (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Mini Monthly Tuition</Label><Input value={form.monthlyTuitionMini} onChange={(e) => setForm({ ...form, monthlyTuitionMini: e.target.value })} /></div>
            <div className="space-y-2"><Label>Junior Monthly Tuition</Label><Input value={form.monthlyTuitionJunior} onChange={(e) => setForm({ ...form, monthlyTuitionJunior: e.target.value })} /></div>
            <div className="space-y-2"><Label>Teen Monthly Tuition</Label><Input value={form.monthlyTuitionTeen} onChange={(e) => setForm({ ...form, monthlyTuitionTeen: e.target.value })} /></div>
            <div className="space-y-2"><Label>Senior Monthly Tuition</Label><Input value={form.monthlyTuitionSenior} onChange={(e) => setForm({ ...form, monthlyTuitionSenior: e.target.value })} /></div>
          </div>
        );
      case "competition":
        return (
          <div className="space-y-2 max-w-sm">
            <Label>Competition Registration Deadline (days)</Label>
            <Input type="number" value={form.compDeadlineDays} onChange={(e) => setForm({ ...form, compDeadlineDays: Number(e.target.value || 0) })} />
          </div>
        );
      case "recitals":
        return (
          <div className="space-y-2 max-w-md">
            <Label>Default Recital Venue</Label>
            <Input value={form.recitalDefaultVenue} onChange={(e) => setForm({ ...form, recitalDefaultVenue: e.target.value })} />
          </div>
        );
      case "attendance":
        return (
          <div className="space-y-2 max-w-sm">
            <Label>Grace Period (minutes)</Label>
            <Input type="number" value={form.attendanceGraceMinutes} onChange={(e) => setForm({ ...form, attendanceGraceMinutes: Number(e.target.value || 0) })} />
          </div>
        );
      case "staff":
        return (
          <div className="flex items-center justify-between rounded-lg border p-3 max-w-md">
            <Label>Allow staff to edit finance data</Label>
            <Switch checked={form.staffCanEditFinance} onCheckedChange={(v) => setForm({ ...form, staffCanEditFinance: v })} />
          </div>
        );
      case "parent-portal":
        return (
          <div className="flex items-center justify-between rounded-lg border p-3 max-w-md">
            <Label>Parents can view balances</Label>
            <Switch checked={form.parentCanViewBalances} onCheckedChange={(v) => setForm({ ...form, parentCanViewBalances: v })} />
          </div>
        );
      case "integrations":
        return (
          <div className="flex items-center justify-between rounded-lg border p-3 max-w-md">
            <Label>Stripe Connected</Label>
            <Switch checked={form.stripeConnected} onCheckedChange={(v) => setForm({ ...form, stripeConnected: v })} />
          </div>
        );
      case "documents":
        return (
          <div className="space-y-2">
            <Label>Default Policy Text</Label>
            <Textarea value={form.defaultPolicyText} onChange={(e) => setForm({ ...form, defaultPolicyText: e.target.value })} rows={5} />
          </div>
        );
      case "security":
        return (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Require MFA for admins</Label>
              <Switch checked={form.requireMfaForAdmins} onCheckedChange={(v) => setForm({ ...form, requireMfaForAdmins: v })} />
            </div>
            <div className="space-y-2">
              <Label>Session Timeout (minutes)</Label>
              <Input type="number" value={form.sessionTimeoutMinutes} onChange={(e) => setForm({ ...form, sessionTimeoutMinutes: Number(e.target.value || 0) })} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-display font-bold">General Settings</h1>
            <p className="text-muted-foreground">Configure studio-wide preferences in one place.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
          <SectionNav
            sections={SETTINGS_SECTIONS}
            activeSection={activeSection}
            onSelectSection={(id) => setActiveSection(id as SectionId)}
          />

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>{activeSectionMeta?.label}</CardTitle>
              <CardDescription>{activeSectionMeta?.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderSection()}

              <div className="pt-4 border-t flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setForm(DEFAULT_STATE)}>
                  Reset
                </Button>
                <Button className="bg-primary text-white" onClick={saveSection}>
                  Save {activeSectionMeta?.label}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
