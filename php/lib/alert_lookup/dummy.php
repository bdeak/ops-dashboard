<?php

require_once(dirname(__FILE__).'/../common.php');
require_once(dirname(__FILE__)."/../../../config/config.php");
require_once(dirname(__FILE__)."/../sqlite.php");

# get_alert_data_<lookup_method>()
# download active alert statuses from a given data source
# and return it as json
#
# format: 
#	for hosts:
# 		$states["host"][$hostname] = 1
#	for services:
#		$states["service"][$hostname . "!" . $service] = 1

function get_alert_data_dummy() {
	
	$states = Array();
	$states["service"] = Array();
	$states["host"] = Array();
	return $states;

}