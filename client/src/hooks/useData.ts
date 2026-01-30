import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Fee,
  InsertFee,
  Announcement,
  InsertAnnouncement,
  CompetitionRegistration,
  InsertCompetitionRegistration,
  StudioSettings, 
  InsertStudioSettings,
  Policy, 
  InsertPolicy,
  PolicyAgreement, 
  InsertPolicyAgreement,
  Recital, 
  InsertRecital,
  RecitalLineup, 
  InsertRecitalLineup
} from "@server/schema";
import { mockDancers, mockRoutines, mockCompetitions, mockStudioFees } from "@/lib/mockData";

// Dancers - MOCK DATA
export function useDancers() {
  return useQuery({
    queryKey: ["dancers"],
    queryFn: async () => {
      return mockDancers.map(d => ({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        age: d.age,
        status: d.isActive ? 'Active' : 'Inactive',
        email: `${d.firstName.toLowerCase()}.${d.lastName.toLowerCase()}@example.com`,
        phone: '555-0100',
        emergencyContact: 'Parent',
        emergencyPhone: '555-0101',
        medicalNotes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
  });
}

export function useCreateDancer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDancer) => {
      const res = await fetch('/api/dancers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create dancer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dancers"] });
    },
  });
}

export function useUpdateDancer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertDancer> }) => {
      const res = await fetch(`/api/dancers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update dancer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dancers"] });
    },
  });
}

export function useDeleteDancer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dancers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete dancer');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dancers"] });
    },
  });
}

// Teachers
export function useTeachers() {
  return useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error('Failed to fetch teachers');
      return res.json();
    }
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertTeacher) => {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create teacher');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTeacher> }) => {
      const res = await fetch(`/api/teachers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update teacher');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
}

// Routines - MOCK DATA
export function useRoutines() {
  return useQuery({
    queryKey: ["routines"],
    queryFn: async () => {
      return mockRoutines.map(r => ({
        id: r.id,
        name: r.name,
        style: r.style,
        duration: r.duration,
        ageLevel: r.style,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
  });
}

export function useCreateRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertRoutine) => {
      const res = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create routine');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
    },
  });
}

export function useUpdateRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertRoutine> }) => {
      const res = await fetch(`/api/routines/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update routine');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
    },
  });
}

export function useDeleteRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/routines/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete routine');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
    },
  });
}

// Competitions - MOCK DATA
export function useCompetitions() {
  return useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      return mockCompetitions.map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        startDate: c.date,
        endDate: c.date,
        status: c.status,
        registrationDeadline: c.date,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
  });
}

export function useCompetition(id: string) {
  return useQuery({
    queryKey: ["competitions", id],
    queryFn: async () => {
      const comp = mockCompetitions.find(c => c.id === id);
      if (!comp) throw new Error('Competition not found');
      return {
        id: comp.id,
        name: comp.name,
        location: comp.location,
        startDate: comp.date,
        endDate: comp.date,
        status: comp.status,
        registrationDeadline: comp.date,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    },
    enabled: !!id,
  });
}

export function useCreateCompetition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertCompetition) => {
      const res = await fetch('/api/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create competition');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
    },
  });
}

export function useUpdateCompetition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCompetition> }) => {
      const res = await fetch(`/api/competitions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update competition');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
    },
  });
}

// Competition Registrations & Fees
export function useCompetitionRegistrations(competitionId?: string) {
  return useQuery({
    queryKey: competitionId ? ['competition-registrations', competitionId] : ['competition-registrations'],
    queryFn: async () => {
      const url = competitionId 
        ? `/api/competition-registrations?competitionId=${competitionId}`
        : '/api/competition-registrations';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch registrations');
      return res.json();
    }
  });
}

export function useCreateCompetitionRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertCompetitionRegistration) => {
      const res = await fetch('/api/competition-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create registration');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-registrations'] });
    }
  });
}

export function useDeleteCompetitionRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/competition-registrations/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete registration');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-registrations'] });
    }
  });
}

