-- AlterTable
ALTER TABLE "interview_questions" ADD COLUMN IF NOT EXISTS "agentQuestionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "interview_questions_agentQuestionId_idx" ON "interview_questions"("agentQuestionId");
