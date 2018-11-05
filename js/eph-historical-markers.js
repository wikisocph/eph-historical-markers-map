'use strict';


// This loads and parses all the primary data that can be obtained from WDQS
// in several batches then enables the app.
function loadPrimaryData() {
  let promise;

  generateTopLevelData()
    .then(constructSparqlValuesClause)
    .then(function() {
      return Promise.all([
        generateAddressData(),
        generateTitleData(),
        generateShortInscriptionData(),
        generateUnveilingDateData(),
        generatePhotoData(),
        generateCommemoratesData(),
      ]);
    })
    .then(preEnableApp)
    .then(enableApp);
}


// This queries WDQS for the historical marker Wikidata items that have current
// coordinates, then based on the query sets the "lat", "lon", "qidSortKey"
// fields of the Markers database, then returns a promise which resolves upon
// completion of the process.
function generateTopLevelData() {
  let promise = queryWikidataQueryService(SPARQL_QUERY_0);
  promise.then(function(data) {

    // Query parsing
    data.results.bindings.forEach(function(result) {
      let qid = getQid(result.marker);
      if (!(qid in Markers)) Markers[qid] = new MarkerRecord;
      let record = Markers[qid];
      let wktBits = result.coord.value.split(/\(|\)| /);  // Note: format is Point WKT
      record.lat.push(parseFloat(wktBits[2]));
      record.lon.push(parseFloat(wktBits[1]));
    });

    // Post-processing: Get the average of the coordinates
    Object.values(Markers).forEach(function(record) {
      let numCoords = record.lat.length;
      let sumLats = 0;
      let sumLons = 0;
      record.lat.forEach(function(lat) { sumLats += lat });
      record.lon.forEach(function(lon) { sumLons += lon });
      record.lat = sumLats / numCoords;
      record.lon = sumLons / numCoords;
    });

    // Post-processing: Generate QID sort key
    Object.keys(Markers).forEach(function(qid) {
      Markers[qid].qidSortKey = Number(qid.substring(1));
    });

    // Update stats
    let numMarkers = Object.keys(Markers).length;
    document.getElementById('stats').innerHTML = 'Showing a total of ' + numMarkers + ' markers';
  });
  return promise;
}


// This generates the SPARQL "VALUES" clause that will be used by subsequent queries
function constructSparqlValuesClause() {
  SparqlValuesClause =
    'VALUES ?marker {' +
    Object.keys(Markers).map(function(qid) { return 'wd:' + qid }).join(' ') +
    '}';
}


// This queries WDQS and sets the "location" field of the Markers database,
// then returns a promise which resolves upon completion of the process.
function generateAddressData() {
  let query = SPARQL_QUERY_1.replace('<SPARQLVALUESCLAUSE>', SparqlValuesClause);
  let promise = queryWikidataQueryService(query);
  promise.then(function(data) {
    data.results.bindings.forEach(function(result) {

      // Combine admin parts into array of objects and ignore countries
      let adminData = [];
      for (let i = 0; i < ADMIN_LEVELS; i++) {
        if (!(('admin' + i) in result)) break;
        if (result['admin' + i].value === result.country.value) break;
        let qid = getQid(result['admin' + i]);
        adminData[i] = {
          qid   : qid,
          type  : getQid(result['admin' + i + 'Type']),
        };
        adminData[i].label = qid in ADDRESS_LABEL_REPLACEMENT
          ? ADDRESS_LABEL_REPLACEMENT[qid]
          : result['admin' + i + 'Label'].value
      }

      // Construct address as array
      let addressParts = [];
      if ('location' in result && !(getQid(result.location) in SKIPPED_ADDRESS_LABELS)) {
        addressParts.push(result.locationLabel.value);
      }
      if ('streetAddress' in result) {
        addressParts.push(result.streetAddress.value);
      }
      let islandAdminTypeQid;
      if ('islandLabel' in result) islandAdminTypeQid = getQid(result.islandAdminType);
      for (let i = 0; i < ADMIN_LEVELS; i++) {
        if (
          adminData[i] && adminData[i].label && (
            i === 0 || (
              adminData[i - 1].type !== PROVINCE_QID &&
              adminData[i - 1].type !== REGION_QID && (
                // Don't display the region for HUCs and Cotabato City unless it's
                // Metro Manila
                (adminData[i - 1].type !== CITY_QID && adminData[i - 1].type !== HUC_QID) ||
                adminData[i].type !== REGION_QID ||
                adminData[i].qid === METRO_MANILA_QID
              )
            )
          )
        ) {
          if (adminData[i].qid in SKIPPED_ADDRESS_LABELS) continue;
          if (islandAdminTypeQid && islandAdminTypeQid === adminData[i].type) addressParts.push(result.islandLabel.value);
          addressParts.push(adminData[i].label);
        }
        else {
          break;
        }
      }
      if (getQid(result.country) !== PH_QID) {
        addressParts.push(result.countryLabel.value);
      }

      let locRecord = Markers[getQid(result.marker)].location;
      locRecord.address = addressParts.join(', ');

      if ('locationImage' in result) {
        locRecord.imageFilename = extractImageFilename(result.locationImage);
      }
    });
  });
  return promise;
}


