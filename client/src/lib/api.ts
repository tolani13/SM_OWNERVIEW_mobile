import type {
  Dancer,
  InsertDancer,
  Teacher,
  InsertTeacher,
  Routine,
  InsertRoutine,
  Competition,
  InsertCompetition,
  RunSlot,
  InsertRunSlot,
  ConventionClass,
  InsertConventionClass,
  StudioClass,
  InsertStudioClass,
  PracticeBooking,
  InsertPracticeBooking,
  Announcement,
  InsertAnnouncement,
  Fee,
  InsertFee,
  CompetitionRunSheet,
  InsertCompetitionRunSheet,
} from "@server/schema";

const API_BASE = "/api";

// Run sheet helper types
export interface RunSheetImportResponse {
  success: boolean;
  entries: InsertCompetitionRunSheet[] | CompetitionRunSheet[];
  warnings?: string[];
  message?: string;
}

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Dancers
export const dancersAPI = {
  getAll: () => fetchAPI<Dancer[]>("/dancers"),
  getOne: (id: string) => fetchAPI<Dancer>(`/dancers/${id}`),
  create: (data: InsertDancer) => fetchAPI<Dancer>("/dancers", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertDancer>) => fetchAPI<Dancer>(`/dancers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => fetchAPI<void>(`/dancers/${id}`, { method: "DELETE" }),
};

// Teachers
export const teachersAPI = {
  getAll: () => fetchAPI<Teacher[]>("/teachers"),
  getOne: (id: string) => fetchAPI<Teacher>(`/teachers/${id}`),
  create: (data: InsertTeacher) => fetchAPI<Teacher>("/teachers", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertTeacher>) => fetchAPI<Teacher>(`/teachers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// Routines
export const routinesAPI = {
  getAll: () => fetchAPI<Routine[]>("/routines"),
  getOne: (id: string) => fetchAPI<Routine>(`/routines/${id}`),
  create: (data: InsertRoutine) => fetchAPI<Routine>("/routines", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertRoutine>) => fetchAPI<Routine>(`/routines/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => fetchAPI<void>(`/routines/${id}`, { method: "DELETE" }),
};

// Competitions
export const competitionsAPI = {
  getAll: () => fetchAPI<Competition[]>("/competitions"),
  getOne: (id: string) => fetchAPI<Competition>(`/competitions/${id}`),
  create: (data: InsertCompetition) => fetchAPI<Competition>("/competitions", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertCompetition>) => fetchAPI<Competition>(`/competitions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// Run Slots
export const runSlotsAPI = {
  getAll: (competitionId?: string) => fetchAPI<RunSlot[]>(`/run-slots${competitionId ? `?competitionId=${competitionId}` : ""}`),
  getOne: (id: string) => fetchAPI<RunSlot>(`/run-slots/${id}`),
  create: (data: InsertRunSlot) => fetchAPI<RunSlot>("/run-slots", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertRunSlot>) => fetchAPI<RunSlot>(`/run-slots/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => fetchAPI<void>(`/run-slots/${id}`, { method: "DELETE" }),
};

// Convention Classes
export const conventionClassesAPI = {
  getAll: (competitionId?: string) => fetchAPI<ConventionClass[]>(`/convention-classes${competitionId ? `?competitionId=${competitionId}` : ""}`),
  getOne: (id: string) => fetchAPI<ConventionClass>(`/convention-classes/${id}`),
  create: (data: InsertConventionClass) => fetchAPI<ConventionClass>("/convention-classes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertConventionClass>) => fetchAPI<ConventionClass>(`/convention-classes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => fetchAPI<void>(`/convention-classes/${id}`, { method: "DELETE" }),
};

// Studio Classes
export const studioClassesAPI = {
  getAll: () => fetchAPI<StudioClass[]>("/studio-classes"),
  getOne: (id: string) => fetchAPI<StudioClass>(`/studio-classes/${id}`),
  create: (data: InsertStudioClass) => fetchAPI<StudioClass>("/studio-classes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertStudioClass>) => fetchAPI<StudioClass>(`/studio-classes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => fetchAPI<void>(`/studio-classes/${id}`, { method: "DELETE" }),
};

// Practice Bookings
export const practiceBookingsAPI = {
  getAll: () => fetchAPI<PracticeBooking[]>("/practice-bookings"),
  getOne: (id: string) => fetchAPI<PracticeBooking>(`/practice-bookings/${id}`),
  create: (data: InsertPracticeBooking) => fetchAPI<PracticeBooking>("/practice-bookings", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertPracticeBooking>) => fetchAPI<PracticeBooking>(`/practice-bookings/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => fetchAPI<void>(`/practice-bookings/${id}`, { method: "DELETE" }),
};

// Announcements
export const announcementsAPI = {
  getAll: () => fetchAPI<Announcement[]>("/announcements"),
  getOne: (id: string) => fetchAPI<Announcement>(`/announcements/${id}`),
  create: (data: InsertAnnouncement) => fetchAPI<Announcement>("/announcements", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertAnnouncement>) => fetchAPI<Announcement>(`/announcements/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => fetchAPI<void>(`/announcements/${id}`, { method: "DELETE" }),
};

// Fees
export const feesAPI = {
  getAll: (dancerId?: string) => fetchAPI<Fee[]>(`/fees${dancerId ? `?dancerId=${dancerId}` : ""}`),
  getOne: (id: string) => fetchAPI<Fee>(`/fees/${id}`),
  create: (data: InsertFee) => fetchAPI<Fee>("/fees", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InsertFee>) => fetchAPI<Fee>(`/fees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => fetchAPI<void>(`/fees/${id}`, { method: "DELETE" }),
};

// Competition Run Sheet (new flow)
export const runSheetAPI = {
  getAll: (competitionId: string) => fetchAPI<CompetitionRunSheet[]>(`/competitions/${competitionId}/run-sheet`),
  importPdf: (competitionId: string, file: File) => {
    const formData = new FormData();
    formData.append("pdf", file);

    return fetch(`${API_BASE}/competitions/${competitionId}/run-sheet/import`, {
      method: "POST",
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      return res.json() as Promise<RunSheetImportResponse>;
    });
  },
  saveAll: (competitionId: string, entries: InsertCompetitionRunSheet[]) =>
    fetchAPI<{ success: boolean; savedCount: number; entries: CompetitionRunSheet[] }>(
      `/competitions/${competitionId}/run-sheet`,
      {
        method: "POST",
        body: JSON.stringify({ entries }),
      },
    ),
  addEntry: (competitionId: string, entry: InsertCompetitionRunSheet) =>
    fetchAPI<CompetitionRunSheet>(`/competitions/${competitionId}/run-sheet/entry`, {
      method: "POST",
      body: JSON.stringify(entry),
    }),
  update: (id: string, data: Partial<CompetitionRunSheet>) =>
    fetchAPI<CompetitionRunSheet>(`/run-sheet/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) => fetchAPI<void>(`/run-sheet/${id}`, { method: "DELETE" }),
  deleteAll: (competitionId: string) => fetchAPI<void>(`/competitions/${competitionId}/run-sheet`, { method: "DELETE" }),
};