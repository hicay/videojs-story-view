# videojs-story-view

header

## Installation

```sh
npm install --save @story-view/videojs-story-view
```

## Usage

To include videojs-story-view on your website or web application, use any of the following methods.

### `<script>` Tag

This is the simplest case. Get the script in whatever way you prefer and include the plugin _after_ you include [video.js][videojs], so that the `videojs` global is available.

```html
<script src="//path/to/video.min.js"></script>
<script src="//path/to/videojs-story-view.min.js"></script>
<script>
  var player = videojs('my-video');

  player.storyView();
</script>
```

### Browserify/CommonJS

When using with Browserify, install videojs-story-view via npm and `require` the plugin as you would any other module.

```js
var videojs = require('video.js');

// The actual plugin function is exported by this module, but it is also
// attached to the `Player.prototype`; so, there is no need to assign it
// to a variable.
require('@story-view/videojs-story-view');

var player = videojs('my-video');

player.storyView();
```

### RequireJS/AMD

When using with RequireJS (or another AMD library), get the script in whatever way you prefer and `require` the plugin as you normally would:

```js
require(['video.js', '@story-view/videojs-story-view'], function(videojs) {
  var player = videojs('my-video');

  player.storyView();
});
```

## License

MIT. Copyright (c) Salih Caglar Ispirli \PC &lt;caglarispirli@gmail.com&gt;


[videojs]: http://videojs.com/