// This queries WDQS and sets the "indexTitle", "title", "alphaSortKey",
// "popupHtml", "indexLi" fields of the Markers database, then returns a promise
// which resolves upon completion of the process.
function generateTitleData() {
  let query = SPARQL_QUERY_2.replace('<SPARQLVALUESCLAUSE>', SparqlValuesClause);
  let promise = queryWikidataQueryService(query);
  promise.then(function(data) {

    // Query parsing
    data.results.bindings.forEach(function(result) {

      let record = Markers[getQid(result.marker)];

      let langCode;
      if ('title' in result) langCode = result.title['xml:lang'];
      if ('targetLang' in result) langCode = getLangCode(result.targetLang);

      if ('titleNoValue' in result) {
        if (langCode) {
          record.title[langCode] = null;
        }
        else {
          record.title = null;
        }
        // ASSUME: All markers have an English label on Wikidata
        let substituteTitle = result.markerLabel.value.replace(/ *historical marker/i, '');
        record.indexTitle = '[' + substituteTitle + ']';
      }
      else if ('title' in result) {
        record.title[langCode] = {
          main : result.title.value,
          sub  : ('subtitle' in result) ? result.subtitle.value : null,
        };
      }
    });

    // Post-processing: Generate the map marker popup HTML and index entry
    let listIndex = document.getElementById('index-list');
    Object.keys(Markers).forEach(function(qid) {

      let record = Markers[qid];

      let popupHtml;
      if (record.title && Object.keys(record.title).length > 0) {
        let title = getTranslation(record.title);
        record.indexTitle = title.main.replace(/<br\s*\/?>/g, ' ');
        popupHtml = title.main;
        if (title.sub) {
          record.indexTitle += (title.sub.substr(0, 1) === '(' ? ' ' : ': ');
          record.indexTitle += title.sub.replace(/<br\s*\/?>/g, ' ');
          popupHtml += '<div class="subtitle">' + title.sub + '</div>';
        }
      }
      else {
        popupHtml = record.indexTitle;
      }
      record.popupHtml = popupHtml;

      // Generate alphabetical sort key and create an index entry and add to the index
      record.alphaSortKey = record.indexTitle.replace(/^[^A-Za-z0-9]/, '');
      record.alphaSortKey = record.alphaSortKey.replace(/^(?:The |Ang )/, '');
      let li = document.createElement('li');
      li.innerHTML = '<a href="#' + qid + '">' + record.indexTitle + '</a>';
      listIndex.appendChild(li);
      record.indexLi = li;
    });
  });
  return promise;
}


