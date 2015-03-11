<?php

# fetches the alerts from Icinga
# fixme: test with Nagios and Thruk

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");

function get_status_data_icinga() {
	global $config;

	$l = get_logger("dashboard");

	$statuses = Array();
	$temp_store = Array();
	$metadata = Array();
	foreach ($config["status"]["icinga"]["status_url"] as $type => $url) {
		$l->debug("Getting " . $type . " status data from the icinga URL...");
		$username = null;
		$password = null;
		if ((array_key_exists("username", $config["status"]["icinga"]) && (array_key_exists("password", $config["status"]["icinga"])))) {
			$username = $config["status"]["icinga"]["username"];
			$password = $config["status"]["icinga"]["password"];
		}
		$data_icinga = get_data($config["status"]["icinga"]["status_url"][$type], $username, $password);
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
		if (array_key_exists($type . "_status", $content["status"])) {
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

				# push all elements in a temporary array that will allow sorting
				$element = Array();
				$element["host"] = $host;
				if ($type == "service") {
					$element["service"] = $service;
				}
				$element["status_information"] = $status_information;
				$element["status"] = $status;
				$element["priority"] = 0; # added later in fetchdata.php
				$element["duration"] = $duration;
				$element["duration_seconds"] = $duration_seconds;
				$element["type"] = $type;
				$element["alert_active"] = false; # added later in fetchdata.php
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
	}

	foreach ($temp_store as $k) {
		#$l->debug("Doing with index $index");
		#print_r($k);
		if ($k["type"] == "service") {
			$md5id = md5($k["host"] . "!" . $k["service"]);
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
		$statuses["status"][$md5id]["type"] = $k["type"];
		$statuses["status"][$md5id]["alert_active"] = $k["alert_active"];
		$statuses["status"][$md5id]["is_flapping"] = $k["is_flapping"];
		$statuses["status"][$md5id]["is_soft"] = $k["is_soft"];

	}
 
    $statuses["metadata"] = $metadata;

	return $statuses;

}
