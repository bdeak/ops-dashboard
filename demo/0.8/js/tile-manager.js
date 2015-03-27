
// frame manager
var TileManager = Backbone.View.extend(
{
    // defaults inputs
    options:
    {
        // default frame size
        frame:
        {
            width : 250,
            height : 50,
        },

        // columns
        cols: null,

        // maximum number of rows
        rows: 5,

        // margin
        margin: 5,

        max_frames: 10,

        columns: 2,

        effects: {
            add: {
              effect: "slide",
              options: {},
            },
            del: {
              effect: "slide",
              options: {},
            },
            position_change: "all-at-once",
        },

        user_msg: {
          duration: 15000,
          direction: "left",
          duplicated: true,
          gap: 1,
        },

        queue_tick_time: 300,
        timeout_base: 100,
        debug: false,

    },
    

    // initialize
    initialize : function(options)
    {
        // read in defaults
        if (options)
            this.options = _.defaults(options, this.options);

        this.el = this.options.el;

        // frame counter
        this.frame_counter = 0;
        
        // frame list
        this.frame_list = {};
        
        this.queue = [];

        this.queue_position = 0;

        this.debug = this.options.debug;

    },

    update_layout: function(tile_sizex, tile_sizey, columns, rows, margin, tiles_max, queue_tick_time, timeout_base) {
        this.options.frame.width = tile_sizex;
        this.options.frame.height = tile_sizey;
        this.options.columns = columns;
        this.options.rows = rows;
        this.options.margin = margin;
        this.options.max_frames = tiles_max;
        this.options.queue_tick_time = queue_tick_time || this.options.queue_tick_time;
        this.options.timeout_base = timeout_base || this.options.timeout_base;
    },

    // add a new element to the queue
    // type, element
    // add: options, animate, left, top, id
    // del: left, top
    // position is optional
    queue_add: function(type, element, beginning, duration) {
        if (typeof(beginning) === 'undefined') {
            beginning = false;
        }
        if (typeof(duration) === 'undefined') {
            duration = null;
        }
        var frame_element = {
            type: type,
            element: element,
        };
        if (beginning === false) {
            this.queue.push(frame_element);
        } else {
            this.queue.unshift(frame_element);
        }
        this.queue_position++;
    },
    
    // get an element from the queue and act on it (add/delete tile)
    queue_next: function() {
      if (this.debug)
        console.log(this.el + " ticking " + this.options.queue_tick_time);
      // pop one element from the queue
      var frame_element = this.queue.shift();
      if (frame_element) {
          if (this.debug) 
            console.log("{0} - element: {1}".format(this.el, frame_element.type));
          // stop the queue processing to make sure no events interlap
          this.stop_queue_processing();
          //this.trigger('queue_working_event');
          var type = frame_element.type;
          var element = frame_element.element;
          var duration = frame_element.duration;
          if (this.debug) {
            console.log("{0} - type is {1}".format(this.el, type));
            console.log(this.el, type, element);
          }
          this.queue_position--;
          if (type == "add") {
              // we have to check if there's enough space to add the frame, if not, we need to delete the last frame first
              if (this.frame_counter < (this.options.max_frames)) {
                  this.frame_new(element.options, element.animate, element.index, element.id);                    
              } else {
                  // re-inject the current frame to the second position
                  this.queue_add("add", frame_element.element, true);                    
                  
                  // delete the last tile in the grid
                  var frame = this.get_frame(this.options.max_frames);
                  this.queue_add("del", {id: frame.id}, true);
              }
              this.start_queue_processing();
          } else if (type == "del") {
              if (this.debug)
                console.log("{0} - in delete".format(this.el));
              var md5id;
              var index;
              var animate = true;
              if (_.isBoolean(element.animate))
                  animate = element.animate;
  
              if (element.id !== undefined) {
                  md5id = element.id;
                  index = this.get_frame_position(md5id);
              } else {
                  var frame = this.get_frame(element.index);
                  md5id = frame.id;
                  index = element.index;
              }
              
              // check if there are other delete events in the queue, if yes, hold back reordering
              if ((this.queue.length == 0) || (this.queue[0].type != "del")) {
                // add a new event for resizing
                this.queue_add("reposition", {animate: true, gravity: "top"}, true);
              }
              if (this.debug)
                console.log("{0} - Will delete frame with id ".format(this.el),md5id); 
              // do the removal
              try {
                  this.frame_delete(md5id, animate);
              }
              catch(err) {
                  console.warn("{1} - Failed to delete element, most likely it was deleted already (?): {0}".format(err, this.el));
                  this.queue_next();
              }
              // if animate is not required, call queue_next immediately
              if (animate === false) {
                  this.queue_next();
                  return false;
              }
          } else if (type == "circular") {
            if (this.debug)
              console.log(this.el + " - in circular");
            // special type of add, where entries are re-added to the end of the queue
            this.frame_replace(element.options, element.animate, element.index, element.id);
            // readd the element to the end of the queue
            this.queue_add(type, element);
          } else if (type == "show_msg") {
              // show a message
              // check if another message is currently shown
              var postfunc = element.postfunc || [];              
              var animate = false;
              if (_.isBoolean(element.animate)) {
                animate = element.animate;
              }
              // just show the message
              this.show_message(element.container, element.content, animate, postfunc);
              // queue a dummy element to allow longer animation times
              //this.queue_add("dummy", {}, true);
              this.start_queue_processing();
          } else if (type == "hide_msg") {
              // hide a message
              var postfunc = element.postfunc || [];
              this.hide_message(element.container, postfunc);
              // queue a dummy element to allow longer animation times
              //this.queue_add("dummy", {}, true);           
              this.start_queue_processing();     
          } else if (type == "adjust_size") {
              // change the size of the grid, adjust the side margins and tile text also
              this.adjust_size(element);
          } else if (type == "external_function") {
              if (element.parameters && element.parameters.length) {
                // http://stackoverflow.com/questions/2856059/passing-an-array-as-a-function-parameter-in-javascript
                element.func_name.apply(this, element.parameters);
              } else {
                element.func_name(element.parameters);
              }
              this.start_queue_processing();
          } else if (type == "reposition") {
              this.resize_all_frames(element.animate, element.gravity);
              // queue processing will be started at the end of resize_all_frames()
          } else if (type == "change_tick_time") {
              this.change_tick_time(element.duration);
              this.start_queue_processing();
          } else if (type == "dummy") {
              // dummy queue element to allow longer animations, do nothing
              this.start_queue_processing();
          } else {
              console.error("Unknown event type has been received: " + type);
              this.start_queue_processing();
          }
        } else {
            if (this.debug)
              console.log("{0} - no frame in queue".format(this.el));
            this.start_queue_processing();
            // trigger a queue empty event
            //this.trigger('queue_empty_event');
        }
    },

    // print the queue
    print_queue: function() {
        if (this.queue.length) {
          var counter = 1;
          for (var obj in this.queue) {
              console.log("{0} - {1} {2} {3}".format(this.el, counter, obj.type, obj));
              counter++;
          };
        }
    },

    // return the lenght of the working queue
    queue_length: function(filter) {
      if (filter === undefined) {
        return this.queue.length;
      } else {
        var self = this;
        // only return number of elements matching filter (match onto type)
        return _.filter(self.queue, function(frame_element) {
          if (frame_element.type == filter)
              return true;
        }).length;
      }
    },

    // empty the queue
    queue_empty: function() {
      this.queue = [];
    },

    change_tick_time: function(duration) {
      if (this.options.queue_tick_time != duration) {
        console.log("{0} - Changing tick time from {1} to {2}".format(this.el, this.options.queue_tick_time, duration));
        this.options.queue_tick_time = duration;
      }
    },

    get_tick_time: function() {
      return this.options.queue_tick_time;
    },

    stop_queue_processing: function() {
        this.killTimeout(this.el + "_ticker");
    },

    start_queue_processing: function() {
      this.doTimeout(this.el + "_ticker", this, "queue_next", this.options.queue_tick_time);
    },

    doTimeout: function (name, object, func, duration) {
      var self = this;

      if (this.timers === undefined) {
        this.timers = {};
      }
      if (!(name in this.timers)) {
        this.timers[name] = null;
      }
      if (this.timers[name] !== null) {
        // re-set current timer
        clearTimeout(this.timers[name]);
      }
      this.timers[name] = setTimeout(function(func, name) {
          object[func]();
          self.timers[name] = null;
      }, duration, func, name);
      return true;
    },

    killTimeout: function (name) {
      if (this.debug)
        console.log(this.el + " - killing timeout " + name);
      if ((this.timers !== undefined) && (name in this.timers) && (this.timers[name] !== null)) {
        clearTimeout(this.timers[name]);
        this.timers[name] = null;
        return true;
      }
      return false;
    },

    // check if there's a frame with the given id in the queue
    check_in_queue: function(id, type) {
      for (var i in this.queue) {
        var frame_element = this.queue[i];
          if (("id" in frame_element.element) && (frame_element.element.id == id)) {
            if (type) {
              if (type == frame_element.type) {
                return true;
              } else {
                return false;
              }
            } else {
              return true;
            }
          }
        }
      return false;
    },

    // show a message outside of the grid area
    show_message: function(container, content, animate, postfunc) {
        $(container).append(content).hide().fadeIn(this.options.queue_tick_time * 2, function() {
          $.each(postfunc, function(f) {
            postfunc[f]();
          });
        });
    },

    hide_message: function(container, postfunc) {
        $(container).fadeOut(this.options.queue_tick_time * 2, function() {
          $(container).remove();
          $.each(postfunc, function(f) {
            postfunc[f]();
          });
        });
    },

    // adds and displays a new frame/window
    frame_new: function(options, animate, index, frame_id)
    {
        // check if frame exists
        if (!(frame_id in this.frame_list)) {

            // append
            $(this.el).append(this.frame_template(frame_id.substring(1), options.title, options.content));
            // hide the tile, it will be shown in frame_insert()
            $("#" + frame_id).hide();

            // calculate the pixel coordinates for the tile
            var p = this.calculate_grid_position(index);
            var pixel = this.calculate_pixel_position(p.left, p.top);

            // construct a new frame
            var frame = {
                id              : frame_id,
                index           : index,
                width           : this.options.frame.width,
                height          : this.options.frame.height,
                pixel_left      : pixel.left,
                pixel_top       : pixel.top,
            };

            delay_required = 0;
            if (this.get_frame(index) !== false) {
                // shift the tiles starting from this index up
                this.reorder_frame_indexes(index);
                // resize/relocate all tiles
                var delay_required = this.resize_all_frames(true, "bottom");
            }

            // add to frame list
            this.frame_list[frame_id] = frame;

            // increase frame counter
            this.frame_counter++;

            // place frame - with a delay, in case position_change effect is 'one-by-one'
            _.delay(function(self, frame, pixel, animate) {
              // insert the frame
              self.frame_insert(frame, {width: self.options.frame.width, height: self.options.frame.height, left: pixel.left, top: pixel.top}, animate);
              // enable queue processing
              self.start_queue_processing();
            }, delay_required, this, frame, pixel, animate);
            
        } else {
            console.log("{0} - Overlap of frame ids. Frame ({1} / {2})".format(this.el, frame_id, index));
        }
    },

    // replace a frame with another
    frame_replace: function(options, animate, index, frame_id)
    {
      var frame_old = this.get_frame(index);
      // don't replace ourselves
      if (frame_old.id != frame_id) {
        // check if there's anything in the given index
        if (frame_old === false) {
          // fall back to frame_new
          this.frame_new(options, animate, index, frame_id);
        } else {
          // delete the old frame
          this.frame_delete(frame_old.id, animate);

          // add the new frame
          if (animate) {
            delay = this.options.timeout_base * 2;
          } else {
            delay = 0;
          }
          _.delay(function(self) { self.frame_new(options, animate, index, frame_id); }, delay * 2, this);

        }
      }
    },

    // resize all the frames according to the current size of the grid
    resize_all_frames: function (animate, gravity) {
        var gravity = gravity || null; 
        var result = {};
        var self = this;
        var start = null;

        var ids = this.get_frame_list();
        if ((animate === true) && ((this.options.effects.position_change == 'one-by-one') && ((gravity == "top") || (gravity == "bottom")))) {
          // resize one by one with delay
          var counter = 1;
          for (var i = 0 ; i < this.get_frame_length() ; i++) {

            // calculate index based on gravity (asc or dsc)
            var index = i;
            if (gravity == "bottom") {
              index = this.get_frame_length() - i - 1;
            }

            // get the id and the frame
            var id = ids[index];
            var frame = this.frame_list[id];

            // check if any resizing is needed
            var p = this.calculate_grid_position(frame.index);
            var pixel = this.calculate_pixel_position(p.left, p.top);
            
            
            if ((frame.width != this.options.frame.width) || (frame.height != this.options.frame.height) || (frame.pixel_left != pixel.left) || (frame.pixel_top != pixel.top)) {
              _.delay(function(self, frame, pixel, animate) {
                  console.debug("{2} - Forcing resize for tile id: {0} index: {1}".format(frame.id, frame.index, self.el));
                  self.frame_resize(frame, {width: self.options.frame.width, height: self.options.frame.height, left: pixel.left, top: pixel.top}, animate); 
              }, this.options.queue_tick_time * counter, this, frame, pixel, animate);
              counter++;
            }
          }
          _.delay(function(self, counter) { self.start_queue_processing(); }, this.options.queue_tick_time * counter, this);
          return this.options.queue_tick_time * (counter + 1);

        } else {
          // all at once or graivty == null
          _.each(this.frame_list, function(frame, id) {

              // check if any resizing is needed
              var p = self.calculate_grid_position(frame.index);
              var pixel = self.calculate_pixel_position(p.left, p.top);
              
              if ((frame.width != self.options.frame.width) || (frame.height != self.options.frame.height) || (frame.pixel_left != pixel.left) || (frame.pixel_top != pixel.top)) {
                console.debug("{2} - Forcing resize for tile id: {0} index: {1}".format(frame.id, frame.index, self.el));
                self.frame_resize(frame, {width: self.options.frame.width, height: self.options.frame.height, left: pixel.left, top: pixel.top}, animate);
              }
          });
          _.delay(function(self) { self.start_queue_processing(); }, this.options.queue_tick_time, this);
          return this.options.queue_tick_time
        }
    },
    
    // resize frame
    frame_resize: function(frame, p, animate)
    {
      var ids = this.get_frame_list();
      // update the frame definitions
      this.frame_list[frame.id]["width"] = p.width;
      this.frame_list[frame.id]["height"] = p.height;
      this.frame_list[frame.id]["pixel_left"] = p.left;
      this.frame_list[frame.id]["pixel_top"] = p.top;

      // update css
      if (animate) {
          $("#" + frame.id).animate({width: p.width, height: p.height, left: p.left, top: p.top}, this.options.timeout_base);
      } else {
          $("#" + frame.id).css({width: p.width, height: p.height, left: p.left, top: p.top});
      }

    },

    frame_insert: function(frame, p, animate)
    {
        if (animate) {
            switch(this.options.effects.add.effect) {
                case "slide-previous":
                    // slide out from the previous tile
                    var p_prev = this.calculate_grid_position(frame.index - 1);
                    p_prev = this.calculate_pixel_position(p_prev.left, p_prev.top);
                    $("#" + frame.id)
                      .css({width: p.width, height: p.height, left: p_prev.left, top: p_prev.top})
                      .show()
                      .animate({left: p.left, top: p.top}, this.options.timeout_base);
                    break;
                case "slide-first":
                    // slide out from the fist tile
                    var p_first = this.calculate_grid_position(1);
                    p_first = this.calculate_pixel_position(p_first.left, p_first.top);
                    $("#" + frame.id)
                      .css({width: p.width, height: p.height, left: p_first.left, top: p_first.top})
                      .show()
                      .animate({left: p.left, top: p.top}, this.options.timeout_base);
                    break;
                default:
                    $("#" + frame.id)
                      //.hide()
                      .css({width: p.width, height: p.height, left: p.left, top: p.top})
                      .show(this.options.effects.add.effect, this.options.effects.add.options, {width: p.width, height: p.height, left: p.left, top: p.top});
            }
        } else {
            $("#" + frame.id).show().css({left: p.left, top: p.top}); 
        }
    },



    frame_delete: function (id, anim)
    {
        // nested function for the delete process
        function do_delete() {

            // hide and remove element
            $("#" + frame.id).hide().remove();
            
            // remove from dictionary
            delete self.frame_list[frame.id];
            
            // reduce frame counter
            self.frame_counter--;

            // update the frame indexes so that they are continuous
            self.update_frame_indexes();

            // start the queue processing again
            self.start_queue_processing();

        }

        var animate = true;
        if (_.isBoolean(anim))
            animate = anim;

        var self = this;

        if (!(id in this.frame_list)) throw "Frame not found in frame list";

        var frame = this.frame_list[id];
        console.log("{0} - Deleting frame, id: {1}, index: {2}".format(this.el, id, frame.index));

        if (animate) {
            switch(this.options.effects.del.effect) {
                case "slide-previous":
                    // slide back tothe previous tile
                    var frame = this.frame_list[id];
                    var p_prev = this.calculate_grid_position(frame.index - 1);
                    p_prev = this.calculate_pixel_position(p_prev.left, p_prev.top);
                    $("#" + frame.id).animate({left: p_prev.left, top: p_prev.top}, this.options.timeout_base, do_delete);
                    break;
                case "slide-first":
                    // slide back to the fist tile
                    var frame = this.frame_list[id];
                    var p_first = this.calculate_grid_position(1);
                    p_first = this.calculate_pixel_position(p_first.left, p_first.top);
                    $("#" + frame.id).animate({left: p_first.left, top: p_first.top}, this.options.timeout_base, do_delete);                    
                    break;
                default:
                    $("#" + frame.id).hide(this.options.effects.del.effect, this.options.effects.del.options, this.options.timeout_base, do_delete);
            }
        } else {
            do_delete();
        }
    },

    // eliminate all gaps from the indexes in this.frame_list
    update_frame_indexes: function() {
        var counter = 1;
        var ids = this.get_frame_list();
        // use the output of get_frame_list(), as it's already sorted by index
        for (var id in ids) {
            this.frame_list[ids[id]]["index"] = counter;
            counter++;
        }

    },

    // starting from a given index increase the index for all frames
    reorder_frame_indexes: function(index) {
        var ids = this.get_frame_list();
        for (var i = index ; i <= this.get_frame_length() ; i++) {
            this.frame_list[ids[i-1]]["index"]++;
        }
    },

    frame_template: function(id, title, content)
    {
        return content;
    },
    
    get_frame_position: function(id)
    {   
        for (var frame in this.frame_list) {
            if (id == this.frame_list[frame]["id"]) {
                return this.frame_list[frame]["index"];
            }
        };
        // if we are here, no result was found
        return false
    },
   
    // return the number of tiles that are drawn currently
    get_frame_length: function() {
        return this.frame_counter;
    },

    // get the normal coordinates for an index, return them as an array
    // 1,1 1,2
    // 2,1 2,2
    // in such a grid index 1 would have coords (1,1), while index 2 would have coords (1,2)
    calculate_grid_position: function (index) {
      // get the x coordinate by doing index mod colnum, then 'invert' the result
      var left = (index - 1) % this.options.columns + 1;
      // get the y coordinate by dividing index with the column number, then doing floor()
      var top = Math.ceil(index / this.options.columns);
      return { left: left, top: top };
    },

    calculate_pixel_position: function(left, top) {
        var left_pixel = (left - 1) * this.options.frame.width + (left - 1) * this.options.margin;
        var top_pixel = (top - 1) * this.options.frame.height + (top - 1) * this.options.margin;
        return { left: left_pixel, top: top_pixel };
    },

    get_frame: function (index) {
        for (var frame in this.frame_list) {
            if (this.frame_list[frame]["index"] == index)
                return this.frame_list[frame];
        }
        return false
    },

    // list the frames
    get_frame_list: function () {
        var result = [];
        // create an array
        for (var id in this.frame_list) {
            result.push(this.frame_list[id]);
        }
        // sort the array based on the indexes, and use map to return an array with only the ids in it, while keeping it sorted
        return _.map(result.sort(function(a,b) { return a.index - b.index }), function(num, key) { return num.id });
    },

    // change the size of the grid, deleting tiles that no longer fit
    // do this using queue actions for deletion
    adjust_size: function(element) {
        // adjust the size of the frame
        var tile_sizex = element.tile_sizex;
        var tile_sizey = element.tile_sizey;
        var columns = element.columns;
        var rows = element.rows;
        var margin = element.margin;
        var tiles_max = element.tiles_max;
        var queue_tick_time = element.queue_tick_time || this.options.queue_tick_time;
        var timeout_base = element.timeout_base || this.options.timeout_base;
        var prefunc = element.prefunc || [];
        var postfunc = element.postfunc || [];
        // call prefunc functions if defined
        $.each(prefunc, function(f) {
            prefunc[f]();
        });
        // delete unneeded tiles
        var length = this.get_frame_length();
        if (length > tiles_max) {

            // requeue resize
            this.queue_add("adjust_size", element, true);
            // start deleting from the back
            for ( var i = tiles_max + 1; i <= length ; i++) {
                var frame = this.get_frame(i);
                var p = this.calculate_grid_position(i);
                this.queue_add("del", {id: frame["id"], animate: false}, true);
                this.start_queue_processing();
            }
        } else {
            this.update_layout(tile_sizex, tile_sizey, columns, rows, margin, tiles_max, queue_tick_time, timeout_base);
            this.resize_all_frames(true);

            // call postfunc functions if defined
            $.each(postfunc, function(f) {
                postfunc[f]();
            });            
        }
    },



});
