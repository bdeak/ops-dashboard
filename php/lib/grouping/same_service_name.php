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
            $statuses_result["status"][$md5_grouped]["multiple_subnodes"] = $entries;

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

function get_common_hostnames($statuses, $group, $tolerance) {
    global $l;
    # filter the elements of $statuses based on the provided list of md5s (in $group)
    $entries = Array();
    $entries = get_elements_by_key($statuses["status"], $group);
    $hostnames = get_hostnames($entries);
    
    $hostname = get_hostname_patterns($hostnames, $tolerance);
#    $tmp1 = str_split("3capp-*-bs01");
#    $tmp2 = str_split("3capp-wh*-bs01");
#    $tmp_res = diff($tmp1, $tmp2);
#    $l->debug(print_r($tmp_res, true));

    #$l->debug($hostname);
    #return implode(":", $hostnames);
}

#function get_hostname_patterns($hostnames, $diff_threshold) {
#    $matching = Array();
#    $not_matching = Array();
#    $tmp = Array();
#    foreach ($hostnames as $key => $value) {
#        # 
#    }
#
#}

function get_hostname_patterns($hostnames, $tolerance = 0.2) {
    global $l;
    $hostmap = Array();
    #$hostnames = Array("3capp-webde-bs01", "3capp-webde-bs02", "3capp-gmx-bs01");
    # build a deeply nested hash, each character is one level
    # example-host1, example-host2
    # $hostmap["e"]["x"]["a"]["m"]["p"]["l"]["e"]["-"]["h"]["o"]["s"]["t"]["1"]
    # $hostmap["e"]["x"]["a"]["m"]["p"]["l"]["e"]["-"]["h"]["o"]["s"]["t"]["2"]
    #foreach ($hostnames as $index => $host) {
    #    $keys = str_split($host);
    #    $hostmap_tmp = array();
    #    $arr = &$hostmap_tmp;
    #    foreach ($keys as $key) {
    #       $arr[$key] = array();
    #       $arr = &$arr[$key];
    #    }
    #    unset($arr);
    #    $hostmap = array_replace_recursive($hostmap, $hostmap_tmp);
    #}

    foreach ($hostnames as $index => $host) {
        $elements = str_split($host);
        array_push($hostmap, $elements);
    }

    # get the longest of the hostnames
    $lengths = array_map('strlen', $hostnames);
    $max_length = max($lengths);
    $host_count = count($hostnames);

    # pre-fill the helper array
    $helper = array_fill(0, $max_length, null);
    $helper_counts = array_fill(0, $max_length, 0);

    # compute the actual tolerance
    $tolerance_actual = $host_count * $tolerance;
    $l->debug("$host_count :: $tolerance :: $tolerance_actual");

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

    # throw out 

    $host_pattern = implode("", $helper);
    # replace double '*' values
    $host_pattern = preg_replace("/\*+/", "*", $host_pattern);

    #$hostmap_mask = Array();
    #$hostmap_new = $hostmap;

    $l->debug("returning $host_pattern");

    return $host_pattern;

    #$tmp = Array();
    #foreach ($hostmap_new as $key => $value) {
    #    $l->debug("key is " . $key);
    #    if (array_key_exists($key, $tmp)) {
    #        $hostmap_new["*"] = $value;
    #        unset($hostmap_new[$key]);
    #    } else {
    #        $tmp[$key] = 1;
    #    }
    #}
    #unset($tmp);
    #array_diff_assoc(array1, array2)

    # traverse the $hostmap and generate a mask


    #$var = array_walk_recursive_ext($hostmap, function($value, $key) use ($l) {
#
    #    $l->debug("key is $key");
    #});
#
    #$l->debug("var is $var");

    #$tmp = Array();
    #$hostmap_new = Array();
    #$marker = false;
    #foreach ($hostmap as $key => $value) {
    #    if (array_key_exists($key, $tmp)) {
    #        $marker = true;
    #        break;
    #    }
    #}
    #if ($marker === true) {
    #    # this level must be a '*'
#
    #} else {
    #    $hostmap_new[$key] = $hostmap[$key];
    #}

    #$l->debug(print_r($hostmap_new, true));

    #$hostmap = Array();
    ## host1 host2 host3 host4
    #array_walk($hostnames, function ($val, $key) use ($hostmap) {
    #    $hostmap_in = Array();
    #    $hostname_array = str_split($val);
    #    # now walk the hostname_array also
    #    # h o s t 1
    #    array_walk($hostname_array, function($val_in, $key_in) use ($hostmap_in)) {
    #        $hostmap_in[$val] = Array();
    #    });
    #});
    #foreach ($hostnames as $index => $host) {
    
    #}

}

