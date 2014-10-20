console.log('initializing viewsync');

var MAX_TIME_DIFF = 1 / 60;
var MIN_SCALE = 0.05;

var yawOffset = (fields.yawOffset) ? fields.yawOffset : 0;
var pitchOffset = (fields.pitchOffset) ? fields.pitchOffset : 0;
var screensLeft = (fields.screensLeft) ? fields.screensLeft : 0;
var screensRight = (fields.screensRight) ? fields.screensRight : 0;
var screensUp = (fields.screensUp) ? fields.screensUp : 0;
var screensDown = (fields.screensDown) ? fields.screensDown : 0;
var hyperwallGroup = (fields.group) ? fields.group : 0;
var viewsync = io.connect('/viewsync');
var masterView;
var id = yawOffset + "_" + pitchOffset;

viewsync.on('connect', function() {
  console.log('viewsync connected');
  viewsync.emit('settings', {
    yawOffset: yawOffset,
    pitchOffset: pitchOffset
  });
});
var previousSentData = {};
viewsync.on('connect_failed', function() {
  console.log('viewsync connection failed!');
});

viewsync.on('disconnect', function() {
  console.log('viewsync disconnected');
});

function viewsync_init() {

  // events for master
  console.log('master of the universe');
  // wait for the timelapse to be ready, there must be a better way!
  var metadata = timelapse.getMetadata();
  masterView = timelapse.getView();
  var view = timelapse.getView();
  // correct scale extents before checking x/ymax
  masterView = view;

  if (fields.master) {
    timelapse.addViewChangeListener(function(e, broadcast) {

      var bbox = timelapse.getBoundingBoxForCurrentView();
      var xmax = timelapse.getPanoWidth();
      var xmin = 0;
      var ymax = timelapse.getPanoHeight();
      var ymin = 0;
      var xyExtents = false;

      if (view.x < xmin) {
        view.x = xmin;
        xyExtents = true;
      } else if (view.x > xmax) {
        view.x = xmax;
        xyExtents = true;
      }
      if (view.y < ymin) {
        view.y = ymin;
        xyExtents = true;
      } else if (view.y > ymax) {
        view.y = ymax;
        xyExtents = true;
      }

      if (xyExtents) {
        timelapse.warpTo(view);
        bbox = timelapse.getBoundingBoxForCurrentView();
      }


      if (fields.showMap || fields.showControls)
        timelapse.updateLocationContextUI();
      if (broadcast) {
        viewsync.emit('view' + hyperwallGroup, {
          "bbox": bbox,
          "view": view,
          "id": id
        });
      }


    });

    viewsync.on('sync masterview' +hyperwallGroup, function(data) {
      if (data.id == id)
        return;


      masterView = data.view;
      var xoffset = (data.bbox.xmax - data.bbox.xmin) * yawOffset;
      var yoffset = (data.bbox.ymax - data.bbox.ymin) * pitchOffset;
      var bbox = {
        xmin: data.bbox.xmin + xoffset,
        xmax: data.bbox.xmax + xoffset,
        ymin: data.bbox.ymin + yoffset,
        ymax: data.bbox.ymax + yoffset
      };

      if (fields.showMap || fields.showControls)
        timelapse.updateLocationContextUI();

      timelapse.warpToBoundingBox(bbox, false);
      if (data.id != id) {
        //"telling everyone else"
        viewsync.emit('view' +hyperwallGroup, data);
      }
    });

    timelapse.addTimeChangeListener(function() {
      viewsync_send_time(false);
    });

    timelapse.addVideoPlayListener(function() {
      viewsync.emit('play' + hyperwallGroup, {
        play: true
      });
      viewsync_send_time(true);
    });

    timelapse.addVideoPauseListener(function() {
      viewsync.emit('play' + hyperwallGroup, {
        play: false
      });
      viewsync_send_time(true);
    });
  } else {
    // events for slaves
    timelapse.addViewChangeListener(function(e, broadcast) {

      var bbox = timelapse.getBoundingBoxForCurrentView();

      var xoffset = (bbox.xmax - bbox.xmin) * yawOffset;
      var yoffset = (bbox.ymax - bbox.ymin) * pitchOffset;

      bbox.xmin -= xoffset;
      bbox.xmax -= xoffset;
      bbox.ymin -= yoffset;
      bbox.ymax -= yoffset;
      if (fields.showMap || fields.showControls)
        timelapse.updateLocationContextUI();
      if (broadcast) {
        viewsync.emit('masterview' + hyperwallGroup, {
          "bbox": bbox,
          "view": view,
          "id": id
        });
      }


    });

    viewsync.on('sync view' + hyperwallGroup, function(data) {
      if (data.id == id)
        return;


      masterView = data.view;
      var xoffset = (data.bbox.xmax - data.bbox.xmin) * yawOffset;
      var yoffset = (data.bbox.ymax - data.bbox.ymin) * pitchOffset;
      var bbox = {
        xmin: data.bbox.xmin + xoffset,
        xmax: data.bbox.xmax + xoffset,
        ymin: data.bbox.ymin + yoffset,
        ymax: data.bbox.ymax + yoffset
      };

      if (fields.showMap || fields.showControls)
        timelapse.updateLocationContextUI();

      timelapse.warpToBoundingBox(bbox, false);
    });

    viewsync.on('sync time' + hyperwallGroup, function(data) {
      timelapse.seek(data.time);
    });

    viewsync.on('sync play' + hyperwallGroup, function(data) {
      if (data.play)
        timelapse.play();
      else
        timelapse.pause();
    });
  }


  //setting borders - only works if there is a 2x2 array of displays ! does the job for now
  var p = location.port;
  if (p == "") p = 0;

  var colors = ["#008744", "#0057e7", "#d62d20", "#ffa700", "#eeeeee"];
  var color = colors[p % 5];
  var style = "10px solid " + color;
  var tiledContentHolder = $(".tiledContentHolder");
  switch (parseInt(yawOffset)) {
    case 0:
      tiledContentHolder.css("border-left", style)
      break;
    case 1:
      tiledContentHolder.css("border-right", style)
      break;
  }
  switch (parseInt(pitchOffset)) {
    case 0:
      tiledContentHolder.css("border-bottom", style)
      break;
    case -1:
      tiledContentHolder.css("border-top", style)
      break;
  }
}

function viewsync_send_time(absolute) {
  var t = timelapse.getCurrentTime();
  viewsync.emit('time' + hyperwallGroup, {
    time: t,
    absolute: absolute
  });
}
