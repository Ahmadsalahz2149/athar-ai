CREATE TABLE "data_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_user_id" text NOT NULL,
	"confirmation_code" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"connections_deleted" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_connections" ADD COLUMN "external_user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "data_deletion_code_uq" ON "data_deletion_requests" USING btree ("confirmation_code");--> statement-breakpoint
CREATE INDEX "data_deletion_user_idx" ON "data_deletion_requests" USING btree ("provider","external_user_id");