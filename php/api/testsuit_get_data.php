<?php

require_once (dirname(__FILE__)."/../lib/sqlite.php");
require_once (dirname(__FILE__)."/../lib/common.php");
require_once(dirname(__FILE__)."/../../config/config.php");
require_once (dirname(__FILE__)."/../lib/testsuit/testsuit.php");


$l = get_logger("dashboard");
header('Content-type: application/json');

$l->info("Sending testsuit data to testsuit");

# add the data to the dashboard db
try {
	$data = get_testsuit_data_sqlite();
} catch (Exception $e) {
	handle_error("Failed to get testsuit from the database: " . $e->getMessage());
}
print json_encode($data);
