L.AGS.DynamicMapLayer = L.ImageOverlay.extend({
  includes: L.AGS.Mixins.identifiableLayer,

  defaultParams: {
    format: 'png',
    transparent: true,
    f: 'image',
    bboxSR: 102100,
    imageSR: 102100,
    layers: '',
    opacity: 1
  },

  initialize: function (url, options) {
    //add a trailing slash to the url if the user omitted it
    if(url[url.length-1] !== "/"){
      url += "/";
    }

    this._url = url;
    this.serviceUrl = url;
    this._layerParams = L.Util.extend({}, this.defaultParams);

    for (var opt in options) {
      if (!this.options.hasOwnProperty(opt)) {
        this._layerParams[opt] = options[opt];
      }
    }

    delete this._layerParams.token;

    this._parseLayers();
    this._parseLayerDefs();

    L.Util.setOptions(this, options);
  },

  onAdd: function (map) {
    this._map = map;

    if (!this._image) {
      this._initImage();
    }

    map._panes.overlayPane.appendChild(this._image);

    map.on({
      'viewreset': this._reset,
      'moveend': this._update,
      'zoomend': this._zoomUpdate
    }, this);

    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on('zoomanim', this._animateZoom, this);
    }

    if (map.options.crs && map.options.crs.code) {
      var sr = map.options.crs.code.split(":")[1];
      this._layerParams.bboxSR = sr;
      this._layerParams.imageSR = sr;
    }

    this._reset();
    //this._update();
  },

  onRemove: function (map) {
    map.getPanes().overlayPane.removeChild(this._image);

    map.off({
      'viewreset': this._reset,
      'moveend': this._update
    }, this);

    if (map.options.zoomAnimation) {
      map.off('zoomanim', this._animateZoom, this);
    }
  },

  _animateZoom: function (e) {
    var map = this._map,
        image = this._image,
        scale = map.getZoomScale(e.zoom),

        nw = this._map.getBounds().getNorthWest(),
        se = this._map.getBounds().getSouthEast(),

        topLeft = map._latLngToNewLayerPoint(nw, e.zoom, e.center),
        size = map._latLngToNewLayerPoint(se, e.zoom, e.center)._subtract(topLeft),
        origin = topLeft._add(size._multiplyBy((1 / 2) * (1 - 1 / scale)));

    image.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(origin) + ' scale(' + scale + ') ';
  },

  _parseLayers: function () {
    if (typeof this._layerParams.layers === 'undefined') {
      delete this._layerParams.layerOption;
      return;
    }

    var action = this._layerParams.layerOption || null,
        layers = this._layerParams.layers || null,
        verb = 'show',
        verbs = ['show', 'hide', 'include', 'exclude'];

    delete this._layerParams.layerOption;

    if (!action) {
      if (layers instanceof Array) {
        this._layerParams.layers = verb + ':' + layers.join(',');
      } else if (typeof layers === 'string') {
        var match = layers.match(':');

        if (match) {
          layers = layers.split(match[0]);
          if (Number(layers[1].split(',')[0])) {
            if (verbs.indexOf(layers[0]) !== -1) {
              verb = layers[0];
            }

            layers = layers[1];
          }
        }
        this._layerParams.layers = verb + ':' + layers;
      }
    } else {
      if (verbs.indexOf(action) !== -1) {
        verb = action;
      }

      this._layerParams.layers = verb + ':' + layers;
    }
  },

  _parseLayerDefs: function () {
    if (typeof this._layerParams.layerDefs === 'undefined') {
      return;
    }

    var layerDefs = this._layerParams.layerDefs;

    var defs = [];

    if (layerDefs instanceof Array) {
      var len = layerDefs.length;
      for (var i = 0; i < len; i++) {
        if (layerDefs[i]) {
          defs.push(i + ':' + layerDefs[i]);
        }
      }
    } else if (typeof layerDefs === 'object') {
      for (var layer in layerDefs) {
        if(layerDefs.hasOwnProperty(layer)){
          defs.push(layer + ':' + layerDefs[layer]);
        }
      }
    } else {
      delete this._layerParams.layerDefs;
      return;
    }
    this._layerParams.layerDefs = defs.join(';');
  },

  _initImage: function () {
    this._image = L.DomUtil.create('img', 'leaflet-image-layer');

    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      L.DomUtil.addClass(this._image, 'leaflet-zoom-animated');
    } else {
      L.DomUtil.addClass(this._image, 'leaflet-zoom-hide');
    }

    this._updateOpacity();

    L.Util.extend(this._image, {
      galleryimg: 'no',
      onselectstart: L.Util.falseFn,
      onmousemove: L.Util.falseFn,
      onload: L.Util.bind(this._onImageLoad, this),
      src: this._getImageUrl()
    });
  },

  _getImageUrl: function () {
    var bounds = this._map.getBounds(),
        size = this._map.getSize(),
        ne = this._map.options.crs.project(bounds._northEast),
        sw = this._map.options.crs.project(bounds._southWest);

    this._layerParams.bbox = [sw.x, sw.y, ne.x, ne.y].join(',');
    this._layerParams.size = size.x + ',' + size.y;

    var url = this._url + 'export' + L.Util.getParamString(this._layerParams);

    if (typeof this.options.token !== 'undefined'){
      url = url + '&token=' + this.options.token;
    }

    return url;
  },

  _update: function (e) {
    if (this._map._panTransition && this._map._panTransition._inProgress) {
      return;
    }

    var zoom = this._map.getZoom();
    if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
      return;
    }

    this._newImage = L.DomUtil.create('img', 'leaflet-image-layer');

    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      L.DomUtil.addClass(this._newImage, 'leaflet-zoom-animated');
    } else {
      L.DomUtil.addClass(this._newImage, 'leaflet-zoom-hide');
    }

    this._updateOpacity();

    L.Util.extend(this._newImage, {
      galleryimg: 'no',
      onselectstart: L.Util.falseFn,
      onmousemove: L.Util.falseFn,
      onload: L.Util.bind(this._onNewImageLoad, this),
      src: this._getImageUrl()
    });
  },

  _updateOpacity: function(){
    L.DomUtil.setOpacity(this._image, this.options.opacity);
    if(this._newImage){
      L.DomUtil.setOpacity(this._newImage, this.options.opacity);
    }
  },

  _zoomUpdate: function (e) {
    //console.log(e);
    //console.log(this._image);
    //console.log(this._newImage);
  },

  _onNewImageLoad: function () {
    var bounds = this._map.getBounds(),
        nw = L.latLng(bounds._northEast.lat, bounds._southWest.lng),
        se = L.latLng(bounds._southWest.lat, bounds._northEast.lng);

    var topLeft = this._map.latLngToLayerPoint(nw),
        size = this._map.latLngToLayerPoint(se)._subtract(topLeft);
    L.DomUtil.setPosition(this._newImage, topLeft);
    this._newImage.style.width = size.x + 'px';
    this._newImage.style.height = size.y + 'px';
    this._map._panes.overlayPane.appendChild(this._newImage);
    this._map._panes.overlayPane.removeChild(this._image);
    this._image = this._newImage;
    this._newImage = null;
  },

  _onImageLoad: function () {
    this.fire('load');
    //if (this._image.style.display == 'none') {
    //  this._image.style.display = 'block';
    //}
  },

  _reset: function () {
    return;
  }
});

L.AGS.dynamicMapLayer = function (url, options) {
  return new L.AGS.DynamicMapLayer(url, options);
};