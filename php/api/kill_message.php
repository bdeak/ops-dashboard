<?php

require_once (dirname(__FILE__)."/../lib/sqlite.php");
require_once (dirname(__FILE__)."/../lib/common.php");
require_once(dirname(__FILE__)."/../../config/config.php");

foreach (glob(dirname(__FILE__)."/../lib/usermsg_lookup/*.php") as $filename) {
    require_once $filename;
}

if ($config["user_msg"]["enabled"] !== true) {
	handle_error("User message support is disabled in the configuration", "array");
}

$l = get_logger("dashboard");
header('Content-type: application/json');

$id = $_GET["id"];

if (!(preg_match("/^[0-9]+$/", $id))) {
	handle_error("id must be a number!", "array");
}

# get the data using the lookup function
$lookup_method = $config["user_msg"]["lookup_method"];
$lookup_func = sprintf("usermsg_kill_message_%s", $lookup_method);

# check if the given function exists
if (! function_exists($lookup_func)) {
	handle_error("Lookup function '$lookup_func' is not defined for lookup method '$lookup_method'!", "array");
}

$l->info("Killing user message with id '" . $id . "'");
try {
	$found = call_user_func("$lookup_func", $id);
} catch (Exception $e) {
	handle_error("Can't kill message: " . $e->getMessage(), "array");
}

# invalidate the apc_cache_info()
apc_delete(get_apc_hash_key("user_messages"));

$message = sprintf("Killed message '%s' sent by '%s'", $found["message"], $found["sender"]);
print json_encode(Array("OK", $message)) . "\n";
