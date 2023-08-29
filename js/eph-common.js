'use strict';

// Constants and fixed parameters
const WDQS_API_URL            = 'https://query.wikidata.org/sparql';
const COMMONS_WIKI_URL_PREF   = 'https://commons.wikimedia.org/wiki/';
const COMMONS_API_URL         = 'https://commons.wikimedia.org/w/api.php';
const YEAR_PRECISION          = '9';
const PH_QID                  = 'Q928';
const REGION_QID              = 'Q24698';
const PROVINCE_QID            = 'Q24746';
const CITY_QID                = 'Q104157';
const HUC_QID                 = 'Q29946056';
const ICC_QID                 = 'Q106079704';
const CC_QID                  = 'Q106078286';
const ADMIN_QIDS              = [REGION_QID, PROVINCE_QID, CITY_QID, HUC_QID, ICC_QID, CC_QID];
const ADMIN_LEVELS            = 4;
const OSM_LAYER_URL           = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_LAYER_ATTRIBUTION   = 'Base map &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const CARTO_LAYER_URL         = 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png';
const CARTO_LAYER_ATTRIBUTION = 'Base map &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (data), <a href="https://carto.com/">CARTO</a> (style)';
const TILE_LAYER_MAX_ZOOM     = 19;
const MIN_PH_LAT              =   4.5;
const MAX_PH_LAT              =  21.0;
const MIN_PH_LON              = 116.5;
const MAX_PH_LON              = 126.5;

// Globals
var Records = {};        // Main app database, keyed by QID
var SparqlValuesClause;  // SPARQL "VALUES" clause containing the QIDs of all main Wikidata items
var Map;                 // Leaflet map object
var Cluster;             // Leaflet map cluster
var BootstrapDataIsLoaded = false;  // Whether the data needed to populate the map and index is loaded
var PrimaryDataIsLoaded   = false;  // Whether the non-lazy data is loaded

// ------------------------------------------------------------

window.addEventListener('load', init);


// Initializes the app once the page has been loaded.
function init() {
  initMap();
  loadPrimaryData();
  window.addEventListener('hashchange', processHashChange);
  Map.on('popupopen', function(e) { displayRecordDetails(e.popup._qid) });
}


// Initializes the Leaflet-based map.
function initMap() {

  // Create map and set initial view
  Map = new L.map('map');
  Map.fitBounds([[MAX_PH_LAT, MAX_PH_LON], [MIN_PH_LAT, MIN_PH_LON]]);

  // Add tile layers
  let cartoLayer = new L.tileLayer(CARTO_LAYER_URL, {
    attribution : CARTO_LAYER_ATTRIBUTION,
    maxZoom     : TILE_LAYER_MAX_ZOOM,
  }).addTo(Map);
  let osmLayer = new L.tileLayer(OSM_LAYER_URL, {
    attribution : OSM_LAYER_ATTRIBUTION,
    maxZoom     : TILE_LAYER_MAX_ZOOM,
  });
  let baseMaps = {
    'CARTO Voyager'       : cartoLayer,
    'OpenStreetMap Carto' : osmLayer,
  };
  L.control.layers(baseMaps, null, {position: 'topleft'}).addTo(Map);

  // Add powered by Wikidata map control
  let powered = L.control({ position: 'bottomleft' });
  powered.onAdd = function(Map) {
    var divElem = L.DomUtil.create('div', 'powered');
    divElem.innerHTML =
      '<a href="https://www.wikidata.org/"><img src="img/powered_by_wikidata.png"></a>';
    return divElem;
  };
  powered.addTo(Map);

  // Initialize the map marker cluster
  Cluster = new L.markerClusterGroup({
    maxClusterRadius: function(z) {
      if (z <=  15) return 50;
      if (z === 16) return 40;
      if (z === 17) return 30;
      if (z === 18) return 20;
      if (z >=  19) return 10;
    },
  }).addTo(Map);
}


// Given a SPARQL query string, a per-result processing callback, and an optional
// post-processing callback, queries WDQS using the given query, parses the query
// results and calls the per-result callback on each result, calls the
// post-processing callback after all results have been processed, then returns
// a promise that resolves after all the processing or rejects with an HTTP
// error code if there is an error querying WDQS. If SparqlValuesClause is not false,
// this also updates the given query with the SparqlValuesClause value prior to
// querying WDQS.
function queryWdqsThenProcess(query, processEachResult, postprocessCallback) {

  let promise = new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== xhr.DONE) return;
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      }
      else {
        reject(xhr.status);
      }
    };
    xhr.open('POST', WDQS_API_URL, true);
    xhr.overrideMimeType('text/plain');
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    if (SparqlValuesClause) query = query.replace('<SPARQLVALUESCLAUSE>', SparqlValuesClause);
    xhr.send('format=json&query=' + encodeURIComponent(query));
  });

  promise = promise.then(data => {
    data.results.bindings.forEach(processEachResult);
  });

  if (postprocessCallback) promise = promise.then(postprocessCallback);

  return promise;
}


// Enables the app. Should be called after the Wikidata queries have been processed.
function enableApp() {
  PrimaryDataIsLoaded = true;
  processHashChange();
}


