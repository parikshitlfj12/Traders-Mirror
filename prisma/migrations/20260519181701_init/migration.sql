-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'UTC',
    `primaryMarket` ENUM('FOREX', 'CRYPTO', 'BOTH') NOT NULL DEFAULT 'CRYPTO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `startingCapital` DECIMAL(18, 2) NOT NULL,
    `maxDrawdown` DECIMAL(18, 2) NOT NULL,
    `dailyDrawdown` DECIMAL(18, 2) NOT NULL,
    `profitTarget` DECIMAL(18, 2) NOT NULL,
    `rawText` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Project_userId_isActive_idx`(`userId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Rule` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `category` ENUM('MAX_TRADES_PER_DAY', 'MAX_TRADES_PER_WEEK', 'MAX_DAILY_LOSS', 'MAX_WEEKLY_LOSS', 'MAX_RISK_PER_TRADE', 'POSITION_SIZE_CAP', 'NO_REVENGE_TRADING', 'NO_SIZE_INCREASE_AFTER_LOSS', 'APPROVED_SETUPS_ONLY', 'ALLOWED_SESSIONS_ONLY', 'NO_FOMO_ENTRIES', 'REQUIRES_CONFIRMATION', 'CUSTOM') NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `params` JSON NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `version` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Rule_projectId_isActive_idx`(`projectId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RuleViolation` (
    `id` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `voiceNoteId` VARCHAR(191) NULL,
    `tradeId` VARCHAR(191) NULL,
    `detectedBy` VARCHAR(191) NOT NULL,
    `evidence` TEXT NOT NULL,
    `detectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RuleViolation_projectId_detectedAt_idx`(`projectId`, `detectedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Trade` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `market` ENUM('FOREX', 'CRYPTO', 'BOTH') NOT NULL,
    `direction` ENUM('LONG', 'SHORT') NOT NULL,
    `size` DECIMAL(18, 8) NOT NULL,
    `entryPrice` DECIMAL(18, 8) NOT NULL,
    `exitPrice` DECIMAL(18, 8) NULL,
    `pnl` DECIMAL(18, 2) NULL,
    `rMultiple` DECIMAL(8, 2) NULL,
    `openedAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `status` ENUM('OPEN', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Trade_userId_openedAt_idx`(`userId`, `openedAt`),
    INDEX `Trade_projectId_openedAt_idx`(`projectId`, `openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceNote` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `tradeId` VARCHAR(191) NULL,
    `audioPath` VARCHAR(191) NULL,
    `audioDurationMs` INTEGER NULL,
    `transcript` TEXT NOT NULL,
    `screenshotPath` VARCHAR(191) NULL,
    `analysisMode` ENUM('QUICK', 'DEEP') NOT NULL DEFAULT 'QUICK',
    `payload` JSON NOT NULL,
    `payloadVersion` VARCHAR(191) NOT NULL DEFAULT 'v1',
    `aiProvider` VARCHAR(191) NOT NULL,
    `aiTier` VARCHAR(191) NOT NULL,
    `context` ENUM('PRE_TRADE', 'POST_TRADE', 'END_OF_DAY', 'GENERAL') NOT NULL DEFAULT 'POST_TRADE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VoiceNote_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `VoiceNote_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `VoiceNote_tradeId_idx`(`tradeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiUsageLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `operation` VARCHAR(191) NOT NULL,
    `inputTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `imageTokens` INTEGER NULL,
    `estimatedCost` DECIMAL(10, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiUsageLog_createdAt_idx`(`createdAt`),
    INDEX `AiUsageLog_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rule` ADD CONSTRAINT `Rule_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RuleViolation` ADD CONSTRAINT `RuleViolation_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `Rule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RuleViolation` ADD CONSTRAINT `RuleViolation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trade` ADD CONSTRAINT `Trade_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trade` ADD CONSTRAINT `Trade_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceNote` ADD CONSTRAINT `VoiceNote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceNote` ADD CONSTRAINT `VoiceNote_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceNote` ADD CONSTRAINT `VoiceNote_tradeId_fkey` FOREIGN KEY (`tradeId`) REFERENCES `Trade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
