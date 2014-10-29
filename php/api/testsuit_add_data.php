<?php

require_once (dirname(__FILE__)."/../lib/sqlite.php");
require_once (dirname(__FILE__)."/../lib/common.php");
require_once(dirname(__FILE__)."/../../config/config.php");
require_once (dirname(__FILE__)."/../lib/testsuit/testsuit.php");


$l = get_logger("dashboard");
header('Content-type: application/json');

$data_raw = file_get_contents('php://input');
$data = json_decode($data_raw, true);

#$data = json_decode(file_get_contents('php://input'));
if ($data === null) {
	handle_error("Invalid data received, can't parse JSON", "array");
}
if (!(array_key_exists("data", $data))) {
	handle_error("Please provide the 'data' field", "array");
}

$l->info("Received data via 'testsuit_add_data'");

# add the data to the dashboard db
try {
	clear_testsuit_data_sqlite();
} catch (Exception $e) {
	handle_error("Failed to clear testsuit data from the database: " . $e->getMessage(), "array");
}
try {
	add_testsuit_data_sqlite($data["data"]);
} catch (Exception $e) {
	handle_error("Failed to add testsuit data to the database: " . $e->getMessage(), "array");
}
print json_encode(Array("OK", "Stored dummy data")) . "\n";
