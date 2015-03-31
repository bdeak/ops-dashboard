<?php 

require_once(dirname(__FILE__).'/../lib/sqlite.php');
require_once (dirname(__FILE__)."/../lib/common.php");

function get_sqlite_conn ($path_to_db, $timeout=120) {
	$sqlite = NULL;
	umask(0002);
	try {
		$sqlite = new SQLite3($path_to_db);
		# set error mode to exception
		//$sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		//$sqlite->setAttribute(PDO::ATTR_TIMEOUT, $timeout);
	}
	catch (Exception $e) {
		handle_error("Error while connecting to the dashboard sqlite database: " . $e);
	}	
	return $sqlite;
}

# initialize the sqlite3 database that holds the information for the current oncall and the user messages
function initialize_dashboard_db ($path_to_db) {
	global $config, $l;
	$l->info("Initializing dashboard database");
	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"]);

	# create the tables
	$query_personnel = sprintf("CREATE TABLE personnel(type text, full_name text, username text)");
	$query_usertext = sprintf("CREATE TABLE usertext(id integer primary key, message text, timestamp integer, ttl integer)");
	$query_last_ok = sprintf("CREATE TABLE status_history(id integer primary key, state text, host_count integer, crit_count integer, warn_count integer, timestamp integer)");
	$query_user_msg = sprintf("CREATE TABLE user_msg(id integer primary key, message text, sender text, valid_until integer, timestamp integer)");
	$query_testsuit = sprintf("CREATE TABLE testsuit(id integer primary key, priority integer, service text, host text, state text, type text, alerting integer)");

	try {
		$sqlite->exec($query_personnel);
		$sqlite->exec($query_usertext);
		$sqlite->exec($query_last_ok);		
		$sqlite->exec($query_user_msg);
		$sqlite->exec($query_testsuit);		
	} catch (Exception $e) {
		handle_error("Can't initialize the dashboard db: ". $e);
	}
	$sqlite->close();
	$l->info("Initialization was successful");
}

# write out a timestamp to show the last OK state
function write_last_status ($status, $host_count=0, $crit_count=0, $warn_count=0) {
	global $config;
	
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}
	
	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"]);

	$query = sprintf("INSERT INTO status_history VALUES (NULL, '%s', '%d', '%d', '%d', '%d')", $status, $host_count, $crit_count, $warn_count, time());
	try {
		$sqlite->exec($query);
	}
	catch (Exception $e) {
		handle_error (sprintf("Can't insert entry to status_history with status '%s': '%s'", $status, $e));
	}
	$sqlite->close();
}

# get the last state from the status_history table before a given timestamp
# $time must be either a unix timestamp or the string "now"
function get_last_state($time = "now") {
	global $config;
	
	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"], $config["sqlite_timeout"]);

	if ($time == "now") {
		$query = "SELECT state,timestamp from status_history ORDER BY timestamp DESC LIMIT 1";
	} else {
		$query = sprintf("SELECT state,timestamp from status_history WHERE timestamp < %d ORDER BY timestamp DESC LIMIT 1", $time);
	}
	
	$res = $sqlite->query($query); 

	$ret = Array();

	while ($entry = $res->fetchArray(SQLITE3_ASSOC)) {
		$ret = $entry;
	}
	$sqlite->close();
	
	return $ret;
}

# get the time since the last ok/problem state is happened
function get_last_state_duration() {
	global $config;
	
	$data = Array();

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"], $config["sqlite_timeout"]);

	# get the current state, and the corresponding timestamp
	$last_state = get_last_state();

	# return the current state and the time
	$data["currstate"] = $last_state["state"];
	$data['duration_sec'] = time() - $last_state["timestamp"];
	$data['duration_human'] = convert_seconds_to_duration($data['duration_sec']);

	return $data;

}

# get the states between two points in the past
# both $start and $end must be provided as an unix timestamp
function get_last_state_history($start, $end) {
	global $config, $l;
	
	$data = Array();

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"], $config["sqlite_timeout"]);

	$query = sprintf("SELECT state,timestamp from status_history WHERE timestamp > %d AND timestamp < %d ORDER BY timestamp ASC", $start, $end);

	$res = $sqlite->query($query); 

	while ($entry = $res->fetchArray(SQLITE3_ASSOC)) {
		array_push($data, Array("timestamp" => (int) $entry['timestamp'], "state" => $entry["state"]));
	}
	$sqlite->close();

	# return the current state and the time
	return $data;

}

