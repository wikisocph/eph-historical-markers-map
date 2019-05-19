'use strict';

// Library function to load JSONP data
// Adapted from https://gist.github.com/gf3/132080/110d1b68d7328d7bfe7e36617f7df85679a08968

var loadJsonp = (function() {
  var unique = 0;
  return function(endpoint, params, callback, callbackParamName) {

    // Create unique function name
    let name = '_jsonp_' + unique++;

    // Construct URL
    let queryParams = Object.keys(params).map(
      el => encodeURIComponent(el) + '=' + encodeURIComponent(params[el]).replace(/\+/, '%2B')
    ).join('&');
    queryParams += queryParams ? '&' : '';
    if (!callbackParamName) callbackParamName = 'callback';
    queryParams += `&${callbackParamName}=${name}`;

    // Create script element
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = endpoint + '?' + queryParams;

    // Setup handler
    window[name] = function(data) {
      callback.call(window, data);

      // Clean up
      script.remove();
      script = null;
      delete window[name];
    };

    // Load JSON
    document.getElementsByTagName('head')[0].appendChild(script);
  };
})();
