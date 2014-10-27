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

$data_raw = file_get_contents('php://input');
$data = json_decode($data_raw, true);

#$data = json_decode(file_get_contents('php://input'));
if ($data === null) {
	handle_error("Invalid data received, can't parse JSON", "array");
}
if (!(array_key_exists("msg", $data)) || (!(array_key_exists("sender", $data)))) {
	handle_error("Please provide both 'msg' and 'sender' fields.", "array");
}

if (!preg_match("/^[a-zA-Z0-9_.-]+$/", $data["sender"])) {
	handle_error("The sender may only contain alphanumeric characters plus '_' '.' '-'.", "array");
}

# look up sender
if (array_key_exists($data['sender'], $config["users"])) {
	$sender = $config["users"][$data['sender']];
} else {
	$sender = $data["sender"];
}

$ttl = $config["user_msg"]["default_ttl"];
if (array_key_exists("ttl", $data)) {
	if (preg_match("/^[0-9]+[wdhms]?$/", $data["ttl"])) {
		$ttl = convert_duration_to_seconds($data["ttl"]);
	} else {
		$l->warn("Ignoring corrupt ttl value '$ttl'");
	}
}

$l->info("Received user message '" . $data["msg"] . "' from sender '" . $sender . "'");

# get the data using the lookup function
$lookup_method = $config["user_msg"]["lookup_method"];
$lookup_func = sprintf("usermsg_add_message_%s", $lookup_method);

# check if the given function exists
if (! function_exists($lookup_func)) {
	handle_error("Lookup function '$lookup_func' is not defined for lookup method '$lookup_method'!", "array");
}
try {
	$added_id = call_user_func("$lookup_func", $data["msg"], $sender, $ttl);
} catch (Exception $e) {
	handle_error("Failed to add user message: " . $e->getMessage(), "array");
}

# invalidate the apc_cache_info()
apc_delete(get_apc_hash_key("user_messages"));

$l->info(sprintf("Added user message '%s' from sender '%s' with id '%s'", $data["msg"], $sender, $added_id));

print json_encode(Array("OK", sprintf("Added message with id '%s'", $added_id))) . "\n";
