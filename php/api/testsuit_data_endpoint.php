<?php

require_once (dirname(__FILE__)."/../lib/sqlite.php");
require_once (dirname(__FILE__)."/../lib/common.php");
require_once (dirname(__FILE__)."/../../config/config.php");
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
# now we need to return the data in a way icinga does, so php/api/fetchdata_icinga.php can deal with it

$result = Array();
$result["cgi_json_version"] = "1.10.0-testsuit";
$result["icinga_status"] = Array(
	"status_data_age" => 1, #FIXME
	"status_update_interval" => 1,
	"reading_status_data_ok" => 1,
);
$result["status"] = Array();
$result["status"]["service_status"] = Array();
foreach ($data as $value) {
	$element = Array(
		"host_name" => $value["host"],
		"service_description" => $value["service"],
		"status" => strtoupper($value["state"]),
		"duration" => "1m", #FIXME
		"state_type" => "SOFT", #FIXME
		"is_flapping" => false, #FIXME
	);
	array_push($result["status"]["service_status"], $element);
}

print json_encode($result);
