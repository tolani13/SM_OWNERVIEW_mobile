import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { ChevronDown, ChevronRight, GripVertical, Pencil, Trash2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClassTreeNode, Performance, Recital } from "@/types/recital";

const MOCK_RECITALS: Recital[] = [
  {
    id: "r-1",
    name: "Spring Showcase",
    date: "2026-05-16",
    startTime: "18:00",
    endTime: "20:30",
    description: "Annual spring production with all performance groups.",
    status: "scheduled",
    locationName: "Main Theater",
  },
  {
    id: "r-2",
    name: "Holiday Magic",
    date: "2026-12-08",
    startTime: "19:00",
    endTime: "21:00",
    description: "Winter recital.",
    status: "draft",
    locationName: "City Arts Hall",
  },
];

const MOCK_PERFORMANCES: Performance[] = [
  {
    id: "p-1",
    recitalId: "r-1",
    routineName: "Opening Number",
    className: "Mini Ballet I",
    performersSummary: "14 dancers · Ages 6–8",
    order: 1,
    segment: "Act 1",
    durationMinutes: 4,
  },
  {
    id: "p-2",
    recitalId: "r-1",
    routineName: "Rhythm City",
    className: "Junior Tap II",
    performersSummary: "12 dancers · Ages 9–11",
    order: 2,
    segment: "Act 1",
    durationMinutes: 3,
  },
  {
    id: "p-3",
    recitalId: "r-1",
    routineName: "Break",
    className: "Front of House",
    performersSummary: "15 minute intermission",
    order: 3,
    segment: "Intermission",
    durationMinutes: 15,
  },
  {
    id: "p-4",
    recitalId: "r-1",
    routineName: "Shine On",
    className: "Senior Contemporary",
    performersSummary: "10 dancers · Ages 14–18",
    order: 4,
    segment: "Act 2",
    durationMinutes: 5,
  },
];

const MOCK_CLASS_TREE: ClassTreeNode[] = [
  {
    id: "loc-1",
    type: "location",
    name: "Main Studio",
    children: [
      {
        id: "cat-1",
        type: "category",
        name: "Ballet",
        children: [
          { id: "class-1", type: "class", name: "Mini Ballet I" },
          { id: "class-2", type: "class", name: "Junior Ballet II" },
        ],
      },
      {
        id: "cat-2",
        type: "category",
        name: "Tap",
        children: [
          { id: "class-3", type: "class", name: "Junior Tap II" },
          { id: "class-4", type: "class", name: "Senior Tap" },
        ],
      },
    ],
  },
  {
    id: "loc-2",
    type: "location",
    name: "North Campus",
    children: [
      {
        id: "cat-3",
        type: "category",
        name: "Contemporary",
        children: [
          { id: "class-5", type: "class", name: "Teen Contemporary" },
          { id: "class-6", type: "class", name: "Senior Contemporary" },
        ],
      },
    ],
  },
];

function segmentPill(segment: string) {
  if (segment.toLowerCase().includes("intermission")) {
    return "bg-orange-50 text-orange-700";
  }
  return "bg-coral/10 text-coral";
}

