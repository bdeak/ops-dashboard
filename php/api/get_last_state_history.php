<?php
require_once (dirname(__FILE__)."/../lib/sqlite.php");
require_once (dirname(__FILE__)."/../lib/common.php");
require_once(dirname(__FILE__)."/../../config/config.php");

function inflate_and_group_state_data($days, $grouping_name) {
	global $config, $l, $lookup;

	$l->info(sprintf("Getting the state history for %d days using grouping '%s'", $days, $grouping_name));

	switch ($grouping_name) {
		case 'day':
			$grouping = 1;
			break;
		case 'week':
			$grouping = 7;
			break;
		case 'month':
			$grouping = 30; # yeah...
			break;
		default:
			handle_error("Undefined grouping parameter: " . $grouping_name);
			break;
	}
	
	$range = Array();
	$history = Array();
	# determine how many intervals (iterations) we have
	$intervals = round($days / $grouping);
	# get the starting timestamp of the first interval
	$range_start = strtotime("0:00", strtotime(sprintf("-%s days", $days)));
	for ($i = 1; $i <= $intervals; $i++) {
		# define the start and the end of the intervals
		$history[$i]["grouping"] = $grouping_name;
		$history[$i]["range_start"] = $range_start;
		$history[$i]["range_end"] = $range_start + $grouping * 60 * 60 * 24;
		$history[$i]["range_start_human"] = date('jS F Y h:i:s A (T)', $history[$i]["range_start"]);
		$history[$i]["range_end_human"] = date('jS F Y h:i:s A (T)', $history[$i]["range_end"]);
		switch ($grouping) {
			case 1:
				# use short day name
				$history[$i]["range_name"] = date("D", $range_start + 1);
				$history[$i]["range_name_long"] = strftime("%Y.%m.%d, %A", $range_start + 1);
				break;
			case 7:
				# use calendar week (CW)
				$history[$i]["range_name"] = sprintf("CW%d", date("W", $range_start + 1));
				$history[$i]["range_name_long"] = $history[$i]["range_name"];
				break;
			case 30:
				# use month name
				$history[$i]["range_name"] = date("M", $range_start + 1);
				$history[$i]["range_name_long"] = strftime("%Y.%m, %B", $range_start + 1);
				break;
			default:
				handle_error("Undefined grouping parameter: " . $grouping);
				break;

		}
		# set the start of the range to the end of this one for the next iteration
		$range_start = $history[$i]["range_end"];
		# get the current state at the beginning and the end of the range, as most likely there won't be
		# datapoints in that given timestamp
		$state_beginning_full = get_last_state($history[$i]["range_start"]);
		$state_end_full = get_last_state($history[$i]["range_end"]);
		$state_beginning = $state_beginning_full["state"];
		$state_end = $state_end_full["state"];
		# get all measurements for the given range
		$states = get_last_state_history($history[$i]["range_start"], $history[$i]["range_end"]);
		$history[$i]["duration_sec"]["OK"] = 0;
		$history[$i]["duration_sec"]["PROBLEM"] = 0;
		# shift in values for the range start and end
		array_unshift($states, Array("timestamp" => (int) $history[$i]["range_start"], "state" => $state_beginning));
		array_push($states, Array("timestamp" => (int) $history[$i]["range_end"], "state" => $state_end));
		# for all measurements, count the duration for both ok and problem states, and accumulate the result
		for ($index = 0 ; $index < count($states) - 1 ; $index++) {
			$state = $states[$index]["state"];
			$timestamp = $states[$index]["timestamp"];
			$timestamp_next = $states[$index + 1]["timestamp"];
			$history[$i]["duration_sec"][$state] += $timestamp_next - $timestamp;
		}
	}
	# inflate the history array with human readable durations
	foreach ($history as $interval => $value) {
		$history[$interval]["duration_human"]["OK"] = convert_seconds_to_duration($history[$interval]["duration_sec"]["OK"]);
		$history[$interval]["duration_human"]["PROBLEM"] = convert_seconds_to_duration($history[$interval]["duration_sec"]["PROBLEM"]);
		$history[$interval]["duration_percent"]["OK"] = convert_seconds_to_percentage($history[$interval]["duration_sec"]["OK"], $grouping);
		$history[$interval]["duration_percent"]["PROBLEM"] = convert_seconds_to_percentage($history[$interval]["duration_sec"]["PROBLEM"], $grouping);		
		#$history[$interval]["duration_hour"]["OK"] = convert_seconds_to_hours($history[$interval]["duration_sec"]["OK"]);
		#$history[$interval]["duration_hour"]["PROBLEM"] = convert_seconds_to_hours($history[$interval]["duration_sec"]["PROBLEM"]);
	}

	return $history;
}


$l = get_logger("dashboard");
header('Content-type: application/json');

$days = (isset($_GET["days"]) ? (int) $_GET["days"] : 7);
$grouping = (isset($_GET["grouping"]) ? strtolower($_GET["grouping"]) : "day");

if (!is_numeric($days)) {
	handle_error("The day parameter must be a number!");
} else {
	$days = (int) $days;
}

if (!preg_match("/^(week|month|day)$/", $grouping)) {
	handle_error("The period parameter must be either 'day', week' or 'month'");
}

$l->info("Getting the last ok history information");
$last_ok_history = apc_fetch(get_apc_hash_key("last_ok_history"));

if ($last_ok_history !== false) {
	# found it in the cache
	$l->info("Found the last_ok_history data in the cache");
} else {
	$l->info(sprintf("last_ok_history data not found in the cache, getting it from %s", $config["dashboard_db"]));

	# need to group the results based on $grouping
	$last_ok_history = inflate_and_group_state_data($days, $grouping);

	$result = apc_delete(get_apc_hash_key("last_ok_history"));
	if ($result === true) {
		$l->info("Deleted cache entry for 'last_ok_history'");
	}	
	$result = apc_add(get_apc_hash_key("last_ok_history"), $last_ok_history, $config["cache_ttl_status"]);
	if ($result === true) {
		$l->debug("Successfully stored last_ok_history data in the cache");
	}
}

print json_encode($last_ok_history);