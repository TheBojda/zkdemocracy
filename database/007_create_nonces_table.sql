CREATE TABLE `nonces` (
    `address` varchar(42) NOT NULL,
    `nonce` int DEFAULT 0,
    PRIMARY KEY (address)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;