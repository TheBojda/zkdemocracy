CREATE TABLE `members` (
    `id` int NOT NULL AUTO_INCREMENT,
    `groups_id` int NOT NULL,
    `commitment` varchar(255) NOT NULL,
    `identity_hash` varchar(255) NOT NULL,
    `merkle_root` varchar(255) NOT NULL,
    `proof` text DEFAULT NULL,
    `creator` varchar(42) NOT NULL,
    `created` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;