// This queries WDQS and sets the "inscription" field of the Markers database,
// then returns a promise which resolves upon completion of the process.
function generateShortInscriptionData() {
  let query = SPARQL_QUERY_3.replace('<SPARQLVALUESCLAUSE>', SparqlValuesClause);
  let promise = queryWikidataQueryService(query);
  promise.then(function(data) {
    data.results.bindings.forEach(function(result) {
      let record = Markers[getQid(result.marker)];
      if ('inscription' in result) {
        record.inscription[result.inscription['xml:lang']] = formatInscription(result.inscription.value);
      }
      else if ('inscriptionNoValue' in result) {
        record.inscription = null;
      }
    });
  });
  return promise;
}


// This queries WDQS and sets the "date" field of the Markers database,
// then returns a promise which resolves upon completion of the process.
function generateUnveilingDateData() {
  let query = SPARQL_QUERY_4.replace('<SPARQLVALUESCLAUSE>', SparqlValuesClause);
  let promise = queryWikidataQueryService(query);
  promise.then(function(data) {
    data.results.bindings.forEach(function(result) {
      let record = Markers[getQid(result.marker)];
      let date = parseDate(result, 'date');
      if ('targetLang' in result) {
        if (!record.date) record.date = {};
        record.date[getLangCode(result.targetLang)] = date;
      }
      else {
        record.date = date;
      }
    });
  });
  return promise;
}


// This queries WDQS and sets the "imageFilename" and "vicinity" fields of the
// Markers database, then returns a promise which resolves upon completion
// of the process.
function generatePhotoData() {
  let query = SPARQL_QUERY_5.replace('<SPARQLVALUESCLAUSE>', SparqlValuesClause);
  let promise = queryWikidataQueryService(query);
  promise.then(function(data) {

    // Query parsing
    data.results.bindings.forEach(function(result) {
      let record = Markers[getQid(result.marker)];
      if ('image' in result) {
        let filename = extractImageFilename(result.image);
        if ('targetLang' in result) {
          if (!record.imageFilename) record.imageFilename = {};
          record.imageFilename[getLangCode(result.targetLang)] = filename;
        }
        else if ('ordinal' in result) {
          if (!record.imageFilename) record.imageFilename = [];
          record.imageFilename[parseInt(result.ordinal.value) - 1] = filename;
        }
        else {
          record.imageFilename = filename;
        }
      }
      if ('vicinityImage' in result) {
        record.vicinity.imageFilename = extractImageFilename(result.vicinityImage);
        record.vicinity.description = result.vicinityDescription.value;
      }
    });

    // Post-processing: indicate missing vicinity data
    Object.values(Markers).forEach(function(record) {
      if (!record.vicinity.imageFilename) record.vicinity = null;
    });
  });
  return promise;
}


// This queries WDQS and sets the "commemorates" field of the Markers database,
// then returns a promise which resolves upon completion of the process.
function generateCommemoratesData() {
  let query = SPARQL_QUERY_6.replace('<SPARQLVALUESCLAUSE>', SparqlValuesClause);
  let promise = queryWikidataQueryService(query);
  promise.then(function(data) {
    data.results.bindings.forEach(function(result) {
      let record = Markers[getQid(result.marker)];
      if (!record.commemorates) record.commemorates = {};
      record.commemorates[getQid(result.commemorates)] = {
        title  : result.commemoratesLabel.value,
        wp_url : ('commemoratesArticle' in result) ? result.commemoratesArticle.value : null,
      };
    });
  });
  return promise;
}


// This queries WDQS using the specified query and returns a promise that
// resolves with the parsed query JSON data or rejects with an HTTP error code.
function queryWikidataQueryService(query) {
  return new Promise(function(resolve, reject) {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== xhr.DONE) return;
      if (xhr.status === 200){
        var data = JSON.parse(xhr.responseText);
        resolve(data);
      }
      else {
        reject(xhr.status);
      }
    };
    xhr.open('POST', WDQS_API_URL, true);
    xhr.overrideMimeType('text/plain');
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send('format=json&query=' + escape(query));
  });
}


