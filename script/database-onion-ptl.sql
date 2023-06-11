--
-- Create database
-- To run the script: $ mysql -u cbwms -p < ./database-onionPtl.sql
--
DROP DATABASE IF EXISTS `onion_ptl`;
CREATE DATABASE IF NOT EXISTS `onion_ptl`;

use `onion_ptl`;

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

--
-- Base de dades: `onionPtl`
--

-- --------------------------------------------------------
CREATE TABLE `shelf_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code_UNIQUE` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shelf` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rows` int NOT NULL DEFAULT '1',
  `columns` int NOT NULL DEFAULT '1',
  `type_id` int NOT NULL,
  `max_concurrent_orders` int NOT NULL DEFAULT '1',
  `max_concurrent_users` int NOT NULL DEFAULT '1',
  `max_concurrent_movs` int NOT NULL DEFAULT '0',
  `autologout` tinyint DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code_UNIQUE` (`code`),
  KEY `fk_shelf_1_idx` (`type_id`),
  CONSTRAINT `fk_shelf_type` FOREIGN KEY (`type_id`) REFERENCES `shelf_type` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ptl_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `manufacturer` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `multilocation` int NOT NULL DEFAULT '0',
  `colors` int NOT NULL DEFAULT '1',
  `display` int NOT NULL DEFAULT '1',
  `keys` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code_UNIQUE` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `dpi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code_UNIQUE` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ptl` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_id` int NOT NULL,
  `internal_id` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel_id` INT NOT NULL,
  `dpi_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code_UNIQUE` (`code`),
  KEY `fk_ptl_1_idx` (`type_id`),
  CONSTRAINT `fk_ptl_type` FOREIGN KEY (`type_id`) REFERENCES `ptl_type` (`id`),
  KEY `fk_ptl_2_idx` (`dpi_id`),
  CONSTRAINT `fk_ptl_dpi` FOREIGN KEY (`dpi_id`) REFERENCES `dpi` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `location` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_code` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shelf_id` int DEFAULT NULL,
  `ptl_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code_UNIQUE` (`code`),
  CONSTRAINT `fk_location_1` FOREIGN KEY (`ptl_id`) REFERENCES `ptl` (`id`),
  KEY `fk_location_2_idx` (`ptl_id`),
  CONSTRAINT `fk_location_2` FOREIGN KEY (`ptl_id`) REFERENCES `ptl` (`id`),
  KEY `fk_location_3_idx` (`shelf_id`),
  CONSTRAINT `fk_location_3` FOREIGN KEY (`shelf_id`) REFERENCES `shelf` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_status` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_header` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type_id` int DEFAULT NULL,
  `status_id` int DEFAULT NULL,
  `priority` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `version` int DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_order_header_1_idx` (`status_id`),
  KEY `fk_order_header_2_idx` (`type_id`),
  CONSTRAINT `fk_order_header_1` FOREIGN KEY (`status_id`) REFERENCES `order_status` (`id`),
  CONSTRAINT `fk_order_header_2` FOREIGN KEY (`type_id`) REFERENCES `order_type` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_line` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '	',
  `order_id` int DEFAULT NULL,
  `location` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(10,0) DEFAULT NULL,
  `quantity_confirmed` decimal(10,0) DEFAULT NULL,
  `wave` int DEFAULT NULL,
  `version` int DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_order_line_1_idx` (`order_id`),
  CONSTRAINT `fk_order_line_1` FOREIGN KEY (`order_id`) REFERENCES `order_header` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_header_arch` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type_id` int DEFAULT NULL,
  `status_id` int DEFAULT NULL,
  `priority` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `user_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version` int DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_line_arch` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '	',
  `order_id` int DEFAULT NULL,
  `location` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(10,0) DEFAULT NULL,
  `quantity_confirmed` decimal(10,0) DEFAULT NULL,
  `wave` int DEFAULT NULL,
  `version` int DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sec_action` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sec_group` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sec_group_action` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sec_action_id` int NOT NULL,
  `sec_group_id` int NOT NULL,
  `privileges` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_sec_group_action_1_idx` (`sec_action_id`),
  CONSTRAINT `fk_sec_group_action_1` FOREIGN KEY (`sec_action_id`) REFERENCES `sec_action` (`id`),
  KEY `fk_sec_group_action_2_idx` (`sec_group_id`),
  CONSTRAINT `fk_sec_group_action_2` FOREIGN KEY (`sec_group_id`) REFERENCES `sec_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sec_user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sec_group_id` int NOT NULL,
  `version` int DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sec_user_group` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sec_user_id` int NOT NULL,
  `sec_group_id` int NOT NULL,
  `version` int DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_sec_user_group_1_idx` (`sec_user_id`),
  CONSTRAINT `fk_sec_user_group_1` FOREIGN KEY (`sec_user_id`) REFERENCES `sec_user` (`id`),
  KEY `fk_sec_user_group_2_idx` (`sec_group_id`),
  CONSTRAINT `fk_sec_user_group_2` FOREIGN KEY (`sec_group_id`) REFERENCES `sec_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sec_user_action` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sec_user_id` int NOT NULL,
  `sec_user_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sec_action_id` int NOT NULL,
  `sec_action_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `method` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `old_data` TEXT COLLATE utf8mb4_unicode_ci,
  `new_data` TEXT COLLATE utf8mb4_unicode_ci,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `parameters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `msg_received` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `external_id` INT NOT NULL,
  `from` VARCHAR(45) NULL,
  `to` VARCHAR(45) NULL,
  `message` JSON NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NULL,
  `processed_at` DATETIME NULL,
  `retries` INT,
  `result` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `msg_received_arch` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `msg_received_id` INT NOT NULL,
  `external_id` INT NOT NULL,
  `from` VARCHAR(45) NULL,
  `to` VARCHAR(45) NULL,
  `message` JSON NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NULL,
  `processed_at` DATETIME NULL,
  `retries` INT,
  `result` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `msg_pending_to_send` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `external_id` INT NOT NULL,
  `from` VARCHAR(45) NULL,
  `to` VARCHAR(45) NULL,
  `message` JSON NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NULL,
  `sent_at` DATETIME NULL,
  `retries` INT,
  `result` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  
CREATE TABLE `msg_pending_to_send_arch` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `msg_pending_to_send_id` INT NOT NULL,
  `external_id` INT NOT NULL,
  `from` VARCHAR(45) NULL,
  `to` VARCHAR(45) NULL,
  `message` JSON NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NULL,
  `sent_at` DATETIME NULL,
  `retries` INT,
  `result` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- ELECTROTEC_NODE_TYPE_NOT_CONFIG: '0',
-- ELECTROTEC_NODE_TYPE_DPA1: '1',
-- ELECTROTEC_NODE_TYPE_DPAZ1: '2',
-- ELECTROTEC_NODE_TYPE_DPM1: '3',
-- ELECTROTEC_NODE_TYPE_DPMZ1: '4',
-- ELECTROTEC_NODE_TYPE_LC1: '5',
-- ELECTROTEC_NODE_TYPE_LCI2_LCIN1: '6',
-- ELECTROTEC_NODE_TYPE_DPW1: '7',
-- ELECTROTEC_NODE_TYPE_DPA2: '8',
INSERT INTO `ptl_type` (`id`, `code`, `manufacturer`, `multilocation`, `colors`, `display`, `keys`)
VALUES (0, '?', 'Electrotec', 0, 0, 0, ''),
  (1, 'DPA1', 'Electrotec', 0, 7, 4, 'V+-F'),
  (2, 'DPAZ1', 'Electrotec', 0, 7, 12, 'V+-F'),
  (3, 'DPM1', 'Electrotec', 0, 7, 4, ''),
  (4, 'DPMZ1', 'Electrotec', 0, 7, 12, ''),
  (5, 'LC1', 'Electrotec', 4, 1, 0, 'V'),
  (6, 'LCI1/LCIN1', 'Electrotec', 0, 0, 0, ''),
  (7, 'DPW1', 'Electrotec', 0, 0, 0, ''),
  (8, 'DPA2', 'Electrotec', 0, 7, 2, 'V+-F');

INSERT INTO `shelf_type` (`id`, `code`)
VALUES (1, 'pick-to-light'),
	(2, 'put-to-light'),
  (3, 'pick-to-light + PT by product'),
  (4, 'pick-to-light + PT by order'),
  (5, 'pick-to-light + Competition Game');

INSERT INTO `order_type` (`id`, `code`)
VALUES (1, 'pick-to-light'),
	(2, 'put-to-light'),
  (3, 'pick-to-light + PT by product'),
  (4, 'pick-to-light + PT by order'),
  (5, 'pick-to-light + Competition Game');

INSERT INTO `order_status` (`id`, `code`)
VALUES (1, 'pending'),
	(2, 'ready'),
  (3, 'releasing'),
  (4, 'executing'),
  (5, 'canceling'),
  (6, 'canceled');

INSERT INTO `parameters` (`id`,`code`,`description`,`type`,`value`,`version`,`created_at`,`updated_at`)
VALUES (1,'max_orders_executing','','INT','7',0,now(),now()),
  (2,'max_picks_per_order','','INT','0',0,now(),now()),
  (3,'autologout','','INT','0',0,now(),now()),
  (4,'arch_retention_days','','INT','30',0,now(),now());
