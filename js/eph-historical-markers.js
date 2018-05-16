'use strict';

// This is the AJAX event handler for the Wikidata query.
function processWikidataQuery() {

  if (this.readyState !== this.DONE || this.status !== 200) return;

  var data = JSON.parse(this.responseText);

  // Go through each query result and populate the Markers database
  data.results.bindings.forEach(function(result) {
    let qid = getQid(result.marker);
    if (!(qid in Markers)) Markers[qid] = new MarkerRecord;
    let record = Markers[qid];
    processQueryResult(result, record);
  });

  // Do post-processing
  Object.keys(Markers).forEach(function(qid) { postProcessRecord(qid) });

  // Update stats
  let numMarkers = Object.keys(Markers).length;
  document.getElementById('stats').innerHTML = 'Showing a total of ' + numMarkers + ' markers';

  // If there is a permalinked marker, re-initialize the map view
  let fragment = window.location.hash.replace('#', '');
  if (fragment in Markers) {
    let record = Markers[fragment];
    Map.setView([record.lat, record.lon], TILE_LAYER_MAX_ZOOM);
  }

  // Enable the index sort button and add click event handler,
  // and perform the initial sort
  let elem = document.getElementById('sort');
  elem.disabled = false;
  elem.addEventListener('click', switchSortMode);
  CurrentSortModeIdx = SORT_MODES.length - 1;
  switchSortMode();

  enableApp();
}


// This takes a query result and its corresponding record and updates that
// record with any new data provided in the result.
function processQueryResult(result, record) {

  if ('title' in result) {
    record.title[result.title['xml:lang']] = {
      main : result.title.value,
      sub  : ('subtitle' in result) ? result.subtitle.value : null,
    };
  }
  else if ('titleNoValue' in result) {
    record.title = null;
    // ASSUME: All markers have an English label on Wikidata
    let substituteTitle = result.markerLabel.value.replace(/ ?historical marker/i, '');
    record.indexTitle = '[' + substituteTitle + ']';
  }

  if ('inscription' in result) {
    record.inscription[result.inscription['xml:lang']] = formatInscription(result.inscription.value);
  }
  else if ('inscriptionNoValue' in result) {
    record.inscription = null;
  }

  let wktBits = result.coord.value.split(/\(|\)| /);  // Note: format is Point WKT
  record.lat = parseFloat(wktBits[2]);
  record.lon = parseFloat(wktBits[1]);

  if ('image' in result) {
    record.imageFilename = extractImageFilename(result.image);
  }

  if ('date' in result) {
    parseDate(result, 'date', record);
  }

  if ('commemorates' in result) {
    record.commemorates[getQid(result.commemorates)] = {
      title  : result.commemoratesLabel.value,
      wp_url : ('commemoratesArticle' in result) ? result.commemoratesArticle.value : null,
    };
  }

  let adminQids = [], adminLabels = [], adminTypes = [];
  for (let i = 0; i < ADMIN_LEVELS; i++) {
    let qidProp = 'admin' + i;
    if (qidProp in result) {
      adminQids[i] = getQid(result[qidProp]);
      let labelProp = 'admin' + i + 'Label';
      if (labelProp in result) adminLabels[i] = result[labelProp].value;
      if (adminQids[i] in ADMIN_LABEL_REPLACEMENT) adminLabels[i] = ADMIN_LABEL_REPLACEMENT[adminQids[i]];
      let typeProp = 'admin' + i + 'Type';
      if (typeProp in result) adminTypes[i] = getQid(result[typeProp]);
    }
  }

  // Construct address
  let address = '';
  if ('locationLabel' in result) {
    address = result.locationLabel.value;
  }
  if ('streetAddress' in result) {
    address += (address ? ', ' : '') + result.streetAddress.value;
  }
  let islandAdminTypeQid;
  if ('islandLabel' in result) islandAdminTypeQid = getQid(result.islandAdminType);
  for (let i = 0; i < ADMIN_LEVELS; i++) {
    if (
      adminLabels[i] && adminTypes[i] !== COUNTRY_QID && (i === 0 || (
        adminTypes[i - 1] !== PROVINCE_QID &&
        adminTypes[i - 1] !== REGION_QID && (
          // Don't display the region for HUCs and Cotabato City unless it's
          // Metro Manila
          (adminTypes[i - 1] !== CITY_QID && adminTypes[i - 1] !== HUC_QID) ||
          adminTypes[i] !== REGION_QID ||
          adminLabels[i] === 'Metro Manila'
        )
      ))
    ) {
      if (adminQids[i] in SKIPPED_ADMIN_LABELS) continue;
      if (islandAdminTypeQid && islandAdminTypeQid === adminTypes[i]) address += (address ? ', ' : '') + result.islandLabel.value;
      address += (address ? ', ' : '') + adminLabels[i];
    }
    else {
      break;
    }
  }
  if ('country' in result && getQid(result.country) !== PH_QID) {
    address += (address ? ', ' : '') + result.countryLabel.value;
  }

  record.location.address = address;

  if ('locationImage' in result) {
    record.location.imageFilename = extractImageFilename(result.locationImage);
  }

  if ('vicinityImage' in result) {
    record.vicinity.imageFilename = extractImageFilename(result.vicinityImage);
    if ('vicinityDescription' in result) {
      record.vicinity.description = result.vicinityDescription.value;
    }
  }
}


