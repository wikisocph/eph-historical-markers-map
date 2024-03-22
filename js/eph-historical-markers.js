'use strict';


// Loads and parses all the primary data that can be obtained from WDQS
// in several batches then enables the app.
function loadPrimaryData() {
  doPreProcessing();
  populateCoordinatesData()
    .then(populateTitleData)
    .then(populateMapAndIndex)
    .then(() => {
      return Promise.all([
        populateLocationData(),
        populateInscriptionData(),
        populateDateData(),
        populatePhotoData(),
        populateCommemoratesData(),
      ]);
    })
    .then(doFinalPostProcessing)
    .then(enableApp);
}


// Performs pre data post-processing: mainly initialize static content
function doPreProcessing() {

  // Set the about page WDQS link
  let anchorElem = document.getElementById('wdqs-link');
  anchorElem.href = 'https://query.wikidata.org/#' + encodeURIComponent(ABOUT_SPARQL_QUERY);

  // Update panel in case of static content
  processHashChange();
}


// Queries WDQS for the historical marker Wikidata items that have current
// coordinates, then generates a Record object if needed and sets the "lat",
// "lon", and "qidSortKey" Records fields and the SparqlValuesClause value,
// then updates the number of historical markers stats.
function populateCoordinatesData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_0,
    function(result) {
      let qid = result.markerQid.value;
      if (!(qid in Records)) Records[qid] = new Record;
      let record = Records[qid];
      let wktBits = result.coord.value.split(/\(|\)| /);  // Note: format is Point WKT
      record.lat.push(parseFloat(wktBits[2]));
      record.lon.push(parseFloat(wktBits[1]));
    },
    function() {

      // Get the average of the coordinates
      Object.values(Records).forEach(record => {
        let numCoords = record.lat.length;
        if (numCoords === 1) {
          record.lat = record.lat[0];
          record.lon = record.lon[0];
        }
        else {
          let sumLats = 0;
          let sumLons = 0;
          record.lat.forEach(lat => { sumLats += lat });
          record.lon.forEach(lon => { sumLons += lon });
          record.lat = sumLats / numCoords;
          record.lon = sumLons / numCoords;
        }
      });

      // Generate QID sort key
      Object.entries(Records).forEach(entry => {
        entry[1].qidSortKey = Number(entry[0].substring(1));
      });

      // Generate SPARQL VALUES clause for subsequent queries
      SparqlValuesClause = 'VALUES ?marker {' + Object.keys(Records).map(qid => `wd:${qid}`).join(' ') + '}';

      // Update stats
      let numRecords = Object.keys(Records).length;
      document.getElementById('stats').innerHTML = `Showing a total of ${numRecords} markers`;
    },
  );
}


// Queries WDQS, sets the "title" and "indexTitle" (for untitled markers)
// Records fields, and sets the BootstrapDataIsLoaded status.
function populateTitleData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_1,
    function(result) {

      let langCode;
      if ('targetLangQid' in result) {
        langCode = getLangCode(result.targetLangQid.value);
      }
      else if ('title' in result) {
        langCode = result.title['xml:lang'];
      }

      let record = Records[result.markerQid.value];
      if ('title' in result) {
        record.title[langCode] = {
          main : result.title.value,
          sub  : ('subtitle' in result) ? result.subtitle.value : null,
        };
      }
      else if ('titleNoValue' in result) {
        if (langCode) {
          record.title[langCode] = null;
        }
        else {
          record.title = null;
        }
        // ASSUME: All markers have an English label on Wikidata
        let substituteTitle = result.markerLabel.value.replace(/ *historical marker/i, '');
        record.indexTitle = `[${substituteTitle}]`;
      }
    },
    function() {
      BootstrapDataIsLoaded = true;
    },
  );
}


