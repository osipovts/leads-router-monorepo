CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "contact" VARCHAR(128) NOT NULL,
    "message" VARCHAR(2048) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
