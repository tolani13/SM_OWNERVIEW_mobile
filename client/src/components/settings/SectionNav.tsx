import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SettingsSection = {
  id: string;
  label: string;
  description?: string;
};

type SectionNavProps = {
  sections: SettingsSection[];
  activeSection: string;
  onSelectSection: (id: string) => void;
};

export function SectionNav({
  sections,
  activeSection,
  onSelectSection,
}: SectionNavProps) {
  return (
    <aside className="rounded-2xl border bg-white p-3 md:p-4 h-fit">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Sections</h2>
        <p className="text-xs text-muted-foreground">
          Choose a category to edit settings.
        </p>
      </div>

      <div className="space-y-1.5">
        {sections.map((section) => {
          const isActive = section.id === activeSection;
          return (
            <Button
              key={section.id}
              type="button"
              variant="ghost"
              onClick={() => onSelectSection(section.id)}
              className={cn(
                "w-full justify-start h-auto px-3 py-2 rounded-lg border text-left",
                isActive
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40",
              )}
            >
              <div>
                <div className="text-sm font-medium">{section.label}</div>
                {section.description ? (
                  <div className="text-[11px] mt-0.5 opacity-80">
                    {section.description}
                  </div>
                ) : null}
              </div>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
