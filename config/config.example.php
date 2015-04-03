<?php

$config = Array(); # needed, don't remove
#################################################################
# base directory on the server - set this to the actual path on the icinga server!
$config["base_dir"] = "/var/www/dashboard";
# change this if the physical directory name and the context are not the same (ie when using an alias on the web server)
# only change if you know what you're doing!
$config["dashboard_context"] = preg_replace("/^.*\/([^\/]+)$/", '$1', $config["base_dir"]);
#################################################################
# naming defaults 
$config["page_title"] = "Icinga Dashboard";
$config["dashboard_name_major"] = "Operations Team";
$config["dashboard_name_minor"] = "dashboard";
#################################################################
$config["status"]["backend_type"] = "icinga";
$config["status"]["icinga"]["status_url"]["service"] = "http://example.com/cgi-bin/icinga/status.cgi?hoststatustypes=3&serviceprops=2097162&servicestatustypes=20&jsonoutput";
$config["status"]["icinga"]["status_url"]["host"] = "http://example.com/cgi-bin/icinga/status.cgi?style=hostdetail&hostprops=2359306&hoststatustypes=12&jsonoutput";
# Don't forget to set these if the icinga interface is password protected!
#$config["status"]["icinga"]["username"] = "icinga_password";
#$config["status"]["icinga"]["password"] = "XXX";
#################################################################
# cache settings
$config["cache_ttl_priorities"] = 60 * 60;
$config["cache_ttl_status"] = 60;
$config["cache_ttl_oncall"] = 60 * 60;
$config["cache_ttl_usermsg"] = 60;
$config["timeout"] = 120;
$config["sqlite_timeout"] = 10;
#################################################################
# location of the dashboard.db sqlite database - for storing internal data
$config["dashboard_db"] = $config["base_dir"] . "/db/dashboard.db";
#################################################################
# add logger parameters
# http://logging.apache.org/log4php/docs/appenders/rolling-file.html
$config["logfile"]["dashboard"]["file"] = $config["base_dir"] . "/log/dashboard.log";
$config["logfile"]["dashboard"]["maxFileSize"] = "10MB";
$config["logfile"]["dashboard"]["maxBackupIndex"] = "3";
$config["logfile"]["dashboard"]["compress"] = true;
#################################################################
# enable Admin of the Day (aod) lookup?
$config["aod_lookup_enabled"] = true;
$config["aod_lookup_method"] = "sqlite";
# enable Oncall lookup?
$config["oncall_lookup_enabled"] = true;
$config["oncall_lookup_method"] = "sqlite";
#################################################################
# what should be the sort method for the alerts?
# * status_priority_age
# * status_priority_name
# * priority_status_age
# * priority_status_name
$config["sort_method"] = "priority_status_age";
# when sorting by age, should the sorting be ascending? (youngest first)
$config["sort_age_asc"] = true;
# when sorting by priorities, should the lowest be first? (prio1 highest)
$config["sort_priority_asc"] = false;
#################################################################
# should alert lookups be enabled?
# alert lookup is to be used to show as a tag that a given alert has been received by the Operations Center
# this varies in every setup, so is disabled by default, as no generic lookup method can be written
$config["alert_lookup_enabled"] = false;
# a dummy lookup method that does nothing
#$config["alert_lookup_method"] = "dummy";
#################################################################
# should priorities looked up and shown?
$config["priority_lookup"]["enabled"] = false;
# available:  * icinga_group_membership - based on icinga service- and hostgroup membership (priority1-priority5)
# 			  * namebased - based on any field present in status data
#			  * testsuit - get data from the testsuit
#$config["priority_lookup"]["method"] = "icinga_group_membership";
#$config["priority_lookup"]["data_url"]["service"] = "http://example.com/cgi-bin/icinga/config.cgi?type=servicegroups&jsonoutput";
#$config["priority_lookup"]["data_url"]["host"] = "http://example.com/cgi-bin/icinga/config.cgi?type=hostgroups&jsonoutput";
# Array of hashes, each hash is defined as:
# pattern => regex to match for
# replacement => replacement expression to use, defaults to '$1'
# field => in which field to search for (in the output of fetchdata.php), only used in namebased
# if multiple hashes provided, the first that is matched will be used
#$config["priority_lookup"]["patterns"] = Array(Array("pattern" => "/^Priority(\d)\s*/i"));

