<?php
require_once (dirname(__FILE__)."/../lib/sqlite.php");
require_once (dirname(__FILE__)."/../lib/common.php");
require_once(dirname(__FILE__)."/../../config/config.php");

$l = get_logger("dashboard");
header('Content-type: application/json');

$l->info("Getting the last ok state information");
$last_ok = apc_fetch(get_apc_hash_key("last_ok"));

if ($last_ok !== false) {
	# found it in the cache
	$l->info("Found the last_ok data in the cache");
} else {
	$l->info(sprintf("last_ok data not found in the cache, getting it from %s", $config["dashboard_db"]));

	$last_ok = get_last_state_duration();

	$result = apc_delete(get_apc_hash_key("last_ok"));
	if ($result === true) {
		$l->info("Deleted cache entry for 'last_ok'");
	}	
	$result = apc_add(get_apc_hash_key("last_ok"), $last_ok, $config["cache_ttl_status"]);
	if ($result === true) {
		$l->debug("Successfully stored last_ok data in the cache");
	}
}

print json_encode($last_ok);