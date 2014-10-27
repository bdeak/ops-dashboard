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

$type = strtolower($_GET["type"]);
$username = strtolower($_GET["username"]);

if (!preg_match("/^[a-z]+$/", $username)) {
	handle_error("The oncall/aod username must only contain alphabetic characters!", "array");
}
if (!preg_match("/^(oncall|aod)$/", $type)) {
	handle_error("The provided type is unknown", "array");
}

if ($config[$type . "_lookup_enabled"] !== true) {
	handle_error(sprintf("Lookup for %s is disabled in the configuration", $type), $array);
}

# get the data using the lookup function
$lookup_method = $config["oncall_lookup_method"];
$lookup_func = sprintf("set_%s_%s", $type, $lookup_method);

# check if the given function exists
if (! function_exists($lookup_func)) {
	handle_error("Lookup function '$lookup_func' is not defined for lookup method '$lookup_method'!", "array");
}

try {
	call_user_func("$lookup_func", $type, $username);
} catch (Exception $e) {
	handle_error("Can't set '$type': " . $e->getMessage(), "array");
}
$l->info("Updating personnel type " . $type . " to " . "'" . $username . "'");

# clear the cache
apc_delete(get_apc_hash_key("cache_ttl_oncall"));

print json_encode(Array("OK", ""));
