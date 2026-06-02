ALTER TABLE "metrics" RENAME COLUMN "related_options" TO "has_related_options";
ALTER TABLE "metric_options" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "metric_options" ALTER COLUMN "short_description" SET NOT NULL;
ALTER TABLE "metrics" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "metrics" ALTER COLUMN "short_description" SET NOT NULL;
ALTER TABLE "metrics" ALTER COLUMN "has_related_options" SET DEFAULT false;
ALTER TABLE "metrics" ALTER COLUMN "has_related_options" SET NOT NULL;