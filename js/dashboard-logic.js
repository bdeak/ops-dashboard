$(function() {

    // templates to be used when creating tiles and messages
    $.templates = {};
    $.templates.tiles = '<div id="{id}" class="tile-frame">\n\
                          <!-- index: {index}, left: {left}, top: {top} -->\n\
                          <div class="alert alert-{state} tile">\n\
                            <div class="priority">{priority}</div>\n\
                            <div class="tile-rest">\n\
                              <div class="service {service_hidden}">{service}</div>\n\
                              <div class="host">{host}</div>\n\
                              <div class="tag_holder">\n\
                                <span class="dashtag alert_active blink {alert_active_hidden}">alert active</span>\n\
                                <span class="dashtag is_flapping {is_flapping_hidden}">flapping</span>\n\
                                <span class="dashtag is_soft {is_soft_hidden}">SOFT</span>\n\
                                <span class="dashtag">{duration}</span>\n\
                              </div>\n\
                            </div>\n\
                          </div>\n\
                        </div>\n';

    $.templates.messages = {        
        msg_big: { container_template: {}, container: {} }, 
        msg_loading: { container_template: {}, container: {} },
        msg_error: { container_template: {}, container: {} },
    };

    $.templates.messages.msg_big.template = '<div id="{message_id}" class="msg_big alert-success msg_ok">{message}</div>';
    $.templates.messages.msg_big.container = "#msg_container_main";

    $.templates.messages.msg_loading.template = '<div id="{message_id}" class="spinner"> \
                                                <div class="rect1"></div> \
                                                <div class="rect2"></div> \
                                                <div class="rect3"></div> \
                                                <div class="rect4"></div> \
                                                <div class="rect5"></div> \
                                              </div>';
    $.templates.messages.msg_loading.container = "#msg_container_main";      

    $.templates.messages.msg_error.template = '<div id="{message_id}" class="modal-content msg_error"> \
                                            <div class="modal-header"> \
                                                <div class="bootstrap-dialog-header"> \
                                                <!-- \
                                                    <div class="bootstrap-dialog-close-button" style="display: none;"> \
                                                        <button class="close">×</button> \
                                                    </div> \
                                                --> \
                                                    <div class="bootstrap-dialog-title">{title}</div> \
                                                </div> \
                                            </div> \
                                            <div class="modal-body"> \
                                                <div class="bootstrap-dialog-body"> \
                                                    <div class="bootstrap-dialog-message">{message}</div> \
                                                </div> \
                                            </div> \
                                        </div>';
    $.templates.messages.msg_error.container = "#msg_container_main";

    function makeMessage(object, id, index, left, top) {
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

		var priority = (object['priority'] == 0 ? "" : object['priority']);
		var alert_active_hidden = (object['alert_active'] === true ? "" : "hidden");
		var is_flapping_hidden = (object['is_flapping'] === true ? "" : "hidden");
		var is_soft_hidden = (object['is_soft'] === true ? "" : "hidden");
		var service_hidden = (object['type'] == "service" ? "" : "hidden");

		// fill the template with values
		var msg = $.templates.tiles.format_by_name({
			id: id,
			index: index,
			left: left,
			top: top,
			state: state,
			priority: priority,
			service_hidden: service_hidden,
			service: ("service" in object ? object['service'].replace(/^Systemcheck/, "SC:") : null),
			host: object["host"],
			alert_active_hidden: alert_active_hidden,
			is_flapping_hidden: is_flapping_hidden,
			is_soft_hidden: is_soft_hidden,
			duration: object["duration"],

		});

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

    // available types:
    // * msg_big - ALL OK
    // * msg_loading - loading
    // * msg_error - error message with header and different layout
    function show_message(message, type, do_show, title) {

      message = message || "";

      function message_displayed(id) {
        var selector_id = $("#"+ id);
        if (selector_id.length > 0) {
          selector_id.unbind();
          return true;
        }
        else {
          selector_id.unbind();
          return false;
        }
      }
   
      var message_md5 = $.md5(message + type);
      var message_id_template = "message_{md5}";
      var message_id = message_id_template.format_by_name({md5: message_md5});

      if ((title === undefined) && (type == "msg_error")) {
        title = "Error";
      }

      if (do_show) {
        if ($.frame_manager.get_frame_length() > 1) {
          // issue a delete of all tiles in the grid

          // reverse the array (to delete from backwards to avoid sensless rearranging of the grid)
          var ids = $.frame_manager.get_frame_list().reverse();
          // iterate on the reversed array and delete the tiles that are no longer needed
          $.each(ids, function(i) {
            // get the md5 id for the current alert
            // check if this tile existed before
            console.debug("Deleting tile with id '{0}'' so message can be shown".format(ids[i]));
            delete_tile(ids[i]);
          });
        }

        // if there's a message already shown, we need to hide it first
        if (($.message_shown.type !== null) && ($.message_shown.md5 != message_md5)) {
          console.debug("deleting message with type {0}, id {1}".format($.message_shown.type, message_id_template.format_by_name({md5: $.message_shown.md5})));
          var element = {
              container: "{0} #{1}".format($.templates.messages[$.message_shown.type]["container"], message_id_template.format_by_name({md5: $.message_shown.md5})),
          }
          $.frame_manager.queue_add("hide_msg", element);
        }
        if (! message_displayed(message_id)) {
          console.debug("showing message '{0}' with type '{1}', id '{2}'".format(message, type, message_md5));
          // show the error message
          var element = {
            container: $.templates.messages[type]["container"],
            content: $.templates.messages[type]["template"].format_by_name({message: message, title: title, message_id: message_id}),
          }
          $.frame_manager.queue_add("show_msg", element);
          $.message_shown.type = type;
          $.message_shown.md5 = message_md5;
        }
      } else {
        if (message_displayed(message_id)) {
        console.debug("Hide message was requested for message {0}, type {1}".format(message, type));
          // hide the error message
          var element = {
              container: "{0} #{1}".format($.templates.messages[type]["container"], message_id), // fixme: initially this may be null
          }
          $.frame_manager.queue_add("hide_msg", element);
          $.message_shown.type = null;
          $.message_shown.md5 = null;

          // queue a display detection also
          var element = {
            func_name: detect_display_options,
            parameters: [null, null, true],
          }
          $.frame_manager.queue_add("external_function", element);     

        }
      }
    };

    // show a message without using the tile manager
    // only to be used initially to show the loading animation
    function show_message_immediate(message, type, do_show, title) {
      message = message || "";
      var message_md5 = $.md5(message + type);
      var message_id_template = "message_{md5}";
      var message_id = message_id_template.format_by_name({md5: message_md5});
      var container = $.templates.messages[type]["container"];
      var content = $.templates.messages[type]["template"].format_by_name({message: message, title: title, message_id: message_id});
      $(container).append(content).hide().fadeIn($.queue_tick_time * 2);
      $.message_shown.type = type;
      $.message_shown.md5 = message_md5;
    };

    function delete_all_messages() {
      if ($("#msg_container_main").children().length) {
        console.debug("Deleting all messages");
        $("#msg_container_main").fadeOut($.queue_tick_time * 2, function() {
            $(this).empty();
        });
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
            $.frame_manager_infobar.queue_add("external_function", element);
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
            $.frame_manager_infobar.queue_add("external_function", element);

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
            $.frame_manager_infobar.queue_add("external_function", element);
          }
        }
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

    // initialize the frame grid
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
        debug: $.config["debug"]["frontend"]["tile_manager"],
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

    String.prototype.format_by_name = function(format) {
        var formatted = this;
        $.each(format, function(name, value) {
            var placeholder = "\\{" + name + "\\}";
            var re = new RegExp(placeholder, "g");
            formatted = formatted.replace(re, value);
        });
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
  
        console.debug("screen size: {7}x{8} detected sizes: tile size: {0}x{1} / columns: {2} / rows: {3} / tiles_max: {4} / aspect_ratio: {5}x1 / footer: {6}"
          .format($.tile_sizex, $.tile_sizey, $.columns, $.rows, $.tiles_max, $.tile_sizex/$.tile_sizey, footer_size, screen_sizex, screen_sizey));
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

        lastok_chart.show[$.config.last_ok.chart.type](true);

      }
      return {columns: proposed_columns, rows: proposed_rows, tile_sizex: proposed_tile_sizex, tile_sizey: proposed_tile_sizey, tiles_max: proposed_tiles_max};
    };


    // update the font size of the tile depending on the dimensions of the tile
    // all CSS elements within the tile are using the 'em' unit so that their sizes
    // are only depending on the font size of the parent element, that is, '.tile-frame'
    //
    // note:
    // this is a workaround for the fact that CSS can't scale elements relative to their parent 
    // containers, only to font sizes or viewport sizes
    function update_tile_text() {
      
      // assemble an associative array with the data that will be added to the DOM in the form of a new stylesheet
      var style_data = {};
      style_data['.tile-frame'] = {};
      style_data['.tile-frame']['font-size'] = Math.round($.tile_sizey * 0.108) + "px";
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
        }
        // do the ajax call
        ajaxCall($.personnel_url, 'GET', null, successAction);
      };

      lastok_chart = {

        show: {

          // show the bar chart
          bar: function (no_refresh) {
             // fill the data structure for the chart with the data that was fetched
             successAction = function(json_data, status, xhr) {
              if ($.lastok_chart_data === undefined) {
                $.lastok_chart_data = new google.visualization.DataTable();
                // add the columns, with custom roles for tooltips and coloring
                $.lastok_chart_data.addColumn('string', "Date");
                $.lastok_chart_data.addColumn('number', "OK");
                $.lastok_chart_data.addColumn({type: 'string', role: 'tooltip'});
                $.lastok_chart_data.addColumn({type: 'string', role: 'style'});
                $.lastok_chart_data.addColumn('number', "Problem");
                $.lastok_chart_data.addColumn({type: 'string', role: 'tooltip'});
                $.lastok_chart_data.addColumn({type: 'string', role: 'style'});
                $.lastok_chart_data.addRows($.assocArraySize(json_data));
              }
              // check if the number of rows needs to be adjusted
              var animate = true;
              var need_redraw = false;
              if (($.lastok_chart_data.getNumberOfRows()) != $.assocArraySize(json_data)) {
                if (($.lastok_chart_data.getNumberOfRows()) > $.assocArraySize(json_data)) {
                  // need to remove rows
                  $.lastok_chart_data.removeRows(0, $.lastok_chart_data.getNumberOfRows() - $.assocArraySize(json_data));
                } else {
                  // need to add more rows
                  $.lastok_chart_data.addRows($.assocArraySize(json_data) - $.lastok_chart_data.getNumberOfRows());
                }
                need_redraw = true;
                animate = false;
              }

              // populate the colums with data
              for (var row = 0 ; row < $.assocArraySize(json_data) ; row++) {
                var i=0;
				
				var formatterDate;
				// formatter patterns from http://userguide.icu-project.org/formatparse/datetime#TOC-DateTimePatternGenerator
				if (json_data[row+1]["grouping"] == "day") {
					formatterDate = new google.visualization.DateFormat({pattern: 'EEE'});
				} else if (json_data[row+1]["grouping"] == "week") {
					formatterDate = new google.visualization.DateFormat({pattern: 'CWww'});
				} else if (json_data[row+1]["grouping"] == "month") {
					formatterDate = new google.visualization.DateFormat({pattern: 'MMM'});
				} else {
					// unrecognized
					formatterDate = new google.visualization.DateFormat({pattern: 'yyyy.MM.dd'});
				}

                $.lastok_chart_data.setValue(row, i++, formatterDate.formatValue(new Date((json_data[row+1]["range_start"] + 1) * 1000)));
                $.lastok_chart_data.setValue(row, i++, json_data[row+1]["duration_percent"]["OK"]);
                $.lastok_chart_data.setValue(row, i++, "{0}: OK: {1}".format(json_data[row+1]["range_name_long"], 
                                                       json_data[row+1]["duration_human"]["OK"]));
                $.lastok_chart_data.setValue(row, i++, "stroke-color: {0}; fill-color: {1}".format($.config.last_ok.chart.bar.color.OK.outline,
                                                                                                   $.config.last_ok.chart.bar.color.OK.fill));
                $.lastok_chart_data.setValue(row, i++, json_data[row+1]["duration_percent"]["PROBLEM"]);
                $.lastok_chart_data.setValue(row, i++, "{0}: Problem: {1}".format(json_data[row+1]["range_name_long"], 
                                                       json_data[row+1]["duration_human"]["PROBLEM"]));            
                $.lastok_chart_data.setValue(row, i++, "stroke-color: {0}; fill-color: {1}".format($.config.last_ok.chart.bar.color.PROBLEM.outline,
                                                                                                   $.config.last_ok.chart.bar.color.PROBLEM.fill));
              }
              // finally, draw the chart
              if (need_redraw) {
                hide_lastok_chart();
              }
              draw_chart(animate);
            }

            // draw the chart based on the already filled data
            draw_chart = function(animate) {
              animate = animate || false;
              if ($.lastok_chart_data !== undefined) {
                if ($.lastok_chart === undefined) {
                $("#chart-container").removeClass("hidden").hide();
                  $.lastok_chart = new google.visualization.ColumnChart($("#chart-container")[0]);
                }
                // calculate the height and width of the chart - unfortuantely google charts is not responsive
                // 12vw
                var chart_width = ($(window).width() / 100) * 15;
                var chart_height = ($(window).width() / 100) * 3.5;
                var margin_top = ($(window).width() / 100) * 1.2 / 60 * 10;
                var chart_options = {  width: chart_width,
                                       height: chart_height,
                                       backgroundColor: 'transparent',
                                       animation: { duration: 0, easing: 'out', startup: false },
                                       vAxis: { gridlines: { color: 'transparent' }, textPosition: 'none', baselineColor: 'transparent'},
                                       hAxis: { gridlines: { color: 'transparent' }, format: "dd", textPosition: 'in', textStyle: { color: 'black', bold: false, fontName: 'Arial' }, baselineColor: 'transparent' },
                                       isStacked: true,
                                       legend: { position: 'none' },
                                       bar: { groupWidth: '90%' },
                                       chartArea: { left: 0, top: margin_top, width: '100%', height: '85%' },
                             };
                if (animate) {
                  chart_options.animation.duration = 1000;
                }
                // draw the chart
                $.lastok_chart.draw($.lastok_chart_data, chart_options);
                // animate the display of the chart
                $('#chart-container').show("blind", {direction: "down", easing: "easeOutCirc"}, 1000);
              }
            }

            no_refresh = no_refresh || false;

            if ($.config['last_ok']["chart"]['enabled'] === true) {
              if (no_refresh !== true) {
                ajaxCall($.lastok_chart_url, 'GET', null, successAction);
                // set up next round
                $.myTimeout("lastok_chart", lastok_chart.show[$.config.last_ok.chart.type], 2 * 60 * 1000);
              } else {
                draw_chart();
              }
            }
          },

          // line chart
          line: function (no_refresh) {

           // fill the data structure for the chart with the data that was fetched
           successAction = function(json_data, status, xhr) {

            if ($.lastok_chart_data === undefined) {
              $.lastok_chart_data = new google.visualization.DataTable();
              // add the columns, with custom roles for tooltips and coloring
              $.lastok_chart_data.addColumn('string', "Date");
              $.lastok_chart_data.addColumn('number', "OK");
              $.lastok_chart_data.addColumn({type: 'string', role: 'tooltip'});
              $.lastok_chart_data.addColumn({type: 'string', role: 'style'});
              $.lastok_chart_data.addRows($.assocArraySize(json_data));
            }

            // check if the number of rows needs to be adjusted
            if (($.lastok_chart_data.getNumberOfRows()) != $.assocArraySize(json_data)) {
              if (($.lastok_chart_data.getNumberOfRows()) > $.assocArraySize(json_data)) {
                // need to remove rows
                $.lastok_chart_data.removeRows(0, $.lastok_chart_data.getNumberOfRows() - $.assocArraySize(json_data));
              } else {
                // need to add more rows
                $.lastok_chart_data.addRows($.assocArraySize(json_data) - $.lastok_chart_data.getNumberOfRows());
              }
            }

            // populate the colums with data
            for (var row = 0 ; row < $.assocArraySize(json_data) ; row++) {
              var i=0;

              var formatterDate;
              // formatter patterns from http://userguide.icu-project.org/formatparse/datetime#TOC-DateTimePatternGenerator
              if (json_data[row+1]["grouping"] == "day") {
              	formatterDate = new google.visualization.DateFormat({pattern: 'EEE'});
              } else if (json_data[row+1]["grouping"] == "week") {
              	formatterDate = new google.visualization.DateFormat({pattern: 'CWww'});
              } else if (json_data[row+1]["grouping"] == "month") {
              	formatterDate = new google.visualization.DateFormat({pattern: 'MMM'});
              } else {
              	// unrecognized
              	formatterDate = new google.visualization.DateFormat({pattern: 'yyyy.MM.dd'});
              }

              $.lastok_chart_data.setValue(row, i++, formatterDate.formatValue(new Date((json_data[row+1]["range_start"] + 1) * 1000)));
              $.lastok_chart_data.setValue(row, i++, json_data[row+1]["duration_percent"]["OK"]);
              $.lastok_chart_data.setValue(row, i++, "{0}: OK: {1}".format(json_data[row+1]["range_name_long"], 
                                                     json_data[row+1]["duration_human"]["OK"]));
              $.lastok_chart_data.setValue(row, i++, "color: {0}".format($.config.last_ok.chart.line.color.OK));
            }

            draw_chart();

          }

          // draw the chart based on the already filled data
          draw_chart = function(animate) {

            if (!_.isBoolean(animate)) {
              animate = true;
            }

            if ($.lastok_chart_data !== undefined) {

              if ($.lastok_chart === undefined) {
                $("#chart-container").removeClass("hidden").hide();
                $.lastok_chart = new google.visualization.LineChart($("#chart-container")[0]);
              }

              // calculate the height and width of the chart - unfortuantely google charts is not responsive
              // 12vw
              var chart_width = ($(window).width() / 100) * 15;
              var chart_height = ($(window).width() / 100) * 3.3;
              var margin_top = ($(window).width() / 100) * 2 / 60 * 10;


              var chart_options = { width: chart_width,
                                    height: chart_height,
                                    backgroundColor: 'transparent',
                                    animation: { duration: 1000, easing: 'out', startup: true },
                                    vAxis: { ticks: [0, 50, 100] , gridlines: { color: '#585858' }, textPosition: 'out', baselineColor: 'grey', textStyle: { color: 'white'}, viewWindow: {min: 0, max: 100}, format: '#\'%\''},
                                    hAxis: { gridlines: { color: 'transparent' }, textPosition: 'out', textStyle: { color: 'white' }, baselineColor: 'transparent' },
                                    legend: { position: 'none' },
                                    chartArea: { left: 0, top: 0, width: '100%', height: '80%' }, 
                                    curveType: 'function',
                                    chartArea: { top: margin_top },
                                    pointSize: 0,
                                  };

              if (animate === false) {
                chart_options.animation.duration = 0;
                chart_options.animation.startup = false;
              }

              // draw the chart
              $.lastok_chart.draw($.lastok_chart_data, chart_options);
              // animate the display of the chart
              $('#chart-container').show("fade", {direction: "down", easing: "easeOutCirc"}, 1000);
            }
          }

          no_refresh = no_refresh || false;

          if ($.config['last_ok']['chart']['enabled'] === true) {
            if (no_refresh !== true) {
              ajaxCall($.lastok_chart_url, 'GET', null, successAction);
              // set up next round
              $.myTimeout("lastok_chart", lastok_chart.show.line, 2 * 60 * 1000);
            } else {
              draw_chart(false);
            }
          }
        },  

        // area chart 
        area: function (no_refresh) {

           // fill the data structure for the chart with the data that was fetched
           successAction = function(json_data, status, xhr) {

            if ($.lastok_chart_data === undefined) {
              $.lastok_chart_data = new google.visualization.DataTable();
              // add the columns, with custom roles for tooltips and coloring
              $.lastok_chart_data.addColumn('string', "Date");
              $.lastok_chart_data.addColumn('number', "OK");
              $.lastok_chart_data.addColumn({type: 'string', role: 'tooltip'});
              $.lastok_chart_data.addColumn({type: 'string', role: 'style'});
              $.lastok_chart_data.addRows($.assocArraySize(json_data));
            }

            // check if the number of rows needs to be adjusted
            if (($.lastok_chart_data.getNumberOfRows()) != $.assocArraySize(json_data)) {
              if (($.lastok_chart_data.getNumberOfRows()) > $.assocArraySize(json_data)) {
                // need to remove rows
                $.lastok_chart_data.removeRows(0, $.lastok_chart_data.getNumberOfRows() - $.assocArraySize(json_data));
              } else {
                // need to add more rows
                $.lastok_chart_data.addRows($.assocArraySize(json_data) - $.lastok_chart_data.getNumberOfRows());
              }
            }

            // populate the colums with data
            for (var row = 0 ; row < $.assocArraySize(json_data) ; row++) {
              var i=0;

              var formatterDate;
              // formatter patterns from http://userguide.icu-project.org/formatparse/datetime#TOC-DateTimePatternGenerator
              if (json_data[row+1]["grouping"] == "day") {
                formatterDate = new google.visualization.DateFormat({pattern: 'EEE'});
              } else if (json_data[row+1]["grouping"] == "week") {
                formatterDate = new google.visualization.DateFormat({pattern: 'CWww'});
              } else if (json_data[row+1]["grouping"] == "month") {
                formatterDate = new google.visualization.DateFormat({pattern: 'MMM'});
              } else {
                // unrecognized
                formatterDate = new google.visualization.DateFormat({pattern: 'yyyy.MM.dd'});
              }

              $.lastok_chart_data.setValue(row, i++, formatterDate.formatValue(new Date((json_data[row+1]["range_start"] + 1) * 1000)));
              $.lastok_chart_data.setValue(row, i++, json_data[row+1]["duration_percent"]["OK"]);
              $.lastok_chart_data.setValue(row, i++, "{0}: OK: {1}".format(json_data[row+1]["range_name_long"], 
                                                     json_data[row+1]["duration_human"]["OK"]));
              $.lastok_chart_data.setValue(row, i++, "color: {0}".format($.config.last_ok.chart.line.color.OK));
            }

            draw_chart();

          }

          // draw the chart based on the already filled data
          draw_chart = function(animate) {

            if (!_.isBoolean(animate)) {
              animate = true;
            }

            if ($.lastok_chart_data !== undefined) {

              if ($.lastok_chart === undefined) {
                $("#chart-container").removeClass("hidden").hide();
                $.lastok_chart = new google.visualization.AreaChart($("#chart-container")[0]);
              }

              // calculate the height and width of the chart - unfortuantely google charts is not responsive
              // 12vw
              var chart_width = ($(window).width() / 100) * 15;
              var chart_height = ($(window).width() / 100) * 3.3;
              var margin_top = ($(window).width() / 100) * 2 / 60 * 10;


              var chart_options = { width: chart_width,
                                    height: chart_height,
                                    backgroundColor: 'transparent',
                                    animation: { duration: 1000, easing: 'out', startup: true },
                                    vAxis: { ticks: [0, 50, 100] , gridlines: { color: '#585858' }, textPosition: 'out', baselineColor: 'grey', textStyle: { color: 'white'}, viewWindow: {min: 0, max: 100}, format: '#\'%\'' },
                                    hAxis: { gridlines: { color: 'transparent' }, textPosition: 'out', textStyle: { color: 'white' }, baselineColor: 'transparent' },
                                    legend: { position: 'none' },
                                    chartArea: { left: 0, top: 0, width: '100%', height: '80%' }, 
                                    curveType: 'function',
                                    chartArea: { top: margin_top },
                                    pointSize: 0,
                                  };

              if (animate === false) {
                chart_options.animation.duration = 0;
                chart_options.animation.startup = false;
              }

              // draw the chart
              $.lastok_chart.draw($.lastok_chart_data, chart_options);
              // animate the display of the chart
              $('#chart-container').show("fade", {direction: "down", easing: "easeOutCirc"}, 1000);
            }
          }

          no_refresh = no_refresh || false;

          if ($.config['last_ok']['chart']['enabled'] === true) {
            if (no_refresh !== true) {
              ajaxCall($.lastok_chart_url, 'GET', null, successAction);
              // set up next round
              $.myTimeout("lastok_chart", lastok_chart.show.line, 2 * 60 * 1000);
            } else {
              draw_chart(false);
            }
          }
        },   
      },

      hide: {
        // hide the chart, required for window resizing, as unfortunately the google charts are not responsive
        bar: function() {
            $('#chart-container').hide("blind", {direction: "down", easing: "easeOutCirc"}, 200);
        },

        line: function() {
            $('#chart-container').hide("fade", {direction: "down", easing: "easeOutCirc"}, 500);
        },
        area: function() {
            $('#chart-container').hide("fade", {direction: "down", easing: "easeOutCirc"}, 500);
        },               
      },
    };


      // get the lastok state
      function show_lastok() {
        if ($.config['last_ok']['enabled'] === true) {

          $.lastok_second = $.lastok_second || null;
          $.lastok_currstate = $.lastok_currstate || null;

          successAction = function(data, status, xhr) {

            // analyze the value
            if (parseInt(data["duration_sec"]) < 60 * 60) {
              $.lastok_second = parseInt(data["duration_sec"]);
              $.lastok_currstate = data["currstate"];
              // need to increment on a per second basis
              increment_lastok_frequently();
            } else {
              // set the value normally
              $.lastok_second = null;
              $.lastok_currstate = null;
              $('#lastok').html(convert_seconds_to_duration(parseInt(data["duration_sec"])));
              // change the icon if needed
              if (!$('#lastok-container .glyphicon').hasClass($.config["icon"]["lastok"][data["currstate"]])) {
                // remove all classes and add the needed ones back
                $('#lastok-container .glyphicon').removeClass().addClass("glyphicon topicon {0}".format($.config["icon"]["lastok"][data["currstate"]]));
              }
              $('#lastok-container .glyphicon').unbind();

              // unhide the tag if needed
              if ($('#lastok-container').hasClass("hidden")) {
                $('#lastok-container').removeClass("hidden");
              }
              $('#lastok-container').unbind();
            }
          }
          ajaxCall($.lastok_url, 'GET', null, successAction);
        }
      };

      // when the last ok state change has happened less than a minute ago,
      // increment the display until it reaches the minute range
      function increment_lastok_frequently() {
        if ($.lastok_second !== null) {

          $('#lastok').html(convert_seconds_to_duration($.lastok_second));
          if ($('#lastok-container').hasClass("hidden")) {
            $('#lastok-container').removeClass("hidden");
          }
          // change the icon if needed
          if (!$('#lastok-container .glyphicon').hasClass($.config["icon"]["lastok"][$.lastok_currstate])) {
            // remove all classes and add the needed ones back
            $('#lastok-container .glyphicon').removeClass().addClass("glyphicon topicon {0}".format($.config["icon"]["lastok"][$.lastok_currstate]));
          }

          $('#lastok-container').unbind();        
          $('#lastok-container .glyphicon').unbind();
          $('#lastok').unbind();

          // reschedule if needed
          if ($.lastok_second < 60) {
            $.lastok_second++;
            $.myTimeout("increment_lastok_frequently", increment_lastok_frequently, 1000);
          } else if ($.lastok_second < 60 * 60) {
            $.lastok_second += 5;
            $.myTimeout("increment_lastok_frequently", increment_lastok_frequently, 5 * 1000);
          }
        }
      };

      function convert_seconds_to_duration (seconds) {
        var duration;
        if (seconds > 60 * 60 * 24 * 7) {
          duration = seconds / (60 * 60 * 24 * 7);
          return duration.toFixed(1) + "w";
        }
        if (seconds > 60 * 60 * 24) {
          duration = seconds / (60 * 60 * 24);
          return duration.toFixed(1) + "d";
        }
        if (seconds > 60 * 60) {
          duration = seconds / (60 * 60);
          return duration.toFixed(1) + "h";
        }
        if (seconds > 59) {
          duration = seconds / 60;
          return duration.toFixed(1) + "m";
        }
        return seconds + "s";
      };

      // check if alert on data freshness should be displayed
      function check_data_freshness() {
        var now = new Date().getTime() / 1000;
        var is_fresh = true;
        if ((now - $.alive_timestamp) > parseInt($.config["show_outdated"]["data"]["max_time"])) {
          is_fresh = false;
        }
        if (is_fresh === false) {
          show_message("The data update process seems not to be running properly.", "msg_error", true);
        } else {
          show_message("The data update process seems not to be running properly.", "msg_error", false);
        }
        return is_fresh;
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

        if (($.metadata !== null) && ($.config["show_outdated"]["icinga"]["enabled"] === true)) {
          if ($.metadata["status_data_age"] > $.metadata["status_update_interval"] * parseInt($.config["show_outdated"]["icinga"]["threshold"])) {
            // data is outdated, show error message
            show_message("Data received from monitoring server is outdated", "msg_error", true);
            $.myTimeout("worker", worker, 5000);
            return false;
          }
        }

        if (check_data_freshness() === false) {
          // message is shown, don't go on with displaying any tiles
          $.myTimeout("worker", worker, 5000);
          return false;
        }

        show_message(null, "msg_loading", false);

        //// hide the error message, if it was present
        //if ($(".msg_error").length || $(".msg_loading").length) {
        //  var element = {
        //      container: "#msg_container_main #msg_error",
        //  }
        //  $.frame_manager.queue_add("hide_msg", element);
        //}

        // we only show a predefined number of tiles, therefore we create a subset of the 
        // data hash that we will work with from now on

        // store the size of the $.monitor_data hash
        $.tiles_total = $.assocArraySize($.monitor_data);
        
        // initialize a temp array that will store only the alerts that are also visible
        var data_shown = {};
        data_shown = {};
        var i = 0;
        if ($.tiles_total != 0) {        
          $.each($.monitor_data, function(index, obj) {
            if (i >= $.tiles_max) {
            //if (i >= 3) {
              return false
            } else {
              data_shown[index] = obj;
              i += 1;
            }
          });
        }

        // remove tiles that are there, but are not supposed to be there
        delete_no_longer_needed_alerts(data_shown);

        if ($.tiles_total == 0) {
          // display the message
          show_message("Everything OK", "msg_big", true);
          show_lastok();
          
          // hide the infobar, if it was showed
          show_infobar_if_needed(data_shown);
        } else {
          // hide the all ok message
          show_message("Everything OK", "msg_big", false);
          // delete all shown messages

          delete_all_messages();
          
          show_lastok();

          // add new alerts
          add_new_alerts_if_needed(data_shown);

          // update information on alerts currently displayed
          update_alert_information(data_shown);
        }

        // add a queue entry for changing the number of columns - will do something only if it's needed
        $.frame_manager.queue_add("external_function", {func_name: change_column_number_if_needed});
        $.frame_manager.queue_add("external_function", {
          func_name: show_infobar_if_needed,
          parameters: [ $.monitor_data ],
        });

        // set the next round
        $.myTimeout("worker", worker, 20 * 1000);


      } else {
        // set up a shorter timeout
        $.myTimeout("worker", worker, ($.frame_manager.queue_length() + 4) * $.queue_tick_time);
      }     
    };

    function get_monitor_data() {

        successAction = function(data, status, xhr) {
          $.monitor_data = data["status"];
          $.metadata = data["metadata"];
          // run detect_display_options() once
          $.once_detectdisplay_monitordata();
        };

        errorAction = function (xhr, status, error) {
          var statuscode = xhr.status;
          var responseText = $.parseJSON(xhr.responseText);
          // check if there's a reason

          if ((responseText) && ("ERROR" in responseText)) {
            show_message(responseText["ERROR"]["message"], "msg_error", true);
          } else {
            // show the error message in a popup window
            show_message("Error {0}: {1}".format(statuscode, error), "msg_error", true);
          }
        };

        // when completed, call another loop for the worker
        completeAction = function() {
          // set the next loop, while making sure only one instance of the worker is running
          $.myTimeout("get_monitor_data", get_monitor_data, 10 * 1000);
          
          // update global timestamp showing freshness of the data showed on the screen
          // will be checked in check_data_freshness()
          $.alive_timestamp = new Date().getTime() / 1000;          
        };

        // do the ajax call
        ajaxCall($.monitor_dataurl, 'GET', null, successAction, errorAction, completeAction);
    };


    function change_column_number_if_needed() {
      if ($.config["layout"]["add_more_columns"] === true) {
        if (! $.url().param('columns')) {
          if ($.tiles_total > $.tiles_max && $.columns < parseInt($.config["layout"]["columns_default"]) + parseInt($.config["layout"]["add_more_columns_max_growth"])) {
            // need to add more columns
            // start from the maximum allowed number of columns and go down from there
            for (var i = 1 ; i <= parseInt($.config["layout"]["add_more_columns_max_growth"]) ; i++) {
              var proposed_geometry = detect_display_options($.columns + i, true);
              if ($.tiles_total <= proposed_geometry.tiles_max) {
                // this size is enough
                console.debug("scaling to more columns, from {0} to {1}".format($.columns, $.columns+i));
                detect_display_options($.columns + i);
                break;
              } else {
                // need to grow further
                if (i != parseInt($.config["layout"]["add_more_columns_max_growth"])) {
                  // console.log("need to grow further");
                } else {
                  // not allowed to grow further
                  detect_display_options($.columns + i);
                  // console.log("can't grow further");
                  break;
                }
              }
            }
          } else {
            if ($.columns > parseInt($.config["layout"]["columns_default"])) {
              for (var i = $.columns - parseInt($.config["layout"]["columns_default"]) ; i > 0 ; i--) {
                var proposed_geometry = detect_display_options($.columns - i, true);
                if ($.tiles_total <= proposed_geometry.tiles_max) {
                  // this size is enough
                  console.debug("reducing the number of columns, from {0} to {1}".format($.columns, $.columns - i));
                  detect_display_options($.columns - i);
                } else {
                  // need to reduce further
                }
              }
            }
          }
        }
      }
    }

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
      }, duration, func, name);
    };

    $.myKillTimeout = function (name, lazy) {
      lazy = lazy || false;
      if (($.timers !== undefined) && (name in $.timers) && ($.timers[name] !== null)) {
        clearTimeout($.timers[name]);
        $.timers[name] = null;
        if ($.debug)
          console.debug("Timeout with name '{0}' has been killed".format(name));
      } else {
        if (lazy !== true)
          console.warn("Can't kill timeout with name '{0}': timer not found".format(name));
      }
    }

    // expose function to the JS console in the browser for debugging
    if ($.debug) 
      window.myKillTimeout = $.myKillTimeout;

    // get the configuration via API call, initialize display using the configuration contents
    function init() {
        successAction = function(data, status, xhr) {
          $.config = data;

          $.debug = $.config["debug"]["frontend"]["main"] || false;

          // show the charts early
          if ($.config.last_ok.chart.enabled) {
            $.myTimeout("lastok_chart", lastok_chart.show[$.config.last_ok.chart.type], 200);
            $( window ).resize( _.debounce(lastok_chart.hide[$.config.last_ok.chart.type], 100) );
          }
          // start timer for lastok display
          if ($.config['last_ok']['enabled'] === true) {
            $.myTimeout("lastok", show_lastok, 200);
          }


          // draw the grid/initialize $.frame_manager, now with default values
          draw_grid();
          draw_grid_infobar();

          // set the window title and dashboard name in the header
          document.title = $.config["page_title"];
          if ($.config["dashboard_name_minor"] != "") {
            $(".main-title").html("{0} <span class='subtitle'>{1}</span>".format($.config["dashboard_name_major"], $.config["dashboard_name_minor"]));
          } else {
            $(".main-title").html($.config["dashboard_name_major"]);
          }
        
          // start the oncall timer, or remove the tag for it if it's disabled
          if ($.config["oncall_lookup_enabled"] || $.config["aod_lookup_enabled"]) {
            show_personnel();
            var timer_personnel = setInterval(function() { show_personnel(); }, 1000 * 60 * 5); // every 5 minutes
          }

          // start usermsg feching, if needed
          if ($.config["user_msg"]["enabled"] === true) {
            $.user_msg_data = {};
            get_user_messages();
            var timer_user_msg = setInterval(function() { get_user_messages(); }, 1000 * 60 * 5);
          }

          if ($.config["show_outdated"]["data"]["enabled"] === true) {
            var timer_freshness = setInterval(function() { check_data_freshness(); }, 1000 * 20); // every 20 seconds
          }

        };

        // show the initial loading message
        show_message_immediate(null, "msg_loading", true);

        // do the ajax call
        ajaxCall($.getconfig_url, 'GET', null, successAction);
    };

    /* ============================== entry point =================================*/

    $.monitor_dataurl = "{0}/php/api/fetchdata.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1"));
    //$.monitor_dataurl = "{0}/tmp.json".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1"));
    $.personnel_url = "{0}/php/api/get_dashboard_data.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1"));   
    $.getconfig_url = "{0}/php/api/expose_configuration.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1")); 
    $.lastok_url = "{0}/php/api/get_last_state.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1")); 
    $.lastok_chart_url = "{0}/php/api/get_last_state_history.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1")); 
    $.user_msg_url = "{0}/php/api/get_messages.php".format(window.location.href.replace(/^(.*)\/[^\/]*$/, "$1")); 

    // base timeout values, will be overridden in detect_display_options() 
    $.timeout_base = 100;
    $.queue_tick_time = $.timeout_base * 3;

    $.queue_tick_time_infobar = 300;
    $.timeout_base_infobar = 100;
    $.message_shown = { type: null, md5: null };

    // get the display configuration from the configuration file
    init();

    // start fetching the data
    $.monitor_data = null;
    $.metadata = null;

    get_monitor_data();

    // show the time, set periodical call
    show_time();
    var timer_time = setInterval(function () { show_time(); }, 1000);
    var timer_show_clock_activity = setInterval(function () { show_clock_activity(); }, 1000);
    
    // showe the date, set periodical call, update every hour
    show_date();
    var timer_show_date = setInterval(function () { show_date(); }, 1000 * 60 * 60);

    // on resize of the window call recalculate again
    // use debounce from underscore.js to avoid bouncing effect
    // http://stackoverflow.com/a/17754746
    $( window ).resize( _.debounce(detect_display_options, 200) );


    // set the initial freshness timestamp
    $.alive_timestamp = new Date().getTime() / 1000;

    $.myTimeout("worker", worker, $.queue_tick_time * 2);

    // create a one-shot version of detect_display_options, to be called one time from get_monitor_data() and get_user_messages()
    $.once_detectdisplay_monitordata = _.once(detect_display_options);
    $.once_detectdisplay_usermessages = _.once(detect_display_options);

});

