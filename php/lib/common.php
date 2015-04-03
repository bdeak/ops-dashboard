<?php

include('log4php/Logger.php');
require_once(dirname(__FILE__)."/../../config/config.php");

# clear the cache if needed
$l = get_logger("dashboard");
if ($config["cache_ttl_status"] == 0) {
	$l->info("Clearing cache as 'cache_ttl_status' is set to 0");
	apc_clear_cache("user");
}

function get_logger($name) {
	global $config;
    date_default_timezone_set($config["log"]["timezone"]);
	$configurator = new LoggerConfiguratorDefault();
	$logconfig = $configurator->parse($config["base_dir"] . "/config/log4php.xml");
	foreach ($config["logfile"][$name] as $k => $v) {
		$logconfig["appenders"][$name]["params"][$k] = $v;
	}

	$logconfig["appenders"][$name]["layout"]["class"] = "LoggerLayoutPattern";
	# there's a bug in log4php, and until it's not fixed, the %server{REMOTE_ADDR} tag won't work, and the following message is written into the apache logfile:
	# PHP Warning:  log4php: LoggerPatternConverterServer: Cannot find superglobal variable $_SERVER. in /usr/share/php/log4php/pattern/LoggerPatternConverterSuperglobal.php on line 76
	#$logconfig["appenders"][$name]["layout"]["params"]["conversionPattern"] = '%date - %server{REMOTE_ADDR} - %p - %m%n';
	$logconfig["appenders"][$name]["layout"]["params"]["conversionPattern"] = '%date - %p - %m%n';

	Logger::configure($logconfig);
	$l = Logger::getLogger($name);

	return $l;
}

function handle_error ($msg, $type="hash") {
	$l = get_logger("dashboard");
	$l->error($msg);
	if ($type == "hash") {
		$result = Array();
		$result["ERROR"] = Array();
		$result["ERROR"]["message"] = $msg;
	} elseif ($type == "array") {
		$result = Array();
		array_push($result, "ERROR");
		array_push($result, $msg);
	} else {
		$result = "ERROR: $msg";
	}
	header('HTTP/1.1 500 Internal Server Error');
	print json_encode($result);
	die();
}

function get_data($url, $user=null, $password=null) {
	global $config;
	$l = get_logger("dashboard");

	$result = Array();

	$l = get_logger("dashboard");
	$ch = curl_init();
	$timeout = $config["timeout"];
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
	if (($user != null) && ($password != null)) {
		curl_setopt($ch, CURLOPT_USERPWD, $user . ":" . $password);  
	}
	$data = curl_exec($ch);
	$info = curl_getinfo($ch);
	if ($info["http_code"] != 200) {
		$result["success"] = false;
        // load the HTTP codes
        $http_codes = parse_ini_file("errorcodes.txt");
       	$result["data"] = "URL: " . $url . ", status: " .$info['http_code'] . "/" . $http_codes[$info['http_code']];
    
    } else {
    	$result["success"] = true;
    	$result["data"] = $data;
    }

	curl_close($ch); // close cURL handler		

	return $result;
}

function convert_duration_to_seconds ($duration) {
	$data = explode(" ", $duration);
	$seconds = 0;
	foreach ($data as $time_fragment) {
		$metric = preg_replace("/([0-9]+)([wdhms])$/", "$1", $time_fragment);
		$unit = preg_replace("/([0-9]+)([wdhms])$/", "$2", $time_fragment);
		switch($unit) {
			case "w":
				$seconds += $metric * 60 * 60 * 24 * 7;
				break;
			case "d":
				$seconds += $metric * 60 * 60 * 24;
				break;
			case "h":
				$seconds += $metric * 60 * 60;
				break;
			case "m":
				$seconds += $metric * 60;
				break;
			case "s":
				$seconds += $metric;
				break;
		}
	}
	return $seconds;
}

function convert_seconds_to_duration ($seconds) {
	if ($seconds > 60 * 60 * 24 * 7) {
		return sprintf("%01.1fw", $seconds / (60 * 60 * 24 * 7));
	}
	if ($seconds > 60 * 60 * 24) {
		return sprintf("%01.1fd", $seconds / (60 * 60 * 24));
	}
	if ($seconds > 60 * 60) {
		return sprintf("%01.1fh", $seconds / (60 * 60));
	}
	if ($seconds > 60) {
		return sprintf("%01.1fm", $seconds / 60);
	}
	return sprintf("%ds", $seconds);
}

function convert_seconds_to_hours ($seconds) {
	return sprintf("%01.1f", $seconds / (60 * 60));
}

function convert_seconds_to_percentage ($seconds, $grouping) {
	return sprintf("%01.1f", ($seconds * 100) / (60 * 60 * 24 * $grouping));
}


# to avoid the apc cache entries for different instances of the dashboard
# to be confused, all key names are hashes of their names and the base directory
# (which needs to be unique)
function get_apc_hash_key ($name) {
	global $config;
	$str = $name . "_" . $config["base_dir"];
	return base64_encode($str);
}
