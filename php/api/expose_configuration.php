<?php

# expose parts of the configuration via an API call

require_once (dirname(__FILE__)."/../lib/common.php");
require_once(dirname(__FILE__)."/../../config/config.php");

$exposable_configuration_keys = Array(
	"display", 
	"page_title", 
	"dashboard_name_major", 
	"dashboard_name_minor", 
	"aod_lookup_enabled", 
	"oncall_lookup_enabled", 
	"alert_lookup_enabled", 
	"priority_lookup_enabled",
	"last_ok",
	"icon",
	"layout",
	"effects",
	"user_msg",
	"show_outdated",
	"debug",
	);

function expose_configuration () {
	global $config;
	global $exposable_configuration_keys;

	$config_exposable = Array();

	foreach ($config as $config_key => $config_value) {
		if (in_array($config_key, $exposable_configuration_keys)) {
			$config_exposable[$config_key] = $config_value;
		}
	}

	return $config_exposable;
}

$l = get_logger("dashboard");
header('Content-type: application/json');

$configuration = expose_configuration();

print json_encode($configuration);