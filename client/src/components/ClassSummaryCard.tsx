import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ClassSummaryCardProps = {
  title: string;
  ageRangeLabel: string;
  seasonLabel: string;
  whenLabel: string;
  whereLabel: string;
  teacherName: string;
  tuitionLabel: string;
  actions?: ReactNode;
  className?: string;
};

export function ClassSummaryCard({
  title,
  ageRangeLabel,
  seasonLabel,
  whenLabel,
  whereLabel,
  teacherName,
  tuitionLabel,
  actions,
  className,
}: ClassSummaryCardProps) {
  return (
    <Card
      className={cn(
        "bg-white shadow-md border border-slate-200 border-l-4 border-l-primary",
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-black">{title}</CardTitle>
            <p className="text-sm text-black/80">
              {ageRangeLabel} · {seasonLabel}
            </p>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-black">
        <div>
          <span className="font-medium text-black">When:</span> {whenLabel}
        </div>
        <div>
          <span className="font-medium text-black">Where:</span> {whereLabel}
        </div>
        <div>
          <span className="font-medium text-black">Teacher:</span> {teacherName}
        </div>
        <div>
          <span className="font-medium text-black">Tuition:</span> {tuitionLabel}
        </div>
      </CardContent>
    </Card>
  );
}