export function useGenerateCompetitionFees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (competitionId: string) => {
      const res = await fetch(`/api/competitions/${competitionId}/generate-fees`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to generate fees');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    }
  });
}

// Run Slots
export function useRunSlots(competitionId?: string) {
  return useQuery({
    queryKey: ["runSlots", competitionId],
    queryFn: async () => {
      const url = competitionId ? `/api/run-slots?competitionId=${competitionId}` : '/api/run-slots';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch run slots');
      return res.json();
    }
  });
}

export function useCreateRunSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertRunSlot) => {
      const res = await fetch('/api/run-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create run slot');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runSlots"] });
    },
  });
}

export function useUpdateRunSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertRunSlot> }) => {
      const res = await fetch(`/api/run-slots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update run slot');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runSlots"] });
    },
  });
}

export function useDeleteRunSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/run-slots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete run slot');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runSlots"] });
    },
  });
}

// Convention Classes
export function useConventionClasses(competitionId?: string) {
  return useQuery({
    queryKey: ["conventionClasses", competitionId],
    queryFn: async () => {
      const url = competitionId ? `/api/convention-classes?competitionId=${competitionId}` : '/api/convention-classes';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch convention classes');
      return res.json();
    }
  });
}

export function useCreateConventionClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertConventionClass) => {
      const res = await fetch('/api/convention-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create convention class');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conventionClasses"] });
    },
  });
}

export function useUpdateConventionClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertConventionClass> }) => {
      const res = await fetch(`/api/convention-classes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update convention class');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conventionClasses"] });
    },
  });
}

export function useDeleteConventionClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/convention-classes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete convention class');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conventionClasses"] });
    },
  });
}

// Studio Classes
export function useStudioClasses() {
  return useQuery({
    queryKey: ["studioClasses"],
    queryFn: async () => {
      const res = await fetch('/api/studio-classes');
      if (!res.ok) throw new Error('Failed to fetch studio classes');
      return res.json();
    }
  });
}

export function useCreateStudioClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertStudioClass) => {
      const res = await fetch('/api/studio-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create studio class');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studioClasses"] });
    },
  });
}

export function useUpdateStudioClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertStudioClass> }) => {
      const res = await fetch(`/api/studio-classes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update studio class');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studioClasses"] });
    },
  });
}

export function useDeleteStudioClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/studio-classes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete studio class');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studioClasses"] });
    },
  });
}

// Practice Bookings
export function usePracticeBookings() {
  return useQuery({
    queryKey: ["practiceBookings"],
    queryFn: async () => {
      const res = await fetch('/api/practice-bookings');
      if (!res.ok) throw new Error('Failed to fetch practice bookings');
      return res.json();
    }
  });
}

export function useCreatePracticeBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPracticeBooking) => {
      const res = await fetch('/api/practice-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create practice booking');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practiceBookings"] });
    },
  });
}

export function useUpdatePracticeBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertPracticeBooking> }) => {
      const res = await fetch(`/api/practice-bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update practice booking');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practiceBookings"] });
    },
  });
}

export function useDeletePracticeBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/practice-bookings/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete practice booking');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practiceBookings"] });
    },
  });
}

