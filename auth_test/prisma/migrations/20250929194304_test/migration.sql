-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `iam_user_mappings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `iamUserId` INTEGER NOT NULL,
    `authUserId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `iam_user_mappings_iamUserId_key`(`iamUserId`),
    UNIQUE INDEX `iam_user_mappings_authUserId_key`(`authUserId`),
    UNIQUE INDEX `iam_user_mappings_iamUserId_authUserId_key`(`iamUserId`, `authUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(700) NOT NULL,
    `userId` INTEGER NOT NULL,
    `externalRefreshToken` VARCHAR(700) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refresh_tokens_token_idx`(`token`),
    UNIQUE INDEX `refresh_tokens_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `iam_user_mappings` ADD CONSTRAINT `iam_user_mappings_authUserId_fkey` FOREIGN KEY (`authUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
