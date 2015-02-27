<?php

# fetches the alerts from Icinga
# fixme: test with Nagios and Thruk

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

if ($config["cache_ttl_status"] == 0) {
	$l->info("Clearing cache as 'cache_ttl_status' is set to 0");
	apc_clear_cache("user");
}

# get the priority information, if an external source is needed (servicegroup membership for example)
if ($config["priority_lookup_enabled"] === true && $config["priority_lookup_method"] != "namebased") {
	# check if the data is already in the APC cache
	$priorities = apc_fetch(get_apc_hash_key("priorities"));
	if ($priorities !== false) {
		# found it in the cache
		$l->info("Found the priorities data in the cache");
	} else {
		$lookup_method = $config["priority_lookup_method"];
		$lookup_func = sprintf("get_priority_data_%s", $lookup_method);
		# check if the given function exists
		if (! function_exists($lookup_func)) {
			handle_error("Lookup function '$lookup_func' is not defined for lookup method '$lookup_method'!");
		}
		$priorities = call_user_func("$lookup_func");
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
$states = null;
if ($config["alert_lookup_enabled"] === true) {
	$lookup_method = $config["alert_lookup_method"];
	$lookup_func = sprintf("get_alert_data_%s", $lookup_method);
	# check if the given function exists
	if (! function_exists($lookup_func)) {
		handle_error("Lookup function '$lookup_func' is not defined for lookup method '$lookup_method'!");
	}

	# get the state information from the sqlite database
	$l->info("Getting the alert history using lookup method '$lookup_method'");
	$states = apc_fetch(get_apc_hash_key("alert_history"));
	if ($states !== false) {
		# found in cache
		$l->info("Found the alert history information in the cache");
	} else {
		$states = call_user_func("$lookup_func");
		# check again to see if it hasn't been put there by another process
		$result = apc_delete(get_apc_hash_key("alert_history"));
		if ($result === true) {
			$l->info("Deleted cache entry for 'states'");
		}
		$result = apc_add(get_apc_hash_key("alert_history"), $states, $config["cache_ttl_status"]);
		if ($result === true) {
			$l->warn("Successfully stored alert history information in the cache");
		} else {
			$l->warn("Failed to store alert history information in the cache, most likely it was stored by another process");
		}
	}
}

# get the status information
$l->info("Getting the status information...");
$statuses = apc_fetch(get_apc_hash_key("status"));
if ($statuses !== false) {
	# found in cache
	$l->info("Found the status information in the cache");
} else {
	# didn't find in the cache, need to download again
	$statuses = Array();
	$temp_store = Array();
	$metadata = Array();
	foreach (array("service", "host") as $type) {
		# failed to retrieve from cache, get it from the URL
		$l->debug("Getting " . $type . " status data from the icinga URL...");
		$username = null;
		$password = null;
		if ((array_key_exists("icinga_username", $config) && (array_key_exists("icinga_password", $config)))) {
			$username = $config["icinga_username"];
			$password = $config["icinga_password"];
		}
		$data_icinga = get_data($config[$type . "_status_url"], $username, $password);
		if ($data_icinga["success"] === false) {
			// handle error
			handle_error("Failed to fetch data from icinga: " . $data_icinga["data"]);
		} else {
			$content = json_decode($data_icinga["data"], true);
		}
		if (!is_array($content)) {
			handle_error("Returned content is not in JSON format");
		}
		$l->debug($type . " status information was downloaded successfully");
		# get status information, and put it into $priorities["service"]

		# check if there's a 'status' key in the response, if not, there is a problem with icinga
		if (! array_key_exists("status", $content)) {
			handle_error("Data returned from icinga is incomplete");
		}

		# store meta information that comes from icinga
		foreach (Array("status_data_age", "status_update_interval", "reading_status_data_ok") as $key) {
			if (!(array_key_exists($key, $metadata))) {
				$metadata[$key] = $content["icinga_status"][$key];
			}
		}

		# status_data_age
		# status_update_interval
		# reading_status_data_ok
		# program_version
		# program_start / total_running_time
		# last_external_command_check
		# notifications_enabled

		foreach ($content["status"][$type . "_status"] as $key => $value) {
			$host = $value["host_name"];
			if ($type == "service") {
				$service = $value["service_description"];
			}
			$status_information = $value["status_information"];
			$status = $value["status"];
			# cut the metrics that have 0 in them
			$duration = preg_replace("/^(0[wdhms]\s+)+/", "", $value["duration"]);
			# cut the seconds
			$duration = preg_replace("/ [0-9]{1,2}s$/", "", $duration);
			# convert the duration to seconds (for sorting)
			$duration_seconds = convert_duration_to_seconds($value["duration"]);
			if ($type == "service") {
				# get priority
				if (array_key_exists($host . "!" . $service, $priorities["service"])) {
					$priority = $priorities["service"][$host . "!" . $service];
				} else {
					$priority = 0;
				}
				
				# check open alerts
				if (($states != null) && (array_key_exists($host, $states["service"])) && (array_key_exists($service, $states["service"][$host]))) {
					$alert_active = true;
				} else {
					$alert_active = false;
				}

			} else {
				# get priority				
				if (array_key_exists($host, $priorities["host"])) {
					$priority = $priorities["host"][$host];
				} else {
					$priority = 0;
				}			
				# check open alerts
				if (($states != null) && (array_key_exists($host, $states["host"]))) {
					$alert_active = true;
				} else {
					$alert_active = false;
				}				
			}
			# store the status information

			# push all elements in a temporary array that will allow sorting based on priorities
			$element = Array();
			#$l->debug("debug: adding host $host");
			$element["host"] = $host;
			if ($type == "service") {
				$element["service"] = $service;
			}
			$element["status_information"] = $status_information;
			$element["status"] = $status;
			$element["priority"] = (int) substr($priority, -1); 
			$element["duration"] = $duration;
			$element["duration_seconds"] = $duration_seconds;
			$element["type"] = $type;
			$element["alert_active"] = $alert_active;
			$element["is_flapping"] = $value["is_flapping"];
			if ($value["state_type"] == "SOFT") {
				$element["is_soft"] = true;
			} else {
				$element["is_soft"] = false;
			}

			# store the data in a temporary array, to be sorted later
			array_push($temp_store, $element);
		}
	}

	$sort_method_func = sprintf('cmp_%s', $config["sort_method"]);
	if (! function_exists($sort_method_func)) {
		handle_error(sprintf("Function '%s' doesn't exist for sorting method '%s'!", $sort_method_func, $config["sort_method"]));
	}

	# sort the source array
	uasort($temp_store, $sort_method_func);

	# create the $statuses array, in a sorted way
	$index = 1;
	foreach ($temp_store as $k) {
		#$l->debug("Doing with index $index");
		#print_r($k);
		if ($k["type"] == "service") {
			$md5id = md5($k["host"] . ":" . $k["service"]);
		} else {
			$md5id = md5($k["host"]);
		}

		$statuses["status"][$md5id]["host"] = $k["host"];
		#$l->debug("host is ". $k['host']);
		if ($k['type'] == "service") {
			$statuses["status"][$md5id]["service"] = preg_replace("/_/", " ", $k["service"]);
		}
		$statuses["status"][$md5id]["status_information"] = $k["status_information"];
		$statuses["status"][$md5id]["status"] = $k["status"];
		$statuses["status"][$md5id]["priority"] = $k["priority"];
		$statuses["status"][$md5id]["duration"] = $k["duration"];
		$statuses["status"][$md5id]["duration_seconds"] = $k["duration_seconds"];	
		$statuses["status"][$md5id]["md5id"] = $md5id;
		$statuses["status"][$md5id]["index"] = $index;
		$statuses["status"][$md5id]["type"] = $k["type"];
		$statuses["status"][$md5id]["alert_active"] = $k["alert_active"];
		$statuses["status"][$md5id]["is_flapping"] = $k["is_flapping"];
		$statuses["status"][$md5id]["is_soft"] = $k["is_soft"];

		$index += 1;
	}
	$statuses["metadata"] = $metadata;
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

if ($config["show_last_ok"]) {
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}
	# get the last status from the sqlite database
	$last_state = get_last_state();
	if (!array_key_exists("state", $last_state)) {
		# first run, initialize with the current state
		if (count($statuses) == 0) {
			write_last_status("OK");
		} else {
			write_last_status("PROBLEM");
		}
	}
	if (count($statuses) == 0) {
		if ($last_state["state"] != "OK") {
			# we went to ok state, write this information
			write_last_status("OK");
		}
	} else {
		if ($last_state["state"] == "OK") {
			$host_count = 0;
			$warn_count = 0;
			$crit_count = 0;
			# get the host/service critical/service warning numbers
			foreach ($statuses as $key => $value) {
				if ($statuses[$key]['type'] == "host") {
					$host_count++;
				}
				if ($statuses[$key]['type'] == "service") {
					if ($statuses[$key]['status'] == "CRITICAL") {
						$crit_count++;
					} elseif ($statuses[$key]['status'] == "WARNING") {
						$warn_count++;
					}
				}
			}
			# we went from ok to problem, write this information
			write_last_status("PROBLEM", $host_count, $crit_count, $warn_count);
		}
	}
}

# output data as json
print json_encode($statuses);

