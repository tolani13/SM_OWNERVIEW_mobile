import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import {
  dancers,
  teachers,
  routines,
  competitions,
  competitionRegistrations,
  competitionRunSheets,
  runSlots,
  conventionClasses,
  studioClasses,
  practiceBookings,
  announcements,
  fees,
  type Dancer,
  type InsertDancer,
  type Teacher,
  type InsertTeacher,
  type Routine,
  type InsertRoutine,
  type Competition,
  type InsertCompetition,
  type CompetitionRegistration,
  type InsertCompetitionRegistration,
  type CompetitionRunSheet,
  type InsertCompetitionRunSheet,
  type RunSlot,
  type InsertRunSlot,
  type ConventionClass,
  type InsertConventionClass,
  type StudioClass,
  type InsertStudioClass,
  type PracticeBooking,
  type InsertPracticeBooking,
  type Announcement,
  type InsertAnnouncement,
  type Fee,
  type InsertFee,
} from "./schema";

export class Storage {
  private db;

  constructor(databaseUrl: string) {
    const client = postgres(databaseUrl);
    this.db = drizzle(client);
  }

  // ========== DANCERS ==========
  async getDancers(): Promise<Dancer[]> {
    return await this.db.select().from(dancers);
  }

  async getDancer(id: string): Promise<Dancer | undefined> {
    const [dancer] = await this.db.select().from(dancers).where(eq(dancers.id, id));
    return dancer;
  }

  async createDancer(data: InsertDancer): Promise<Dancer> {
    const [dancer] = await this.db.insert(dancers).values(data).returning();
    return dancer;
  }

  async updateDancer(id: string, data: Partial<InsertDancer>): Promise<Dancer | undefined> {
    const [dancer] = await this.db.update(dancers).set(data).where(eq(dancers.id, id)).returning();
    return dancer;
  }

  async deleteDancer(id: string): Promise<void> {
    await this.db.delete(dancers).where(eq(dancers.id, id));
  }

  // ========== TEACHERS ==========
  async getTeachers(): Promise<Teacher[]> {
    return await this.db.select().from(teachers);
  }

  async getTeacher(id: string): Promise<Teacher | undefined> {
    const [teacher] = await this.db.select().from(teachers).where(eq(teachers.id, id));
    return teacher;
  }

  async createTeacher(data: InsertTeacher): Promise<Teacher> {
    const [teacher] = await this.db.insert(teachers).values(data).returning();
    return teacher;
  }

  async updateTeacher(id: string, data: Partial<InsertTeacher>): Promise<Teacher | undefined> {
    const [teacher] = await this.db.update(teachers).set(data).where(eq(teachers.id, id)).returning();
    return teacher;
  }

  async deleteTeacher(id: string): Promise<void> {
    await this.db.delete(teachers).where(eq(teachers.id, id));
  }

  // ========== ROUTINES ==========
  async getRoutines(): Promise<Routine[]> {
    return await this.db.select().from(routines);
  }

  async getRoutine(id: string): Promise<Routine | undefined> {
    const [routine] = await this.db.select().from(routines).where(eq(routines.id, id));
    return routine;
  }

  async createRoutine(data: InsertRoutine): Promise<Routine> {
    const [routine] = await this.db.insert(routines).values(data).returning();
    return routine;
  }

  async updateRoutine(id: string, data: Partial<InsertRoutine>): Promise<Routine | undefined> {
    const [routine] = await this.db.update(routines).set(data).where(eq(routines.id, id)).returning();
    return routine;
  }

  async deleteRoutine(id: string): Promise<void> {
    await this.db.delete(routines).where(eq(routines.id, id));
  }

  // ========== COMPETITIONS ==========
  async getCompetitions(): Promise<Competition[]> {
    return await this.db.select().from(competitions);
  }

  async getCompetition(id: string): Promise<Competition | undefined> {
    const [competition] = await this.db.select().from(competitions).where(eq(competitions.id, id));
    return competition;
  }

  async createCompetition(data: InsertCompetition): Promise<Competition> {
    const [competition] = await this.db.insert(competitions).values(data).returning();
    return competition;
  }

  async updateCompetition(id: string, data: Partial<InsertCompetition>): Promise<Competition | undefined> {
    const [competition] = await this.db.update(competitions).set(data).where(eq(competitions.id, id)).returning();
    return competition;
  }

  async deleteCompetition(id: string): Promise<void> {
    await this.db.delete(competitions).where(eq(competitions.id, id));
  }

