'use strict';

// Constants and fixed parameters
const WDQS_API_URL            = 'https://query.wikidata.org/sparql';
const COMMONS_API_URL         = 'https://commons.wikimedia.org/w/api.php';
const YEAR_PRECISION          = '9';
const PH_QID                  = 'Q928';
const REGION_QID              = 'Q24698';
const PROVINCE_QID            = 'Q24746';
const HUC_QID                 = 'Q29946056';
const CITY_QID                = 'Q104157';
const ADMIN_QIDS              = [REGION_QID, PROVINCE_QID, HUC_QID, CITY_QID];
const ADMIN_LEVELS            = 4;
const OSM_LAYER_URL           = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_LAYER_ATTRIBUTION   = 'Base map &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const CARTO_LAYER_URL         = 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png';
const CARTO_LAYER_ATTRIBUTION = 'Base map &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (data), <a href="https://carto.com/">CARTO</a> (style)';
const TILE_LAYER_MAX_ZOOM     = 19;
const MIN_PH_LAT              =   4.5;
const MAX_PH_LAT              =  21.0;
const MIN_PH_LON              = 116.5;
const MAX_PH_LON              = 126.5;

// Globals
var Map;      // Leaflet map object
var Cluster;  // Leaflet map cluster
var AppIsInitialized;

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
  let osmLayer = new L.tileLayer(OSM_LAYER_URL, {
    attribution : OSM_LAYER_ATTRIBUTION,
    maxZoom     : TILE_LAYER_MAX_ZOOM,
  })
  let cartoLayer = new L.tileLayer(CARTO_LAYER_URL, {
    attribution : CARTO_LAYER_ATTRIBUTION,
    maxZoom     : TILE_LAYER_MAX_ZOOM,
  }).addTo(Map);
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


// Enables the app. Should be called after the Wikidata queries have been processed.
function enableApp() {
  // Remove the app initialization spinner and activate the hashchange handler
  AppIsInitialized = true;
  document.getElementById('init').remove();
  processHashChange();
}


// Event handler that handles any change in the window URL hash.
function processHashChange() {

  if (!AppIsInitialized) return;

  let fragment = window.location.hash.replace('#', '');
  if (!processFragment(fragment)) {
    if (fragment === 'about') {
      document.title = 'About – ' + BASE_TITLE;
      displayPanelContent('about');
    }
    else {
      window.location.hash = '';  // Disable invalid fragments
      document.title = BASE_TITLE;
      displayPanelContent('index');
    }
  }
}


// Displays the element with the specified ID on the side panel and
// updates the navigation menu state as well.
function displayPanelContent(contentId) {
  document.querySelectorAll('.panel-content').forEach(content => {
    content.style.display = (content.id === contentId) ? content.dataset.display : 'none';
  });
  document.querySelectorAll('nav li').forEach(li => {
    if (li.childNodes[0].getAttribute('href') === '#' + contentId) {
      li.classList.add('selected');
    }
    else {
      li.classList.remove('selected');
    }
  });
}


// This takes a Commons image filename and a figure HTML element and populates
// the element with the 150-pixel wide image and any required attribution inside
// a figcaption element.
function displayFigure(filename, figure) {

  // Fetch the image thumbnail
  loadJsonp(
    COMMONS_API_URL,
    {
      action     : 'query',
      format     : 'json',
      prop       : 'imageinfo',
      iiprop     : 'url',
      iiurlwidth : 300,
      titles     : 'File:' + filename,
    },
    function(data) {
      let pageId = Object.keys(data.query.pages)[0];
      let imageInfo = data.query.pages[pageId].imageinfo[0];
      let img = document.createElement('img');
      img.src = imageInfo.thumburl;
      let anchor = document.createElement('a');
      anchor.href = imageInfo.descriptionurl;
      img.style.height = (imageInfo.thumbheight / 2) + 'px';
      anchor.appendChild(img);
      figure.replaceChild(anchor, figure.childNodes[0]);  // replace spinner
    }
  );

  // Fetch the image attribution and see if it is needed
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
      let pageId = Object.keys(data.query.pages)[0];
      let metadata = data.query.pages[pageId].imageinfo[0].extmetadata;
      let artistHtml = metadata.Artist.value;
      if (artistHtml.search('href="//') >= 0) {
        artistHtml = artistHtml.replace(/href="(?:https?:)?\/\//, 'href="https://');
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
      figure.insertAdjacentHTML('beforeend', `<figcaption>${artistHtml}${licenseHtml}</figcaption>`);
    }
  );
}


// Given a WDQS query result Wikidata item data, returns the QID.
function getQid(queryItem) {
  if (!queryItem) return '';
  return queryItem.value.split('/')[4];
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