#$config["priority_lookup"]["method"] = "namebased";
#$config["priority_lookup"]["patterns"] = Array(
#	Array(
#		"field" => "service",
#		"pattern" => "/^PRI:\s*(\d)\s*/i",
#	),
#	Array(
#		"field" => "host",
#		"pattern" => "/^PRI:\s*(\d)\s*/i",
#	)
#);
# if the priority is derived from the status data, should the data be removed 
# after the priority identification has been made? (so that the priority is not shown twice)
# (has to be implemented for each priority lookup method separately)
#$config["priority_lookup"]["cleanup_state_data"] = true;
#$config["priority_lookup"]["method"] = "testsuit";
#################################################################
# log the state changes and show the time since in error, or how long in ok?
$config["last_ok"]["enabled"] = true;
$config["last_ok"]["chart"]["enabled"] = true;
# what type of chart to display
# possibilities: bar, line
$config["last_ok"]["chart"]["type"] = "line";
# bar chart options
$config["last_ok"]["chart"]["bar"]["color"]["OK"]["outline"] = "#DDDDDD";
$config["last_ok"]["chart"]["bar"]["color"]["OK"]["fill"] = "#DDDDDD";
$config["last_ok"]["chart"]["bar"]["color"]["PROBLEM"]["outline"] = "#999999";
$config["last_ok"]["chart"]["bar"]["color"]["PROBLEM"]["fill"] = "#999999";
# line chart options
$config["last_ok"]["chart"]["line"]["color"]["OK"] = "#DDDDDD";
# area chart options
$config["last_ok"]["chart"]["area"]["color"]["OK"]["outline"] = "#DDDDDD";
$config["last_ok"]["chart"]["area"]["color"]["PROBLEM"]["fill"] = "#999999";
#################################################################
$config["log"]["timezone"] = "Europe/Berlin";
#################################################################
$config["icon"]["oncall"] = "glyphicon-earphone";
$config["icon"]["aod"] = "glyphicon-wrench";
$config["icon"]["lastok"]["OK"] = "glyphicon-ok";
$config["icon"]["lastok"]["PROBLEM"] = "glyphicon-chevron-down";
#################################################################
# Username mappings, only used for displaying
$config["users"]["John, Doe"] = "jdoe";
$config["users"]["jdoe"] = "John";
#################################################################
# Configuration for the alert tiles
$config["layout"]["aspect_ratio"] = "5:1";
$config["layout"]["columns_default"] = 2;
# allow scaling to more columns on many errors?
# only used if the number of columns is not overridden via query parameter
$config["layout"]["add_more_columns"] = true;
# how many columns to add maximum
$config["layout"]["add_more_columns_max_growth"] = 2;
# size to be left on each side of the grid
$config["layout"]["margin_sides_percent"] = 2.5;
$config["layout"]["margin_tiles_pixel"] = 3;
#################################################################
# Effects to use when moving tiles around
# available effects are: 
# * jquery-ui effects (http://jqueryui.com/effect/):
# 	* blind
# 	* bounce
# 	* clip
# 	* drop
# 	* explode
# 	* fade
# 	* fold
# 	* highlight
# 	* puff
# 	* pulsate
# 	* scale
# 	* shake
# 	* size
# 	* slide
# 	* transfer
# * non jquery-ui based effects:
# 	* slide-previous - slide out of the previous tile
# 	* slide-first - slide out from the first tile of the frame
# 
# Options (like easing) can be also passed to the effect if using a jquery-ui effect, use the 'options' subhash
# Look up options at http://api.jqueryui.com/effect/
$config["effects"]["tile"]["add"]["effect"] = "slide";
$config["effects"]["tile"]["add"]["options"]["easing"] = "easeOutCirc";
$config["effects"]["tile"]["del"]["effect"] = "puff";
# when tiles are being moved, how should the transition happen?
# * all-at-once
# * one-by-one
#$config["effects"]["position_change"] = "one-by-one";
$config["effects"]["tile"]["position_change"] = "all-at-once";

# effects for the infobar
$config["effects"]["infobar"]["add"]["effect"] = "blind";
$config["effects"]["infobar"]["add"]["options"]["direction"] = "up";
$config["effects"]["infobar"]["add"]["options"]["easing"] = "easeOutCirc";
$config["effects"]["infobar"]["del"]["effect"] = "blind";
$config["effects"]["infobar"]["del"]["options"]["direction"] = "down";

#################################################################
# show user messages in the infobar?
$config["user_msg"]["enabled"] = true;
$config["user_msg"]["lookup_method"] = "sqlite";
# default msg ttl in seconds
$config["user_msg"]["default_ttl"] = 60 * 60;
# if multiple user messages are to be shown, after how many seconds should they change
$config["user_msg"]["change_time"] = 60;
#############################################################################################################
# show error if the data was not updated for a certain time?
$config["show_outdated"]["data"]["enabled"] = true;
# how many seconds to allow before showing the alert?
$config["show_outdated"]["data"]["max_time"] = 2 * 60;
# show if the icinga output has not refreshed recently? (based on status_data_age in JSON output)
# status_update_interval: 10
$config["show_outdated"]["icinga"]["enabled"] = true;
# how many times of "status_update_interval" (also from JSON output) to allow before reporting 
# an outdated status?
$config["show_outdated"]["icinga"]["threshold"] = 5;
#############################################################################################################
$config["debug"]["frontend"]["main"] = false;
$config["debug"]["frontend"]["tile_manager"] = false;
#############################################################################################################