  // ========== COMPETITION REGISTRATIONS ==========
  async getCompetitionRegistrations(competitionId?: string): Promise<CompetitionRegistration[]> {
    if (competitionId) {
      return await this.db.select().from(competitionRegistrations).where(eq(competitionRegistrations.competitionId, competitionId));
    }
    return await this.db.select().from(competitionRegistrations);
  }

  async createCompetitionRegistration(data: InsertCompetitionRegistration): Promise<CompetitionRegistration> {
    const [registration] = await this.db.insert(competitionRegistrations).values(data).returning();
    return registration;
  }

  async getCompetitionRegistrationByKeys(
    competitionId: string,
    dancerId: string,
    routineId: string,
  ): Promise<CompetitionRegistration | undefined> {
    const [registration] = await this.db
      .select()
      .from(competitionRegistrations)
      .where(
        and(
          eq(competitionRegistrations.competitionId, competitionId),
          eq(competitionRegistrations.dancerId, dancerId),
          eq(competitionRegistrations.routineId, routineId),
        ),
      );
    return registration;
  }

  async deleteCompetitionRegistration(id: string): Promise<void> {
    await this.db.delete(competitionRegistrations).where(eq(competitionRegistrations.id, id));
  }

  async deleteCompetitionRegistrationsByDancer(competitionId: string, dancerId: string): Promise<void> {
    await this.db.delete(competitionRegistrations)
      .where(
        and(
          eq(competitionRegistrations.competitionId, competitionId),
          eq(competitionRegistrations.dancerId, dancerId)
        )
      );
  }

  // ========== STUDIO CLASSES ==========
  async getStudioClasses(): Promise<StudioClass[]> {
    return await this.db.select().from(studioClasses);
  }

  async createStudioClass(data: InsertStudioClass): Promise<StudioClass> {
    const [cls] = await this.db.insert(studioClasses).values(data).returning();
    return cls;
  }

  async updateStudioClass(id: string, data: Partial<InsertStudioClass>): Promise<StudioClass | undefined> {
    const [cls] = await this.db.update(studioClasses).set(data).where(eq(studioClasses.id, id)).returning();
    return cls;
  }

  async deleteStudioClass(id: string): Promise<void> {
    await this.db.delete(studioClasses).where(eq(studioClasses.id, id));
  }

  // ========== PRACTICE BOOKINGS ==========
  async getPracticeBookings(): Promise<PracticeBooking[]> {
    return await this.db.select().from(practiceBookings);
  }

  async createPracticeBooking(data: InsertPracticeBooking): Promise<PracticeBooking> {
    const [booking] = await this.db.insert(practiceBookings).values(data).returning();
    return booking;
  }

  async updatePracticeBooking(id: string, data: Partial<InsertPracticeBooking>): Promise<PracticeBooking | undefined> {
    const [booking] = await this.db.update(practiceBookings).set(data).where(eq(practiceBookings.id, id)).returning();
    return booking;
  }

  async deletePracticeBooking(id: string): Promise<void> {
    await this.db.delete(practiceBookings).where(eq(practiceBookings.id, id));
  }

  // ========== ANNOUNCEMENTS ==========
  async getAnnouncements(): Promise<Announcement[]> {
    return await this.db.select().from(announcements);
  }

  async createAnnouncement(data: InsertAnnouncement): Promise<Announcement> {
    const [announcement] = await this.db.insert(announcements).values(data).returning();
    return announcement;
  }

  async updateAnnouncement(id: string, data: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const [announcement] = await this.db.update(announcements).set(data).where(eq(announcements.id, id)).returning();
    return announcement;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await this.db.delete(announcements).where(eq(announcements.id, id));
  }

  // ========== FEES ==========
  async getFees(dancerId?: string): Promise<Fee[]> {
    if (dancerId) {
      return await this.db.select().from(fees).where(eq(fees.dancerId, dancerId));
    }
    return await this.db.select().from(fees);
  }

  async createFee(data: InsertFee): Promise<Fee> {
    const [fee] = await this.db.insert(fees).values(data).returning();
    return fee;
  }

  async updateFee(id: string, data: Partial<InsertFee>): Promise<Fee | undefined> {
    const [fee] = await this.db.update(fees).set(data).where(eq(fees.id, id)).returning();
    return fee;
  }

  async deleteFee(id: string): Promise<void> {
    await this.db.delete(fees).where(eq(fees.id, id));
  }

