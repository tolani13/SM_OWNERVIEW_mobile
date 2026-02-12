import { pgTable, text, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";

// ========== DANCERS ==========
export const dancers = pgTable("dancers", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  parentName: text("parent_name"),
  parentEmail: text("parent_email"),
  parentPhone: text("parent_phone"),
  emergencyContact: text("emergency_contact"),
  medicalNotes: text("medical_notes"),
  email: text("email"),
  status: text("status"),
  studioNotes: text("studio_notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type Dancer = typeof dancers.$inferSelect;
export type InsertDancer = typeof dancers.$inferInsert;

// ========== TEACHERS ==========
export const teachers = pgTable("teachers", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name"),
  role: text("role"),
  avatarUrl: text("avatar_url"),
  isAvailableForSolo: boolean("is_available_for_solo").default(false),
  classes: text("classes").array().default([]),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  specialty: text("specialty"),
  email: text("email"),
  phone: text("phone"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = typeof teachers.$inferInsert;

// ========== ROUTINES ==========
export const routines = pgTable("routines", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  style: text("style").notNull(),
  type: text("type").notNull(),
  dancerIds: text("dancer_ids").array().notNull().default([]),
  costumeName: text("costume_name"),
  costumeFee: text("costume_fee").default("0"),
  costumePaid: boolean("costume_paid").default(false),
  paidDancerIds: text("paid_dancer_ids").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type Routine = typeof routines.$inferSelect;
export type InsertRoutine = typeof routines.$inferInsert;

// ========== COMPETITIONS ==========
export const competitions = pgTable("competitions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  location: text("location").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status").notNull().default("Upcoming"),
  logoUrl: text("logo_url"),
  conventionFee: text("convention_fee").default("0"),
  paymentDeadline: text("payment_deadline"),
  feeStructure: json("fee_structure").$type<{
    solo: string;
    duetTrio: string;
    group: string;
    largeGroup: string;
    line: string;
    production: string;
    photoFee?: string;
  }>().default({ solo: "0", duetTrio: "0", group: "0", largeGroup: "0", line: "0", production: "0" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = typeof competitions.$inferInsert;

// ========== COMPETITION REGISTRATIONS ==========
export const competitionRegistrations = pgTable("competition_registrations", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  competitionId: text("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
  dancerId: text("dancer_id").notNull().references(() => dancers.id, { onDelete: "cascade" }),
  routineId: text("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type CompetitionRegistration = typeof competitionRegistrations.$inferSelect;
export type InsertCompetitionRegistration = typeof competitionRegistrations.$inferInsert;

// ========== COMPETITION RUN SHEETS ==========
export const competitionRunSheets = pgTable("competition_run_sheets", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  competitionId: text("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
  
  // Core Fields (editable by user)
  entryNumber: text("entry_number"), // Competition entry # (e.g., "1", "42", "248")
  routineName: text("routine_name").notNull(), // Routine name
  division: text("division").notNull(), // Mini, Junior, Teen, Senior, etc.
  style: text("style").notNull(), // Jazz, Ballet, Contemporary, etc.
  groupSize: text("group_size").notNull(), // Solo, Duo/Trio, Small Group, etc.
  studioName: text("studio_name").notNull(), // Studio name
  performanceTime: text("performance_time").notNull(), // 12hr format without AM/PM (e.g., "1:30", "11:45")
  
  // Optional Fields
  day: text("day"), // Friday, Saturday, Sunday
  notes: text("notes"), // Owner notes
  placement: text("placement"), // 1st, 2nd, 3rd, etc.
  award: text("award"), // Special awards
  
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type CompetitionRunSheet = typeof competitionRunSheets.$inferSelect;
export type InsertCompetitionRunSheet = typeof competitionRunSheets.$inferInsert;

// ========== RUN SLOTS (LEGACY - Keep for backward compatibility) ==========
export const runSlots = pgTable("run_slots", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  competitionId: text("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
  
  // PDF Parsed Fields (primary data from import)
  entryNumber: text("entry_number"), // Competition entry # from PDF
  routineName: text("routine_name").notNull(), // Raw name from PDF
  division: text("division").notNull(), // PreTeen, Junior, Intermediate, Teen, Senior, Mini, Spark
  style: text("style").notNull(), // Ballet, Jazz, Contemporary, Tap, Lyrical, Hip Hop, etc.
  groupSize: text("group_size").notNull(), // Solo, Duo/Trio, Small Group, Large Group, Line, Production
  studioName: text("studio_name").notNull(), // Studio name from PDF
  
  // Schedule Fields
  day: text("day").notNull(), // Day of performance (Friday, Saturday, Sunday)
  performanceTime: text("performance_time").notNull(), // Normalized 24hr time (HH:MM)
  stage: text("stage"), // Stage/room name
  orderNumber: integer("order_number").notNull(), // Performance order
  
  // Linked Data (set after import when matching routines)
  routineId: text("routine_id").references(() => routines.id), // Null until linked
  isStudioRoutine: boolean("is_studio_routine").default(false), // True if studioName matches
  
  // Post-Competition Results (added manually after event)
  placement: text("placement"), // 1st, 2nd, 3rd, Honorable Mention, etc.
  overallPlacement: text("overall_placement"), // Overall award placement
  specialAwards: text("special_awards").array().default([]), // Array of special awards
  score: text("score"), // Numeric score if provided
  
  // Metadata
  notes: text("notes"), // Manual notes
  rawText: text("raw_text"), // Raw PDF text for debugging parse issues
  parsedBy: text("parsed_by").default("auto"), // "auto" or user ID if manual
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type RunSlot = typeof runSlots.$inferSelect;
export type InsertRunSlot = typeof runSlots.$inferInsert;

// ========== CONVENTION CLASSES ==========
export const conventionClasses = pgTable("convention_classes", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  competitionId: text("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
  
  // PDF Parsed Fields (primary data from import)
  className: text("class_name").notNull(), // Raw class name from PDF
  instructor: text("instructor").notNull(), // Instructor name
  room: text("room").notNull(), // Room/stage name
  
  // Schedule Fields  
  day: text("day").notNull(), // Day of class (Friday, Saturday, Sunday)
  startTime: text("start_time").notNull(), // Normalized 24hr time (HH:MM)
  endTime: text("end_time").notNull(), // Normalized 24hr time (HH:MM)
  duration: integer("duration"), // Duration in minutes (calculated)
  
  // Classification Fields
  style: text("style"), // Ballet, Jazz, Contemporary, etc. (extracted from class name)
  division: text("division"), // Mini, Junior, Teen, Senior (from grid position)
  ageRange: text("age_range"), // "5-7", "8-10", "11-12", etc. (parsed from division)
  level: text("level"), // Beginner, Intermediate, Advanced, All Levels
  
  // Additional Info
  isAuditionPhrase: boolean("is_audition_phrase").default(false), // Special audition classes
  notes: text("notes"), // Manual notes
  rawText: text("raw_text"), // Raw PDF cell text for debugging
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type ConventionClass = typeof conventionClasses.$inferSelect;
export type InsertConventionClass = typeof conventionClasses.$inferInsert;

// ========== STUDIO CLASSES ==========
export const studioClasses = pgTable("studio_classes", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  level: text("level").notNull(),
  day: text("day").notNull(),
  time: text("time").notNull(),
  type: text("type").default("Weekly"),
  description: text("description"),
  cost: text("cost"),
  teacherId: text("teacher_id").references(() => teachers.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type StudioClass = typeof studioClasses.$inferSelect;
export type InsertStudioClass = typeof studioClasses.$inferInsert;

// ========== PRACTICE BOOKINGS ==========
export const practiceBookings = pgTable("practice_bookings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title"),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  room: text("room").notNull(),
  bookedBy: text("booked_by").notNull(),
  purpose: text("purpose"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type PracticeBooking = typeof practiceBookings.$inferSelect;
export type InsertPracticeBooking = typeof practiceBookings.$inferInsert;

// ========== ANNOUNCEMENTS ==========
export const announcements = pgTable("announcements", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  date: text("date"),
  tags: text("tags"),
  isPinned: boolean("is_pinned"),
  tag: text("tag"),
  status: text("status").default("Active"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;

// ========== MESSAGES ==========
export const messages = pgTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  audience: text("audience").default("All Families").notNull(),
  channel: text("channel").default("in-app").notNull(),
  status: text("status").default("Draft").notNull(), // Draft, Scheduled, Sent, Archived
  isTimeSensitive: boolean("is_time_sensitive").default(false).notNull(),
  sendAt: text("send_at"),
  expiresAt: text("expires_at"),
  createdBy: text("created_by").default("Owner").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ========== CHAT THREADS (Parent <-> Studio + CompChat) ==========
export const chatThreads = pgTable("chat_threads", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  type: text("type").notNull().default("direct_parent_staff"), // direct_parent_staff, compchat, group_broadcast
  createdById: text("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdByRole: text("created_by_role").notNull(), // owner, staff, parent
  staffOnlyBroadcast: boolean("staff_only_broadcast").default(false).notNull(),
  isTimeSensitive: boolean("is_time_sensitive").default(false).notNull(),
  expiresAt: text("expires_at"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ChatThread = typeof chatThreads.$inferSelect;
export type InsertChatThread = typeof chatThreads.$inferInsert;

export const chatThreadParticipants = pgTable("chat_thread_participants", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  threadId: text("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  participantName: text("participant_name").notNull(),
  participantRole: text("participant_role").notNull(), // owner, staff, parent
  authorized: boolean("authorized").default(true).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export type ChatThreadParticipant = typeof chatThreadParticipants.$inferSelect;
export type InsertChatThreadParticipant = typeof chatThreadParticipants.$inferInsert;

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  threadId: text("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role").notNull(), // owner, staff, parent
  body: text("body").notNull(),
  isStaffBroadcast: boolean("is_staff_broadcast").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export const chatMessageReads = pgTable("chat_message_reads", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  messageId: text("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
  readerId: text("reader_id").notNull(),
  readerName: text("reader_name").notNull(),
  readerRole: text("reader_role").notNull(), // owner, staff, parent
  readAt: timestamp("read_at").defaultNow().notNull(),
});

export type ChatMessageRead = typeof chatMessageReads.$inferSelect;
export type InsertChatMessageRead = typeof chatMessageReads.$inferInsert;

// ========== FEES ==========
export const fees = pgTable("fees", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  type: text("type").notNull(),
  amount: text("amount").notNull(),
  paid: boolean("paid").default(false).notNull(),
  dueDate: text("due_date").notNull(),
  dancerId: text("dancer_id").notNull().references(() => dancers.id, { onDelete: "cascade" }),
  competitionId: text("competition_id").references(() => competitions.id, { onDelete: "cascade" }),
  routineId: text("routine_id").references(() => routines.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type Fee = typeof fees.$inferSelect;
export type InsertFee = typeof fees.$inferInsert;

// ========== POLICIES (Waivers) ==========
export const policies = pgTable("policies", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  content: text("content").notNull(),
  requiresSignature: boolean("requires_signature").default(true).notNull(),
  active: boolean("active").default(true).notNull(),
  documentVersion: text("document_version").default("1.0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = typeof policies.$inferInsert;

// ========== POLICY AGREEMENTS ==========
export const policyAgreements = pgTable("policy_agreements", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  policyId: text("policy_id").notNull().references(() => policies.id, { onDelete: "cascade" }),
  dancerId: text("dancer_id").notNull().references(() => dancers.id, { onDelete: "cascade" }),
  signedBy: text("signed_by").notNull(),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  documentVersion: text("document_version").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type PolicyAgreement = typeof policyAgreements.$inferSelect;
export type InsertPolicyAgreement = typeof policyAgreements.$inferInsert;

// ========== RECITALS ==========
export const recitals = pgTable("recitals", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  description: text("description"),
  ticketPrice: text("ticket_price").default("0").notNull(),
  ticketsAvailable: integer("tickets_available").default(0).notNull(),
  ticketsSold: integer("tickets_sold").default(0).notNull(),
  salesOpenDate: text("sales_open_date"),
  salesCloseDate: text("sales_close_date"),
  status: text("status").default("Upcoming").notNull(),
  // Program generation fields
  programTitle: text("program_title"),
  programSubtitle: text("program_subtitle"),
  programCoverImage: text("program_cover_image"),
  directorMessage: text("director_message"),
  specialThanks: text("special_thanks"),
  sponsors: json("sponsors").$type<Array<{ name: string; logoUrl?: string; level?: string }>>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type Recital = typeof recitals.$inferSelect;
export type InsertRecital = typeof recitals.$inferInsert;

// ========== RECITAL TICKETS ==========
export const recitalTickets = pgTable("recital_tickets", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  recitalId: text("recital_id").notNull().references(() => recitals.id, { onDelete: "cascade" }),
  dancerId: text("dancer_id").notNull().references(() => dancers.id, { onDelete: "cascade" }),
  parentName: text("parent_name").notNull(),
  parentEmail: text("parent_email").notNull(),
  quantityPurchased: integer("quantity_purchased").notNull(),
  totalAmount: text("total_amount").notNull(),
  paymentStatus: text("payment_status").default("Pending").notNull(),
  paymentMethod: text("payment_method"),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type RecitalTicket = typeof recitalTickets.$inferSelect;
export type InsertRecitalTicket = typeof recitalTickets.$inferInsert;

// ========== RECITAL LINEUP ==========
export const recitalLineup = pgTable("recital_lineup", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  recitalId: text("recital_id").notNull().references(() => recitals.id, { onDelete: "cascade" }),
  routineId: text("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
  performanceOrder: integer("performance_order").notNull(),
  performanceTime: text("performance_time"),
  act: text("act"), // Act 1, Act 2, Finale, etc.
  notes: text("notes"),
  // For program printing
  programDescription: text("program_description"), // Optional description for the program
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export type RecitalLineup = typeof recitalLineup.$inferSelect;
export type InsertRecitalLineup = typeof recitalLineup.$inferInsert;

// ========== STUDIO SETTINGS ==========
export const studioSettings = pgTable("studio_settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  ageGroupConfig: json("age_group_config").$type<Array<{
    minAge: number;
    maxAge: number;
    groupName: string;
  }>>().default([
    { minAge: 5, maxAge: 8, groupName: "Minis" },
    { minAge: 9, maxAge: 11, groupName: "Juniors" },
    { minAge: 12, maxAge: 14, groupName: "Teens" },
    { minAge: 15, maxAge: 18, groupName: "Seniors" }
  ]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export type StudioSettings = typeof studioSettings.$inferSelect;
export type InsertStudioSettings = typeof studioSettings.$inferInsert;

// ========== RELATIONS ==========
export const competitionsRelations = relations(competitions, ({ many }) => ({
  runSheets: many(competitionRunSheets)
}));

export const competitionRunSheetsRelations = relations(competitionRunSheets, ({ one }) => ({
  competition: one(competitions, {
    fields: [competitionRunSheets.competitionId],
    references: [competitions.id]
  })
}));
