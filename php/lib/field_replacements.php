<?php

# initialize logger
$l = get_logger("dashboard");

# do replacement operations based on patterns on different fields of the status data
function do_field_replacements(&$statuses, $patterns) {
	global $l;
	$available_fields = Array("host", "service", "status_information", "type");
	foreach ($patterns as $index => $pattern_obj) {
		if (!in_array($pattern_obj["field"], $available_fields)) {
			$l->warn("Required replacement field " . $pattern_obj["field"] . " is not among the allowed ones, ignoring");
			continue;
		}
		# go through the statuses array, and do the replacements
		foreach($statuses["status"] as $md5id => &$status_data) {
			$matches = Array();
			$matches_tmp = Array();
			if (preg_match($pattern_obj["pattern"], $status_data[$pattern_obj["field"]], $matches_tmp)) {
				$matches = array_merge_recursive($matches, $matches_tmp);
				# check if there are additional fields to check/match
				if (array_key_exists("additional_patterns", $pattern_obj)) {
					foreach ($pattern_obj["additional_patterns"] as $index_additional => $pattern_obj_additional) {
						# check if the field is allowed
						if (!in_array($pattern_obj_additional["field"], $available_fields)) {
							$l->warn("Required additional search field " . $pattern_obj_additional["field"] . " is not among the allowed ones, ignoring");
							continue;
						}
						# do only matching here to fill $matches with possible values
						preg_match($pattern_obj_additional["pattern"], $status_data[$pattern_obj_additional["field"]], $matches_tmp);
						$matches = array_merge_recursive($matches, $matches_tmp);

					}
				}
				# first construct the replacement string by filling the placeholders
				$replace_placeholders = Array();
				$match_patterns = Array();
				$all_found = true;
				$replacement_string = $pattern_obj["replacement"];
				if (preg_match_all("/%(?P<placeholder>[^%]+)%/", $pattern_obj["replacement"], $match_patterns)) {
					foreach ($match_patterns['placeholder'] as $match_pattern_key => $match_pattern_value) {
						if (!array_key_exists($match_pattern_value, $matches)) {
							$all_found = false;
							$l->warn("Required placeholder '%$match_pattern_value%' has no value after pattern matching, ignoring");
							break;
						}
						$replacement_string = preg_replace("/(%$match_pattern_value%)+/", $matches[$match_pattern_value], $replacement_string);
					}
				}
				if ($all_found === false) {
					continue;
				}
				# do the replacement for the field
				$status_data[$pattern_obj["field"]] = preg_replace($pattern_obj["pattern"], $replacement_string, $status_data[$pattern_obj["field"]]);
			}
		}
	}
	return $statuses;
}
