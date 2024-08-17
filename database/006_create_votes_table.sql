CREATE TABLE `votes` (
    `id` int NOT NULL AUTO_INCREMENT,
    `votings_id` int NOT NULL,
    `groups_id` int NOT NULL,
    `nullifier` varchar(255) NOT NULL,
    `merkle_root` varchar(255) NOT NULL,
    `proof` text NOT NULL,
    `vote` varchar(255) NOT NULL,
    `created` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;