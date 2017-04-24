L.AGS = {
    _callbacks: {},
    get: function(url, params, callback){
        var callbackId = "callback_" + (Math.random() * 1e9).toString(36);

        params.f="json";
        params.callback="L.AGS._callbacks['"+callbackId+"']";

        var qs="?";

        for(var param in params){
            if(params.hasOwnProperty(param)){
                var key = param;
                var value = params[param];
                qs+=encodeURIComponent(key);
                qs+="=";
                qs+=encodeURIComponent(value);
                qs+="&";
            }
        }

        qs = qs.substring(0, qs.length - 1);

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url + qs;
        script.id = callbackId;

        L.AGS._callbacks[callbackId] = function(response){
            callback(response);
            document.body.removeChild(script);
            delete L.AGS._callbacks[callbackId];
        };

        document.body.appendChild(script);

    }
};

L.AGS.Util = {
    extentToBounds: function(extent){
        var southWest = new L.LatLng(extent.xmin, extent.ymin);
        var northEast = new L.LatLng(extent.xmax, extent.ymin);
        return new L.LatLngBounds(southWest, northEast);
    },

    boundsToExtent: function(bounds) {
        return {
            "xmin": bounds.getSouthWest().lng,
            "ymin": bounds.getSouthWest().lat,
            "xmax": bounds.getNorthEast().lng,
            "ymax": bounds.getNorthEast().lat,
            "spatialReference": {
                "wkid" : 4326
            }
        };
    },
    boundsToEnvelope: function(bounds){
        var extent = L.AGS.Util.boundsToExtent(bounds);
        return {
            x: extent.xmin,
            y: extent.ymin,
            w: Math.abs(extent.xmin - extent.ymax),
            h: Math.abs(extent.ymin - extent.ymax)
        };
    }
};

L.AGS.Mixins = {
    identifiableLayer: {
        identify:function(latLng, options, callback){
            var defaults = {
                sr: '4265',
                mapExtent: JSON.stringify(L.AGS.Util.boundsToExtent(this._map.getBounds())),
                tolerance: 3,
                geometryType: 'AGSGeometryPoint',
                imageDisplay: '800,600,96',
                geometry: JSON.stringify({
                    x: latLng.lng,
                    y: latLng.lat,
                    spatialReference: {
                        wkid: 4265
                    }
                })
            };

            var params;

            if (typeof options === 'function' && typeof callback === 'undefined') {
                callback = options;
                params = defaults;
            } else if (typeof options === 'object') {
                if (options.layerDefs) {
                    options.layerDefs = this.parseLayerDefs(options.layerDefs);
                }

                params = L.Util.extend(defaults, options);
            }

            L.AGS.get(this.serviceUrl + '/identify', params, callback);
        },
        parseLayerDefs: function (layerDefs) {
            if (layerDefs instanceof Array) {
                //throw 'must be object or string';
                return '';
            }

            if (typeof layerDefs === 'object') {
                return JSON.stringify(layerDefs);
            }

            return layerDefs;
        }
    }
};