<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");

# get_usermsg_data_<lookup_method>()
# get the messages which are still valid, return them as a hash
function get_usermsg_data_sqlite () {
	global $config;
	
	# ensure that the database structure is in swf_placeobject(objid, depth)
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"], $config["sqlite_timeout"]);

	# get the personnel, and return it as a string
	$query = sprintf("SELECT id, message, sender, timestamp, valid_until FROM user_msg WHERE valid_until > '%d' ORDER BY timestamp ASC", time());

	$query_result = $sqlite->query($query);
	
	$result = Array();

	while ($entry = $query_result->fetchArray(SQLITE3_ASSOC)) {
		$res = Array();
		$res["id"] = $entry["id"];
		$res["message"] = $entry["message"];
		$res["sender"] = $entry["sender"];
		$res["timestamp"] = $entry["timestamp"];
		$res["valid_until"] = $entry["valid_until"];
		array_push($result, $res);
	}
	$sqlite->close();
	return $result;
}

function usermsg_kill_message_sqlite ($id) {
	global $config;

	# ensure that the database structure is in swf_placeobject(objid, depth)
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"]);

	// check if there's a still valid message with this id
	$query = sprintf("SELECT id, message, sender, timestamp, valid_until FROM user_msg WHERE valid_until > '%d' AND id='%d'", time(), $id);
	$found = Array();

	try {
		$res = $sqlite->query($query);
	} catch (Exception $e) {
		throw new Exception("Failed to run query: " . $query);
	}
	while ($entry = $res->fetchArray(SQLITE3_ASSOC)) {
		$found = $entry;
	}

	if (!(count($found))) {
		throw new Exception("The requested message was not found in the database");
	}

	$timestamp = time();

	# use prepared statements to ensure no SQL injection can be done
	try {
		$statement = $sqlite->prepare("UPDATE user_msg SET valid_until=:valid_until WHERE id=:id");
	} catch (Exception $e) {
		throw new Exception("Can't prepare statement for user_msg: ". $e);
	}

	try {
		$statement->bindValue(':valid_until', $timestamp, SQLITE3_INTEGER);
		$statement->bindValue(':id', $id, SQLITE3_INTEGER);
	} catch (Exception $e) {
		throw new Exception("Failed to bind value for prepared statement: ". $e);
	}
	try {
		$result = $statement->execute();
	} catch (Exception $e) {
		throw new Exception("Error while killing message with id '$id' in user_msg message database: ". $e);
	}

	$sqlite->close();

	return $found;

}

function usermsg_add_message_sqlite ($message, $sender, $ttl) {
	global $config;

	# ensure that the database structure is in swf_placeobject(objid, depth)
	if (!file_exists($config["dashboard_db"])) {
		initialize_dashboard_db($config["dashboard_db"]);
	}

	# get the sqlite connection
	$sqlite = get_sqlite_conn($config["dashboard_db"]);

	$timestamp = time();
	$valid_until = $timestamp + $ttl;

	# use prepared statements to ensure no SQL injection can be done
	try {
		$statement = $sqlite->prepare("INSERT INTO user_msg VALUES (NULL, :msg, :sender, :valid_until, :timestamp)");
	} catch (Exception $e) {
		throw new Exception("Can't prepare statement for user_msg: ". $e);
	}

	try {
		$statement->bindValue(':msg', $message, SQLITE3_TEXT);
		$statement->bindValue(':sender', $sender, SQLITE3_TEXT);
		$statement->bindValue(':valid_until', $valid_until, SQLITE3_INTEGER);
		$statement->bindValue(':timestamp', $timestamp, SQLITE3_INTEGER);
	} catch (Exception $e) {
		throw new Exception("Failed to bind value for prepared statement: ". $e);
	}
	try {
		$result = $statement->execute();
	} catch (Exception $e) {
		throw new Exception("Error while inserting user_msg message to the database: ". $e);
	}
	$added_id = $sqlite->lastInsertRowID();
	$statement->close();
	$sqlite->close();
	return $added_id;

}