-- CreateEnum
CREATE TYPE "AiReviewType" AS ENUM ('EXTRACTION', 'VALIDATION', 'SUMMARY');

-- CreateEnum
CREATE TYPE "AiReviewStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "AiFindingSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

-- CreateEnum
CREATE TYPE "AiFeedbackDecision" AS ENUM ('ACCEPTED', 'EDITED', 'DISMISSED');

-- CreateTable
CREATE TABLE "AiExpenseReview" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "AiReviewType" NOT NULL DEFAULT 'EXTRACTION',
    "status" "AiReviewStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "inputHash" TEXT,
    "result" JSONB,
    "confidence" JSONB,
    "warnings" JSONB,
    "error" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiExpenseReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiFinding" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "AiFindingSeverity" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "evidence" TEXT,
    "confidence" DOUBLE PRECISION,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiFeedback" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" "AiFeedbackDecision" NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiExpenseReview_companyId_createdAt_idx" ON "AiExpenseReview"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AiExpenseReview_expenseId_type_idx" ON "AiExpenseReview"("expenseId", "type");

-- CreateIndex
CREATE INDEX "AiFinding_reviewId_severity_idx" ON "AiFinding"("reviewId", "severity");

-- CreateIndex
CREATE INDEX "AiFeedback_reviewId_createdAt_idx" ON "AiFeedback"("reviewId", "createdAt");

-- CreateIndex
CREATE INDEX "AiFeedback_userId_createdAt_idx" ON "AiFeedback"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiExpenseReview" ADD CONSTRAINT "AiExpenseReview_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExpenseReview" ADD CONSTRAINT "AiExpenseReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFinding" ADD CONSTRAINT "AiFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AiExpenseReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFeedback" ADD CONSTRAINT "AiFeedback_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AiExpenseReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFeedback" ADD CONSTRAINT "AiFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
