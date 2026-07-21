CREATE TABLE IF NOT EXISTS "context_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"type" text DEFAULT 'string' NOT NULL,
	"source" text DEFAULT 'sdk' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"description" text,
	"example" text,
	"enum_values" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "context_fields_project_id_key_unique" UNIQUE("project_id","key"),
	CONSTRAINT "context_fields_type_check" CHECK ("type" IN ('string','enum','boolean','number','version','date')),
	CONSTRAINT "context_fields_source_check" CHECK ("source" IN ('sdk','server','computed'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "context_fields" ADD CONSTRAINT "context_fields_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