// This does any further data post-processing including generating the map markers.
// Also sets the "mapMarker", "popup", "languages" fields of the Markers database.
function preEnableApp() {

  // Do further post-processing
  Object.keys(Markers).forEach(function(qid) {

    let record = Markers[qid];

    // Generate map marker
    let mapMarker = L.marker(
      [record.lat, record.lon],
      { icon: L.ExtraMarkers.icon({ icon: '', markerColor : 'cyan' }) },
    );
    record.mapMarker = mapMarker;
    Cluster.addLayer(mapMarker);

    // Generate map marker popup based on the stored HTML string
    mapMarker.bindPopup(record.popupHtml, { closeButton: false });
    let popup = record.mapMarker.getPopup();
    popup._qid = qid;
    record.popup = popup;

    // Generate the list of codes of the languages of the historical marker
    // and indicate missing language values
    ORDERED_LANGUAGES.forEach(function(langCode) {
      if (
        record.inscription   && typeof record.inscription   === 'object' && langCode in record.inscription ||
        record.title         && typeof record.title         === 'object' && langCode in record.title       ||
        record.date          && typeof record.date          === 'object' && langCode in record.date        ||
        record.imageFilename && typeof record.imageFilename === 'object' && langCode in record.imageFilename
      ) {
        record.languages.push(langCode);
        if (record.inscription   &&                                             !(langCode in record.inscription  )) record.inscription  [langCode] = undefined;
        if (record.title         &&                                             !(langCode in record.title        )) record.title        [langCode] = null;
        if (record.date          && typeof record.date          === 'object' && !(langCode in record.date         )) record.date         [langCode] = null;
        if (record.imageFilename && typeof record.imageFilename === 'object' && !(langCode in record.imageFilename)) record.imageFilename[langCode] = null;
      }
    });
  });

  // If the URL indicates a permalinked marker, re-initialize the map view
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

  // Set the about page WDQS link
  let anchorElem = document.getElementById('wdqs-link');
  anchorElem.href = 'https://query.wikidata.org/#' + escape(ABOUT_SPARQL_QUERY);
}


// This checks if the specified URL fragment is the QID of a valid historical
// marker and activates the display of that marker if so.
// Returns true if the fragment is valid and false otherwise.
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

  // Set URL hash and window title
  window.location.hash = '#' + qid;
  let title = getTranslation(record.title);
  document.title = (title ? title.main : record.indexTitle) + ' – ' + BASE_TITLE;

  // Update panel
  if (!record.panelElem) generateMarkerDetails(qid, record);
  displayPanelContent('details');
  let detailsElem = document.querySelector('#details');
  detailsElem.replaceChild(record.panelElem, detailsElem.childNodes[0]);
}


