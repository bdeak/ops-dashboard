<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sort_methods/sort_order_status.php");

function do_grouping_same_service_name(&$statuses) {
	global $config, $l, $tmp_direction;

	$l = get_logger("dashboard");

    # rough tasks
	# build a temporary hash with the service names
	# find the ones that have 1+ entry
	# use the md5hash of the entries based on 'group!$service'
	# build the new hash
	# return the new hash

    $statuses_result = Array();
    $statuses_grouping = Array();
    foreach ($statuses["status"] as $md5 => $state_data) {
        if ($statuses["status"][$md5]["type"] != "service") {
            continue;
        }
        $service = $statuses["status"][$md5]["service"];
        if (!array_key_exists($service, $statuses_grouping)) {
            $statuses_grouping[$service] = Array();
        }
        # gather all the md5s of the services that needs to be grouped under the same service name
        array_push($statuses_grouping[$service], $md5);
	}

    # delete the the original statuses
    $statuses_result = $statuses;
    $statuses_result["status"] = Array();

    # go through the $statuses_grouping array, and create a new $statuses array based on it
    foreach ($statuses_grouping as $service => $group) {
        if (count($group) > 1) {
            # get new md5
            $md5_grouped = md5("group!" . $service);

            $host = $config["grouping"]["service"]["group_hostname"]["default"];
            # determine the common hostnames, find a common pattern
            if ($config["grouping"]["service"]["group_hostname"]["enabled"] === true) {
                $tolerance = $config["grouping"]["service"]["group_hostname"]["tolerance"] / 100;
                $host = get_common_hostnames($statuses, $group, $tolerance);
            }
            # if one is critical, this is critical
            $status = get_common_status($statuses, $group);
            # get the duration
            $duration_seconds = get_common_value($statuses, $group, "duration", $config["grouping"]["duration"]["show_newest"]);
            $duration = convert_seconds_to_duration($duration_seconds);
            # flapping? if one flapping, this is flapping
            $is_flapping = get_common_value($statuses, $group, "is_flapping", false);
            # alert_active? if one is active, this is active
            $alert_active = get_common_value($statuses, $group, "alert_active", false);
            # soft? only if all of them are soft
            $is_soft = get_common_value($statuses, $group, "is_soft", true);
            # get the oldest duration
            # get the common priority
            $priority = get_common_value($statuses, $group, "priority", $config["sort_priority_asc"]);

            # put all of them into an array so it can be displayed later
            
            $statuses_result["status"][$md5_grouped]["host"] = $host;
            $statuses_result["status"][$md5_grouped]["service"] = $service;
            $statuses_result["status"][$md5_grouped]["status_information"] = "N/A";
            $statuses_result["status"][$md5_grouped]["status"] = $status;
            $statuses_result["status"][$md5_grouped]["priority"] = $priority;
            $statuses_result["status"][$md5_grouped]["duration"] = $duration;
            $statuses_result["status"][$md5_grouped]["duration_seconds"] = $duration_seconds;
            $statuses_result["status"][$md5_grouped]["md5id"] = $md5_grouped;
            $statuses_result["status"][$md5_grouped]["type"] = "service";
            $statuses_result["status"][$md5_grouped]["alert_active"] = $alert_active;
            $statuses_result["status"][$md5_grouped]["is_flapping"] = $is_flapping;
            $statuses_result["status"][$md5_grouped]["is_soft"] = $is_soft;
            $statuses_result["status"][$md5_grouped]["is_grouped"] = true;
            $statuses_result["status"][$md5_grouped]["group_size"] = count($group);
            # get the entries for this group
            $entries = get_elements_by_key($statuses["status"], $group);
            $statuses_result["status"][$md5_grouped]["group_subnodes"] = $entries;

        } else {
            # use the original md5
            $statuses_result["status"][$group[0]] = $statuses["status"][$group[0]];
        }
    }
    return $statuses_result;
}

function get_common_status($statuses, $group) {
    $entries = Array();
    $entries = get_elements_by_key($statuses["status"], $group);
    # sort the entries array on "status"
    uasort($entries, "cmp_status");
    # final status is the status of the first element
    foreach ($entries as $key => $value) {
        return $entries[$key]["status"];
    }
}

function get_common_value($statuses, $group, $flag, $ascending=true) {
    global $tmp_direction;
    $entries = Array();
    $entries = get_elements_by_key($statuses["status"], $group);
    # sort the entries array
    # use an anonymous function, as from PHP 5.3+ it allows us
    # to pass parameters to the function using the 'use' keyword
    # source: http://stackoverflow.com/questions/8230538/pass-extra-parameters-to-usort-callback
    uasort($entries, function ($a, $b) use ($flag, $ascending) {
        if ($ascending === true) {
            return $a[$flag] - $b[$flag];
        } else {
            return $b[$flag] - $a[$flag];
        }
    });

    # final status is the status of the first element
    foreach ($entries as $key => $value) {
        return $entries[$key][$flag];
    }
}

# $array: array with keys (haystack)
# $keynames: array with needles
function get_elements_by_key($array, $keynames) {
    $new_array = Array();
    foreach ($array as $key => $value) {
        foreach ($keynames as $keyname) {
            if ($key == $keyname) {
                array_push($new_array, $value);
            }
        }
    }
    return $new_array;
}


# sorting callbacks for uasort
function cmp_status($a, $b) {
    global $sort_order_status;
    if ($a["status"] == $b["status"]) {
        return 1;
    } else {
        # sort on status
        return $sort_order_status[$a["status"]] - $sort_order_status[$b["status"]];
    }
}

