<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");

# get_priority_data_<lookup_method>()
# get the priority data for services and hosts based on icinga service- and hostgroup membership

# result -> array():
# $priorities["service"]["host1!service1"] = "priority1"
# $priorities["host"]["host1"] = "priority2"

function get_priority_data_icinga_group_membership ($statuses) {
	global $config, $l;

	$l = get_logger("dashboard");
	
	$priorities = Array();
	# Get the service/hostgroup information
	foreach ($config["status"]["icinga"]["status_url"] as $type => $url) {
		if (array_key_exists($type, $config["priority_lookup"]["data_url"])) {
			$l->info("Getting the " . $type . "group information...");
			# failed to retrieve, get it from the URL
			$l->info($type . "group data doesn't exist in the cache, getting it from the icinga URL...");
			$data_icinga = get_data($config["priority_lookup"]["data_url"][$type] , $config["status"]["icinga"]["username"], $config["status"]["icinga"]["password"]);
			if ($data_icinga["success"] === false) {
				// handle error
				handle_error("Failed to fetch priority data from icinga: " . $data_icinga["data"]);
			} else {
				$content = json_decode($data_icinga["data"], true);
			}
			$content = json_decode($data_icinga["data"], true);
			if (!is_array($content)) {
				handle_error("Returned content is not in JSON format");
			}
			$l->info($type . "group data was downloaded successfully");
			# get servicegroup information, and put it into $priorities["service"]
			foreach($content["config"][$type . "groups"] as $key => $value) {
				# ignore groups that doesn't match 'priorityX'
				$group_name = strtolower($value["group_name"]);
				# get the pattern and replacement strings from the configuration
				$pattern = $config["priority_lookup"]["patterns"][0]["pattern"];
				if (array_key_exists("replacement", $config["priority_lookup"]["patterns"][0]) && isset($config["priority_lookup"]["patterns"][0]["replacement"])) {
						$replacement = $config["priority_lookup"]["patterns"][0]["replacement"];
				} else {
					$replacement = '$1';
				}

				if (!preg_match($pattern, $group_name)) {
					continue;
				}
				foreach ($value[$type . "group_members"] as $e) {
					if ($type == "service") {
						# servicegroup
						$host = $e["host_name"];
						$service = $e["service_description"];
						$priorities["service"][$host . "!" . $service] = (int) preg_replace($pattern, $replacement, $group_name);
					} else {
						# hostgroup
						$host = $e;
						$priorities["host"][$host] = (int) preg_replace($pattern, $replacement, $group_name);
					}
				}
			}
		}
	}
	return $priorities;
}