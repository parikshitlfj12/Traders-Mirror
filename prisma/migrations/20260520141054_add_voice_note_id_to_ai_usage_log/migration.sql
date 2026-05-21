-- AlterTable
ALTER TABLE `aiusagelog` ADD COLUMN `voiceNoteId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AiUsageLog_voiceNoteId_idx` ON `AiUsageLog`(`voiceNoteId`);

-- AddForeignKey
ALTER TABLE `AiUsageLog` ADD CONSTRAINT `AiUsageLog_voiceNoteId_fkey` FOREIGN KEY (`voiceNoteId`) REFERENCES `VoiceNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
