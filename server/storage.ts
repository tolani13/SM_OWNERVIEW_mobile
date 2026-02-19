import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
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
  messages,
  chatThreads,
  chatThreadParticipants,
  chatMessages,
  chatMessageReads,
  fees,
  events,
  eventFees,
  transactions,
  feeTypes,
  policies,
  policyAgreements,
  type FeeType,
  type DancerLevel,
  type Event,
  type InsertEvent,
  type EventFee,
  type InsertEventFee,
  type EventFeeStatus,
  type Transaction,
  type InsertTransaction,
  type TransactionType,
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
  type Message,
  type InsertMessage,
  type ChatThread,
  type InsertChatThread,
  type ChatThreadParticipant,
  type InsertChatThreadParticipant,
  type ChatMessage,
  type InsertChatMessage,
  type ChatMessageRead,
  type InsertChatMessageRead,
  type Fee,
  type InsertFee,
  type Policy,
  type InsertPolicy,
  type PolicyAgreement,
  type InsertPolicyAgreement,
} from "./schema";

type MoneyString = string;

type EventFeeWithEventId = {
  id: string;
  eventId: string;
};

type EventWithIdName = {
  id: string;
  name: string;
};

const LEVEL_SORT_ORDER: Record<DancerLevel, number> = {
  mini: 1,
  junior: 2,
  teen: 3,
  senior: 4,
  elite: 5,
};

const EVENT_FEE_TO_PAYMENT_STATUS: Record<EventFeeStatus, "paid" | "unpaid" | "partial"> = {
  unbilled: "unpaid",
  billed: "unpaid",
  paid: "paid",
  partial: "partial",
};

const EVENT_TYPE_TO_FEE_TYPE: Record<string, FeeType> = {
  competition: "competition",
  nationals: "competition",
  recital: "recital",
  other: "other",
};