// This takes a historical marker QID then cleans up the corresponding record,
// and generates a map marker and index entry for the historical marker.
function postProcessRecord(qid) {

  let record = Markers[qid];

  // Clean up record
  if (Object.keys(record.commemorates).length === 0) record.commemorates = null;
  if (!record.vicinity.imageFilename) record.vicinity = null;

  // Generate the map marker popup HTML
  let popupHtml;
  if (record.title && Object.keys(record.title).length > 0) {
    let title = getTranslation(record.title);
    record.indexTitle = title.main;
    popupHtml = title.main;
    if (title.sub) {
      record.indexTitle += (title.sub.substr(0, 1) === '(' ? ' ' : ': ') + title.sub;
      popupHtml += '<div class="subtitle">' + title.sub + '</div>';
    }
  }
  else {
    popupHtml = record.indexTitle;
  }

  // Create a map marker and add to the cluster
  let mapMarker = L.marker([record.lat, record.lon], {
    icon: L.ExtraMarkers.icon({ icon: '', markerColor : 'cyan' })
  });
  mapMarker.bindPopup(popupHtml, { closeButton: false });
  Cluster.addLayer(mapMarker);
  record.mapMarker = mapMarker;
  let popup = mapMarker.getPopup();
  popup._qid = qid;
  record.popup = popup;

  // Create an index entry and add to the index
  let li = document.createElement('li');
  li.innerHTML = '<a href="#' + qid + '">' + record.indexTitle + '</a>';
  document.getElementById('index-list').appendChild(li);
  record.indexLi = li;
}


// TODO
function processFragment(fragment) {
  if (!(fragment in Markers)) return false;
  activateMarker(fragment);
  return true;
}


// This takes a historical marker QID and updates the map to show the
// corresponding map marker, opens its popup if it isn't open yet, and
// displays the historical marker's details on the side panel.
function activateMarker(qid) {
  displayRecordDetails(qid);
  let record = Markers[qid];
  Cluster.zoomToShowLayer(record.mapMarker, function() {
    Map.setView([record.lat, record.lon], Map.getZoom());
    if (!record.popup.isOpen()) {
      record.mapMarker.openPopup();
    }
  });
}


// This function displays the historical marker's details on the side panel.
function displayRecordDetails(qid) {

  let record = Markers[qid];

  window.location.hash = '#' + qid;
  let title = getTranslation(record.title);
  document.title = (title ? title.main : record.indexTitle) + ' – ' + BASE_TITLE;

  if (!record.panelElem) generateMarkerDetails(qid, record);
  displayPanelContent('details');
  let detailsElem = document.querySelector('#details');
  detailsElem.replaceChild(record.panelElem, detailsElem.childNodes[0]);
}


