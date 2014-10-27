$(function() {
    //
    // GENERATE MESSAGE OBJECT
    //
    function makeMessage(object, id, index, left, top) {
        var timeout = index * $.timeout_base;
        var msg = "";
        var state;
        // use the bootstrap compatible state names
        if (object["status"] == "WARNING") {
          state = "warn";
        } else if (object["status"] == "CRITICAL") {
           state = "error";
        } else if (object["status"] == "DOWN" || object["status"] == "UNREACHABLE") {
          state = "down"
        } else if (object["status"] == "UNKNOWN") {
          state = "unknown";
        } else {
          state = "info";
        }
        // tile container
        msg = '<div id="{0}" class="galaxy-frame dragable">\n'.format(id);
        msg += '  <div id="{0}" class="alert alert-{1} tile dragable">\n'.format(id, state);
        // show or hide the priority via a css class

        // priority label
        if (object['priority'] == 0) {
        msg += '    <div class="priority dragable hidden">{0}</div>\n'.format(object["priority"]);
        } else {
        msg += '    <div class="priority dragable">{0}</div>\n'.format(object["priority"]);
        }
        // service name (if present)
        if (object["type"] == "service") {
          // do some search & replace on the service text
          var service = object['service'].replace(/^Systemcheck/, "SC:");
          msg += '    <div class="service dragable">{0}</div>\n'.format(service);
        }
        // hostname
        msg += '    <div class="host dragable">{0}</div>\n'.format(object["host"]);
        // tag holder container
        msg += '    <div class="tag_holder dragable">\n';
        // if there's an active alert, show a tag
        if (object["alert_active"]) {
          // show that there's an active alert triggered
          msg += '    <span class="dashtag dragable alert_active blink">Alert active</span>\n';
        } else {
          // hide the alert tag using the 'hidden' css class.. this is needed for easier removal/adding of the tag
          msg += '    <span class="dashtag dragable alert_active hidden">Alert active</span>\n';
        }
        if (object["is_flapping"]) {
          msg += '    <span class="dashtag dragable is_flapping">flapping</span>\n';
        } else {
          msg += '    <span class="dashtag dragable is_flapping hidden">flapping</span>\n';
        }
        if (object["is_soft"]) {
          msg += '    <span class="dashtag dragable is_soft">SOFT</span>\n';
        } else {
          msg += '    <span class="dashtag dragable is_soft hidden">SOFT</span>\n';
        }              
        // show the duration tag
        msg += '    <span class="dashtag dragable duration">{0}</span>\n'.format(object["duration"]);
        msg += '    </div>\n';
        // show position with a comment, for debug purposes
        msg += '    <!-- index: {0}, left: {1}, top: {2} -->\n'.format(index, left, top);
        msg += '   </div>\n';
        msg += '  </div>\n';
        // send an add element to the queue
        var element = {
          options: {
            title: 'frame',
            content: msg,
          },
          animate: true,
          index: index,
          id: id,
        }
        $.frame_manager.queue_add("add", element);
    };

    // 
    // GENERIC AJAX WRAPER
    //
    function ajaxCall(url, type, data, success, error, complete) {
        if (success != undefined) {
            // use the defined success action is provided
            successAction = success;
        } else {
            // use the default action if not provided
            successAction = function(data, status, xhr) {
            }
        }

        if (error != undefined) {
            // use the defined success action is provided
            errorAction = error;
        } else {
            // use the default action if not provided
            errorAction = function (xhr, status, error) {
            }
        }
        
        if (complete != undefined) {
            // use the defined success action is provided
            completeAction = complete;
        } else {
            // use the default action if not provided
            completeAction = null;
        }


        $.ajax({
          url: url,
          dataType: 'json',
          type: type,
          data: data,
          contentType: 'application/json',
          //beforeSend: function(xhr) {
          //    // provide basic auth details here if needed
          //    //xhr.setRequestHeader ("Authorization", "Basic XXX=");
          //},
          success: successAction,
          error: errorAction,
          complete: completeAction,
        });
    }

    // remove all tiles and display an error message
    function show_error_message(statuscode, error, do_show) {
      if (do_show) {
        if ($.frame_manager.get_frame_length() > 1) {
          // issue a delete of all tiles in the grid

          // reverse the array (to delete from backwards to avoid sensless rearranging of the grid)
          var ids = $.frame_manager.get_frame_list().reverse();
          // iterate on the reversed array and delete the tiles that are no longer needed
          $.each(ids, function(i) {
            // get the md5 id for the current alert
            // check if this tile existed before
            console.debug("Deleting tile with id {0} to so error msg can be shown".format(ids[i]));
            delete_tile(ids[i]);
          });
        }
        // show the error message
        if ($(".msg_error").length == 0) {
          var msg = "There was a problem while loading data from the backend API: {0}".format(error);
          var element = {
            container: "#msg_container_main",
            classes: "message_default msg_error",
            content: msg,
          }
          $.frame_manager.queue_add("show_msg", element);
        }
      } else {
        // hide the error message
        if ($(".msg_error").length) {
            var element = {
                container: "#msg_container_main",
            }
            $.frame_manager.queue_add("hide_msg", element);  
          }
      }
    };


    // delete the alerts that are no longer needed, in a reversed order (from bottom to top to avoid
    // senseless reordering of the grid)
    function delete_no_longer_needed_alerts (data) {

      // get the ids of the tiles, reverse it so that they will be deleted from the end
      var ids = $.frame_manager.get_frame_list().reverse();

      // iterate on the reversed array and delete the tiles that are no longer needed
      $.each(ids, function(i) {
        // get the md5 id for the current alert
        // check if this tile existed before
        if (ids[i] in data) {
          // existed, and exists, nothing to do 
        } else {
          // did exist, but not needed anymore, remove it
          var index = $.frame_manager.get_frame_position(ids[i]);
          console.debug("Issuing delete of tile with id {0} / index: {1}".format(ids[i], index));
          delete_tile(ids[i]);
        }
      });
    };

    // add new tiles to the grid if needed
    function add_new_alerts_if_needed (data) {

      $.each(data, function(index, obj) {
        // check if the given object already existed
        var md5id = obj["md5id"];
        if ($.frame_manager.get_frame_position(md5id) === false) {
          // no displayed tile match this one, add a new object to the grid          
          var duration = obj['duration'];
          var index = obj['index'];
          // calculate x-y index
          var p = $.frame_manager.calculate_grid_position(index);
          console.debug("Adding new tile with index {0} ({1}x{2}), id {3}".format(obj['index'], p.top, p.left, md5id));
          // create the tile
          makeMessage(obj, md5id, index, p.left, p.top);
          // start blinker timer if needed
          if (obj["alert_active"]) {
            // blinking is needed
            if ($.timer_blink == null) {
              $.timer_blink = setInterval(function () { blink(); }, 300);
              // call the kill_blink timer also initially
              if ($.timer_kill_blink == null) {
                $.timer_kill_blink = setTimeout(function() { kill_blink(); }, 1000 * 20);
              }
            }
          }
        }
      });
    };

    // update information on the tiles that are currently shown (currently only duration)
    // runs periodically
    function update_alert_information (data) {

      $.each(data, function(index, obj) {
        // update duration
        // get the div with the current id (md5id), update the duration
        var tile = $("#" + obj["md5id"]).find(".duration")
        tile.html(obj["duration"]);
        // unbind the selector to avoid memleaks
        tile.unbind();

        change_tile_state_if_needed(obj["md5id"], obj["status"]);

        // tags that need blinking
        $.each(Array("alert_active"), function(index, tagname) {
          show_or_hide_tag(tagname, obj["md5id"], obj[tagname], true); // obj[tagname] will be true or false
        });
        // tags without blinking
        $.each(Array("is_soft", "is_flapping"), function(index, tagname) {
          show_or_hide_tag(tagname, obj["md5id"], obj[tagname], false); // obj[tagname] will be true or false
        });
      });
    };    

    // check if the displayed state of the tile matches the current value, if not, change it by changing it's class
    function change_tile_state_if_needed (md5id, status) {
        // remap the states properly
        var states = new Object;
        states["CRITICAL"] = "error";
        states["WARNING"] = "warn";
        states["DOWN"] = "down";
        states["UNREACHABLE"] = "down";
        states["UNKNOWN"] = "unknown";
        var tile = $("#" + md5id).find(".alert");
        // change the tile color if state changed (warning <-> critical)
        if ((tile.length > 0) && (tile.hasClass("alert-{0}".format(states[status])) == false)) {
          var currstate = null;
          if (tile.hasClass("alert-error")) {
            currstate = "error";
          } else if (tile.hasClass("alert-warn")) {
            currstate = "warn";
          } else if (tile.hasClass("alert-down")) {
            currstate = "down";
          } else if (tile.hasClass("alert-unknown")) {
            currstate = "unknown";
          }
          // the required state (color) and the shown color differs
          console.info("State for tile with id {0} is {1} instead of {2}, changing it (and the color)".format(md5id, currstate, states[status]));
          tile.removeClass('alert-{0}'.format(currstate));
          tile.addClass('alert-{0}'.format(states[status]));
        }
        // unbind the selector to avoid memleaks
        tile.unbind();

    };

    // show or hide a given tag
    // the tagname must be already available as part of the tile, in the form of a span
    // the second argument defines if the tag should be shown or hidden
    function show_or_hide_tag(tagname, md5id, is_visible, is_blink) {
      // check if adding this tag is needed
      if (typeof is_visible != "boolean") {
        console.warn("is_visible for tag {0} is not boolean but {1}".format(tagname, typeof is_visible));
      }
      if (is_visible == true) {
        if ($("#" + md5id).find("." + tagname).hasClass("hidden") == true) {
          // should be shown, but is not shown, remove the hidden class
          $("#" + md5id).find("." + tagname).removeClass("hidden");
        }
        if (is_blink == true) {
          if ($("#" + md5id).find("." + tagname).hasClass("blink") == false) {
            $("#" + md5id).find("." + tagname).addClass("blink");
          }
          // make sure the timer is running; it will be cleared when nothing else exists that needs blinking
          if ($.timer_blink == null) {
            $.timer_blink = setInterval(function () { blink(); }, 300);
            if ($.timer_kill_blink == null) {
              $.timer_kill_blink = setTimeout(function() { kill_blink(); }, 1000 * 20);
            }              
          }
        }
      } else {
        if ($("#" + md5id).find("." + tagname).hasClass("hidden") == false) {
          // it's shown, but should not be shown, add the hidden class
          $("#" + md5id).find("." + tagname).addClass("hidden");
        }
      }
    };

    // show the infobar at the bottom of the page showing how many alerts are not visible currently
    // hide it if it's no longer should be visible
    function show_infobar_if_needed(data) {
        if ($.debug) 
          console.debug("in infobar!");
        var message = null;
        var animate = false;
        if ($.assocArraySize(data) > $.tiles_max) {
          var notshown_warning = 0;
          var notshown_critical = 0;
          var notshown_down = 0;
          var notshown_unknown = 0;

          // get the number of not shown warnings and criticals
          var counter = 0;
          // count the states for each type
          $.each(data, function(index, object) {
            counter += 1;
            if (counter <= $.tiles_max) {  
              return true;  // continue
            } else {
              if (data[index]["status"] == "UNKNOWN") {
                notshown_unknown += 1;
              } else if (data[index]["status"] == "WARNING") {
                notshown_warning += 1;
              } else if (data[index]["status"] == "CRITICAL") {
                notshown_critical += 1;
              } else if (data[index]["status"] == "DOWN" || data[index]["status"] == "UNREACHABLE") {
                notshown_down += 1;
              }
            }
          });
          // create a message array holding the text for the given state types
          var message = Array();
          if (notshown_down > 0) {
            message.push('{0} down host'.format(notshown_down));
          }
          if (notshown_critical > 0) {
            message.push('{0} critical'.format(notshown_critical));
          }
          if (notshown_warning > 0) {
            message.push('{0} warning'.format(notshown_warning));
          }
          if (notshown_unknown > 0) {
            message.push('{0} unknown'.format(notshown_unknown));
          }          

          // create the message string by joining the message array
          message_flat = message.join(" and ");
          message = message_flat + " alerts are not shown";

          var md5id = $.md5(message);

          $.frame_manager_infobar.queue_empty();
          
          // resize the tiles to make space for the infobar
          if ($.frame_manager_infobar.get_frame_length() == 0) {
            // re-detect display options because the infobar is now shown
            var element = {
              func_name: detect_display_options,
              parameters: [null, null, true],
            }
            $.frame_manager_infobar.queue_add("detect_display_options", element);
          }

          // add the tile if it doesn't exist already
          if ($.frame_manager_infobar.get_frame_position(md5id) === false) {
            var element = {
              options: {
                title: 'frame',
                content: "<div id='{0}' class='alert-infobar'>{1}</div>".format(md5id, message),
              },
              animate: true,
              index: 1,
              id: md5id,
            }
            
            // change queue tick time to slower
            $.queue_tick_time_infobar = 300;
            $.frame_manager_infobar.change_tick_time($.queue_tick_time_infobar);
            $.frame_manager_infobar.start_queue_processing();
            $.frame_manager_infobar.queue_add("add", element);
          }
        } else if (($.config["user_msg"]["enabled"] === true) && $.assocArraySize($.user_msg_data)) {
          // infobar is only shown if all tiles are shown
          // check if there's something new to show
          var trigger = false;
          for (var id in $.user_msg_data) {
            var message = add_markup("{0} <span style='font-size:0.7em;'>[{1}]</span>".format($.user_msg_data[id]["message"], $.user_msg_data[id]['sender']));
            var md5id = $.md5(message);
            if (($.frame_manager_infobar.check_in_queue(md5id, "circular") === false) && ($.frame_manager_infobar.get_frame_position(md5id) === false)) {
              trigger = true;
            }
          }

          if ((trigger) || ($.frame_manager_infobar.queue_length("circular") != $.user_msg_data.length)) {
            // clear the queue
            $.frame_manager_infobar.queue_empty();

            // re-detect display options because the infobar is now shown
            var element = {
              func_name: detect_display_options,
              parameters: [null, null, true],            
            }
            $.frame_manager_infobar.queue_add("detect_display_options", element);

            for (var id in $.user_msg_data) {
              var message = add_markup("{0} <span style='font-size:0.7em;'>[{1}]</span>".format($.user_msg_data[id]["message"], $.user_msg_data[id]['sender']));
              var md5id = $.md5(message);

              var element = {
                options: {
                  title: 'frame',
                  content: "<div id='{0}' class='alert-infobar'>{1}</div>".format(md5id, message),
                },
                animate: true,
                index: 1,
                id: md5id,
              }

              // add a special tile, this will allow multipe tiles on one index, shown in circulation
              $.frame_manager_infobar.queue_add("circular", element);
              console.debug("Adding tile to infobar using method 'circular' with id " + md5id);

              // push a tick time changer also to the queue if needed
              $.queue_tick_time_infobar = parseInt($.config["user_msg"]["change_time"]) * 1000;
              if ($.frame_manager_infobar.get_tick_time() != $.queue_tick_time_infobar) {
                $.frame_manager_infobar.queue_add("change_tick_time", {duration: $.queue_tick_time_infobar});
              }
            }

          }

        } else {
          if ($.frame_manager_infobar.get_frame_length() > 0) {

            // if the infobar is shown, hide it
            // clear the queue first
            $.frame_manager_infobar.queue_empty();

            // change the tick time to the normal value

            $.queue_tick_time_infobar = 300;
            if ($.frame_manager_infobar.get_tick_time() != $.queue_tick_time_infobar) {
              $.frame_manager_infobar.change_tick_time($.queue_tick_time_infobar);
            }

            var element = {
                index: 1,
                animate: true,
            }

            $.frame_manager_infobar.queue_add("del", element);
            console.log("del");

            $.frame_manager_infobar.start_queue_processing();

            // reposition after
            var element = {
              func_name: detect_display_options,
              parameters: [null, null, null],
            }
            $.frame_manager_infobar.queue_add("detect_display_options", element);
          }
        }
        //console.log("end");
    };

    // change markup to real html code
    // available markup:
    // bold: *text*
    // underline: _text_
    // strikethrough: --text--
    // italics: ~text~
    // marked text: !!text!!
    // small text: ^^
    function add_markup(text) {
      text = text.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");
      text = text.replace(/_([^_]+)_/g, "<u>$1</u>");
      text = text.replace(/--([^-]+)--/g, "<s>$1</s>");
      text = text.replace(/~([^~]+)~/g, "<em>$1</em>");
      text = text.replace(/!!([^!]+)!!/g, "<mark>$1</mark>");
      text = text.replace(/\^([^\^]+)\^/g, "<small>$1</small>");
      return text;
    }

    // initialize the galaxy frame grid
    function draw_grid() {
      // initialize frame manager
      $.frame_manager = new TileManager(
      {
        el: "#everything",
        effects: {
          add: {
            effect: $.config["effects"]["tile"]["add"]["effect"],
            options: $.config["effects"]["tile"]["add"]["options"] || {},
          },
          del: {
            effect: $.config["effects"]["tile"]["del"]["effect"],
            options: $.config["effects"]["tile"]["del"]["options"] || {},
          },
          position_change: $.config["effects"]["tile"]["position_change"],
        },
        user_msg: {
          duration: $.config["user_msg"]["scroll_time"] * 1000,
          direction: $.config["user_msg"]["direction"],
          duplicated: $.config["user_msg"]["duplicated"],
        },
        queue_tick_time: $.queue_tick_time,
        timeout_base: $.timeout_base,
      });

      // trigger the queue_next event once
      $.frame_manager.start_queue_processing();
      //$.frame_manager.bind('queue_empty_event', queue_empty_handler);
      //$.frame_manager.bind('queue_working_event', queue_working_handler);

    }; 

    // initialize the infobar grid
    function draw_grid_infobar() {
      // initialize frame manager
      $.frame_manager_infobar = new TileManager(
      {
          el: '#infobar',
          frame: {
            width: $(window).width(),
            height: 45,
          },
          rows: 1,
          columns: 1,
          margin: 0,
          max_frames: 1,
          effects: {
            add: {
              effect: $.config["effects"]["infobar"]["add"]["effect"],
              options: $.config["effects"]["infobar"]["add"]["options"] || {},
            },
            del: {
              effect: $.config["effects"]["infobar"]["del"]["effect"],
              options: $.config["effects"]["infobar"]["del"]["options"] || {},
            },
            position_change: "all-at-once",
          },
          queue_tick_time: 300,
          timeout_base: 300,
      });

      // trigger the queue_next event once
      $.frame_manager_infobar.start_queue_processing();

    }; 


    // show an initial message while the first data is being loaded
    function show_loading() {
      var element = {
          container: "#msg_container_main",
          classes: "message_default msg_loading",
          content: "Fetching data from the icinga server...",
      }
      $.frame_manager.queue_add("show_msg", element);
    };

    // display a message that no checks are in bad state
    function display_all_ok(state) {
      if (state) {
        var msg = "Everything OK";
        // check if not already shown
        if ($(".msg_ok").length == 0) {
          // show the message
          var element = {
            container: "#msg_container_main",
            classes: "alert alert-success all_ok msg_ok",
            content: msg, 
          }
          $.frame_manager.queue_add("show_msg", element);

          // update the last_ok field if it's in use
          if ($.config['show_last_ok'] === true) {
            timer_lastok = setTimeout(function() { show_lastok(); }, 300);
          }
        }
      } else {
        // hide the error message, if needed
        if ($(".msg_ok").length) {
          var element = {
              container: "#msg_container_main",
          }
          $.frame_manager.queue_add("hide_msg", element);
  
          // update the last_ok field if it's in use
          if ($.config['show_last_ok'] === true) {
            timer_lastok = setTimeout(function() { show_lastok(); }, 300);
          }
        }
      }
    };

    // helper function for display_all_ok()
    // because tiles are being deleted with a delay, the ok message must only be 
    // visible after no more tiles are visible
    function show_popup_when_no_more_frames(element) {
        // check if there are any tiles still visible, if yes, start another loop via setTimeout()
        // >2 because the shadow element is always in the grid
        if ($.frame_manager.get_frame_length() > 1) {
          setTimeout(function() {show_popup_when_no_more_frames(element)}, 500);
        } else {
          // no more tiles visible, fade in the message
          $(element).fadeIn(800);
        }
    };

    function delete_tile(e) {
      var id = null;
      var index = null;
      if ($.isNumeric(e)) {
        index = e;
      } else {
        id = e;
      }
      var element = {
          id: id,
          index: index,
      }
      $.frame_manager.queue_add("del", element);
    };

    // show the clock, updated via setInterval()
    function show_time() {
      var time = new Date();
      var hour = time.getHours();
      if (hour < 10) {
        hour = "0" + hour;
      }
      var minute = time.getMinutes();
      if (minute < 10) {
        minute = "0" + minute;
      }
      $("#hour").html(hour);
      $("#minutes").html(minute);

    };

    // blink the colon in the clock to show activity
    // can't use .toggle(), because in that case the 
    // colon literally disappears, and the minutes would then
    // move to the left
    // we only trigger it's visibility via css
    function show_clock_activity() {
      if ($.clock_activity === undefined) {
        $.clock_activity = false;
      }
      if ($.clock_activity == false) {
        // hide the ':'
        $("#colon").css('visibility','hidden')
        $.clock_activity = true;
      } else {
        // show the ':'
        $("#colon").css('visibility','visible')
        $.clock_activity = false;
      }
    };

    // show the date in the header
    function show_date() {
      var d = new Date();
      var day = d.getDate();
      var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      var month = months[d.getMonth()];
      var dayname = days[d.getDay()];
      $("#date").html("{0}. {1}, {2}".format(day, month, dayname));

      // update the header_container
      setTimeout(function() { recalculate_header_positions(); }, 100);

    }

    // sprintf like formatting
    // usage: "Foo {0}".format("bar");
    // source: http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
    String.prototype.format = function() {
        var formatted = this;
        for( var arg in arguments ) {
            // replace all occurances, not just the first
            var placeholder = "\\{" + arg + "\\}";
            var re = new RegExp(placeholder, "g");
            formatted = formatted.replace(re, arguments[arg]);
        }
        return formatted;
    };

    // get the length of an associative array
    $.assocArraySize = function(obj) {
        // http://stackoverflow.com/a/6700/11236
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    };

    // change the side margin, so that the space is evenly distributed
    function recalculate_side_margins() {
      var margin_final = Math.round(($(window).width()- ($.tile_sizex * $.columns + ($.columns - 1) * $.margin)) / 2);
      $("#everything").css("margin-left", "{0}px".format(margin_final));
    };

    // set some global variables with the rows/cols/etc based on the screen resolution
    // the rest is done via media queries in style.css
    // fixme: make this more clever, maybe dynamic?
    function detect_display_options(columns_override, sim, infobar) {
      //console.log("called from " + arguments.callee.caller.toString());
      var proposed_columns = parseInt($.url().param('columns')) || parseInt(columns_override) || $.columns || parseInt($.config["layout"]["columns_default"]);
      var simulate = false;
      if (_.isBoolean(sim))
        simulate = sim;
      
      var with_infobar = false;
      if (_.isBoolean(infobar))
        with_infobar = infobar;

      // based on the columns, the screeen size and the aspect ratio we can calculate the size of one cell block
      var margin_sides_percent = parseInt($.config["layout"]["margin_sides_percent"]);
      var screen_sizex = $(window).width();
      var screen_sizey = $(window).height();
      var gap_between = 5; // just a guess, will be autoadjusted (final value will be proposed_margin)
      // get the sizes of the fix elements - header and footer
      var header_height = Math.ceil($(".page-header").outerHeight(true));
      // calculate the footer size

      var footer_size;
      if (with_infobar === true || $.frame_manager_infobar.get_frame_length() > 0 || 
         ($.assocArraySize($.monitor_data) > $.tiles_max) || 
         (($.config["user_msg"]["enabled"] === true) && ($.assocArraySize($.user_msg_data) > 0)))
      {
        footer_size = parseInt($("#infobar").append("<div id='infobar-dummy'>dummy</div>").find("#infobar-dummy").actual('outerHeight'));
        $("#infobar-dummy").remove();
      } else {
        footer_size = 0;
      }

      // calculate the desired cell size using the screen width and the desired margin percent
      var aspect_ratio = $.config["layout"]["aspect_ratio"].split(":");
      var aspect_x = parseInt(aspect_ratio[0]);
      var aspect_y = parseInt(aspect_ratio[1]);

      var proposed_tile_sizex = Math.floor((screen_sizex - 2*(screen_sizex * margin_sides_percent/100)) / proposed_columns);
      var proposed_tile_sizey = Math.floor(proposed_tile_sizex * Math.min(aspect_x, aspect_y)/Math.max(aspect_x, aspect_y));

      // the margin should depend on the cell size, for bigger cells, use bigger margin
      var proposed_margin = Math.round(proposed_tile_sizey * 0.03); // use a hand-adjusted scaling value
      // cacalculate the number of rows using the free space and the cell size
      var proposed_rows = Math.floor((screen_sizey - footer_size - header_height) / ((proposed_tile_sizey) + proposed_margin));

      // get the size of the space that is actually left if using the previously calculated values
      var space_left = Math.floor(screen_sizey - footer_size - header_height - proposed_rows * proposed_tile_sizey - (proposed_rows) * proposed_margin);
      // finetune the cell size so it fits vertically properly
      // grow the tiles a bit
      proposed_tile_sizey = Math.floor(proposed_tile_sizey * (1 + (space_left / proposed_rows / (proposed_tile_sizey + proposed_margin))));

      var proposed_tiles_max = proposed_columns * proposed_rows;

      if (simulate == false) {
        $.columns = proposed_columns;
        $.tile_sizex = proposed_tile_sizex;
        $.tile_sizey = proposed_tile_sizey;
        $.margin = proposed_margin;
        $.rows = proposed_rows;
        $.tiles_max = proposed_tiles_max;
  
        console.debug("detected sizes: tile size: {0}x{1} / columns: {2} / rows: {3} / tiles_max: {4} / aspect_ratio: {5}x1 / footer: {6}"
          .format($.tile_sizex, $.tile_sizey, $.columns, $.rows, $.tiles_max, $.tile_sizex/$.tile_sizey, footer_size));
        var free_space = Math.floor(screen_sizey - footer_size - header_height - (proposed_rows) * ((proposed_tile_sizey) + proposed_margin));
        // make animations quicker if the size of the frame is bigger
        $.queue_tick_time = 100 * 3 - ($.columns-2) * 50;

        // check if there are tiles that don't fit anymore
        // queue a resize event immediately
        var element = {
          tile_sizex: $.tile_sizex,
          tile_sizey: $.tile_sizey,
          columns: $.columns,
          rows: $.rows,
          margin: $.margin,
          tiles_max: $.tiles_max,
          queue_tick_time: $.queue_tick_time,
          timeout_base: $.timeout_base,          
          prefunc: null,
          postfunc: [recalculate_side_margins, update_tile_text, worker],
        }
        $.frame_manager.queue_add("adjust_size", element, true);
       
        // also the infobar
        element = {
          tile_sizex: $(window).width(),
          tile_sizey: footer_size,
          columns: 1,
          rows: 1,
          margin: 0,
          tiles_max: 1,
          prefunc: null,
          postfunc: null,
        }
        $.frame_manager_infobar.queue_add("adjust_size", element, true);

      }
      return {columns: proposed_columns, rows: proposed_rows, tile_sizex: proposed_tile_sizex, tile_sizey: proposed_tile_sizey, tiles_max: proposed_tiles_max};
    };

    // update the contents of the tiles so that they match the size of the tiles
    // this is a workaround for the fact that CSS can't scale elements relative to their parent 
    // containers, only to font sizes or viewport sizes
    // fixme: try using eg values in css and only alter the font size of the CSS elements?
    function update_tile_text() {
      // define scaling factors that provide the relative sizes inside a tile

      // size of the service text
      var scale_factor_text_service = 0.22;
      // size of the host text
      var scale_factor_text_host = 0.18;
      // font size of the tags
      var scale_factor_text_tag = 0.15;
      // space between service and host text
      var scale_factor_margin_service_host = -0.05;
      // padding of the service text on the top
      var scale_factor_padding_service_top = 0.04;
      // padding of the service text on the right
      var scale_factor_padding_service_right = 0.07;
      // padding of the tag holder - horizontally
      var scale_factor_tag_padding_horizontal = 0.05;
      // padding of the tag holder - vertically
      var scale_factor_tag_padding_vertical = 0.001;
      // the radius of the tags
      var scale_factor_tag_border_radius = 0.03;
      // space between the tags
      var scale_factor_tag_margin_left = 0.01;
      // the radius of the tiles
      var scale_factor_tile_radius = 0.05;
      // the padding of the tag holder at the bottom
      var scale_factor_tag_holder_bottom = 0.04;
      // the size of the priority text
      var scale_factor_text_priority = 1;
      // the padding of the priority text on the top
      var scale_factor_margin_priority_top = -0.3;
      
      // assemble an associative array with the data that will be added to the DOM in the form of a new stylesheet
      var style_data = {};
      style_data['.service'] = {};
      style_data['.service']['font-size'] = Math.round($.tile_sizey * scale_factor_text_service) + "px";
      style_data['.host'] = {};
      style_data['.host']['font-size'] = Math.round($.tile_sizey * scale_factor_text_host) + "px";
      style_data['.host']['margin-top'] = Math.round($.tile_sizey * scale_factor_margin_service_host) + "px";
      style_data['.dashtag'] = {};
      style_data['.dashtag']['font-size'] = Math.round($.tile_sizey * scale_factor_text_tag) + "px";
      style_data['.dashtag']['padding'] = "{0}px {1}px {0}px {1}px".format(Math.round($.tile_sizey * scale_factor_tag_padding_vertical), Math.round($.tile_sizey * scale_factor_tag_padding_horizontal));
      style_data['.dashtag']['border-radius'] = Math.round($.tile_sizey * scale_factor_tag_border_radius) + "px";
      style_data['.dashtag']['-moz-border-radius'] = style_data['.dashtag']['border-radius'];
      style_data['.dashtag']['margin-left'] = Math.round($.tile_sizey * scale_factor_tag_margin_left) + "px";
      style_data['.alert'] = {};
      style_data['.alert']['border-radius'] = Math.round($.tile_sizey * scale_factor_tile_radius) + "px";
      style_data['.alert']['-moz-border-radius'] = style_data['.alert']['border-radius'];
      style_data['.alert']['padding-top'] = Math.round($.tile_sizey * scale_factor_padding_service_top) + "px";
      style_data['.alert']['padding-right'] = Math.round($.tile_sizey * scale_factor_padding_service_right) + "px";
      style_data['.tag_holder'] = {};
      style_data['.tag_holder']['right'] = style_data['.alert']['padding-right'];
      style_data['.tag_holder']['bottom'] = Math.round($.tile_sizey * scale_factor_tag_holder_bottom) + "px";
      style_data['.priority'] = {};
      style_data['.priority']['font-size'] = Math.round($.tile_sizey * scale_factor_text_priority) + "px";
      style_data['.priority']['margin-top'] = Math.round($.tile_sizey * scale_factor_margin_priority_top) + "px";

      // put the custom stylesheet in place
      add_style("title_updater", style_data);

    }

    // write a custom style tag to the head, generate the content from an associative array
    function add_style(style_name, data) {
      // delete the currently existing stylesheet from the DOM
      $("#tile_updater").remove();
      // add a new stylesheet
      var line = "<style id='{0}'>".format(style_name);
      $.each(data, function(name, value) {
        line += name + " { ";
        $.each(value, function(subname, attrib) {
          line += subname + ": " + attrib + "; ";
        });
        line += "} ";
      });
      // append it
      $('html > head').append(line);
    };

    // get the name of the current oncall (and aod later)
    function show_personnel() {
        successAction = function(data, status, xhr) {
          $.each(Array("oncall", "aod"), function(index, type) {
            if (type in data) {
              // make it visible if needed
              if ($('#{0}-container'.format(type)).hasClass("hidden")) {
                $('#{0}-container'.format(type)).removeClass("hidden");
                // set the icon
                $('#{0}-container .glyphicon'.format(type)).addClass($.config["icon"][type]);
              }
              // change the content of the span to be the name fetched via the API call
              $('#{0}'.format(type)).html(data[type]);
            } else {
              console.warn("The json response for 'personnel_url' doesn't contain the field '{0}'!".format(type));
              $('#{0}'.format(type)).html("N/A");
            }          
          });
          // update the header_container
          setTimeout(function() { recalculate_header_positions(); }, 100);
        }
        // do the ajax call
        ajaxCall($.personnel_url, 'GET', null, successAction);
      };

      // get the lastok state
      function show_lastok() {
          successAction = function(data, status, xhr) {
            if ($('#lastok-container').hasClass("hidden")) {
              $('#lastok-container').removeClass("hidden");
            }
            // change the icon if needed
            if (!$('#lastok-container .glyphicon').hasClass($.config["icon"]["lastok"][data["currstate"]])) {
              // remove all classes and add the needed ones back
              $('#lastok-container .glyphicon').removeClass().addClass("glyphicon topicon {0}".format($.config["icon"]["lastok"][data["currstate"]]));
            }
            // set the value  
            $('#lastok').html(data["duration_human"]);

            // update the header_container
            setTimeout(function() { recalculate_header_positions(); }, 100);
          }
          // do the ajax call
          ajaxCall($.lastok_url, 'GET', null, successAction);
      };

      // check if alert on freshness should be displayed
      function check_data_freshness() {
        var now = new Date().getTime() / 1000;
        if ((now - $.alive_timestamp) > 2 * 60) { // fixme: make this dynamic
          // make background different color
          // fixme: display popup instead?
          $("body").addClass("outdated");
        } else {
          // remove the bg coloring if it's no longer needed
          if ($("body").hasClass("outdated")) {
            $("body").removeClass("outdated");
          }
        }
      };

      // get user messages data
      function get_user_messages() {
          successAction = function(data, status, xhr) {
            $.user_msg_data = data;
            // call detect_display_options once
            $.once_detectdisplay_usermessages();
          }
          // do the ajax call
          ajaxCall($.user_msg_url, 'GET', null, successAction);
      };

    // the main worker process, getting the data via AJAX and calling the helper functions
    // run periodically by setInterval()
    function worker() {
      if ($.debug) 
        console.log("In worker");
      if ($.timer_worker !== null) {
        clearTimeout($.timer_worker);
        $.timer_worker = null;
      }

      if ($.frame_manager.queue_length() == 0) {
        
        if ($.monitor_data === null) {
          // data not yet ready
          $.myTimeout("worker", worker, $.queue_tick_time * 2);
          return false;
        }

        // check if the result is valid
        if (($.monitor_data) && ("ERROR" in $.monitor_data)) {
          show_error_message(null, $.monitor_data["ERROR"]["message"], true);
          $.myTimeout("worker", worker, 5000);
          return false;
        }

        // hide the error message, if it was present
        if ($(".msg_error").length || $(".msg_loading").length) {
          var element = {
              container: "#msg_container_main",
          }
          $.frame_manager.queue_add("hide_msg", element);
        }

        // we only show a predefined number of tiles, therefore we create a subset of the 
        // data hash that we will work with from now on

        // store the size of the $.monitor_data hash
        $.tiles_total = $.assocArraySize($.monitor_data);
        
        // initialize a temp array that will store only the alerts that are also visible
        var data_shown = {};
        data_shown = {};
        var i = 0;
        $.each($.monitor_data, function(index, obj) {
          if (i >= $.tiles_max) {
          //if (i >= 3) {
            return false
          } else {
            data_shown[index] = obj;
            i += 1;
          }
        });

        // remove tiles that are there, but are not supposed to be there
        delete_no_longer_needed_alerts(data_shown);
        //delete_no_longer_needed_alerts({});

        if ($.tiles_total == 0) {
          // display the message
          display_all_ok(true);
          // hide the infobar, if it was showed
          show_infobar_if_needed(data_shown);
        } else {
          // hide the all ok message
          display_all_ok(false);
          // add new alerts
          add_new_alerts_if_needed(data_shown);

          // show infobar at the bottom if needed
          show_infobar_if_needed($.monitor_data);

          // update information on alerts currently displayed
          update_alert_information(data_shown);
        } 

        // add a queue entry for changing the number of columns - will do anything only if it's needed
        $.frame_manager.queue_add("manage_columns", {func_name: change_column_number_if_needed});

        // set the next round
        $.myTimeout("worker", worker, 20 * 1000);


      } else {
        // set up a shorter timeout
        $.myTimeout("worker", worker, ($.frame_manager.queue_length() + 4) * $.queue_tick_time);
      }
      // update global timestamp showing freshness of the data showed on the screen
      // will be checked in check_data_freshness()
      $.alive_timestamp = new Date().getTime() / 1000;
      
    };

    function get_monitor_data() {

        successAction = function(data, status, xhr) {
          $.monitor_data = data;
          // run detect_dispolay_options() once
          $.once_detectdisplay_monitordata();
        };

        errorAction = function (xhr, status, error) {
          var statuscode = xhr.status;
          // show the error message in a popup window
          show_error_message(statuscode, error, true);
        };

        // when completed, call another loop for the worker
        completeAction = function() {
          // set the next loop, while making sure only one instance of the worker is running
          if ($.timer_get_monitor_data == null) {
            //$.worker_skip_counter = 0;
            $.timer_get_monitor_data = setTimeout(function() { get_monitor_data(); }, 1000 * 10);
          }
        };

        // do the ajax call
        ajaxCall($.monitor_dataurl, 'GET', null, successAction, errorAction, completeAction);
        $.timer_get_monitor_data = null;
    };

    function change_column_number_if_needed() {
      if ($.config["layout"]["add_more_columns"] === true) {
        if (! $.url().param('columns')) {
          // if the number of not shown tiles is bigger than the max + 10
          if ($.tiles_total > $.tiles_max) {
            // need to add more columns
            if ($.columns < (parseInt($.config["layout"]["columns_default"]) + $.config["layout"]["add_more_columns_max_growth"])) {
              console.log("adding more columns, from {0} to {1}".format($.columns, $.columns+1));
              detect_display_options($.columns+1);
            }
          } else {
            var proposed_geometry = detect_display_options($.columns - 1, true);
            if (($.columns > parseInt($.config["layout"]["columns_default"])) && ($.tiles_total <= proposed_geometry.tiles_max)) {
              // we can remove a column
              console.log("reducing the number of columns, from {0} to {1}".format($.columns, $.columns-1));
              detect_display_options($.columns-1);
            }
          }  
        }     
      }
    };

    // if memory leak, this should be the first place to look!
    function blink() {
      // blink all elements that need blinking
      if ($(".blink").length) {
        if ($.blink_state) {
          $(".blink").fadeIn(300 - 10);
        } else {
          $(".blink").fadeOut(300 - 10);
        }
        $.blink_state = ! $.blink_state;
      }
      // unbind the jquery selector to avoid memory leak
      // http://stackoverflow.com/questions/2316726/javascript-memory-leaks
      $(".blink").unbind();
    };

    function kill_blink() {
      if ($(".blink").length == 0) {
        if ($.timer_blink != null) {
          // nothing to blink, clear blinker timer
          clearTimeout($.timer_blink);
          $.timer_blink = null;
          $.timer_kill_blink = null;
        }
      } else {
        // re-set the timer
        $.timer_kill_blink = setTimeout(function() { kill_blink(); }, 1000 * 20);
      }
    };

    // adjust the width of the spacer element to so that the header information is right justified
    function recalculate_header_positions() {
      var header_container = $('#header-right-container');
      $("#spacer").css("margin-left", "1px");
      var space_left = Math.round($(window).width() - header_container.offset().left - header_container.outerWidth());
      $("#spacer").css("margin-left", "+={0}".format(space_left - 15));

      $("#spacer").unbind();
      header_container.unbind();
    };

    // ensure that only one copy can exist of a given counter
    $.myTimeout = function (name, func, duration) {
      if ($.timers === undefined) {
        $.timers = {};
      }
      if (!(name in $.timers)) {
        $.timers[name] = null;
      }
      if ($.timers[name] !== null) {
        // re-set current timer
        clearTimeout($.timers[name]);
      }
      $.timers[name] = setTimeout(function(func, name) {
          func();
          $.timers[name] = null;
      }, duration, func, name);
      
    };

    // get the configuration via API call, initialize display using the configuration contents
    function init() {
        successAction = function(data, status, xhr) {
          $.config = data;

          // draw the grid/initialize $.frame_manager, now with default values
          draw_grid();
          draw_grid_infobar();

          // set the window title and dashboard name in the header
          document.title = $.config["page_title"];
          if ($.config["dashboard_name_minor"] != "") {
            $(".main-title").html("{0} <small>{1}</small>".format($.config["dashboard_name_major"], $.config["dashboard_name_minor"]));
          } else {
            $(".main-title").html($.config["dashboard_name_major"]);
          }
        
          // show the initial loading message
          show_loading();

          // start the oncall timer, or remove the tag for it if it's disabled
          if ($.config["oncall_lookup_enabled"] || $.config["aod_lookup_enabled"]) {
            show_personnel();
            var timer_personnel = setInterval(function() { show_personnel(); }, 1000 * 60 * 5); // every 5 minutes
          }

          // start timer for lastok display
          if ($.config['show_last_ok'] === true) {
            show_lastok();
            var timer_lastok = setInterval(function() { show_lastok(); }, 1000 * 60); // every minute
          }

          // start usermsg feching, if needed
          if ($.config["user_msg"]["enabled"] === true) {
            $.user_msg_data = {};
            get_user_messages();
            var timer_user_msg = setInterval(function() { get_user_messages(); }, 1000 * 60 * 5);
          }

        };
        // do the ajax call
        ajaxCall($.getconfig_url, 'GET', null, successAction);
    };

    /* ============================== entry point =================================*/

    $.monitor_dataurl = "{0}/php/api/fetchdata_icinga.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1"));
    //$.monitor_dataurl = "{0}/tmp.json".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1"));
    $.personnel_url = "{0}/php/api/get_dashboard_data.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1"));   
    $.getconfig_url = "{0}/php/api/expose_configuration.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1")); 
    $.lastok_url = "{0}/php/api/get_last_state.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1")); 
    $.user_msg_url = "{0}/php/api/get_messages.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1")); 

    $.debug = false;

    // base timeout values, will be overridden in detect_display_options() 
    $.timeout_base = 100;
    $.queue_tick_time = $.timeout_base * 3;

    $.queue_tick_time_infobar = 300;
    $.timeout_base_infobar = 100;

    // get the display configuration from the configuration file
    init();

    // start fetching the data
    $.monitor_data = null;
    get_monitor_data();

    // show the time, set periodical call
    show_time();
    var timer_time = setInterval(function () { show_time(); }, 1000);
    var timer_show_clock_activity = setInterval(function () { show_clock_activity(); }, 1000);
    
    // showe the date, set periodical call, update every hour
    show_date();
    var timer_show_date = setInterval(function () { show_date(); }, 1000 * 60 * 60);

    // recalculate header positions after init
    var timer_recalculate_header_positions = setTimeout(function() { recalculate_header_positions(); }, 500);

    // on resize of the window call recalculate again
    // use debounce from underscore.js to avoid bouncing effect
    // http://stackoverflow.com/a/17754746
    $( window ).resize( _.debounce(recalculate_header_positions, 200) );
    $( window ).resize( _.debounce(detect_display_options, 200) );

    // set the initial freshness timestamp
    $.alive_timestamp = new Date().getTime() / 1000;

    $.myTimeout("worker", worker, $.queue_tick_time * 2);

    check_data_freshness();
    var timer_freshness = setInterval(function() { check_data_freshness(); }, 1000 * 20); // every 20 seconds

    // create a one-shot version of detect_display_options, to be called one time from get_monitor_data() and get_user_messages()
    $.once_detectdisplay_monitordata = _.once(detect_display_options);
    $.once_detectdisplay_usermessages = _.once(detect_display_options);

});

