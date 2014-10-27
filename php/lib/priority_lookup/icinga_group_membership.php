<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");

# get_priority_data_<lookup_method>()
# get the priority data for services and hosts based on icinga service- and hostgroup membership

function get_priority_data_icinga_group_membership () {
	global $config, $l;

	$l = get_logger("dashboard");
	
	$groups = Array();
	# Get the service/hostgroup information
	foreach (Array("service", "host") as $type) {
		$l->info("Getting the " . $type . "group information...");
		# failed to retrieve, get it from the URL
		$l->info($type . "group data doesn't exist in the cache, getting it from the icinga URL...");
		$data_icinga = get_data($config[$type . "group_url"], $config["icinga_username"], $config["icinga_password"]);
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
		# get servicegroup information, and put it into $groups["service"]
		foreach($content["config"][$type . "groups"] as $key => $value) {
			# ignore groups that doesn't match 'priorityX'
			$group_name = strtolower($value["group_name"]);
			if (!preg_match("/^priority[1-5]/", $group_name)) {
				continue;
			}
			foreach ($value[$type . "group_members"] as $e) {
				if ($type == "service") {
					# servicegroup
					$host = $e["host_name"];
					$service = $e["service_description"];
					$groups["service"][$host . "!" . $service] = $group_name;
				} else {
					# hostgroup
					$host = $e;
					$groups["host"][$host] = $group_name;
				}
			}
		}
	}
	return $groups;
}