// This generates the details content of a historical marker for the side panel.
function generateMarkerDetails(qid, record) {

  let titleHtml;
  if (record.title) {
    titleHtml = '<h1>';
    let title = getTranslation(record.title);
    titleHtml += title.main;
    if (title.sub) titleHtml += ' <span class="subtitle">' + title.sub + '</span>';
    titleHtml += '</h1>';
  }
  else {
    titleHtml = '<h1 class="untitled">Untitled</h1>';
  }

  let markerFigureHtml;
  if (record.imageFilename) {
    markerFigureHtml = '<figure class="marker"><div class="loader"></div></figure>';
  }
  else {
    markerFigureHtml = '<figure class="marker nodata">No photo available</figure>';
  }

  let inscriptionHtml;
  if (record.inscription) {
    let inscription = getTranslation(record.inscription);
    if (inscription) {
      inscriptionHtml = '<div class="inscription main-text">' + inscription + '</div>';
    }
    else {
      inscriptionHtml = '<div class="inscription main-text loading"><div class="loader"></div></div>';
    }
  }
  else {
    inscriptionHtml = '<div class="inscription main-text nodata"><p>This historical marker has no inscription.</p></div>';
  }

  let commemoratesHtml;
  if (record.commemorates) {
    let commemoratesIds = Object.keys(record.commemorates);
    let tagName = commemoratesIds.length > 1 ? 'li' : 'p';
    commemoratesHtml = commemoratesIds.length > 1 ? '<ul>' : '';
    commemoratesIds.forEach(function(qid) {
      let commemoratesData = record.commemorates[qid];
      commemoratesHtml += '<' + tagName + '>' + commemoratesData.title;
      commemoratesHtml += '<a class="image" href="https://www.wikidata.org/wiki/' + qid + '" title="View in Wikidata">';
      commemoratesHtml += '<img src="img/wikidata_tiny_logo.png" alt="[view Wikidata item]" /></a>';
      if (commemoratesData.wp_url) {
        commemoratesHtml += '<a class="image" href="' + commemoratesData.wp_url + '" title="View in Wikipedia">';
        commemoratesHtml += '<img src="img/wikipedia_tiny_logo.png" alt="[view Wikipedia article]" /></a>';
      }
      commemoratesHtml += '</' + tagName + '>';
    });
    commemoratesHtml += commemoratesIds.length > 1 ? '</ul>' : '';
  }
  else {
    commemoratesHtml = '<p class="nodata">Unspecified</p>';
  }

  let locationFigureHtml = '';
  if (record.location.imageFilename) {
    locationFigureHtml = '<figure class="location"><div class="loader"></div></figure>';
  }

  let addressHtml;
  if (record.location.address) {
    addressHtml = '<p class="address">' + record.location.address + '</p>';
  }
  else {
    addressHtml = '<p class="nodata">Unspecified</p>';
  }

  let vicinityHtml = '';
  if (record.vicinity) {
    vicinityHtml = '<div class="vicinity">';
    vicinityHtml += '<figure class="vicinity"><div class="loader"></div></figure>';
    if (record.vicinity.description) {
      vicinityHtml += '<p>' + record.vicinity.description + '</p>';
    }
    vicinityHtml += '</div>'
  }

  let detailsHtml =
    '<a class="main-wikidata-link" href="https://www.wikidata.org/wiki/' + qid + '" title="View in Wikidata">' +
    '<img src="img/wikidata_tiny_logo.png" alt="[view Wikidata item]" /></a>' +
    titleHtml +
    markerFigureHtml +
    inscriptionHtml +
    '<h2>' + (record.datePrecision === YEAR_PRECISION ? 'Year' : 'Date') + ' unveiled</h2>' +
    '<p' + (record.date ? ('>' + record.date) : ' class="nodata">Unknown') + '</p>' +
    '<h2>Commemorates</h2>' +
    commemoratesHtml +
    '<h2>Location</h2>' +
    locationFigureHtml +
    addressHtml +
    vicinityHtml;

  let panelElem = document.createElement('div');
  panelElem.innerHTML = detailsHtml;
  record.panelElem = panelElem;

  // Load images
  let markerFigure   = panelElem.querySelector('figure.marker'  );
  let locationFigure = panelElem.querySelector('figure.location');
  let vicinityFigure = panelElem.querySelector('figure.vicinity');
  if (record         .imageFilename) displayFigure(record         .imageFilename, markerFigure  );
  if (record.location.imageFilename) displayFigure(record.location.imageFilename, locationFigure);
  if (record.vicinity              ) displayFigure(record.vicinity.imageFilename, vicinityFigure);

  // Historical marker has no direct inscription: check the talk page
  if (record.inscription && Object.keys(record.inscription).length === 0) {
    checkAndDisplayLongInscription(qid, record);
  }
}