function TreeNode({
  node,
  level,
  expanded,
  classFilter,
  selectedClassId,
  onToggle,
  onSelectClass,
}: {
  node: ClassTreeNode;
  level: number;
  expanded: Set<string>;
  classFilter: string;
  selectedClassId: string | null;
  onToggle: (id: string) => void;
  onSelectClass: (id: string) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expanded.has(node.id);

  const isClassVisible =
    node.type !== "class" ||
    node.name.toLowerCase().includes(classFilter.toLowerCase().trim());

  const childNodes = node.children ?? [];
  const visibleChildren = childNodes.filter((child) => {
    if (child.type === "class") {
      return child.name.toLowerCase().includes(classFilter.toLowerCase().trim());
    }
    return true;
  });

  if (!isClassVisible && visibleChildren.length === 0) {
    return null;
  }

  if (node.type === "class") {
    const selected = selectedClassId === node.id;
    return (
      <button
        type="button"
        onClick={() => onSelectClass(node.id)}
        className={[
          "w-full flex items-center gap-2 hover:bg-orange-50 cursor-pointer rounded-lg px-2 py-1.5 border transition-colors",
          selected
            ? "bg-coral/10 border-coral/40"
            : "bg-white border-transparent",
        ].join(" ")}
        style={{ marginLeft: `${level * 12}px` }}
      >
        <GripVertical className="w-3.5 h-3.5 text-gray-400 cursor-grab" />
        <span className="text-sm text-gray-700 text-left">{node.name}</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-coral/10 text-coral">
          Class
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onToggle(node.id)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50"
        style={{ marginLeft: `${level * 10}px` }}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )
        ) : (
          <span className="w-4" />
        )}
        <span className="text-sm font-semibold text-gray-800">{node.name}</span>
      </button>

      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {visibleChildren.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              classFilter={classFilter}
              selectedClassId={selectedClassId}
              onToggle={onToggle}
              onSelectClass={onSelectClass}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecitalEditorPage() {
  const [match, params] = useRoute<{ id: string }>("/recitals/:id");
  const recitalId = match ? params.id : "r-1";

  const recital = useMemo(
    () => MOCK_RECITALS.find((item) => item.id === recitalId) ?? MOCK_RECITALS[0],
    [recitalId],
  );

  const recitalPerformances = useMemo(
    () =>
      MOCK_PERFORMANCES.filter((item) => item.recitalId === recital.id).sort(
        (a, b) => a.order - b.order,
      ),
    [recital.id],
  );

  const [name, setName] = useState(recital.name);
  const [date, setDate] = useState(recital.date);
  const [startTime, setStartTime] = useState(recital.startTime ?? "");
  const [endTime, setEndTime] = useState(recital.endTime ?? "");
  const [conflictGap, setConflictGap] = useState(10);
  const [status, setStatus] = useState<NonNullable<Recital["status"]>>(
    recital.status ?? "draft",
  );
  const [description, setDescription] = useState(recital.description ?? "");

  const [expandedAll, setExpandedAll] = useState(true);
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<Set<string>>(
    new Set(MOCK_CLASS_TREE.map((node) => node.id)),
  );
  const [classFilter, setClassFilter] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const groupedSegments = useMemo(() => {
    const map = new Map<string, Performance[]>();

    recitalPerformances.forEach((item) => {
      const key = item.segment ?? "Act 1";
      map.set(key, [...(map.get(key) ?? []), item]);
    });

    return Array.from(map.entries());
  }, [recitalPerformances]);

  const totalDuration = recitalPerformances.reduce(
    (total, item) => total + (item.durationMinutes ?? 0),
    0,
  );

  const handleSaveChanges = () => {
    console.log("[RecitalEditorPage] save payload", {
      recitalId: recital.id,
      name,
      date,
      startTime,
      endTime,
      conflictGap,
      status,
      description,
      selectedClassId,
    });
    // TODO: connect to API
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Recital Editor</h1>
              <p className="text-sm text-gray-500">Manage recital details and lineup.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="rounded-xl px-4 py-2 text-sm font-semibold bg-coral text-white hover:bg-coral/90"
                onClick={handleSaveChanges}
              >
                Save Changes
              </Button>
              <Button variant="ghost" className="rounded-xl border border-gray-200 text-gray-700">
                Add Performance
              </Button>
              <Button
                variant="ghost"
                className="rounded-xl border border-gray-200 text-gray-700"
                onClick={() => {
                  const nextValue = !expandedAll;
                  setExpandedAll(nextValue);
                  if (nextValue) {
                    const allIds: string[] = [];
                    const collect = (nodes: ClassTreeNode[]) => {
                      nodes.forEach((node) => {
                        allIds.push(node.id);
                        if (node.children?.length) collect(node.children);
                      });
                    };
                    collect(MOCK_CLASS_TREE);
                    setExpandedTreeNodes(new Set(allIds));
                  } else {
                    setExpandedTreeNodes(new Set());
                  }
                }}
              >
                Expand/Collapse All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Status</label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as NonNullable<Recital["status"]>)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Start Time</label>
              <Input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">End Time</label>
              <Input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Performance Conflict Gap (minutes)</label>
              <Input
                type="number"
                min={0}
                value={conflictGap}
                onChange={(event) => setConflictGap(Number(event.target.value || 0))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-gray-500">Description</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add notes for this recital"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr,3fr] gap-6">
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 space-y-3 h-[480px] flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Select a Class</h2>
              <Input
                placeholder="Filter classes"
                className="max-w-[220px]"
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
              />
            </div>

            <div className="mt-2 flex-1 overflow-y-auto space-y-1 pr-1">
              {MOCK_CLASS_TREE.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  level={0}
                  expanded={expandedTreeNodes}
                  classFilter={classFilter}
                  selectedClassId={selectedClassId}
                  onToggle={(id) => {
                    setExpandedTreeNodes((previous) => {
                      const copy = new Set(previous);
                      if (copy.has(id)) {
                        copy.delete(id);
                      } else {
                        copy.add(id);
                      }
                      return copy;
                    });
                  }}
                  onSelectClass={setSelectedClassId}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Recital Lineup</h2>
                <p className="text-xs text-gray-500">Order of performances for this show.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="border border-coral text-coral bg-coral/5 rounded-xl px-3 py-1.5 text-xs font-medium"
                >
                  Print Lineup
                </Button>
                <Button
                  variant="ghost"
                  className="border border-coral text-coral bg-coral/5 rounded-xl px-3 py-1.5 text-xs font-medium"
                >
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {groupedSegments.map(([segment, items]) => (
                <div key={segment} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{segment}</h3>
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${segmentPill(segment)}`}
                    >
                      {segment.toLowerCase().includes("intermission") ? "Intermission" : "Act"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {items.map((performance) => (
                      <div
                        key={performance.id}
                        className="grid grid-cols-[auto,1fr,auto] gap-3 items-center py-2 px-2 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 text-gray-500 min-w-[58px]">
                          <span className="text-sm font-semibold">{performance.order}</span>
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{performance.routineName}</p>
                          <p className="text-xs text-gray-500">{performance.className}</p>
                          <p className="text-xs text-gray-500">{performance.performersSummary}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 mr-1">
                            {performance.durationMinutes ?? 0} min
                          </span>
                          <Button variant="ghost" size="icon" aria-label="Edit performance">
                            <Pencil className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete performance">
                            <Trash2 className="w-4 h-4 text-gray-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-1 text-xs text-gray-500">
              Total routines: {recitalPerformances.length} · Estimated run time: {totalDuration} min
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