// Queries WDQS and sets the "location" and "vicinty.description" Records fields.
function populateLocationData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_2,
    function(result) {

      // Combine admin parts into array of objects and ignore countries
      let adminData = [];
      for (let i = 0; i < ADMIN_LEVELS; i++) {
        let key = `admin${i}`;
        if (!(`${key}Qid` in result)) break;
        let qid = result[key + 'Qid'].value;
        if (qid === result.countryQid.value) break;
        adminData[i] = {
          qid  : qid,
          type : `${key}TypeQid` in result ? result[key + 'TypeQid'].value : null,
        };
        adminData[i].label = qid in ADDRESS_LABEL_REPLACEMENT
          ? ADDRESS_LABEL_REPLACEMENT[qid]
          : result[key + 'Label'].value
      }

      // Construct address as array
      let addressParts = [];
      if ('locationQid' in result && !(result.locationQid.value in SKIPPED_ADDRESS_LABELS)) {
        addressParts.push(result.locationLabel.value);
      }
      if ('streetAddress' in result) {
        addressParts.push(result.streetAddress.value);
      }
      let islandAdminTypeQid;
      if ('islandLabel' in result) islandAdminTypeQid = result.islandAdminTypeQid.value;
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
      if (result.countryQid.value !== PH_QID) {
        addressParts.push(result.countryLabel.value);
      }

      let record = Records[result.markerQid.value];
      record.location.address = addressParts.join(', ');

      if ('locationImage' in result) {
        record.location.imageFilename = extractImageFilename(result.locationImage);
      }

      if ('directions' in result) {
        record.vicinity.description = result.directions.value;
      }
    },
  );
}


// Queries WDQS and sets the non-lazy "inscription" Records field.
function populateInscriptionData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_3,
    function(result) {
      let record = Records[result.markerQid.value];
      if ('inscription' in result) {
        record.inscription[result.inscription['xml:lang']] = formatInscription(result.inscription.value);
      }
      else if ('inscriptionNoValue' in result) {
        record.inscription = null;
      }
    },
  );
}


// Queries WDQS and sets the "date" Records field.
function populateDateData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_4,
    function(result) {
      let record = Records[result.markerQid.value];
      let date = parseDate(result, 'date');
      if ('targetLangQid' in result) {
        if (!record.date) record.date = {};
        record.date[getLangCode(result.targetLangQid.value)] = date;
      }
      else {
        record.date = date;
      }
    },
  );
}


// Queries WDQS and sets the "imageFilename" and "vicinity.imageFilename"
// Records fields.
function populatePhotoData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_5,
    function(result) {
      let record = Records[result.markerQid.value];
      if ('image' in result) {
        let filename = extractImageFilename(result.image);
        if ('targetLangQid' in result) {
          if (!record.imageFilename) record.imageFilename = {};
          record.imageFilename[getLangCode(result.targetLangQid.value)] = filename;
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
      }
    },
  );
}


// Queries WDQS and sets the "commemorates" Records field.
function populateCommemoratesData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_6,
    function(result) {
      let record = Records[result.markerQid.value];
      if (!record.commemorates) record.commemorates = {};
      record.commemorates[result.commemoratesQid.value] = {
        title  : result.commemoratesLabel.value,
        wp_url : ('commemoratesArticle' in result) ? result.commemoratesArticle.value : null,
      };
    },
  );
}