// This generates the details content of a historical marker for the side panel.
function generateMarkerDetails(qid, record) {

  let langBarHtml = '';
  if (record.languages.length > 1) {
    langBarHtml = '<ol class="language-bar">';
    record.languages.forEach(function(langCode) {
      langBarHtml +=
        '<li onclick="selectLanguage(\'' + langCode + '\')"' +
        (langCode === record.languages[0] ? ' class="selected"' : '') +
        ' data-lang-code="' + langCode + '">' +
        LANGUAGES[langCode].name + '</li>';
    });
    langBarHtml += '</ol>';
  }

  let titleHtml = '';
  if (record.title) {
    Object.keys(record.title).forEach(function(langCode) {
      titleHtml += '<h1 class="l10n ' + langCode + '">';
      let titleData = record.title[langCode] || getTranslation(record.title);
      titleHtml += titleData.main;
      if (titleData.sub) titleHtml += ' <span class="subtitle">' + titleData.sub + '</span>';
      titleHtml += '</h1>';
    });
  }
  else {
    titleHtml = '<h1 class="untitled">Untitled</h1>';
  }

  let markerFigureHtml = '';
  let figureLoaders = [];
  if (!record.imageFilename) {
    markerFigureHtml = '<figure class="marker nodata">No photo available</figure>';
  }
  else {
    if (typeof record.imageFilename !== 'object') {
      markerFigureHtml = '<figure class="marker"><div class="loader"></div></figure>';
      figureLoaders.push({ filename: record.imageFilename, selector: 'figure.marker' });
    }
    else if (Array.isArray(record.imageFilename)) {
      for (let idx = 0; idx < record.imageFilename.length; idx++) {
        let filename = record.imageFilename[idx];
        markerFigureHtml += '<figure class="marker list' + idx + '"><div class="loader"></div></figure>';
        figureLoaders.push({ filename: filename, selector: 'figure.marker.list' + idx });
      }
    }
    else {
      record.languages.forEach(function(langCode) {
        let filename = record.imageFilename[langCode];
        markerFigureHtml += '<figure class="marker l10n ' + langCode;
        if (filename) {
          markerFigureHtml += '"><div class="loader"></div>';
          figureLoaders.push({ filename: filename, selector: 'figure.marker.' + langCode });
        }
        else {
          markerFigureHtml += ' nodata">No photo available';
        }
        markerFigureHtml += '</figure>';
      });
    }
  }

  let inscriptionHtml = '';
  let longInscriptionShouldBeChecked = false;
  if (!record.inscription) {
    inscriptionHtml = '<div class="inscription main-text nodata"><p>This historical marker has no inscription.</p></div>';
  }
  else {
    inscriptionHtml = '<div class="inscription main-text">';
    record.languages.forEach(function(langCode) {
      let inscription = record.inscription[langCode];
      if (inscription) {
        inscriptionHtml += '<div class="l10n ' + langCode + '">' + inscription + '</div>';
      }
      else {
        inscriptionHtml += '<div class="l10n ' + langCode + ' loading"><div class="loader"></div></div>';
        longInscriptionShouldBeChecked = true;
      }
    });
    if (record.languages.length === 0) {
      inscriptionHtml += '<div class="loading"><div class="loader"></div></div>';
      longInscriptionShouldBeChecked = true;
    }
    inscriptionHtml += '</div>';
  }

  let unveiledHtml = '';
  if (record.date) {
    if (typeof record.date === 'object') {
      record.languages.forEach(function(langCode) {
        let date = record.date[langCode];
        if (date) {
          unveiledHtml +=
            '<h2 class="l10n ' + langCode + '">' + (date.length === 4 ? 'Year' : 'Date') + ' unveiled</h2>' +
            '<p class="l10n ' + langCode + '">' + date + '</p>';
        }
        else {
          unveiledHtml +=
            '<h2 class="l10n ' + langCode + '">Date unveiled</h2>' +
            '<p class="nodata l10n ' + langCode + '"">Unknown</p>';
        }
      });
    }
    else {
      unveiledHtml =
        '<h2>' + (record.date.length === 4 ? 'Year' : 'Date') + ' unveiled</h2>' +
        '<p>' + record.date + '</p>';
    }
  }
  else {
    unveiledHtml = '<h2>Date unveiled</h2><p class="nodata">Unknown</p>';
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
    figureLoaders.push({ filename: record.location.imageFilename, selector: 'figure.location' });
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
    figureLoaders.push({ filename: record.vicinity.imageFilename, selector: 'figure.vicinity' });
    if (record.vicinity.description) {
      vicinityHtml += '<p>' + record.vicinity.description + '</p>';
    }
    vicinityHtml += '</div>'
  }

  let detailsHtml =
    langBarHtml +
    '<a class="main-wikidata-link" href="https://www.wikidata.org/wiki/' + qid + '" title="View in Wikidata">' +
    '<img src="img/wikidata_tiny_logo.png" alt="[view Wikidata item]" /></a>' +
    titleHtml +
    markerFigureHtml +
    inscriptionHtml +
    unveiledHtml +
    '<h2>Commemorates</h2>' +
    commemoratesHtml +
    '<h2>Location</h2>' +
    locationFigureHtml +
    addressHtml +
    vicinityHtml;

  let panelElem = document.createElement('div');
  if (record.languages.length > 1) panelElem.classList.add('l10n-top', record.languages[0]);
  panelElem.innerHTML = detailsHtml;
  record.panelElem = panelElem;

  // Load images
  figureLoaders.forEach(function(loaderData) {
    let figure = panelElem.querySelector(loaderData.selector);
    displayFigure(loaderData.filename, figure);
  });

  // Historical marker has missing inscriptions: check the talk page
  if (longInscriptionShouldBeChecked) checkAndDisplayLongInscription(qid, record);
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
                if (record.languages.length === 0) {
                  record.languages.push(langCode);
                  record.panelElem.querySelector('.inscription .loading').classList.add('l10n', langCode);
                }
                break;
              }
            }
          });
        }
      }

      // Populate the details content with the inscription,
      // or indicate that there's none
      record.languages.forEach(function(langCode) {
        let inscriptionElem = record.panelElem.querySelector('.inscription .l10n.' + langCode);
        if (!inscriptionElem.classList.contains('loading')) return;
        inscriptionElem.classList.remove('loading');
        let inscription = record.inscription[langCode];
        if (inscription) {
          inscriptionElem.innerHTML = inscription;
        }
        else {
          inscriptionElem.classList.add('nodata');
          inscriptionElem.innerHTML = '<p>No inscription has been encoded yet.</p>';
        }
      });
    }
  );
}


