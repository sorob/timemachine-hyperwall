console.log('initializing viewsync');

var MAX_TIME_DIFF = 1 / 60;
var MIN_SCALE = 0.05;

var yawOffset = (fields.yawOffset) ? fields.yawOffset : 0;
var pitchOffset = (fields.pitchOffset) ? fields.pitchOffset : 0;
var screensLeft = (fields.screensLeft) ? fields.screensLeft : 0;
var screensRight = (fields.screensRight) ? fields.screensRight : 0;
var screensUp = (fields.screensUp) ? fields.screensUp : 0;
var screensDown = (fields.screensDown) ? fields.screensDown : 0;
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

      // var xoffset = (xmax - xmin) * yawOffset;
      // var yoffset = (ymax - ymin) * pitchOffset;

      // bbox.xmin -= xoffset;
      // bbox.xmax -= xoffset;
      // bbox.ymin -= yoffset;
      // bbox.ymax -= yoffset;

      if (fields.showMap || fields.showControls)
        timelapse.updateLocationContextUI();
      // if (e.x == view.x && e.y == view.y && e.scale == view.scale) {
      if (broadcast) {
        viewsync.emit('view', {
          "bbox": bbox,
          "view": view,
          "id": id
        });
        // previousSentData = _.clone(bbox);
      }
      // }


    });

    viewsync.on('sync masterview', function(data) {
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
        viewsync.emit('view', data);
      }
    });

    timelapse.addTimeChangeListener(function() {
      viewsync_send_time(false);
    });

    timelapse.addVideoPlayListener(function() {
      viewsync.emit('play', {
        play: true
      });
      viewsync_send_time(true);
    });

    timelapse.addVideoPauseListener(function() {
      viewsync.emit('play', {
        play: false
      });
      viewsync_send_time(true);
    });
  } else {
    // events for slaves
    timelapse.addViewChangeListener(function(e, broadcast) {

      var bbox = timelapse.getBoundingBoxForCurrentView();
      // var xmax = timelapse.getPanoWidth();
      // var xmin = 0;
      // var ymax = timelapse.getPanoHeight();
      // var ymin = 0;
      // var xyExtents = false;

      // if (view.x < xmin) {
      //   view.x = xmin;
      //   xyExtents = true;
      // } else if (view.x > xmax) {
      //   view.x = xmax;
      //   xyExtents = true;
      // }
      // if (view.y < ymin) {
      //   view.y = ymin;
      //   xyExtents = true;
      // } else if (view.y > ymax) {
      //   view.y = ymax;
      //   xyExtents = true;
      // }

      // if (xyExtents) {
      //   timelapse.warpTo(view);
      //   bbox = timelapse.getBoundingBoxForCurrentView();
      // }

      var xoffset = (bbox.xmax - bbox.xmin) * yawOffset;
      var yoffset = (bbox.ymax - bbox.ymin) * pitchOffset;

      bbox.xmin -= xoffset;
      bbox.xmax -= xoffset;
      bbox.ymin -= yoffset;
      bbox.ymax -= yoffset;
      if (fields.showMap || fields.showControls)
        timelapse.updateLocationContextUI();
      // if (e.x == view.x && e.y == view.y && e.scale == view.scale) {
      if (broadcast) {
        viewsync.emit('masterview', {
          "bbox": bbox,
          "view": view,
          "id": id
        });
      }
      // }


    });

    viewsync.on('sync view', function(data) {
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

    viewsync.on('sync time', function(data) {
      timelapse.seek(data.time);
    });

    viewsync.on('sync play', function(data) {
      if (data.play)
        timelapse.play();
      else
        timelapse.pause();
    });
  }
}

function viewsync_send_time(absolute) {
  var t = timelapse.getCurrentTime();
  viewsync.emit('time', {
    time: t,
    absolute: absolute
  });
}