# get the hostname patterns that represent the hosts that are grouped into this check
function get_common_hostnames($statuses, $group, $tolerance) {
    global $l;
    # filter the elements of $statuses based on the provided list of md5s (in $group)
    $entries = Array();
    $entries = get_elements_by_key($statuses["status"], $group);

    # get the hostnames out of the entries
    $hostnames = get_hostnames($entries);
    
    # get the patterns (as a string)
    $hostname_pattern = get_hostname_patterns($hostnames, $tolerance);

    return $hostname_pattern;
}

# get the patterns
# tolerance: how much percentage of a change to allow before replacing with '*'
# limit: how many patterns to return
# the patterns that are covering the most hosts are returned first
function get_hostname_patterns($hostnames, $tolerance = 0.2, $limit = 2) {
    global $l;

    # calculate the differences between the hostnames using the levenshtein() function
    $differences = get_levenshtein_for_array($hostnames);

    # separate similar groups based on their levenshtein difference
    $hostgroups = get_similar_groups($differences);

    # get the pattern that covers the given groups
    $hostpatterns = get_hostpatterns_for_groups($hostgroups, $tolerance);

    # cut out the required elements (based on $limit), get only the 'pattern' field
    $hostpatterns_result = array_map(function($a) {
        return $a["pattern"];
    }, array_slice($hostpatterns, 0, $limit));


    # return the patterns as a string
    return implode(", ", $hostpatterns_result);

}

# convert sets of hostnames into groups, where '*' replaces the characters that are different
# example: host1 host2 host3 => pattern: host*
function get_hostpatterns_for_groups($hostgroups, $tolerance) {

    global $l;

    $hostpatterns = Array();

    # iterate on the different hostgroups
    foreach ($hostgroups as $index => $hostgroup) {

        $hostmap = Array();
        $helper = Array();
        $helper_counts = Array();

        # split each hostname to an array
        foreach ($hostgroup as $index => $host) {
            $elements = str_split($host);
            array_push($hostmap, $elements);
        }

        # get the longest of the hostnames
        $lengths = array_map('strlen', $hostgroup);
        $max_length = max($lengths);
        $host_count = count($hostgroup);

        # pre-fill the helper array
        $helper = array_fill(0, $max_length, null);
        $helper_counts = array_fill(0, $max_length, 0);

        # compute the actual tolerance
        $tolerance_actual = $host_count * $tolerance;

        # iterate on the hostmap, mark characters that are different in the $helper array
        # measure the number of differences in $helper_counts
        # helper will in the end hold each character that is the same, and all differences as '*'
        # in the end, holding the pattern itself
        for ($column = 0 ; $column < $max_length ; $column++) {
            # compare each value on the same level
            for ($row = 0 ; $row < $host_count ; $row++) {
                if (isset($hostmap[$row][$column])) {
                    $current_char = $hostmap[$row][$column];
                } else {
                    # out of bound
                    continue;
                }
                if ($helper[$column] === null) {
                    $helper[$column] = $current_char;
                } elseif ($helper[$column] == $current_char) {
                    # nothing to do
                    continue;
                } else {
                    # already occupied, change it to '*', but only if the tolerance level has been hit
                    $helper_counts[$column]++;
                    if ($helper_counts[$column] > $tolerance_actual) {
                        $helper[$column] = '*';
                    }
                }
            }
        }

        # join the elements of $helper to create the pattern
        $hostpattern = implode("", $helper);
        # replace double '*' values
        $hostpattern = preg_replace("/\*+/", "*", $hostpattern);

        # push the pattern into $hostpatterns
        array_push($hostpatterns, Array("pattern" => $hostpattern, "hostcount" => $host_count));
    }

    # sort the hostpatterns based on the numer of hosts that they represent
    usort($hostpatterns, function ($a, $b) {
            return $b["hostcount"] - $a["hostcount"];
    });

    return $hostpatterns;
}


function get_levenshtein_for_array($array) {
    $data = Array();
    # get a permutation of all elements
    foreach ($array as $index => $value) {
        foreach ($array as $index2 => $value2) {
            $data[$value][$value2] = levenshtein($value, $value2);
        }
    }
    return $data;
}

/* like min(), but casts to int and ignores 0 */
function min_not_null(Array $values) {
    return min(array_diff($values, array(0)));
}

# group similar hostnames based on their levenshtein value
# difference: how many differences (in the sense of levenshtein value) to allow before considering as different
# input format: $array["host1"]["host2"] = difference;

function get_similar_groups($array, $difference = 2) {
    global $l;
    $groups = Array();
    # get a permutation of all elements
    foreach ($array as $host1 => $subhash) {
        # for each host find min, max and avg values
        $min_diff = min_not_null(array_values($subhash));
        $max_diff = max(array_values($subhash));
        $avg_diff = array_sum(array_values($subhash)) / count(array_values($subhash));

        # find groups that are only slightly different 
        foreach ($subhash as $host2 => $score) {
            if ($score > $difference) {
                continue;
            }
            # store
            if (!array_key_exists($host1, $groups)) {
                $groups[$host1] = Array();
            }
            array_push($groups[$host1], $host2);
        }
    }


    $unique_groups = Array();
    $helper = Array();
    # get the unique groups
    foreach ($groups as $key => $value) {
        if (array_key_exists($key, $helper)) {
            continue;
        }
        # mark all hosts of this group
        foreach ($value as $host1 => $host2) {
            $helper[$host2] = true;
        }
        array_push($unique_groups, $value);
    }

    return $unique_groups;
}

function get_hostnames($hostnames) {
    $result = Array();
    foreach ($hostnames as $key => $value) {
        array_push($result, $hostnames[$key]["host"]);
    }
    return $result;
}