// Event handler that handles any change in the window URL hash. When all the
// data is loaded, this updates the correct panel section and window title and
// optionally updates the map to the relevant location. Otherwise, the panel
// contents will show a loading indicator and the window will be the basic title.
// This is also called when data has been progressively loaded in order
// to update the panel during app initialization.
function processHashChange() {
  let fragment = window.location.hash.replace('#', '');
  if (fragment === 'about') {
    document.title = 'About – ' + BASE_TITLE;
    displayPanelContent('about');
  }
  else {
    if (!BootstrapDataIsLoaded) {
      displayPanelContent('loading');
    }
    else {
      if (fragment === '' || !(fragment in Records)) {
        window.location.hash = '';  // Disable invalid fragments
        document.title = BASE_TITLE;
        displayPanelContent('index');
      }
      else {
        activateMapMarker(fragment);
        displayRecordDetails(fragment);
      }
    }
  }
}


// Given a record QID, if the record has a map marker, updates the map to show
// and center on the map marker and open its popup if needed.
function activateMapMarker(qid) {
  let record = Records[qid];
  if (!record.mapMarker) return;  // Some records (grouped heritage sites) don't have markers
  Cluster.zoomToShowLayer(
    record.mapMarker,
    function() {
      Map.setView([record.lat, record.lon], Map.getZoom());
      if (!record.popup.isOpen()) record.mapMarker.openPopup();
    },
  );
}


// Given the ID of the panel content ID, displays the corresponding
// panel content and updates the navigation menu state as well.
function displayPanelContent(id) {
  document.querySelectorAll('.panel-content').forEach(content => {
    content.style.display = (content.id === id) ? content.dataset.display : 'none';
  });
  document.querySelectorAll('nav li').forEach(li => {
    if (li.childNodes[0].getAttribute('href') === '#' + id) {
      li.classList.add('selected');
    }
    else {
      li.classList.remove('selected');
    }
  });
}


// Given a record QID, displays the record's details on the side panel,
// generating it as needed. Also updates the window title and URL hash.
// If the primary data is not yet loaded, shows the loading panel.
function displayRecordDetails(qid) {
  let record = Records[qid];
  window.location.hash = `#${qid}`;
  document.title = `${record.indexTitle} – ${BASE_TITLE}`
  if (PrimaryDataIsLoaded) {
    if (!record.panelElem) generateRecordDetails(qid);
    let detailsElem = document.getElementById('details');
    detailsElem.replaceChild(record.panelElem, detailsElem.childNodes[0]);
    displayPanelContent('details');
  }
  else {
    displayPanelContent('loading');
  }
}


// Given a Commons image filename and an array of class names, generates
// a figure HTML string, returns it, and calls the Commons API to fetch
// and insert the image attribution if needed. If the filename is false,
// the figure element will indicate "No photo available".
function generateFigure(filename, classNames = []) {
  if (filename) {

    // Fetch the image attribution asynchronously then add it to the figure element
    loadJsonp(
      COMMONS_API_URL,
      {
        action : 'query',
        format : 'json',
        prop   : 'imageinfo',
        iiprop : 'extmetadata',
        titles : 'File:' + filename,
      },
      function(data) {
        let metadata = Object.values(data.query.pages)[0].imageinfo[0].extmetadata;
        let artistHtml = metadata.Artist.value.trim();
        // Remove all HTML except links
        artistHtml = artistHtml.replace(/<(?!\/?a ?)[^>]+>/g, '');
        if (artistHtml.search('href="//') >= 0) {
          artistHtml = artistHtml.replace(/href="(?:https?:)?\/\//g, 'href="https://');
        }
        let licenseHtml = '';
        if ('AttributionRequired' in metadata && metadata.AttributionRequired.value === 'true') {
          licenseHtml = metadata.LicenseShortName.value.replace(/ /g, '&nbsp;');
          licenseHtml = licenseHtml.replace(/-/g, '&#8209;');
          licenseHtml = `[${licenseHtml}]`;
          if ('LicenseUrl' in metadata) {
            licenseHtml = `<a href="${metadata.LicenseUrl.value}">${licenseHtml}</a>`;
          }
          licenseHtml = ' ' + licenseHtml;
        }
        let selector = `figure${classNames.length ? '.' : ''}${classNames.join('.')} figcaption`;
        document.querySelector(selector).innerHTML = artistHtml + licenseHtml;
      }
    );

    let encodedFilename = encodeURIComponent(filename);
    return (
      `<figure class="${classNames.join(' ')}">` +
        `<a href="${COMMONS_WIKI_URL_PREF}File:${encodedFilename}">` +
          `<img class="loading" src="${COMMONS_WIKI_URL_PREF}Special:FilePath/${encodedFilename}?width=300" alt="" onload="this.className=''">` +
        '</a>' +
        '<figcaption>(Loading…)</figcaption>' +
      '</figure>'
    );
  }
  else {
    return `<figure class="${classNames.join(' ')} nodata">No photo available</figure>`;
  }
}


// Given a WDQS query result image data, returns the base image filename.
function extractImageFilename(image) {
  let regex = /https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//;
  return decodeURIComponent(image.value.replace(regex, ''));
}


// Given a WDQS result record and key name, takes the date value based on
// the key name and then returns a formatted date string.
function parseDate(result, keyName) {
  let dateVal = result[keyName].value;
  if (result[keyName + 'Precision'].value === YEAR_PRECISION) {
    return dateVal.substr(0, 4);
  }
  else {
    let date = new Date(dateVal);
    return date.toLocaleDateString(
      'en-US',
      {
        month : 'long',
        day   : 'numeric',
        year  : 'numeric',
      },
    );
  }
}
