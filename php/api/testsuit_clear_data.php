<?php

require_once (dirname(__FILE__)."/../lib/sqlite.php");
require_once (dirname(__FILE__)."/../lib/common.php");
require_once(dirname(__FILE__)."/../../config/config.php");
require_once (dirname(__FILE__)."/../lib/testsuit/testsuit.php");


$l = get_logger("dashboard");
header('Content-type: application/json');

$l->info("Clearing testsuit data");

# add the data to the dashboard db
try {
	clear_testsuit_data_sqlite();
} catch (Exception $e) {
	handle_error("Failed to clear testsuit data from the database: " . $e->getMessage(), "array");
}
print json_encode(Array("OK", "Cleared testsuit data")) . "\n";
