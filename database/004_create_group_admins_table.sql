CREATE TABLE `group_admins` (
    `groups_id` int NOT NULL,
    `admin` varchar(42) NOT NULL,
    `creator` varchar(42) NOT NULL,
    `created` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;