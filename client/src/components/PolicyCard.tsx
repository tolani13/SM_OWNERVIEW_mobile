import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type PolicyStatus = "agreed" | "pending";

export interface PolicyCardProps {
  title: string;
  summary: string;
  appliesTo: string;
  categoryLabel: string;
  status: PolicyStatus;
  onViewFullPolicy: () => void;
  onToggleAgree?: () => void;
}

export function PolicyCard({
  title,
  summary,
  appliesTo,
  categoryLabel,
  status,
  onViewFullPolicy,
  onToggleAgree,
}: PolicyCardProps) {
  const isAgreed = status === "agreed";

  return (
    <Card
      className={[
        "group h-full border border-slate-200 bg-white shadow-md",
        "transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-primary/25 focus-within:ring-offset-1",
      ].join(" ")}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg text-black">{title}</CardTitle>
            <p className="text-sm text-black/80">{summary}</p>
          </div>
          <Badge
            variant="secondary"
            className="border border-primary/40 bg-primary/10 text-primary"
          >
            {categoryLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-black/90">
          <span className="font-medium text-primary">Applies to:</span> {appliesTo}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-slate-300 bg-white text-black hover:bg-slate-50"
            onClick={onViewFullPolicy}
          >
            View Full Policy
          </Button>

          <Button
            variant="outline"
            onClick={onToggleAgree}
            disabled={isAgreed || !onToggleAgree}
            className={
              isAgreed
                ? "border-emerald-200 bg-emerald-50 text-black hover:bg-emerald-50"
                : "border-slate-300 bg-white text-black hover:bg-slate-50"
            }
          >
            {isAgreed ? "Agreed" : "Agree"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
