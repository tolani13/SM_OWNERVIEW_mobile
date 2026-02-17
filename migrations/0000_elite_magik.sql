CREATE TYPE "public"."class_program_type" AS ENUM('REC', 'COMP', 'BOTH');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"date" text,
	"tags" text,
	"is_pinned" boolean,
	"tag" text,
	"status" text DEFAULT 'Active',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message_reads" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"reader_id" text NOT NULL,
	"reader_name" text NOT NULL,
	"reader_role" text NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"is_staff_broadcast" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_thread_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"participant_name" text NOT NULL,
	"participant_role" text NOT NULL,
	"authorized" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'direct_parent_staff' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_by_role" text NOT NULL,
	"staff_only_broadcast" boolean DEFAULT false NOT NULL,
	"is_time_sensitive" boolean DEFAULT false NOT NULL,
	"expires_at" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"dancer_id" text NOT NULL,
	"routine_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_run_sheets" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"entry_number" text,
	"routine_name" text NOT NULL,
	"division" text NOT NULL,
	"style" text NOT NULL,
	"group_size" text NOT NULL,
	"studio_name" text NOT NULL,
	"performance_time" text NOT NULL,
	"day" text,
	"notes" text,
	"placement" text,
	"award" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'Upcoming' NOT NULL,
	"logo_url" text,
	"convention_fee" text DEFAULT '0',
	"payment_deadline" text,
	"fee_structure" json DEFAULT '{"solo":"0","duetTrio":"0","group":"0","largeGroup":"0","line":"0","production":"0"}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "convention_classes" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"class_name" text NOT NULL,
	"instructor" text NOT NULL,
	"room" text NOT NULL,
	"day" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"duration" integer,
	"style" text,
	"division" text,
	"age_range" text,
	"level" text,
	"is_audition_phrase" boolean DEFAULT false,
	"notes" text,
	"raw_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dancers" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" text,
	"parent_name" text,
	"parent_email" text,
	"parent_phone" text,
	"emergency_contact" text,
	"medical_notes" text,
	"email" text,
	"status" text,
	"studio_notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fees" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"amount" text NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"due_date" text NOT NULL,
	"dancer_id" text NOT NULL,
	"competition_id" text,
	"routine_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"audience" text DEFAULT 'All Families' NOT NULL,
	"channel" text DEFAULT 'in-app' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"is_time_sensitive" boolean DEFAULT false NOT NULL,
	"send_at" text,
	"expires_at" text,
	"created_by" text DEFAULT 'Owner' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"requires_signature" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"document_version" text DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_id" text NOT NULL,
	"dancer_id" text NOT NULL,
	"signed_by" text NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"document_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"room" text NOT NULL,
	"booked_by" text NOT NULL,
	"purpose" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recital_lineup" (
	"id" text PRIMARY KEY NOT NULL,
	"recital_id" text NOT NULL,
	"routine_id" text NOT NULL,
	"performance_order" integer NOT NULL,
	"performance_time" text,
	"act" text,
	"notes" text,
	"program_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recital_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"recital_id" text NOT NULL,
	"dancer_id" text NOT NULL,
	"parent_name" text NOT NULL,
	"parent_email" text NOT NULL,
	"quantity_purchased" integer NOT NULL,
	"total_amount" text NOT NULL,
	"payment_status" text DEFAULT 'Pending' NOT NULL,
	"payment_method" text,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recitals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"location" text NOT NULL,
	"description" text,
	"ticket_price" text DEFAULT '0' NOT NULL,
	"tickets_available" integer DEFAULT 0 NOT NULL,
	"tickets_sold" integer DEFAULT 0 NOT NULL,
	"sales_open_date" text,
	"sales_close_date" text,
	"status" text DEFAULT 'Upcoming' NOT NULL,
	"program_title" text,
	"program_subtitle" text,
	"program_cover_image" text,
	"director_message" text,
	"special_thanks" text,
	"sponsors" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"style" text NOT NULL,
	"type" text NOT NULL,
	"dancer_ids" text[] DEFAULT '{}' NOT NULL,
	"costume_name" text,
	"costume_fee" text DEFAULT '0',
	"costume_paid" boolean DEFAULT false,
	"paid_dancer_ids" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"entry_number" text,
	"routine_name" text NOT NULL,
	"division" text NOT NULL,
	"style" text NOT NULL,
	"group_size" text NOT NULL,
	"studio_name" text NOT NULL,
	"day" text NOT NULL,
	"performance_time" text NOT NULL,
	"stage" text,
	"order_number" integer NOT NULL,
	"routine_id" text,
	"is_studio_routine" boolean DEFAULT false,
	"placement" text,
	"overall_placement" text,
	"special_awards" text[] DEFAULT '{}',
	"score" text,
	"notes" text,
	"raw_text" text,
	"parsed_by" text DEFAULT 'auto',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_classes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"day" text NOT NULL,
	"time" text NOT NULL,
	"type" text DEFAULT 'Weekly',
	"description" text,
	"cost" text,
	"class_name" text DEFAULT '' NOT NULL,
	"age_group_label" text DEFAULT 'All Ages' NOT NULL,
	"min_age" integer,
	"max_age" integer,
	"session_label" text DEFAULT '2025–2026' NOT NULL,
	"start_date" text DEFAULT '2025-09-02' NOT NULL,
	"day_of_week" text DEFAULT '' NOT NULL,
	"start_time" text DEFAULT '' NOT NULL,
	"end_time" text DEFAULT '' NOT NULL,
	"room" text DEFAULT 'Main' NOT NULL,
	"teacher_id" text,
	"teacher_name" text,
	"spots_left" integer DEFAULT 0 NOT NULL,
	"tuition_monthly" numeric(8, 2) DEFAULT '0' NOT NULL,
	"program_type" "class_program_type" DEFAULT 'REC' NOT NULL,
	"is_competition" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"age_group_config" json DEFAULT '[{"minAge":5,"maxAge":8,"groupName":"Minis"},{"minAge":9,"maxAge":11,"groupName":"Juniors"},{"minAge":12,"maxAge":14,"groupName":"Teens"},{"minAge":15,"maxAge":18,"groupName":"Seniors"}]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"role" text,
	"avatar_url" text,
	"is_available_for_solo" boolean DEFAULT false,
	"classes" text[] DEFAULT '{}',
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"specialty" text,
	"email" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread_participants" ADD CONSTRAINT "chat_thread_participants_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_registrations" ADD CONSTRAINT "competition_registrations_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_registrations" ADD CONSTRAINT "competition_registrations_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_registrations" ADD CONSTRAINT "competition_registrations_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_run_sheets" ADD CONSTRAINT "competition_run_sheets_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convention_classes" ADD CONSTRAINT "convention_classes_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fees" ADD CONSTRAINT "fees_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fees" ADD CONSTRAINT "fees_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fees" ADD CONSTRAINT "fees_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_agreements" ADD CONSTRAINT "policy_agreements_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_agreements" ADD CONSTRAINT "policy_agreements_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recital_lineup" ADD CONSTRAINT "recital_lineup_recital_id_recitals_id_fk" FOREIGN KEY ("recital_id") REFERENCES "public"."recitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recital_lineup" ADD CONSTRAINT "recital_lineup_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recital_tickets" ADD CONSTRAINT "recital_tickets_recital_id_recitals_id_fk" FOREIGN KEY ("recital_id") REFERENCES "public"."recitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recital_tickets" ADD CONSTRAINT "recital_tickets_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_slots" ADD CONSTRAINT "run_slots_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_slots" ADD CONSTRAINT "run_slots_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_classes" ADD CONSTRAINT "studio_classes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;