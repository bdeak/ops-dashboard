<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");
require_once (dirname(__FILE__)."/../testsuit/testsuit.php");

# get_priority_data_<lookup_method>()
# get the priority data for services and hosts based on icinga service- and hostgroup membership

# result -> array():
# $priorities["service"]["host1!service1"] = "priority1"
# $priorities["host"]["host1"] = "priority2"

function get_priority_data_testsuit (&$statuses) {
	global $config, $l;

	$l = get_logger("dashboard");
	$priorities = Array();

	try {
		$data = get_testsuit_data_sqlite();
	} catch (Exception $e) {
		handle_error("Failed to get testsuit from the database: " . $e->getMessage());
	}

	foreach ($data as $value) {
		$key = ($value["type"] == "host" ? $value["host"] : $value["host"] . "!" . $value["service"]); 
		$priorities[$value["type"]][$key] = $value["priority"];
	}

	return $priorities;
}