import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Copy, Edit3, Search, Trash2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CopyRecitalDialog,
  type CopyOption,
} from "@/components/recitals/CopyRecitalDialog";
import {
  CreateRecitalDialog,
  type CreateRecitalInput,
} from "@/components/recitals/CreateRecitalDialog";
import type { Recital } from "@/types/recital";

type RecitalStatusFilter = "all" | "draft" | "scheduled" | "archived";

const INITIAL_RECITALS: Recital[] = [
  {
    id: "r-1",
    name: "Spring Showcase",
    date: "2026-05-16",
    startTime: "18:00",
    endTime: "20:30",
    description: "Annual spring production.",
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
  {
    id: "r-3",
    name: "Summer Spotlight",
    date: "2025-08-10",
    startTime: "17:30",
    endTime: "20:00",
    description: "Archived sample recital.",
    status: "archived",
    locationName: "North Campus Stage",
  },
];

function statusPill(status: Recital["status"]) {
  if (status === "scheduled") {
    return "bg-coral/10 text-coral";
  }
  if (status === "draft") {
    return "bg-orange-50 text-orange-700";
  }
  return "bg-gray-100 text-gray-600";
}

export default function RecitalListPage() {
  const [, setLocation] = useLocation();

  const [recitals, setRecitals] = useState<Recital[]>(INITIAL_RECITALS);
  const [nameFilter, setNameFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecitalStatusFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySource, setCopySource] = useState<Recital | undefined>(undefined);

  const filteredRecitals = useMemo(() => {
    return recitals.filter((recital) => {
      const matchesName = recital.name
        .toLowerCase()
        .includes(nameFilter.toLowerCase().trim());

      const matchesStatus =
        statusFilter === "all" ? true : recital.status === statusFilter;

      const matchesFrom = fromDate ? recital.date >= fromDate : true;
      const matchesTo = toDate ? recital.date <= toDate : true;

      return matchesName && matchesStatus && matchesFrom && matchesTo;
    });
  }, [recitals, nameFilter, statusFilter, fromDate, toDate]);

  const handleCreateRecital = (payload: CreateRecitalInput) => {
    const newRecital: Recital = {
      id: `r-${Date.now()}`,
      name: payload.name,
      date: payload.date,
      status: "draft",
      startTime: "",
      endTime: "",
      locationName: "",
      description: "",
    };

    setRecitals((prev) => [newRecital, ...prev]);
  };

  const handleCopyRecital = (payload: {
    sourceRecitalId: string;
    newName: string;
    option: CopyOption;
  }) => {
    const source = recitals.find((item) => item.id === payload.sourceRecitalId);
    if (!source) return;

    const copied: Recital = {
      ...source,
      id: `r-${Date.now()}`,
      name: payload.newName,
      status: "draft",
      description:
        payload.option === "recital-only"
          ? source.description
          : `${source.description ?? ""}`.trim(),
    };

    setRecitals((prev) => [copied, ...prev]);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Recitals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create, copy, and manage recitals and their lineups.
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Recital name</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={nameFilter}
                  onChange={(event) => setNameFilter(event.target.value)}
                  className="pl-9"
                  placeholder="Search by recital name"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <Input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as RecitalStatusFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button className="rounded-xl px-4 py-2 text-sm font-semibold bg-coral text-white hover:bg-coral/90">
              Search
            </Button>
            <Button
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-coral text-white hover:bg-coral/90"
              onClick={() => setCreateOpen(true)}
            >
              Create New Recital
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex justify-end pb-3">
            <span className="text-xs text-gray-500">
              {filteredRecitals.length} recitals found
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100 text-gray-500">
                  <th className="font-medium py-2">Recital Name</th>
                  <th className="font-medium py-2">Date</th>
                  <th className="font-medium py-2">Start Time</th>
                  <th className="font-medium py-2">End Time</th>
                  <th className="font-medium py-2">Status</th>
                  <th className="font-medium py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecitals.map((recital) => (
                  <tr key={recital.id} className="border-b border-gray-50">
                    <td className="py-3">
                      <button
                        type="button"
                        className="text-coral hover:underline font-medium"
                        onClick={() => setLocation(`/recitals/${recital.id}`)}
                      >
                        {recital.name}
                      </button>
                    </td>
                    <td className="py-3 text-gray-700">{recital.date}</td>
                    <td className="py-3 text-gray-700">{recital.startTime || "—"}</td>
                    <td className="py-3 text-gray-700">{recital.endTime || "—"}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${statusPill(recital.status)}`}
                      >
                        {recital.status || "draft"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCopySource(recital);
                            setCopyOpen(true);
                          }}
                          aria-label={`Copy ${recital.name}`}
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLocation(`/recitals/${recital.id}`)}
                          aria-label={`Edit ${recital.name}`}
                        >
                          <Edit3 className="w-4 h-4 text-gray-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (window.confirm(`Delete ${recital.name}?`)) {
                              setRecitals((prev) =>
                                prev.filter((item) => item.id !== recital.id),
                              );
                            }
                          }}
                          aria-label={`Delete ${recital.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-gray-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreateRecitalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreateRecital}
      />

      <CopyRecitalDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        sourceRecital={copySource}
        onCopy={handleCopyRecital}
      />
    </Layout>
  );
}
