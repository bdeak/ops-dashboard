<?php

require_once (dirname(__FILE__)."/../lib/sqlite.php");
require_once (dirname(__FILE__)."/../lib/common.php");
require_once(dirname(__FILE__)."/../../config/config.php");
foreach (glob(dirname(__FILE__)."/../lib/oncall_lookup/*.php") as $filename) {
    require_once $filename;
}
foreach (glob(dirname(__FILE__)."/../lib/aod_lookup/*.php") as $filename) {
    require_once $filename;
}


$l = get_logger("dashboard");
header('Content-type: application/json');

if ($config["cache_ttl_oncall"] == 0) {
	$l->info("Clearing cache as 'cache_ttl_status' is set to 0");
	apc_clear_cache("user");
}

$l->info("Getting the oncall/aod information");
$personnel_data = apc_fetch(get_apc_hash_key("personnel"));

if ($personnel_data !== false) {
	# found it in the cache
	$l->info("Found the oncall/aod data in the cache");
} else {
	$l->info("Oncall/aod data not found in the cache, getting it from Schichtplan");
	# failed to retrieve, get it from the URL

	# get the alert information, (if enabled) using the defined lookup method
	$personnel_data = null;
	foreach (array('aod', 'oncall') as $type) {
		if ($config[$type . "_lookup_enabled"] === true) {
			$lookup_method = $config[$type . "_lookup_method"];
			$lookup_func = sprintf("get_%s_data_%s", $type, $lookup_method);
			# check if the given function exists
			if (! function_exists($lookup_func)) {
				handle_error("Lookup function '$lookup_func' is not defined for lookup method '$lookup_method'!");
			}
			$personnel_data[$type] = call_user_func("$lookup_func");
		}
	}
	$result = apc_delete(get_apc_hash_key("personnel"));
	if ($result === true) {
		$l->info("Deleted cache entry for 'states'");
	}	
	$result = apc_add(get_apc_hash_key("personnel"), $personnel_data, $config["cache_ttl_oncall"]);
	if ($result === true) {
		$l->debug("Successfully stored oncall/aod data in the cache");
	}
}

print json_encode($personnel_data);