// This takes a historical marker QID and the corresponding record and checks if
// there are {{LongInscription}} templates in the Wikidata talk page. If there
// are, this parses the templates, stores the inscriptions into the record, then
// inserts the preferred inscription into the details content.
function checkAndDisplayLongInscription(qid, record) {
  loadJsonp(
    'https://www.wikidata.org/w/api.php',
    {
      action : 'query',
      format : 'json',
      prop   : 'revisions',
      rvprop : 'content',
      titles : 'Talk:' + qid,
    },
    function(data) {

      // Extract inscriptions and add them to the database
      let pageId = Object.keys(data.query.pages)[0];
      if (pageId !== '-1') {
        let talkContent = data.query.pages[pageId].revisions[0]['*'];
        let templateStrings = talkContent.match(/{{\s*LongInscription[^]+?}}/g);
        if (templateStrings) {
          templateStrings.forEach(function(string) {
            let langQid = string.match(/\|\s*langqid\s*=\s*(Q[0-9]+)/)[1];
            let inscription = string.match(/\|\s*inscription\s*=\s*([^]*?)(?:\||}})/)[1];
            for (let i = 0; i < ORDERED_LANGUAGES.length; i++) {
              let langCode = ORDERED_LANGUAGES[i];
              if (langQid === LANGUAGES[langCode].qid) {
                record.inscription[langCode] = formatInscription(inscription);
                break;
              }
            }
          });
        }
      }

      // Populate the details content with the inscription,
      // or indicate that there's none
      let inscriptionElem = record.panelElem.childNodes[3];
      if (Object.keys(record.inscription).length > 0) {
        inscriptionElem.innerHTML = getTranslation(record.inscription);
      }
      else {
        inscriptionElem.classList.add('nodata');
        inscriptionElem.innerHTML = '<p>No inscription has been encoded yet.</p>';
      }
      inscriptionElem.classList.remove('loading');
    }
  );
}


// This toggles the sort mode and then sorts the index list.
function switchSortMode() {

  CurrentSortModeIdx = (CurrentSortModeIdx + 1) % SORT_MODES.length;
  document.getElementById('sort').innerHTML =
    'Sort list ' + SORT_MODES[(CurrentSortModeIdx + 1) % SORT_MODES.length].label;

  let sorter = function(getKey, compareKey) {
    return Object.keys(Markers)
      .map(function(el) {
        return { key: getKey(el), item: Markers[el].indexLi };
      })
      .sort(compareKey)
      .map(function(el) { return el.item });
  };

  let lis;
  if (SORT_MODES[CurrentSortModeIdx].id === 'alpha') {
    lis = sorter(
      function(el) { return Markers[el].indexTitle.replace(/^[^A-Za-z0-9]/, ''); },
      function(a, b) { return a.key > b.key ? 1 : -1; }
    );
  }
  else { // 'qid'
    lis = sorter(
      function(el) { return Number(el.substring(1)); },
      function(a, b) { return a.key - b.key; }
    );
  }

  let list = document.getElementById('index-list');
  list.innerHTML = '';
  lis.forEach(function(li) { list.appendChild(li); });
}


// This takes an inscription text from Wikidata and reformats it into
// paragraphs.
function formatInscription(text) {
  return '<p>' + text.replace(/\s*<br\s*\/?>(?:<br\s*\/?>)?\s*/gi, '</p><p>') + '</p>';
}


// This takes a dictionary keyed by language code and an optional language code
// and returns the value for the code if it exists in the dictionary. Otherwise
// it returns the first value that matches an ordered list of language codes.
// Returns null if the dict is not valid and the empty string if there is no
// suitable language code existing in the dictionary.
function getTranslation(dict, langCode) {
  if (!dict) return null;
  if (langCode && langCode in dict) return dict[langCode];
  for (let i = 0; i < ORDERED_LANGUAGES.length; i++) {
    let langCode = ORDERED_LANGUAGES[i];
    if (langCode in dict) return dict[langCode];
  }
  return '';
}

// ------------------------------------------------------------

// Class declaration for representing a historical marker
function MarkerRecord() {
  this.indexTitle    = '';
  this.title         = {};  // empty if not encoded yet; null if novalue
  this.inscription   = {};  // empty if not encoded yet; null if novalue
  this.lat           = 0;
  this.lon           = 0;
  this.imageFilename = '';
  this.date          = '';
  this.datePrecision = YEAR_PRECISION;
  this.commemorates  = {};
  this.location      = { address:     '', imageFilename: '' };
  this.vicinity      = { description: '', imageFilename: '' };
  this.mapMarker     = undefined;
  this.popup         = undefined;
  this.panelElem     = undefined;
  this.indexLi       = undefined;
}
