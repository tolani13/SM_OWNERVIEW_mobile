export interface Recital {
  id: string;
  name: string;
  date: string; // ISO yyyy-mm-dd
  startTime?: string; // "18:00"
  endTime?: string; // "20:30"
  description?: string;
  status?: "draft" | "scheduled" | "archived";
  locationName?: string;
}

export interface Performance {
  id: string;
  recitalId: string;
  routineName: string;
  className: string;
  performersSummary: string;
  order: number; // global order in show
  segment?: "Act 1" | "Intermission" | "Act 2" | string;
  durationMinutes?: number;
}

export interface ClassTreeNode {
  id: string;
  type: "location" | "category" | "class";
  name: string;
  children?: ClassTreeNode[];
}