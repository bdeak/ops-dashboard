<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");
require_once(dirname(__FILE__)."/sort_order_status.php");


# implement the sorting method
function cmp_priority_status_name ($a, $b) {
	global $config, $sort_order_status;
	if ($a["type"] == $b["type"]) {
		if ($a["priority"] == $b["priority"]) {
			# prios are the same, sort by state
			if ($a["status"] == $b["status"]) {
				# statuses are the same, sort by name
				if (array_key_exists("service", $a)) {
					# these are services, sort on their service names
					return strcmp($a["service"], $b["service"]);
				} else {
					# these are hosts, sort on the hostnames
					return strcmp($a["host"], $b["host"]);
				}
			} else {
				# sort by status
				return $sort_order_status[$a["status"]] - $sort_order_status[$b["status"]];
			}
		} else {
			# sort by prio
			if ($config["sort_priority_asc"]) {
				return $a["priority"] - $b["priority"];
			} else {
				return $b["priority"] - $a["priority"];
			}
		}
	} else {
		# hosts first
		if ($a["type"] == "host") {
			return -1;
		} else {
			return +1;
		}
	}
	return 1;
}