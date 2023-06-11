-- 1. execute script to create database and basic confgiuration: mysql < database-onion-ptl.sql
-- 2. execute this script to populate the database with specific configuration: mysql onion-ptl < export-database-test.sql

INSERT INTO shelf (id,code,`rows`,`columns`,type_id,max_concurrent_orders,max_concurrent_users,max_concurrent_movs,autologout) VALUES
	 (52,'SHELF',1,10,1,1,1,0,0);

INSERT INTO dpi (id,code,ip,port) VALUES
	 (57,'1','192.168.1.222',16);
   
INSERT INTO ptl (id,code,type_id,internal_id,channel_id,dpi_id) VALUES
	 (359,'1',1,'001',1,57),
	 (360,'2',1,'002',1,57),
	 (361,'3',1,'003',1,57),
	 (362,'4',2,'004',1,57),
	 (363,'5',7,'005',1,57),
	 (364,'6',6,'001',2,57),
	 (365,'7',5,'002',2,57),
	 (366,'8',5,'003',2,57),
	 (367,'9',5,'004',2,57),
	 (368,'10',5,'005',2,57);

INSERT INTO `location` (id,code,product_code,shelf_id,ptl_id) VALUES
	 (359,'L000000',NULL,52,359),
	 (360,'L000001',NULL,52,360),
	 (361,'L000002',NULL,52,361),
	 (362,'L000003',NULL,52,362),
	 (363,'L000004',NULL,52,363),
	 (364,'L001000',NULL,52,364),
	 (365,'L001001',NULL,52,365),
	 (366,'L001002',NULL,52,366),
	 (367,'L001003',NULL,52,367),
	 (368,'L001004',NULL,52,368);