function parseMoney(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIsoDate(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();

  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

function toSqlDate(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function computeAgeFromBirthdate(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const parsed = new Date(birthdate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age;
}

function normalizeLegacyFeeType(value: string | null | undefined, fallbackType?: string | null): FeeType {
  const direct = (value || "").trim().toLowerCase();
  if (direct === "tuition" || direct === "costume" || direct === "competition" || direct === "recital" || direct === "other") {
    return direct;
  }

  const fallback = (fallbackType || "").trim().toLowerCase();
  if (fallback.includes("tuition")) return "tuition";
  if (fallback.includes("costume")) return "costume";
  if (fallback.includes("competition")) return "competition";
  if (fallback.includes("recital")) return "recital";
  return "other";
}

export type FinanceDancersQuery = {
  sortBy?: "lastName" | "age" | "level" | "balance";
  sortDir?: "asc" | "desc";
  levels?: DancerLevel[];
  isCompetitionDancer?: boolean;
  eventId?: string;
  eventPaymentStatus?: "paid" | "unpaid" | "partial";
};

export type FinanceDancerListRow = {
  id: string;
  firstName: string;
  lastName: string;
  level: DancerLevel;
  birthdate: string;
  age: number | null;
  isCompetitionDancer: boolean;
  currentBalance: number;
  eventStatuses: Record<string, "paid" | "unpaid" | "partial">;
};

export type FinanceLedgerEntry = {
  id: string;
  date: string;
  type: TransactionType;
  feeType: FeeType;
  amount: number;
  description: string | null;
  runningBalance: number;
  eventFeeId: string | null;
  eventId: string | null;
  eventName: string | null;
};

export type FinanceLedgerResponse = {
  dancerId: string;
  dancerName: string;
  currentBalance: number;
  lastPaymentDate: string | null;
  entries: FinanceLedgerEntry[];
};

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

  async countStudioClassesByTeacherId(teacherId: string): Promise<number> {
    const classes = await this.db
      .select({ id: studioClasses.id })
      .from(studioClasses)
      .where(eq(studioClasses.teacherId, teacherId));
    return classes.length;
  }

  async detachTeacherFromStudioClasses(teacherId: string): Promise<void> {
    await this.db
      .update(studioClasses)
      .set({ teacherId: null, teacherName: "Unassigned" })
      .where(eq(studioClasses.teacherId, teacherId));
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

  async getStudioClass(id: string): Promise<StudioClass | undefined> {
    const [cls] = await this.db.select().from(studioClasses).where(eq(studioClasses.id, id));
    return cls;
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

  // ========== POLICIES ==========
  async getPolicies(): Promise<Policy[]> {
    return await this.db.select().from(policies);
  }

  async getPolicy(id: string): Promise<Policy | undefined> {
    const [policy] = await this.db.select().from(policies).where(eq(policies.id, id));
    return policy;
  }

  async createPolicy(data: InsertPolicy): Promise<Policy> {
    const [policy] = await this.db.insert(policies).values(data).returning();
    return policy;
  }

  async updatePolicy(id: string, data: Partial<InsertPolicy>): Promise<Policy | undefined> {
    const [policy] = await this.db.update(policies).set(data).where(eq(policies.id, id)).returning();
    return policy;
  }

  // ========== POLICY AGREEMENTS ==========
  async getPolicyAgreements(): Promise<PolicyAgreement[]> {
    return await this.db.select().from(policyAgreements);
  }

  async createPolicyAgreement(data: InsertPolicyAgreement): Promise<PolicyAgreement> {
    const [agreement] = await this.db.insert(policyAgreements).values(data).returning();
    return agreement;
  }

  // ========== MESSAGES ==========
  async getMessages(): Promise<Message[]> {
    return await this.db.select().from(messages);
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [message] = await this.db.insert(messages).values(data).returning();
    return message;
  }

  async updateMessage(id: string, data: Partial<InsertMessage>): Promise<Message | undefined> {
    const [message] = await this.db.update(messages).set(data).where(eq(messages.id, id)).returning();
    return message;
  }

  async deleteMessage(id: string): Promise<void> {
    await this.db.delete(messages).where(eq(messages.id, id));
  }

  // ========== CHAT THREADS ==========
  async getChatThreads(): Promise<ChatThread[]> {
    return await this.db.select().from(chatThreads).where(eq(chatThreads.active, true)).orderBy(asc(chatThreads.createdAt));
  }

  async getChatThread(id: string): Promise<ChatThread | undefined> {
    const [thread] = await this.db.select().from(chatThreads).where(eq(chatThreads.id, id));
    return thread;
  }

  async createChatThread(data: InsertChatThread): Promise<ChatThread> {
    const [thread] = await this.db.insert(chatThreads).values(data).returning();
    return thread;
  }

  async updateChatThread(id: string, data: Partial<InsertChatThread>): Promise<ChatThread | undefined> {
    const [thread] = await this.db
      .update(chatThreads)
      .set({ ...data, updatedAt: new Date() as any })
      .where(eq(chatThreads.id, id))
      .returning();
    return thread;
  }

  async getChatThreadParticipants(threadId: string): Promise<ChatThreadParticipant[]> {
    return await this.db
      .select()
      .from(chatThreadParticipants)
      .where(eq(chatThreadParticipants.threadId, threadId));
  }

  async getChatThreadParticipant(threadId: string, participantId: string): Promise<ChatThreadParticipant | undefined> {
    const [participant] = await this.db
      .select()
      .from(chatThreadParticipants)
      .where(
        and(
          eq(chatThreadParticipants.threadId, threadId),
          eq(chatThreadParticipants.participantId, participantId),
        ),
      );
    return participant;
  }

  async addChatThreadParticipant(data: InsertChatThreadParticipant): Promise<ChatThreadParticipant> {
    const [participant] = await this.db.insert(chatThreadParticipants).values(data).returning();
    return participant;
  }

  async getChatMessages(threadId: string): Promise<ChatMessage[]> {
    return await this.db.select().from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(asc(chatMessages.createdAt));
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await this.db.insert(chatMessages).values(data).returning();
    return message;
  }

  async getChatMessageReads(messageId: string): Promise<ChatMessageRead[]> {
    return await this.db.select().from(chatMessageReads).where(eq(chatMessageReads.messageId, messageId));
  }

  async getChatMessageRead(messageId: string, readerId: string): Promise<ChatMessageRead | undefined> {
    const [read] = await this.db
      .select()
      .from(chatMessageReads)
      .where(and(eq(chatMessageReads.messageId, messageId), eq(chatMessageReads.readerId, readerId)));
    return read;
  }

  async markChatMessageRead(data: InsertChatMessageRead): Promise<ChatMessageRead> {
    const existing = await this.getChatMessageRead(data.messageId, data.readerId);
    if (existing) return existing;
    const [read] = await this.db.insert(chatMessageReads).values(data).returning();
    return read;
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
    await this.upsertLegacyFeeTransactions(fee);
    return fee;
  }

  async updateFee(id: string, data: Partial<InsertFee>): Promise<Fee | undefined> {
    const [fee] = await this.db.update(fees).set(data).where(eq(fees.id, id)).returning();
    if (fee) {
      await this.upsertLegacyFeeTransactions(fee);
    }
    return fee;
  }

  async deleteFee(id: string): Promise<void> {
    await this.db.delete(fees).where(eq(fees.id, id));
    await this.db.delete(transactions).where(eq(transactions.legacyFeeId, id));
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

  // ========== FINANCE HUB ==========
  async getFeeTypeDefaults(feeType: FeeType) {
    const [row] = await this.db.select().from(feeTypes).where(eq(feeTypes.feeType, feeType));
    return row;
  }

  async getEvents(seasonYear?: number): Promise<Event[]> {
    if (typeof seasonYear === "number") {
      return await this.db
        .select()
        .from(events)
        .where(eq(events.seasonYear, seasonYear))
        .orderBy(asc(events.dueDate), asc(events.name));
    }

    return await this.db.select().from(events).orderBy(asc(events.dueDate), asc(events.name));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await this.db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(data: InsertEvent): Promise<Event> {
    const [event] = await this.db
      .insert(events)
      .values({ ...data, updatedAt: new Date() as any })
      .returning();
    return event;
  }

  async updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await this.db
      .update(events)
      .set({ ...data, updatedAt: new Date() as any })
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async getEventFee(id: string): Promise<EventFee | undefined> {
    const [eventFee] = await this.db.select().from(eventFees).where(eq(eventFees.id, id));
    return eventFee;
  }

  async getEventFeesByDancer(dancerId: string): Promise<EventFee[]> {
    return await this.db.select().from(eventFees).where(eq(eventFees.dancerId, dancerId));
  }

  async updateEventFee(id: string, data: Partial<InsertEventFee>): Promise<EventFee | undefined> {
    const [updated] = await this.db
      .update(eventFees)
      .set({ ...data, updatedAt: new Date() as any })
      .where(eq(eventFees.id, id))
      .returning();
    return updated;
  }

  async getTransactions(dancerId?: string): Promise<Transaction[]> {
    if (dancerId) {
      return await this.db
        .select()
        .from(transactions)
        .where(eq(transactions.dancerId, dancerId))
        .orderBy(asc(transactions.date), asc(transactions.createdAt));
    }

    return await this.db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.createdAt));
  }

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [transaction] = await this.db
      .insert(transactions)
      .values({
        ...data,
        date: toSqlDate((data as any).date) as any,
        updatedAt: new Date() as any,
      })
      .returning();
    return transaction;
  }

  async upsertLegacyFeeTransactions(fee: Fee): Promise<void> {
    const normalizedFeeType = normalizeLegacyFeeType((fee as any).feeType, fee.type);
    const amount = Number(parseMoney(fee.amount).toFixed(2));
    const txDate = toIsoDate(fee.dueDate);
    const defaults = await this.getFeeTypeDefaults(normalizedFeeType);

    const [existingCharge] = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.legacyFeeId, fee.id), eq(transactions.type, "charge")));

    const chargePayload: Partial<InsertTransaction> = {
      dancerId: fee.dancerId,
      date: toSqlDate(txDate) as any,
      type: "charge",
      feeType: normalizedFeeType,
      amount: amount.toFixed(2),
      description: fee.type,
      syncStatus: "pending",
      legacyFeeId: fee.id,
      quickbooksItemId: defaults?.defaultQuickbooksItemId ?? null,
      quickbooksAccountId: defaults?.defaultQuickbooksAccountId ?? null,
      waveIncomeAccountId: defaults?.defaultWaveIncomeAccountId ?? null,
      updatedAt: new Date() as any,
    };

    if (existingCharge) {
      await this.db.update(transactions).set(chargePayload).where(eq(transactions.id, existingCharge.id));
    } else {
      await this.db.insert(transactions).values(chargePayload as InsertTransaction);
    }

    if (fee.paid) {
      const [existingPayment] = await this.db
        .select()
        .from(transactions)
        .where(and(eq(transactions.legacyFeeId, fee.id), eq(transactions.type, "payment")));

      const paymentPayload: Partial<InsertTransaction> = {
        dancerId: fee.dancerId,
        date: toSqlDate(txDate) as any,
        type: "payment",
        feeType: normalizedFeeType,
        amount: amount.toFixed(2),
        description: `Payment for ${fee.type}`,
        syncStatus: "pending",
        legacyFeeId: fee.id,
        quickbooksItemId: defaults?.defaultQuickbooksItemId ?? null,
        quickbooksAccountId: defaults?.defaultQuickbooksAccountId ?? null,
        waveIncomeAccountId: defaults?.defaultWaveIncomeAccountId ?? null,
        updatedAt: new Date() as any,
      };

      if (existingPayment) {
        await this.db.update(transactions).set(paymentPayload).where(eq(transactions.id, existingPayment.id));
      } else {
        await this.db.insert(transactions).values(paymentPayload as InsertTransaction);
      }
    } else {
      await this.db
        .delete(transactions)
        .where(and(eq(transactions.legacyFeeId, fee.id), eq(transactions.type, "payment")));
    }
  }

  async getFinanceDancers(query: FinanceDancersQuery): Promise<FinanceDancerListRow[]> {
    const [allDancers, allTransactions, allEventFees] = await Promise.all([
      this.getDancers(),
      this.getTransactions(),
      this.db.select().from(eventFees),
    ]);

    const balances = new Map<string, number>();
    for (const transaction of allTransactions) {
      const amount = parseMoney(transaction.amount);
      const delta = transaction.type === "charge" ? amount : -amount;
      balances.set(
        transaction.dancerId,
        Number(((balances.get(transaction.dancerId) ?? 0) + delta).toFixed(2)),
      );
    }

    const eventStatusesByDancer = new Map<string, Record<string, "paid" | "unpaid" | "partial">>();
    for (const eventFee of allEventFees) {
      const byEvent = eventStatusesByDancer.get(eventFee.dancerId) ?? {};
      byEvent[eventFee.eventId] = EVENT_FEE_TO_PAYMENT_STATUS[eventFee.status as EventFeeStatus] ?? "unpaid";
      eventStatusesByDancer.set(eventFee.dancerId, byEvent);
    }

    let rows: FinanceDancerListRow[] = allDancers.map((dancer) => {
      const level = ((dancer.level || "mini").toLowerCase() as DancerLevel) || "mini";
      const birthdate = (dancer.birthdate || dancer.dateOfBirth || "2015-01-01") as string;
      const age = computeAgeFromBirthdate(birthdate) ?? dancer.age ?? null;

      return {
        id: dancer.id,
        firstName: dancer.firstName,
        lastName: dancer.lastName,
        level,
        birthdate,
        age,
        isCompetitionDancer: Boolean((dancer as any).isCompetitionDancer),
        currentBalance: Number((balances.get(dancer.id) ?? 0).toFixed(2)),
        eventStatuses: eventStatusesByDancer.get(dancer.id) ?? {},
      };
    });

    if (query.levels?.length) {
      const allowed = new Set(query.levels);
      rows = rows.filter((row) => allowed.has(row.level));
    }

    if (typeof query.isCompetitionDancer === "boolean") {
      rows = rows.filter((row) => row.isCompetitionDancer === query.isCompetitionDancer);
    }

    if (query.eventId) {
      if (query.eventPaymentStatus) {
        rows = rows.filter((row) => {
          const status = row.eventStatuses[query.eventId!] ?? "unpaid";
          return status === query.eventPaymentStatus;
        });
      }
    }

    const sortBy = query.sortBy ?? "lastName";
    const sortDir = query.sortDir ?? "asc";

    rows.sort((a, b) => {
      let value = 0;

      if (sortBy === "balance") {
        value = a.currentBalance - b.currentBalance;
      } else if (sortBy === "age") {
        value = (a.age ?? 0) - (b.age ?? 0);
      } else if (sortBy === "level") {
        value = LEVEL_SORT_ORDER[a.level] - LEVEL_SORT_ORDER[b.level];
      } else {
        value = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" });
      }

      if (value === 0) {
        value = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" });
      }

      return sortDir === "desc" ? -value : value;
    });

    return rows;
  }

  async getDancerFinanceLedger(dancerId: string): Promise<FinanceLedgerResponse | undefined> {
    const dancer = await this.getDancer(dancerId);
    if (!dancer) return undefined;

    const txRows = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.dancerId, dancerId))
      .orderBy(asc(transactions.date), asc(transactions.createdAt));

    const eventFeeIds = Array.from(new Set(txRows.map((tx) => tx.eventFeeId).filter(Boolean) as string[]));
    const relatedEventFees: EventFeeWithEventId[] = eventFeeIds.length
      ? (await this.db
          .select({ id: eventFees.id, eventId: eventFees.eventId })
          .from(eventFees)
          .where(inArray(eventFees.id, eventFeeIds as string[])))
      : [];
    const relatedEventIds = Array.from(new Set(relatedEventFees.map((ef) => ef.eventId)));
    const relatedEvents: EventWithIdName[] = relatedEventIds.length
      ? (await this.db
          .select({ id: events.id, name: events.name })
          .from(events)
          .where(inArray(events.id, relatedEventIds as string[])))
      : [];

    const eventFeeById = new Map<string, EventFeeWithEventId>(relatedEventFees.map((ef) => [ef.id, ef]));
    const eventById = new Map<string, EventWithIdName>(relatedEvents.map((event) => [event.id, event]));

    let runningBalance = 0;
    const entries: FinanceLedgerEntry[] = txRows.map((tx) => {
      const amount = Number(parseMoney(tx.amount).toFixed(2));
      runningBalance += tx.type === "charge" ? amount : -amount;

      const linkedEventFee = tx.eventFeeId ? eventFeeById.get(tx.eventFeeId) : undefined;
      const linkedEvent = linkedEventFee ? eventById.get(linkedEventFee.eventId) : undefined;

      return {
        id: tx.id,
        date: toIsoDate(tx.date as any),
        type: tx.type,
        feeType: tx.feeType,
        amount,
        description: tx.description ?? null,
        runningBalance: Number(runningBalance.toFixed(2)),
        eventFeeId: tx.eventFeeId ?? null,
        eventId: linkedEvent?.id ?? null,
        eventName: linkedEvent?.name ?? null,
      };
    });

    const lastPayment = [...entries].reverse().find((entry) => entry.type === "payment");

    return {
      dancerId,
      dancerName: `${dancer.firstName} ${dancer.lastName}`,
      currentBalance: entries.length ? entries[entries.length - 1].runningBalance : 0,
      lastPaymentDate: lastPayment?.date ?? null,
      entries,
    };
  }

  async createEventFeeWithCharge(input: {
    dancerId: string;
    eventId: string;
    amount: number;
    description?: string;
  }): Promise<{ eventFee: EventFee; chargeTransaction: Transaction }> {
    const event = await this.getEvent(input.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const amount = Number(Math.max(0, parseMoney(input.amount)).toFixed(2));
    const initialStatus: EventFeeStatus = amount <= 0 ? "unbilled" : "billed";

    const [existingEventFee] = await this.db
      .select()
      .from(eventFees)
      .where(and(eq(eventFees.dancerId, input.dancerId), eq(eventFees.eventId, input.eventId)));

    let eventFee: EventFee;
    if (existingEventFee) {
      const [updatedEventFee] = await this.db
        .update(eventFees)
        .set({
          amount: amount.toFixed(2) as MoneyString,
          balance: amount.toFixed(2),
          status: initialStatus,
          updatedAt: new Date() as any,
        })
        .where(eq(eventFees.id, existingEventFee.id))
        .returning();
      eventFee = updatedEventFee;
    } else {
      const [createdEventFee] = await this.db
        .insert(eventFees)
        .values({
          dancerId: input.dancerId,
          eventId: input.eventId,
          amount: amount.toFixed(2) as MoneyString,
          balance: amount.toFixed(2),
          status: initialStatus,
          updatedAt: new Date() as any,
        })
        .returning();
      eventFee = createdEventFee;
    }

    const mappedFeeType = EVENT_TYPE_TO_FEE_TYPE[event.type] ?? "other";
    const defaults = await this.getFeeTypeDefaults(mappedFeeType);

    const [existingCharge] = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.eventFeeId, eventFee.id), eq(transactions.type, "charge")));

    let chargeTransaction: Transaction;
    if (existingCharge) {
      const [updatedCharge] = await this.db
        .update(transactions)
        .set({
          dancerId: input.dancerId,
          date: toSqlDate(event.dueDate ?? new Date()) as any,
          feeType: mappedFeeType,
          amount: amount.toFixed(2) as MoneyString,
          description: input.description || `${event.name} charge`,
          quickbooksItemId: defaults?.defaultQuickbooksItemId ?? null,
          quickbooksAccountId: defaults?.defaultQuickbooksAccountId ?? null,
          waveIncomeAccountId: defaults?.defaultWaveIncomeAccountId ?? null,
          syncStatus: "pending",
          updatedAt: new Date() as any,
        })
        .where(eq(transactions.id, existingCharge.id))
        .returning();
      chargeTransaction = updatedCharge;
    } else {
      const [createdCharge] = await this.db
        .insert(transactions)
        .values({
          dancerId: input.dancerId,
          date: toSqlDate(event.dueDate ?? new Date()) as any,
          type: "charge",
          feeType: mappedFeeType,
          amount: amount.toFixed(2) as MoneyString,
          description: input.description || `${event.name} charge`,
          eventFeeId: eventFee.id,
          quickbooksItemId: defaults?.defaultQuickbooksItemId ?? null,
          quickbooksAccountId: defaults?.defaultQuickbooksAccountId ?? null,
          waveIncomeAccountId: defaults?.defaultWaveIncomeAccountId ?? null,
          syncStatus: "pending",
          updatedAt: new Date() as any,
        })
        .returning();
      chargeTransaction = createdCharge;
    }

    await this.recalculateEventFeeBalanceStatus(eventFee.id);

    return { eventFee, chargeTransaction };
  }

  async createFinancePayment(input: {
    dancerId: string;
    amount: number;
    date?: string;
    feeType?: FeeType;
    description?: string;
    eventFeeId?: string;
  }): Promise<Transaction> {
    let dancerId = input.dancerId;
    let feeType: FeeType = input.feeType ?? "other";
    let eventFeeId: string | null = input.eventFeeId ?? null;

    if (eventFeeId) {
      const eventFee = await this.getEventFee(eventFeeId);
      if (!eventFee) {
        throw new Error("Event fee not found");
      }
      dancerId = eventFee.dancerId;

      const event = await this.getEvent(eventFee.eventId);
      if (event) {
        feeType = EVENT_TYPE_TO_FEE_TYPE[event.type] ?? "other";
      }
    }

    const defaults = await this.getFeeTypeDefaults(feeType);
    const amount = Number(Math.max(0, parseMoney(input.amount)).toFixed(2));

    const [payment] = await this.db
      .insert(transactions)
      .values({
        dancerId,
        date: toSqlDate(input.date ?? new Date()) as any,
        type: "payment",
        feeType,
        amount: amount.toFixed(2) as MoneyString,
        description: input.description ?? "Payment received",
        eventFeeId,
        quickbooksItemId: defaults?.defaultQuickbooksItemId ?? null,
        quickbooksAccountId: defaults?.defaultQuickbooksAccountId ?? null,
        waveIncomeAccountId: defaults?.defaultWaveIncomeAccountId ?? null,
        syncStatus: "pending",
        updatedAt: new Date() as any,
      })
      .returning();

    if (eventFeeId) {
      await this.recalculateEventFeeBalanceStatus(eventFeeId);
    }

    return payment;
  }

  async recalculateEventFeeBalanceStatus(eventFeeId: string): Promise<EventFee | undefined> {
    const eventFee = await this.getEventFee(eventFeeId);
    if (!eventFee) return undefined;

    const txRows = await this.db.select().from(transactions).where(eq(transactions.eventFeeId, eventFeeId));

    const chargeTotal = txRows
      .filter((tx) => tx.type === "charge")
      .reduce((sum, tx) => sum + parseMoney(tx.amount), 0);
    const paidTotal = txRows
      .filter((tx) => tx.type === "payment")
      .reduce((sum, tx) => sum + parseMoney(tx.amount), 0);

    const billedTotal = Math.max(parseMoney(eventFee.amount), chargeTotal);
    const balance = Math.max(0, billedTotal - paidTotal);

    let status: EventFeeStatus = "unbilled";
    if (billedTotal > 0 && paidTotal <= 0) status = "billed";
    if (billedTotal > 0 && paidTotal > 0 && balance > 0) status = "partial";
    if (billedTotal > 0 && balance <= 0.009) status = "paid";

    const [updated] = await this.db
      .update(eventFees)
      .set({
        amount: billedTotal.toFixed(2),
        balance: balance.toFixed(2),
        status,
        updatedAt: new Date() as any,
      })
      .where(eq(eventFees.id, eventFeeId))
      .returning();

    return updated;
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
