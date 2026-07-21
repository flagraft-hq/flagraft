ALTER TABLE "context_fields" DROP CONSTRAINT "context_fields_source_check";--> statement-breakpoint
ALTER TABLE "context_fields" DROP COLUMN IF EXISTS "source";--> statement-breakpoint
ALTER TABLE "context_fields" DROP COLUMN IF EXISTS "required";--> statement-breakpoint
ALTER TABLE "context_fields" DROP COLUMN IF EXISTS "example";