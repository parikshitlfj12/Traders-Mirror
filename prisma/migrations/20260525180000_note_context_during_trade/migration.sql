-- Add DURING_TRADE to VoiceNote.context (pre / during / post trade tagging).
ALTER TABLE `VoiceNote` MODIFY `context` ENUM('PRE_TRADE', 'DURING_TRADE', 'POST_TRADE', 'END_OF_DAY', 'GENERAL') NOT NULL DEFAULT 'POST_TRADE';
