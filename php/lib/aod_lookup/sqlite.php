<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");

# get_aod_data_<lookup_method>()
# get the full name of the aod from a data storage backend
# and return it

function get_aod_data_sqlite () {
	global $config, $l;

	# initialize the database if it doesn't exist yet
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"], $config["sqlite_timeout"]);

	# get the personnel, and return it as a string
	$query = "SELECT * from personnel where type='aod'";
	$result = "N/A";
	$res = $sqlite->query($query);
	while ($entry = $res->fetchArray(SQLITE3_ASSOC)) {
		if (array_key_exists($entry["username"], $config["users"])) {
			$result = $config["users"][$entry["username"]];
		} else {
			$result = $entry["username"];
		}
	}
	$sqlite->close();
	return $result;
}

function check_aod_exists_dashboard_db ($type) {
	global $config;

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"]);

	# get the personnel, and return it as a string
	$query = sprintf("SELECT * from personnel WHERE type='%s'", $type);
	$result = false;
	$res = $sqlite->query($query);
	while ($entry = $res->fetchArray(SQLITE3_ASSOC)) {
		$result = true;
		break;
	}
	$sqlite->close();
	return $result;
}

# set the aod or aod personnel in the dashboard db ($type can be 'aod' or 'aod')
function set_aod_sqlite ($type, $username) {
	global $config, $l;

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"]);

	if (check_aod_exists_dashboard_db($type) === true) {
		$query = sprintf("UPDATE personnel SET username='%s' WHERE type='%s'", $username, $type);
	} else {
		$query = sprintf("INSERT INTO personnel VALUES ('%s', NULL, '%s')", $type, $username);
	}

	try {
		$sqlite->exec($query);
	}
	catch (Exception $e) {
		handle_error ("Can't update " . $type . ": " . $e);
	}
	$sqlite->close();
}

function clear_aod_sqlite ($type, $username) {
	global $config, $l;

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"]);


	# use prepared statements to ensure no SQL injection can be done
	try {
		$statement = $sqlite->prepare("DELETE FROM personnel WHERE type=:type");
	} catch (Exception $e) {
		throw new Exception("Can't prepare statement for personnel: ". $e);
	}

	try {
		$statement->bindValue(':type', $type, SQLITE3_TEXT);
	} catch (Exception $e) {
		throw new Exception("Failed to bind value for prepared statement: ". $e);
	}
	try {
		$result = $statement->execute();
	} catch (Exception $e) {
		throw new Exception("Error while clearing personnel type '$type' from database: ". $e);
	}

	$sqlite->close();
}