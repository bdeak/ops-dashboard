<?php
require_once (dirname(__FILE__)."/../lib/sqlite.php");
require_once (dirname(__FILE__)."/../lib/common.php");
require_once(dirname(__FILE__)."/../../config/config.php");

foreach (glob(dirname(__FILE__)."/../lib/usermsg_lookup/*.php") as $filename) {
    require_once $filename;
}

if ($config["user_msg"]["enabled"] !== true) {
	handle_error("User message support is disabled in the configuration");
}

$l = get_logger("dashboard");
header('Content-type: application/json');

$l->info("Getting the messages from the database");
$user_messages = apc_fetch(get_apc_hash_key("user_messages"));

if ($user_messages !== false) {
	# found it in the cache
	$l->info("Found the user_messages data in the cache");
} else {
	$l->info(sprintf("user_messages data not found in the cache, getting it from %s", $config["dashboard_db"]));

	# get the data using the lookup function
	$lookup_method = $config["user_msg"]["lookup_method"];
	$lookup_func = sprintf("get_usermsg_data_%s", $lookup_method);
	# check if the given function exists
	if (! function_exists($lookup_func)) {
		handle_error("Lookup function '$lookup_func' is not defined for lookup method '$lookup_method'!");
	}

	$user_messages = call_user_func("$lookup_func");

	$result = apc_delete(get_apc_hash_key("user_messages"));
	if ($result === true) {
		$l->info("Deleted cache entry for 'user_messages'");
	}	
	$result = apc_add(get_apc_hash_key("user_messages"), $user_messages, $config["cache_ttl_usermsg"]);
	if ($result === true) {
		$l->debug("Successfully stored user_messages data in the cache");
	}
}

print json_encode($user_messages) . "\n";