// Announcements
export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const res = await fetch('/api/announcements');
      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json();
    }
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAnnouncement) => {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create announcement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertAnnouncement> }) => {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update announcement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete announcement');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

// Fees - MOCK DATA
export function useFees(dancerId?: string) {
  return useQuery({
    queryKey: ["fees", dancerId],
    queryFn: async () => {
      const fees = mockStudioFees.map(f => ({
        id: f.id,
        dancerId: f.dancerId,
        type: 'Tuition' as const,
        amount: f.monthlyTuition.toString(),
        dueDate: new Date().toISOString(),
        status: f.status,
        description: 'Monthly Tuition',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      if (dancerId) {
        return fees.filter(f => f.dancerId === dancerId);
      }
      return fees;
    }
  });
}

export function useCreateFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFee) => {
      const res = await fetch('/api/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create fee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
  });
}

export function useUpdateFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertFee> }) => {
      const res = await fetch(`/api/fees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update fee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
  });
}

export function useDeleteFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/fees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete fee');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
  });
}

// ========== STUDIO SETTINGS ==========
export function useStudioSettings() {
  return useQuery<StudioSettings[]>({
    queryKey: ["/api/studio-settings"],
    queryFn: async () => {
      const res = await fetch('/api/studio-settings');
      if (!res.ok) throw new Error('Failed to fetch studio settings');
      return res.json();
    }
  });
}

export function useCreateStudioSettings() {
  const queryClient = useQueryClient();
  return useMutation<StudioSettings, Error, InsertStudioSettings>({
    mutationFn: async (data) => {
      const res = await fetch("/api/studio-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio-settings"] });
    },
  });
}

export function useUpdateStudioSettings() {
  const queryClient = useQueryClient();
  return useMutation<StudioSettings, Error, { id: string; data: Partial<InsertStudioSettings> }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/studio-settings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio-settings"] });
    },
  });
}

// ========== POLICIES ==========
export function usePolicies() {
  return useQuery<Policy[]>({
    queryKey: ["/api/policies"],
    queryFn: async () => {
      const res = await fetch('/api/policies');
      if (!res.ok) throw new Error('Failed to fetch policies');
      return res.json();
    }
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation<Policy, Error, InsertPolicy>({
    mutationFn: async (data) => {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
    },
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  return useMutation<Policy, Error, { id: string; data: Partial<InsertPolicy> }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/policies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
    },
  });
}

// ========== POLICY AGREEMENTS ==========
export function usePolicyAgreements() {
  return useQuery<PolicyAgreement[]>({
    queryKey: ["/api/policy-agreements"],
    queryFn: async () => {
      const res = await fetch('/api/policy-agreements');
      if (!res.ok) throw new Error('Failed to fetch policy agreements');
      return res.json();
    }
  });
}

export function useCreatePolicyAgreement() {
  const queryClient = useQueryClient();
  return useMutation<PolicyAgreement, Error, InsertPolicyAgreement>({
    mutationFn: async (data) => {
      const res = await fetch("/api/policy-agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-agreements"] });
    },
  });
}

// ========== RECITALS ==========
export function useRecitals() {
  return useQuery<Recital[]>({
    queryKey: ["/api/recitals"],
    queryFn: async () => {
      const res = await fetch('/api/recitals');
      if (!res.ok) throw new Error('Failed to fetch recitals');
      return res.json();
    }
  });
}

export function useCreateRecital() {
  const queryClient = useQueryClient();
  return useMutation<Recital, Error, InsertRecital>({
    mutationFn: async (data) => {
      const res = await fetch("/api/recitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recitals"] });
    },
  });
}

export function useUpdateRecital() {
  const queryClient = useQueryClient();
  return useMutation<Recital, Error, { id: string; data: Partial<InsertRecital> }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/recitals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recitals"] });
    },
  });
}

// ========== RECITAL LINEUP ==========
export function useRecitalLineup() {
  return useQuery<RecitalLineup[]>({
    queryKey: ["/api/recital-lineup"],
    queryFn: async () => {
      const res = await fetch('/api/recital-lineup');
      if (!res.ok) throw new Error('Failed to fetch recital lineup');
      return res.json();
    }
  });
}

export function useCreateRecitalLineup() {
  const queryClient = useQueryClient();
  return useMutation<RecitalLineup, Error, InsertRecitalLineup>({
    mutationFn: async (data) => {
      const res = await fetch("/api/recital-lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recital-lineup"] });
    },
  });
}

export function useUpdateRecitalLineup() {
  const queryClient = useQueryClient();
  return useMutation<RecitalLineup, Error, { id: string; data: Partial<InsertRecitalLineup> }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/recital-lineup/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recital-lineup"] });
    },
  });
}
