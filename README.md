# videojs-story-view

VideoJs Story View like Instagram

![alt text](https://raw.githubusercontent.com/hicay/videojs-story-view/master/static/demo1.png)

## Installation

```sh
npm install --save videojs-story-view
```

CDN

```html
<link
  rel="stylesheet"
  type="text/css"
  href="https://cdn.jsdelivr.net/gh/hicay/videojs-story-view@0.0.1/dist/videojs-story-view.css"
/>
<script src="//path/to/video@7.4.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/hicay/videojs-story-view@0.0.1/dist/videojs-story-view.min.js"></script>
```

## Usage

To include videojs-story-view on your website or web application, use any of the following methods.

### `<script>` Tag

This is the simplest case. Get the script in whatever way you prefer and include the plugin _after_ you include [video.js][videojs], so that the `videojs` global is available.

LOCAL

```html
<link
  rel="stylesheet"
  type="text/css"
  href="//path/to/videojs-story-view.css"
/>
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

MIT. Copyright (c) Salih Caglar Ispirli &lt;caglarispirli@gmail.com&gt;

[videojs]: http://videojs.com/