// Populates the map with map markers and the index list with items and sets the
// "indexTitle" (for titled markers), "alphaSortKey", "mapMarker", "popup", and
// "indexLi" Records field. This also enables the sorting function and does the
// initial sort. This should be called as soon as the bootstrap data
// (coordinates and titles) have been loaded.
function populateMapAndIndex() {

  // Populate map and index
  let listIndex = document.getElementById('index-list');
  let mapMarkers = [];
  Object.entries(Records).forEach(entry => {

    let qid = entry[0], record = entry[1];

    // Generate map marker popup HTML, index title, and alpha sort key
    let popupHtml  = record.indexTitle;  // For untitled historical markers
    let indexTitle = record.indexTitle;  // For untitled historical markers
    if (record.title && Object.keys(record.title).length > 0) {
      let title = getTranslation(record.title);
      popupHtml = title.main;
      indexTitle = title.main;
      if (title.sub) {
        popupHtml += `<div class="subtitle">${title.sub}</div>`;
        indexTitle += (title.sub.substr(0, 1) === '(' ? ' ' : ': ') + title.sub;
      }
      indexTitle = indexTitle.replace(/<br\s*\/?>/g, ' ');
      record.indexTitle = indexTitle;
    }
    record.alphaSortKey =
      indexTitle.replace(/^[^A-Za-z0-9]/, '').replace(/^(?:The |Ang )/, '');

    // Generate map marker with popup
    let mapMarker = L.marker(
      [record.lat, record.lon],
      { icon: L.ExtraMarkers.icon({ icon: '', markerColor : 'cyan' }) },
    );
    record.mapMarker = mapMarker;
    mapMarker.bindPopup(popupHtml, { closeButton: false });
    let popup = record.mapMarker.getPopup();
    popup._qid = qid;
    record.popup = popup;
    mapMarkers.push(mapMarker);

    // Generate index list item
    let li = document.createElement('li');
    li.innerHTML = `<a href="#${qid}">${indexTitle}</a>`;
    record.indexLi = li;
    listIndex.appendChild(li);
  });
  Cluster.addLayers(mapMarkers);

  // Enable the index sort button and add click event handler,
  // and perform the initial sort
  let elem = document.getElementById('sort');
  elem.disabled = false;
  elem.addEventListener('click', switchSortMode);
  CurrentSortModeIdx = SORT_MODES.length - 1;
  switchSortMode();
  processHashChange();
}


