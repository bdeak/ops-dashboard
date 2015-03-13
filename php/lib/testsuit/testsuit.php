<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");

# get_usermsg_data_<lookup_method>()
# get the messages which are still valid, return them as a hash
function get_testsuit_data_sqlite () {
	global $config;
	
	# ensure that the database structure is in swf_placeobject(objid, depth)
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"], $config["sqlite_timeout"]);

	# get the personnel, and return it as a string
	$query = "SELECT id, priority, service, host, state, type, alerting FROM testsuit ORDER BY id ASC";

	$query_result = $sqlite->query($query);
	
	$result = Array();

	while ($entry = $query_result->fetchArray(SQLITE3_ASSOC)) {
		$res = Array();
		$res["id"] = $entry["id"];
		$res["priority"] = (int) $entry["priority"];
		$res["service"] = $entry["service"];
		$res["host"] = $entry["host"];
		$res["state"] = $entry["state"];
		$res["type"] = $entry["type"];
		$res["alerting"] = $entry["alerting"];
		array_push($result, $res);
	}
	$sqlite->close();
	return $result;
}

function clear_testsuit_data_sqlite () {
	global $config;

	# ensure that the database structure is in swf_placeobject(objid, depth)
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"]);

	# use prepared statements to ensure no SQL injection can be done
	try {
		$statement = $sqlite->prepare("DELETE from testsuit");
	} catch (Exception $e) {
		throw new Exception("Can't prepare statement for clearing table testsuit: ". $e);
	}
	try {
		$result = $statement->execute();
	} catch (Exception $e) {
		throw new Exception("Error while clearing table testsuit: ". $e);
	}

	$sqlite->close();

}

function add_testsuit_data_sqlite ($data) {
	global $config;

	# ensure that the database structure is in swf_placeobject(objid, depth)
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"]);

	foreach($data as $value) {
		# use prepared statements to ensure no SQL injection can be done
		try {
			$statement = $sqlite->prepare("INSERT INTO testsuit VALUES (NULL, :priority, :service, :host, :state, :type, :alerting)");
		} catch (Exception $e) {
			throw new Exception("Can't prepare statement for inserting into testsuit: ". $e);
		}

		try {
			$statement->bindValue(':priority', (int) $value["priority"], SQLITE3_INTEGER);
			$statement->bindValue(':service', $value["service"], SQLITE3_TEXT);
			$statement->bindValue(':host', $value["host"], SQLITE3_TEXT);
			$statement->bindValue(':state', $value["state"], SQLITE3_TEXT);
			$statement->bindValue(':type', $value["type"], SQLITE3_TEXT);
			$statement->bindValue(':alerting', (int) $value["alerting"], SQLITE3_INTEGER);
		} catch (Exception $e) {
			throw new Exception("Failed to bind values for prepared statement: ". $e);
		}

		try {
			$result = $statement->execute();
		} catch (Exception $e) {
			throw new Exception("Error while inserting user_msg message to the database: ". $e);
		}

	}

	$statement->close();
	$sqlite->close();
}
