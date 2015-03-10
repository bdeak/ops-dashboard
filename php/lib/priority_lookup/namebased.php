<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");

# get_priority_data_<lookup_method>()
# get the priority data for services and hosts based on icinga service- and hostgroup membership

# result -> array():
# $priorities["service"]["host1!service1"] = "priority1"
# $priorities["host"]["host1"] = "priority2"

function get_priority_data_namebased (&$statuses) {
	global $config, $l;

	$l = get_logger("dashboard");
	$priorities = Array();
	foreach ($statuses["status"] as $md5 => $state_data) {
		foreach ($config["priority_lookup"]["patterns"] as $pattern_array) {
			try {
				$service = $statuses["status"][$md5]["service"];
			} 
			catch (Exception $e) {
				$service = null;
			}
			$host = $statuses["status"][$md5]["host"];
			$pattern = $pattern_array["pattern"];
			$field = $pattern_array["field"];
			$replacement = null;
			if (array_key_exists("replacement", $pattern_array) && isset($pattern_array["replacement"])) {
				$replacement = $pattern_array["replacement"];
			} else {
				$replacement = '$1';
			}

			if (!preg_match($pattern, $state_data[$field])) {
				continue;
			} else {
				if ($service !== null) {
					$priorities["service"][$host . "!" . $service] = (int) preg_replace($pattern, $replacement, $state_data[$field]);
				} else {
					$priorities["host"][$host] = (int) preg_replace($pattern, $replacement, $state_data[$field]);
				}
				if ($config["priority_lookup"]["cleanup_state_data"] === true) {
					$statuses["status"][$md5][$field] = preg_replace($pattern, "", $state_data[$field]);
				}
			}
		}
	}
	return $priorities;
}