// Performs final data post-processing:
// - Nullifies the "vicinity" Records field if it is completely empty
// - Populates the "languages" Records field and nullifies language-specific
//   values for the "inscription", "title", "date", and "imageFilename" Records
//   fields if there remain empty
function doFinalPostProcessing() {
  Object.values(Records).forEach(record => {

    // Indicate missing vicinity data
    if (!record.vicinity.imageFilename && !record.vicinity.description) record.vicinity = null;

    // Generate the list of codes of the languages of the historical marker
    // and indicate missing language values
    ORDERED_LANGUAGES.forEach(langCode => {
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
}


// Generates the details content of a historical marker for the side panel.
function generateRecordDetails(qid) {

  let record = Records[qid];

  let langBarHtml = '';
  if (record.languages.length > 1) {
    langBarHtml =
      '<ol class="language-bar">' +
      record.languages.map((langCode, idx) =>
        `<li onclick="selectLanguage('${langCode}')"` +
        (idx === 0 ? ' class="selected"' : '') +
        ` data-lang-code="${langCode}">${LANGUAGES[langCode].name}</li>`
      ).join('') +
      '</ol>';
  }

  let titleHtml = '';
  if (record.title) {
    Object.entries(record.title).forEach(entry => {
      titleHtml += `<h1 class="l10n ${entry[0]}">`;
      let titleData = entry[1] || getTranslation(record.title);
      titleHtml += titleData.main;
      if (titleData.sub) titleHtml += ` <span class="subtitle">${titleData.sub}</span>`;
      titleHtml += '</h1>';
    });
  }
  else {
    titleHtml = '<h1 class="untitled">Untitled</h1>';
  }

  let markerFigureHtml = '';
  if (record.imageFilename && typeof record.imageFilename === 'object') {
    if (Array.isArray(record.imageFilename)) {
      record.imageFilename.forEach((filename, idx) => {
        markerFigureHtml += generateFigure(filename, ['marker', `list${idx}`]);
      });
    }
    else {
      record.languages.forEach(langCode => {
        markerFigureHtml += generateFigure(record.imageFilename[langCode], ['marker', 'l10n', langCode]);
      });
    }
  }
  else {
    markerFigureHtml = generateFigure(record.imageFilename, ['marker']);
  }

  let inscriptionHtml = '';
  let longInscriptionShouldBeChecked = false;
  if (record.inscription) {
    inscriptionHtml = '<div class="inscription main-text">';
    record.languages.forEach(langCode => {
      let inscription = record.inscription[langCode];
      if (inscription) {
        inscriptionHtml += `<div class="l10n ${langCode}">${inscription}</div>`;
      }
      else {
        inscriptionHtml += `<div class="l10n ${langCode} loading"><div class="loader"></div></div>`;
        longInscriptionShouldBeChecked = true;
      }
    });
    if (record.languages.length === 0) {
      inscriptionHtml += '<div class="loading"><div class="loader"></div></div>';
      longInscriptionShouldBeChecked = true;
    }
    inscriptionHtml += '</div>';
  }
  else {
    inscriptionHtml =
      '<div class="inscription main-text nodata">' +
        '<p>This historical marker has no inscription.</p>' +
      '</div>';
  }

  let unveiledHtml = '';
  if (record.date) {
    if (typeof record.date === 'object') {
      record.languages.forEach(langCode => {
        let date = record.date[langCode];
        if (date) {
          let dateTypeLabel = (date.length === 4 ? 'Year' : 'Date');
          unveiledHtml +=
            `<h2 class="l10n ${langCode}">${dateTypeLabel} unveiled</h2>` +
            `<p class="l10n ${langCode}">${date}</p>`;
        }
        else {
          unveiledHtml +=
            `<h2 class="l10n ${langCode}">Date unveiled</h2>` +
            `<p class="nodata l10n ${langCode}"">Unknown</p>`;
        }
      });
    }
    else {
      let dateTypeLabel = (record.date.length === 4 ? 'Year' : 'Date');
      unveiledHtml = `<h2>${dateTypeLabel} unveiled</h2><p>${record.date}</p>`;
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
    commemoratesIds.forEach(qid => {
      let commemoratesData = record.commemorates[qid];
      commemoratesHtml +=
        `<${tagName}>` +
          commemoratesData.title +
          `<a class="image" href="https://www.wikidata.org/wiki/${qid}" title="View in Wikidata">` +
            '<img class="icon" src="img/wikidata_logo.svg" alt="[view Wikidata item]" />' +
          '</a>';
      if (commemoratesData.wp_url) {
        commemoratesHtml +=
          `<a class="image" href="${commemoratesData.wp_url}" title="View in Wikipedia">` +
            '<img class="icon" src="img/wikipedia_logo.svg" alt="[view Wikipedia article]" />' +
          '</a>';
      }
      commemoratesHtml += `</${tagName}>`;
    });
    commemoratesHtml += commemoratesIds.length > 1 ? '</ul>' : '';
  }
  else {
    commemoratesHtml = '<p class="nodata">Unspecified</p>';
  }

  let locationFigureHtml = '';
  if (record.location.imageFilename) {
    locationFigureHtml = generateFigure(record.location.imageFilename, ['location']);
  }

  let addressHtml;
  if (record.location.address) {
    addressHtml = `<p class="address">${record.location.address}</p>`;
  }
  else {
    addressHtml = '<p class="nodata">Unspecified</p>';
  }

  let vicinityHtml = '';
  if (record.vicinity) {
    vicinityHtml = '<div class="vicinity">';
    if (record.vicinity.imageFilename) {
      vicinityHtml += generateFigure(record.vicinity.imageFilename, ['vicinity']);
    }
    if (record.vicinity.description) {
      vicinityHtml += `<p>${record.vicinity.description}</p>`;
    }
    vicinityHtml += '</div>'
  }

  let panelElem = document.createElement('div');
  if (record.languages.length > 1) panelElem.classList.add('l10n-top', record.languages[0]);
  panelElem.innerHTML =
    langBarHtml +
    `<a class="main-wikidata-link" href="https://www.wikidata.org/wiki/${qid}" title="View in Wikidata">` +
    '<img class="icon" src="img/wikidata_logo.svg" alt="[view Wikidata item]" /></a>' +
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
  record.panelElem = panelElem;

  // Historical marker has missing inscriptions: check the talk page
  if (longInscriptionShouldBeChecked) checkAndDisplayLongInscription(qid);
}


// Given a historical marker QID, checks if there are {{LongInscription}}
// templates in the Wikidata talk page. If there are, parses the templates,
// stores the inscriptions into the record, then inserts them into the details
// content.
function checkAndDisplayLongInscription(qid) {
  let record = Records[qid];
  loadJsonp(
    'https://www.wikidata.org/w/api.php',
    {
      action : 'query',
      format : 'json',
      prop   : 'revisions',
      rvprop : 'content',
      titles : `Talk:${qid}`,
    },
    function(data) {

      // Extract inscriptions and add them to the Records database
      let pageId = Object.keys(data.query.pages)[0];
      if (pageId !== '-1') {
        let talkContent = data.query.pages[pageId].revisions[0]['*'];
        let templateStrings = talkContent.match(/{{\s*LongInscription[^]+?}}/g);
        if (templateStrings) {
          templateStrings.forEach(string => {
            let langQid = string.match(/\|\s*langqid\s*=\s*(Q[0-9]+)/)[1];
            let inscription = string.match(/\|\s*inscription\s*=\s*([^]*?)(?:\||}})/)[1];
            for (let i = 0; i < ORDERED_LANGUAGES.length; i++) {
              let langCode = ORDERED_LANGUAGES[i];
              if (langQid !== LANGUAGES[langCode].qid) continue;
              record.inscription[langCode] = formatInscription(inscription);
              if (record.languages.length === 0) {
                record.languages.push(langCode);
                record.panelElem.querySelector('.inscription .loading').classList.add('l10n', langCode);
              }
              break;
            }
          });
        }
      }

      // Populate the details content with the inscription,
      // or indicate that there's none
      record.languages.forEach(langCode => {
        let inscriptionElem = record.panelElem.querySelector(`.inscription .l10n.${langCode}`);
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


// Toggles the sort mode and then sorts the index list.
function switchSortMode() {

  // Toggle sort mode
  CurrentSortModeIdx = (CurrentSortModeIdx + 1) % SORT_MODES.length;
  document.getElementById('sort').innerHTML =
    'Sort list ' + SORT_MODES[(CurrentSortModeIdx + 1) % SORT_MODES.length].label;
  let currentSortModeId = SORT_MODES[CurrentSortModeIdx].id;

  // Perform sort
  let list = document.getElementById('index-list');
  list.innerHTML = '';
  Object.values(Records).map(record => {
    return {
      key  : record[currentSortModeId + 'SortKey'],
      item : record.indexLi,
    };
  })
  .sort(
    currentSortModeId === 'alpha'
    ? ((a, b) => a.key > b.key ? 1 : -1)
    : ((a, b) => a.key - b.key)
  )
  .map(sortDatum => sortDatum.item)
  .forEach(li => { list.appendChild(li) });
}


// Activates the specified language in the current multilingual historical
// marker's details content.
function selectLanguage(langCode) {
  document.querySelector('#details .l10n-top').className = `l10n-top ${langCode}`;
  document.querySelectorAll('#details .language-bar li').forEach(elem => {
    if (elem.dataset.langCode === langCode) {
      elem.classList.add('selected');
    }
    else {
      elem.classList.remove('selected');
    }
  });
}


// Given a raw inscription text from Wikidata,
// returns it reformatted into paragraphs.
function formatInscription(text) {
  return '<p>' + text.replace(/\s*<br\s*\/?>\s*<br\s*\/?>\s*/gi, '</p><p>') + '</p>';
}


// Given a WDQS query result language Wikidata item data,
// returns the language code (undefined if not recognized).
function getLangCode(langCodeQid) {
  let langCode;
  Object.entries(LANGUAGES).forEach(entry => {
    if (entry[1].qid === langCodeQid) langCode = entry[0];
  });
  return langCode;
}


// Given a dictionary keyed by language code and an optional language code,
// returns the value for the code if it exists in the dictionary. Otherwise
// returns the first value that matches an ordered list of language codes.
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
class Record {
  constructor() {
    this.lat           = [];
    this.lon           = [];
    this.indexTitle    = undefined;
    this.title         = {};  // empty if not encoded yet; null if novalue
    this.inscription   = {};  // empty if not encoded yet; null if novalue
    this.imageFilename = undefined;
    this.date          = undefined;
    this.commemorates  = undefined;
    this.location      = { address:     '', imageFilename: '' };
    this.vicinity      = { description: '', imageFilename: '' };
    this.languages     = [];
    this.qidSortKey    = undefined;
    this.alphaSortKey  = undefined;
    this.indexLi       = undefined;
    this.mapMarker     = undefined;
    this.popup         = undefined;
    this.panelElem     = undefined;
  }
}
