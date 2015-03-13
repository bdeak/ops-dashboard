<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");
require_once (dirname(__FILE__)."/../testsuit/testsuit.php");

# get_alert_data_<lookup_method>()
# download active alert statuses from a given data source
# and return it as json
#
# format: 
#	for hosts:
# 		$states["host"][$hostname] = 1
#	for services:
#		$states["service"][$hostname . "!" . $service] = 1

function get_alert_data_testsuit() {
	global $config;
	global $l;


	$states = Array();
	try {
		$data = get_testsuit_data_sqlite();
	} catch (Exception $e) {
		handle_error("Failed to get testsuit from the database: " . $e->getMessage());
	}

	foreach ($data as $value) {
		$key = ($value["type"] == "host" ? $value["host"] : $value["host"] . "!" . $value["service"]); 
		$states[$value["type"]][$key] = $value["alerting"];
	}

	return $states;
}
