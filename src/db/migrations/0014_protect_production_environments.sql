-- Production is now protected by default, which is what keeps editors from
-- toggling flags there. Existing projects were seeded before that rule, so
-- backfill them. Environments already marked protected are left alone.
UPDATE "environments" SET "protected" = true WHERE "slug" = 'production';
