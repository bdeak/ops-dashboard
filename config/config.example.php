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
# datasource urls
# SERVICES
# only hard states
#$config["service_status_url"] = "http://example.com/cgi-bin/icinga/status.cgi?hoststatustypes=3&serviceprops=2359306&servicestatustypes=20&jsonoutput";
# soft and hard states
$config["service_status_url"] = "http://example.com/cgi-bin/icinga/status.cgi?hoststatustypes=3&serviceprops=2097162&servicestatustypes=20&jsonoutput";
# all problems
#$config["service_status_url"] = "http://example.com/cgi-bin/icinga/status.cgi?servicestatustypes=28&jsonoutput";
# HOSTS
$config["host_status_url"] = "http://example.com/cgi-bin/icinga/status.cgi?style=hostdetail&hostprops=2359306&hoststatustypes=12&jsonoutput";
# HOST and SERVICEGROUPS - needed for priority lookup
$config["servicegroup_url"] = "http://example.com/cgi-bin/icinga/config.cgi?type=servicegroups&jsonoutput";
$config["hostgroup_url"] = "http://example.com/cgi-bin/icinga/config.cgi?type=hostgroups&jsonoutput";
#################################################################
# cache settings
$config["cache_ttl_priorities"] = 60 * 60;
$config["cache_ttl_status"] = 60;
$config["cache_ttl_oncall"] = 60 * 60;
$config["cache_ttl_usermsg"] = 60;
$config["timeout"] = 120;
$config["sqlite_timeout"] = 10;
#################################################################
# fixme: replace these
$config["icinga_username"] = "icinga_password";
$config["icinga_password"] = "XXX";
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
$config["alert_lookup_enabled"] = true;
# a dummy lookup method that does nothing
$config["alert_lookup_method"] = "dummy";
#################################################################
# should priorities looked up and shown?
$config["priority_lookup_enabled"] = true;
# available: icinga_group_membership - based on icinga service- and hostgroup membership (priority1-priority5)
$config["priority_lookup_method"] = "icinga_group_membership";
#################################################################
# log the state changes and show the time since in error, or how long in ok?
$config["show_last_ok"] = true;
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
$config["user_msg"]["default_ttl"] = 5 * 60;
# if multiple user messages are to be shown, after how many seconds should they change
$config["user_msg"]["change_time"] = 30;
#############################################################################################################