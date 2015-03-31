<?php

require_once(dirname(__FILE__).'/../lib/common.php');
require_once(dirname(__FILE__)."/../../config/config.php");

# require all alert_lookup functions
foreach (glob(dirname(__FILE__)."/../lib/alert_lookup/*.php") as $filename)
{
    require_once $filename;
}

foreach (glob(dirname(__FILE__)."/../lib/priority_lookup/*.php") as $filename)
{
    require_once $filename;
}

foreach (glob(dirname(__FILE__)."/../lib/backends/*.php") as $filename)
{
    require_once $filename;
}

# require all sort methods
foreach (glob(dirname(__FILE__)."/../lib/sort_methods/*.php") as $filename)
{
    require_once $filename;
}

header('Content-type: application/json');

###########################################################
# Don't touch below this
########################################################### 
$priorities = Array();

############################ MAIN ##########################

# initialize logger
$l = get_logger("dashboard");

# get the alert information, using the defined backend type
$statuses = null;
$lookup_method = $config["status"]["backend_type"];
$lookup_func = sprintf("get_status_data_%s", $lookup_method);
# check if the given function exists
if (! function_exists($lookup_func)) {
	handle_error("Lookup function '$lookup_func' is not defined for status lookup method '$lookup_method'!");
}

# get the state information from the sqlite database
$l->info("Getting the status data using lookup method '$lookup_method'");
$statuses = apc_fetch(get_apc_hash_key("status"));
if ($statuses !== false) {
	# found in cache
	$l->info("Found the alert history information in the cache");
} else {
	$statuses = call_user_func("$lookup_func");
	# check again to see if it hasn't been put there by another process
	$result = apc_delete(get_apc_hash_key("status"));
	if ($result === true) {
		$l->info("Deleted cache entry for 'status'");
	}
	$result = apc_add(get_apc_hash_key("status"), $statuses, $config["cache_ttl_status"]);
	if ($result === true) {
		$l->warn("Successfully stored status information in the cache");
	} else {
		$l->warn("Failed to store status information in the cache, most likely it was stored by another process");
	}
}

# get the priority information, if an external source is needed (servicegroup membership for example)
if ($config["priority_lookup"]["enabled"] === true) {
	# check if the data is already in the APC cache
	$priorities = apc_fetch(get_apc_hash_key("priorities"));
	if ($priorities !== false) {
		# found it in the cache
		$l->info("Found the priorities data in the cache");
	} else {
		$lookup_method = $config["priority_lookup"]["method"];
		$lookup_func = sprintf("get_priority_data_%s", $lookup_method);
		# check if the given function exists
		if (! function_exists($lookup_func)) {
			handle_error("Lookup function '$lookup_func' is not defined for lookup method '$lookup_method'!");
		}
		$priorities = call_user_func_array("$lookup_func", Array(&$statuses));
		$result = apc_delete(get_apc_hash_key("priorities"));
		if ($result === true) {
			$l->debug("Deleted cache entry for 'priorities'");
		}	
		$result = apc_add(get_apc_hash_key("priorities"), $priorities, $config["cache_ttl_priorities"]);
		if ($result === true) {
			$l->debug("Successfully stored priorities data in the cache");
		}
	}
}

# get the alert information, (if enabled) using the defined lookup method
$alert_history = null;
if ($config["alert_lookup_enabled"] === true) {
	$lookup_method = $config["alert_lookup_method"];
	$lookup_func = sprintf("get_alert_data_%s", $lookup_method);
	# check if the given function exists
	if (! function_exists($lookup_func)) {
		handle_error("Lookup function '$lookup_func' is not defined for lookup method '$lookup_method'!");
	}

	# get the state information from the sqlite database
	$l->info("Getting the alert history using lookup method '$lookup_method'");
	$alert_history = apc_fetch(get_apc_hash_key("alert_history"));
	if ($alert_history !== false) {
		# found in cache
		$l->info("Found the alert history information in the cache");
	} else {
		$alert_history = call_user_func("$lookup_func");
		# check again to see if it hasn't been put there by another process
		$result = apc_delete(get_apc_hash_key("alert_history"));
		if ($result === true) {
			$l->info("Deleted cache entry for 'alert_history'");
		}
		$result = apc_add(get_apc_hash_key("alert_history"), $alert_history, $config["cache_ttl_status"]);
		if ($result === true) {
			$l->warn("Successfully stored alert history information in the cache");
		} else {
			$l->warn("Failed to store alert history information in the cache, most likely it was stored by another process");
		}
	}
}

# add the alert history and priorities information into the statuses array
if ($priorities !== null) {
	foreach ($priorities as $type => $value) {
		foreach ($priorities[$type] as $key => $value) {
			if (array_key_exists(md5($key), $statuses["status"])) {
				$statuses["status"][md5($key)]["priority"] = $value;
			}
		}
	}
}

if ($alert_history !== null) {
	foreach ($alert_history as $type => $value) {
		foreach ($alert_history[$type] as $key => $value) {
			if (array_key_exists(md5($key), $statuses["status"])) {
				$statuses["status"][md5($key)]["alert_active"] = ($value == 1 ? true : false);
			}
		}
	}
}

# sort the statuses hash


$sort_method_func = sprintf('cmp_%s', $config["sort_method"]);
if (! function_exists($sort_method_func)) {
	handle_error(sprintf("Function '%s' doesn't exist for sorting method '%s'!", $sort_method_func, $config["sort_method"]));
}

if (!isset($statuses["status"])) {
	$statuses["status"] = Array();	
}

uasort($statuses["status"], $sort_method_func);

# go through the array and fill the index values
$index = 1;
foreach ($statuses["status"] as $md5 => $subhash) {
	$statuses["status"][$md5]["index"] = $index;
	$index++;
}

if ($config["last_ok"]["enabled"]) {
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}
	# get the last status from the sqlite database
	$last_state = get_last_state();
	if (count($statuses["status"]) == 0) {
		if ($last_state["state"] != "OK") { 
			write_last_status("OK"); 
		}
	} else {
		# there is an old state, and a new state also
		$host_count = 0;
		$warn_count = 0;
		$crit_count = 0;
		$current_state = "PROBLEM";
		foreach ($statuses["status"] as $key => $value) {
			if ($statuses["status"][$key]['type'] == "host") {
				$host_count++;
			}
			if ($statuses["status"][$key]['type'] == "service") {
				if ($statuses["status"][$key]['status'] == "CRITICAL") {
					$crit_count++;
				} elseif ($statuses["status"][$key]['status'] == "WARNING") {
					$warn_count++;
				}
			}
		}
		$l->debug($current_state . " vs " . $last_state["state"]);
		if ($current_state != $last_state["state"]) {
				write_last_status($current_state, $host_count, $crit_count, $warn_count);
				$l->info("Writing updated state: " . $current_state);
		}
	}
}

# output data as json
print json_encode($statuses);