// This toggles the sort mode and then sorts the index list.
function switchSortMode() {

  CurrentSortModeIdx = (CurrentSortModeIdx + 1) % SORT_MODES.length;
  document.getElementById('sort').innerHTML =
    'Sort list ' + SORT_MODES[(CurrentSortModeIdx + 1) % SORT_MODES.length].label;
  let currentSortModeId = SORT_MODES[CurrentSortModeIdx].id;

  let list = document.getElementById('index-list');
  list.innerHTML = '';
  Object.keys(Markers).map(
    function(qid) {
      return {
        key  : Markers[qid][currentSortModeId + 'SortKey'],
        item : Markers[qid].indexLi,
      };
    }
  ).sort(
    currentSortModeId === 'alpha'
    ? function(a, b) { return a.key > b.key ? 1 : -1 }
    : function(a, b) { return a.key - b.key          }
  ).map(
    function(el) { return el.item }
  ).forEach(
    function(li) { list.appendChild(li); }
  );
}


// This activates the specified language in the current
// multilingual historical marker's details content.
function selectLanguage(langCode) {
  document.querySelector('#details .l10n-top').className = 'l10n-top ' + langCode;
  document.querySelectorAll('#details .language-bar li').forEach(function(elem) {
    if (elem.dataset.langCode === langCode) {
      elem.classList.add('selected');
    }
    else {
      elem.classList.remove('selected');
    }
  });
}


// This takes an inscription text from Wikidata and reformats it into
// paragraphs.
function formatInscription(text) {
  return '<p>' + text.replace(/\s*<br\s*\/?>\s*<br\s*\/?>\s*/gi, '</p><p>') + '</p>';
}


// This takes a WDQS query result language Wikidata item data
// and returns the language code.
function getLangCode(queryItem) {
  let langCode;
  Object.keys(LANGUAGES).forEach(function(code) {
    if (LANGUAGES[code].qid === getQid(queryItem)) langCode = code;
  });
  return langCode;
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
    if (langCode in dict && dict[langCode]) return dict[langCode];
  }
  return '';
}

// ------------------------------------------------------------

// Class declaration for representing a historical marker
function MarkerRecord() {
  this.qidSortKey    = undefined;
  this.alphaSortKey  = undefined;
  this.lat           = [];
  this.lon           = [];
  this.indexTitle    = '';
  this.title         = {};  // empty if not encoded yet; null if novalue
  this.inscription   = {};  // empty if not encoded yet; null if novalue
  this.imageFilename = undefined;
  this.date          = undefined;
  this.commemorates  = undefined;
  this.location      = { address:     '', imageFilename: '' };
  this.vicinity      = { description: '', imageFilename: '' };
  this.languages     = [];
  this.indexLi       = undefined;
  this.mapMarker     = undefined;
  this.popupHtml     = undefined;
  this.popup         = undefined;
  this.panelElem     = undefined;
}
