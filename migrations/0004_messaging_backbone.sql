-- Messaging backbone (Band-style text messaging)

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "studio_id" text NOT NULL,
  "type" text NOT NULL,
  "name" text,
  "allow_parent_replies" boolean NOT NULL DEFAULT false,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "archived_at" timestamp
);

CREATE INDEX IF NOT EXISTS "conversations_studio_updated_idx"
  ON "conversations"("studio_id", "updated_at" DESC);

CREATE TABLE IF NOT EXISTS "conversation_participants" (
  "conversation_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role_in_conversation" text NOT NULL,
  "is_muted" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "conversation_participants_pk" PRIMARY KEY ("conversation_id", "user_id"),
  CONSTRAINT "conversation_participants_conversation_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "conversation_participants_user_idx"
  ON "conversation_participants"("user_id");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" text PRIMARY KEY NOT NULL,
  "conversation_id" text NOT NULL,
  "studio_id" text NOT NULL,
  "sender_user_id" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp,
  CONSTRAINT "messages_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx"
  ON "messages"("conversation_id", "created_at" ASC);

CREATE TABLE IF NOT EXISTS "message_reads" (
  "conversation_id" text NOT NULL,
  "user_id" text NOT NULL,
  "last_read_message_id" text NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "message_reads_pk" PRIMARY KEY ("conversation_id", "user_id"),
  CONSTRAINT "message_reads_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade,
  CONSTRAINT "message_reads_last_read_message_id_messages_id_fk"
    FOREIGN KEY ("last_read_message_id") REFERENCES "messages"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "message_reads_user_updated_idx"
  ON "message_reads"("user_id", "updated_at" DESC);
