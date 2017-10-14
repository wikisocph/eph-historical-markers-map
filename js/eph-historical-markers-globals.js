'use strict';

// Constants and fixed parameters
const BASE_TITLE = 'Historical Markers Map – Encyclopedia of Philippine Heritage';
const LANGUAGES = {
  'en': { name: 'English', qid: 'Q1860'  },
  'tl': { name: 'Tagalog', qid: 'Q34057' },
  'es': { name: 'Spanish', qid: 'Q1321'  },
  'de': { name: 'German' , qid: 'Q188'   },
  'fr': { name: 'French' , qid: 'Q150'   },
};
const ORDERED_LANGUAGES = ['en', 'tl', 'es', 'de', 'fr'];
const NL = '\n';
const SPARQL_QUERY =
'SELECT ?marker ?markerLabel ?coord ?title ?subtitle ?titleNoValue ?image' + NL +
'       ?date ?datePrecision ?inscription ?inscriptionNoValue' + NL +
'       ?country ?countryLabel ?locationLabel ?locationImage ?streetAddress' + NL +
'       ?admin0Label ?admin0Type ?admin1Label ?admin1Type' + NL +
'       ?admin2Label ?admin2Type ?admin3Label ?admin3Type' + NL +
'       ?vicinityImage ?vicinityDescription' + NL +
'       ?commemorates ?commemoratesLabel ?commemoratesArticle WHERE {' + NL +
'  ?marker wdt:P31 wd:Q21562164 ;' + NL +
'          wdt:P625 ?coord .' + NL +
'  OPTIONAL {' + NL +
'    ?marker p:P1476 ?titleStatement .' + NL +
'    OPTIONAL {' + NL +
'      ?titleStatement ps:P1476 ?title .' + NL +
'      OPTIONAL { ?titleStatement pq:P1680 ?subtitle }' + NL +
'    }' + NL +
'    OPTIONAL {' + NL +
'      ?titleStatement a ?titleNoValue .' + NL +
'      FILTER (?titleNoValue = wdno:P1476)' + NL +
'    }' + NL +
'  }' + NL +
'  OPTIONAL {' + NL +
'    ?marker p:P18 ?imageStatement .' + NL +
'    OPTIONAL {' + NL +
'      ?imageStatement ps:P18 ?image .' + NL +
'      FILTER NOT EXISTS { ?imageStatement pq:P3831 wd:Q16968816 }' + NL +
'    }' + NL +
'    OPTIONAL {' + NL +
'      ?imageStatement ps:P18 ?vicinityImage .' + NL +
'      OPTIONAL { ?imageStatement pq:P2096 ?vicinityDescription }' + NL +
'      FILTER EXISTS { ?imageStatement pq:P3831 wd:Q16968816 }' + NL +
'    }' + NL +
'  }' + NL +
'  OPTIONAL {' + NL +
'    ?marker p:P571 ?dateStatement .' + NL +
'    ?dateStatement psv:P571 ?dateValue .' + NL +
'    ?dateValue wikibase:timeValue ?date .' + NL +
'    ?dateValue wikibase:timePrecision ?datePrecision .' + NL +
'  }' + NL +
'  OPTIONAL { ?marker wdt:P1684 ?inscription }' + NL +
'  OPTIONAL {' + NL +
'    ?marker p:P1684 ?inscriptionStatement .' + NL +
'    ?inscriptionStatement a ?inscriptionNoValue .' + NL +
'    FILTER (?inscriptionNoValue = wdno:P1684)' + NL +
'  }' + NL +
'  OPTIONAL { ?marker wdt:P17 ?country }' + NL +
'  OPTIONAL {' + NL +
'    ?marker wdt:P276 ?location .' + NL +
'    OPTIONAL { ?location wdt:P18 ?locationImage }' + NL +
'  }' + NL +
'  OPTIONAL { ?marker wdt:P969 ?streetAddress }' + NL +
'  OPTIONAL {' + NL +
'    ?marker wdt:P131 ?admin0 .' + NL +
'    OPTIONAL {' + NL +
'      ?admin0 wdt:P31 ?admin0Type .' + NL +
'      FILTER (' + NL +
'        ?admin0Type = wd:Q6256   ||' + NL +
'        ?admin0Type = wd:Q24698  ||' + NL +
'        ?admin0Type = wd:Q24746  ||' + NL +
'        ?admin0Type = wd:Q104157 ||' + NL +
'        ?admin0Type = wd:Q29946056' + NL +
'      )' + NL +
'    }' + NL +
'    OPTIONAL {' + NL +
'      ?admin0 wdt:P131 ?admin1 .' + NL +
'      OPTIONAL {' + NL +
'        ?admin1 wdt:P31 ?admin1Type .' + NL +
'        FILTER (' + NL +
'          ?admin1Type = wd:Q6256   ||' + NL +
'          ?admin1Type = wd:Q24698  ||' + NL +
'          ?admin1Type = wd:Q24746  ||' + NL +
'          ?admin1Type = wd:Q104157 ||' + NL +
'          ?admin1Type = wd:Q29946056' + NL +
'        )' + NL +
'      }' + NL +
'      OPTIONAL {' + NL +
'        ?admin1 wdt:P131 ?admin2 .' + NL +
'        OPTIONAL {' + NL +
'          ?admin2 wdt:P31 ?admin2Type .' + NL +
'          FILTER (' + NL +
'            ?admin2Type = wd:Q6256   ||' + NL +
'            ?admin2Type = wd:Q24698  ||' + NL +
'            ?admin2Type = wd:Q24746  ||' + NL +
'            ?admin2Type = wd:Q104157 ||' + NL +
'            ?admin2Type = wd:Q29946056' + NL +
'          )' + NL +
'        }' + NL +
'        OPTIONAL {' + NL +
'          ?admin2 wdt:P131 ?admin3 .' + NL +
'          OPTIONAL {' + NL +
'            ?admin3 wdt:P31 ?admin3Type .' + NL +
'            FILTER (' + NL +
'              ?admin3Type = wd:Q6256   ||' + NL +
'              ?admin3Type = wd:Q24698  ||' + NL +
'              ?admin3Type = wd:Q24746  ||' + NL +
'              ?admin3Type = wd:Q104157 ||' + NL +
'              ?admin3Type = wd:Q29946056' + NL +
'            )' + NL +
'          }' + NL +
'        }' + NL +
'      }' + NL +
'    }' + NL +
'  }' + NL +
'  OPTIONAL {' + NL +
'    ?marker wdt:P547 ?commemorates .' + NL +
'    OPTIONAL {' + NL +
'      ?commemoratesArticle schema:about ?commemorates ;' + NL +
'               schema:isPartOf <https://en.wikipedia.org/> .' + NL +
'    }' + NL +
'  }' + NL +
'  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }' + NL +
'}';
const SORT_MODES              = [
  { id: 'alpha', label: 'alphabetically'  },
  { id: 'qid',   label: 'by Wikidata QID' },
];

// Globals
var Markers = {};  // Hash to contain data about the historical markers
var CurrentSortModeIdx;
