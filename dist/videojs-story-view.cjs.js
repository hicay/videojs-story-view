/*! @name videojs-story-view @version 0.0.1 @license MIT */
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var videojs = _interopDefault(require('video.js'));

var version = "0.0.1";

var defaults = {}; // Cross-compatibility for Video.js 5 and 6.

var registerPlugin = videojs.registerPlugin || videojs.plugin; // const dom = videojs.dom || videojs;

/**
 * Function to invoke when the player is ready.
 *
 * This is a great place for your plugin to initialize itself. When this
 * function is called, the player will have its DOM and child components
 * in place.
 *
 * @function onPlayerReady
 * @param    {Player} player
 *           A Video.js player object.
 *
 * @param    {Object} [options={}]
 *           A plain object containing options for the plugin.
 */

var onPlayerReady = function onPlayerReady(player, options) {
  player.addClass('vjs-story-view');
  var sContainer = document.createElement('div');
  sContainer.className = 'vjs-s-container';
  var sDrurationBase = document.createElement('div');
  sDrurationBase.className = 'vjs-s-base';
  var sDuration = document.createElement('div');
  sDuration.className = 'vjs-s-duration';
  sDrurationBase.appendChild(sDuration);
  sContainer.appendChild(sDrurationBase); //textDisplay.innerHTML = 'Becoming a plugin developer';

  player.el().appendChild(sContainer);
  var totalDuration = 0;
  var currentTime = player.on('loadedmetadata', function () {
    totalDuration = player.duration();
    console.log(totalDuration);
    requestAnimationFrame(changeWidth);
  });

  var changeWidth = function changeWidth() {
    var time = player.scrubbing() ? player.getCache().currentTime : player.currentTime();
    sDuration.style.width = (time / totalDuration).toFixed(2) * 100 + "%";
    requestAnimationFrame(changeWidth);
  }; // player.on ('timeupdate', function (e) {
  //   currentTime = time;
  //   console.log ('the time was updated to: ' + time, time / totalDuration);
  //   requestAnimationFrame (changeWidth);
  // });

};
/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 *
 * @function storyView
 * @param    {Object} [options={}]
 *           An object of options left to the plugin author to define.
 */


var storyView = function storyView(options) {
  var _this = this;

  this.ready(function () {
    onPlayerReady(_this, videojs.mergeOptions(defaults, options));
  });
}; // Register the plugin with video.js.


registerPlugin('storyView', storyView); // Include the version number.

storyView.VERSION = version;

module.exports = storyView;
