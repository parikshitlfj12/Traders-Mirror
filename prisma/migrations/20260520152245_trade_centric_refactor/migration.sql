/*
  Warnings:

  - You are about to alter the column `status` on the `trade` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(6))` to `Enum(EnumId(5))`.
  - Made the column `tradeId` on table `voicenote` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `voicenote` DROP FOREIGN KEY `VoiceNote_tradeId_fkey`;

-- AlterTable
ALTER TABLE `trade` ADD COLUMN `fieldSources` JSON NULL,
    MODIFY `symbol` VARCHAR(191) NULL,
    MODIFY `market` ENUM('FOREX', 'CRYPTO', 'BOTH') NULL,
    MODIFY `direction` ENUM('LONG', 'SHORT') NULL,
    MODIFY `size` DECIMAL(18, 8) NULL,
    MODIFY `entryPrice` DECIMAL(18, 8) NULL,
    MODIFY `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `status` ENUM('TODO', 'ANALYSED', 'COMPLETED') NOT NULL DEFAULT 'TODO';

-- AlterTable
ALTER TABLE `voicenote` MODIFY `tradeId` VARCHAR(191) NOT NULL,
    MODIFY `aiProvider` VARCHAR(191) NULL,
    MODIFY `aiTier` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Trade_userId_status_idx` ON `Trade`(`userId`, `status`);

-- AddForeignKey
ALTER TABLE `VoiceNote` ADD CONSTRAINT `VoiceNote_tradeId_fkey` FOREIGN KEY (`tradeId`) REFERENCES `Trade`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