#function count_array_sizes($array) {
#    if (is_array($array)) {
#        # traverse
#    } else {
#        # end
#    }
#    # recurse
#    count_array_sizes($array);
#}

# diff two arrays of strings to get the insert/delete operations that are required to transform one to another
# source: https://github.com/paulgb/simplediff/blob/master/php/simplediff.php
#function diff($old, $new){
#    $matrix = array();
#    $maxlen = 0;
#    foreach($old as $oindex => $ovalue){
#        $nkeys = array_keys($new, $ovalue);
#        foreach($nkeys as $nindex){
#            $matrix[$oindex][$nindex] = isset($matrix[$oindex - 1][$nindex - 1]) ?
#                $matrix[$oindex - 1][$nindex - 1] + 1 : 1;
#            if($matrix[$oindex][$nindex] > $maxlen){
#                $maxlen = $matrix[$oindex][$nindex];
#                $omax = $oindex + 1 - $maxlen;
#                $nmax = $nindex + 1 - $maxlen;
#            }
#        }   
#    }
#    if($maxlen == 0) return array(array('d'=>$old, 'i'=>$new));
#    return array_merge(
#        diff(array_slice($old, 0, $omax), array_slice($new, 0, $nmax)),
#        array_slice($new, $nmax, $maxlen),
#        diff(array_slice($old, $omax + $maxlen), array_slice($new, $nmax + $maxlen)));
#}
#
#function htmlDiff($old, $new){
#    $ret = '';
#    $diff = diff(preg_split("/[\s]+/", $old), preg_split("/[\s]+/", $new));
#    foreach($diff as $k){
#        if(is_array($k))
#            $ret .= (!empty($k['d'])?"<del>".implode(' ',$k['d'])."</del> ":'').
#                (!empty($k['i'])?"<ins>".implode(' ',$k['i'])."</ins> ":'');
#        else $ret .= $k . ' ';
#    }
#    return $ret;
#}

function get_hostnames($hostnames) {
    $result = Array();
    foreach ($hostnames as $key => $value) {
        array_push($result, $hostnames[$key]["host"]);
    }
    return $result;
}

/** 
 * Apply a user defined function recursively to every member of an array 
 * - Allows the key of an array to be used 
 * @param array $array 
 * @param string userFunction 
 * @param mixed $userData [optional] 
 * @see array_walk_recursive() 
 * @since version 1.0 
 */ 
function array_walk_recursive_ext(&$input, $userFunction, $userData = null) 
{ 
    foreach ($input as $key => $value) 
    { 
        if (is_array($value)) 
        { 
            /* 
                call the user function and pass all the arguments 
                this is what array_walk_recursive() is missing 
                $value will be an array but we can still use $key 
                and perhaps you want to do something with each array 
            */ 
            call_user_func_array($userFunction, 
                array( 
                    $value, $key, $userData 
                ) 
            ); 
            // recuse though the next level 
            array_walk_recursive_ext($value, $userFunction, $userData); 
        } 
        else 
        { 
            // call the user function and pass all the arguments 
            call_user_func_array($userFunction, 
                array( 
                    $value, $key, $userData 
                ) 
            ); 
        } 
    } 
}  


#
#function longest_common_substring($words)
#{
#  $words = array_map('strtolower', array_map('trim', $words));
#  $sort_by_strlen = create_function('$a, $b', 'if (strlen($a) == strlen($b)) { return strcmp($a, $b); } return (strlen($a) < strlen($b)) ? -1 : 1;');
#  usort($words, $sort_by_strlen);
#  // We have to assume that each string has something in common with the first
#  // string (post sort), we just need to figure out what the longest common
#  // string is. If any string DOES NOT have something in common with the first
#  // string, return false.
#  $longest_common_substring = array();
#  $shortest_string = str_split(array_shift($words));
#  while (sizeof($shortest_string)) {
#    array_unshift($longest_common_substring, '');
#    foreach ($shortest_string as $ci => $char) {
#      foreach ($words as $wi => $word) {
#        if (!strstr($word, $longest_common_substring[0] . $char)) {
#          // No match
#          break 2;
#        } // if
#      } // foreach
#      // we found the current char in each word, so add it to the first longest_common_substring element,
#      // then start checking again using the next char as well
#      $longest_common_substring[0].= $char;
#    } // foreach
#    // We've finished looping through the entire shortest_string.
#    // Remove the first char and start all over. Do this until there are no more
#    // chars to search on.
#    array_shift($shortest_string);
#  }
#  // If we made it here then we've run through everything
#  usort($longest_common_substring, $sort_by_strlen);
#  return array_pop($longest_common_substring);
#}