  async deleteCompetitionFees(competitionId: string): Promise<void> {
    await this.db
      .delete(fees)
      .where(
        and(
          eq(fees.competitionId, competitionId),
          eq(fees.type, "Competition"),
        ),
      );
  }

  // ========== RUN SLOTS (PDF PARSED) ==========
  async getRunSlots(competitionId?: string): Promise<RunSlot[]> {
    if (competitionId) {
      return await this.db.select().from(runSlots).where(eq(runSlots.competitionId, competitionId));
    }
    return await this.db.select().from(runSlots);
  }

  async createRunSlot(data: InsertRunSlot): Promise<RunSlot> {
    const [slot] = await this.db.insert(runSlots).values(data).returning();
    return slot;
  }

  async createRunSlotsBulk(data: InsertRunSlot[]): Promise<RunSlot[]> {
    if (data.length === 0) return [];
    return await this.db.insert(runSlots).values(data).returning();
  }

  async updateRunSlot(id: string, data: Partial<InsertRunSlot>): Promise<RunSlot | undefined> {
    const [slot] = await this.db.update(runSlots).set(data).where(eq(runSlots.id, id)).returning();
    return slot;
  }

  async deleteRunSlot(id: string): Promise<void> {
    await this.db.delete(runSlots).where(eq(runSlots.id, id));
  }

  async deleteRunSlotsByCompetition(competitionId: string): Promise<void> {
    await this.db.delete(runSlots).where(eq(runSlots.competitionId, competitionId));
  }

  // ========== CONVENTION CLASSES (PDF PARSED) ==========
  async getConventionClasses(competitionId?: string): Promise<ConventionClass[]> {
    if (competitionId) {
      return await this.db.select().from(conventionClasses).where(eq(conventionClasses.competitionId, competitionId));
    }
    return await this.db.select().from(conventionClasses);
  }

  async createConventionClass(data: InsertConventionClass): Promise<ConventionClass> {
    const [cls] = await this.db.insert(conventionClasses).values(data).returning();
    return cls;
  }

  async createConventionClassesBulk(data: InsertConventionClass[]): Promise<ConventionClass[]> {
    if (data.length === 0) return [];
    return await this.db.insert(conventionClasses).values(data).returning();
  }

  async updateConventionClass(id: string, data: Partial<InsertConventionClass>): Promise<ConventionClass | undefined> {
    const [cls] = await this.db.update(conventionClasses).set(data).where(eq(conventionClasses.id, id)).returning();
    return cls;
  }

  async deleteConventionClass(id: string): Promise<void> {
    await this.db.delete(conventionClasses).where(eq(conventionClasses.id, id));
  }

  async deleteConventionClassesByCompetition(competitionId: string): Promise<void> {
    await this.db.delete(conventionClasses).where(eq(conventionClasses.competitionId, competitionId));
  }

  // ========== COMPETITION RUN SHEETS ==========
  async getCompetitionRunSheets(competitionId: string): Promise<CompetitionRunSheet[]> {
    return await this.db.select().from(competitionRunSheets).where(eq(competitionRunSheets.competitionId, competitionId));
  }

  async getCompetitionRunSheet(id: string): Promise<CompetitionRunSheet | undefined> {
    const [sheet] = await this.db.select().from(competitionRunSheets).where(eq(competitionRunSheets.id, id));
    return sheet;
  }

  async createCompetitionRunSheet(data: InsertCompetitionRunSheet): Promise<CompetitionRunSheet> {
    const [sheet] = await this.db.insert(competitionRunSheets).values(data).returning();
    return sheet;
  }

  async createCompetitionRunSheetsBulk(data: InsertCompetitionRunSheet[]): Promise<CompetitionRunSheet[]> {
    if (data.length === 0) return [];
    return await this.db.insert(competitionRunSheets).values(data).returning();
  }

  async updateCompetitionRunSheet(id: string, data: Partial<InsertCompetitionRunSheet>): Promise<CompetitionRunSheet | undefined> {
    const [sheet] = await this.db.update(competitionRunSheets).set(data).where(eq(competitionRunSheets.id, id)).returning();
    return sheet;
  }

  async deleteCompetitionRunSheet(id: string): Promise<void> {
    await this.db.delete(competitionRunSheets).where(eq(competitionRunSheets.id, id));
  }

  async deleteCompetitionRunSheetsByCompetition(competitionId: string): Promise<void> {
    await this.db.delete(competitionRunSheets).where(eq(competitionRunSheets.competitionId, competitionId));
  }
}

export const storage = new Storage(process.env.DATABASE_URL!);
