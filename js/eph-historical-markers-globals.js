'use strict';

// Constants and fixed parameters
const BASE_TITLE = 'Historical Markers Map – Encyclopedia of Philippine Heritage';
const LANGUAGES = {
  'en'  : { name: 'English'    , qid: 'Q1860'  },
  'tl'  : { name: 'Tagalog'    , qid: 'Q34057' },
  'ceb' : { name: 'Cebuano'    , qid: 'Q33239' },
  'ilo' : { name: 'Ilocano'    , qid: 'Q35936' },
  'pam' : { name: 'Kapampangan', qid: 'Q36121' },
  'es'  : { name: 'Spanish'    , qid: 'Q1321'  },
  'de'  : { name: 'German'     , qid: 'Q188'   },
  'fr'  : { name: 'French'     , qid: 'Q150'   },
};
const ORDERED_LANGUAGES = ['en', 'tl', 'ceb', 'ilo', 'pam', 'es', 'de', 'fr'];
const NL = '\n';
const SPARQL_QUERY =
'SELECT ?marker ?markerLabel ?coord ?title ?subtitle ?titleNoValue ?image' + NL +
'       ?date ?datePrecision ?inscription ?inscriptionNoValue' + NL +
'       ?country ?countryLabel ?locationLabel ?locationImage ?streetAddress' + NL +
'       ?admin0 ?admin0Label ?admin0Type ?admin1 ?admin1Label ?admin1Type' + NL +
'       ?admin2 ?admin2Label ?admin2Type ?admin3 ?admin3Label ?admin3Type' + NL +
'       ?islandLabel ?islandAdminType' + NL +
'       ?vicinityImage ?vicinityDescription' + NL +
'       ?commemorates ?commemoratesLabel ?commemoratesArticle WHERE {' + NL +
'  ?marker wdt:P31 wd:Q21562164 ;' + NL +
'          wdt:P625 ?coord .' + NL +
'  FILTER (!isBLANK(?coord)) .' + NL +
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
'        ?admin0Type = wd:Q6256     ||' + NL +
'        ?admin0Type = wd:Q24698    ||' + NL +
'        ?admin0Type = wd:Q24746    ||' + NL +
'        ?admin0Type = wd:Q104157   ||' + NL +
'        ?admin0Type = wd:Q29946056 ||' + NL +
'        ?admin0Type = wd:Q24764    ||' + NL +
'        ?admin0Type = wd:Q61878' + NL +
'      )' + NL +
'    }' + NL +
'    OPTIONAL {' + NL +
'      ?admin0 wdt:P131 ?admin1 .' + NL +
'      OPTIONAL {' + NL +
'        ?admin1 wdt:P31 ?admin1Type .' + NL +
'        FILTER (' + NL +
'          ?admin1Type = wd:Q6256     ||' + NL +
'          ?admin1Type = wd:Q24698    ||' + NL +
'          ?admin1Type = wd:Q24746    ||' + NL +
'          ?admin1Type = wd:Q104157   ||' + NL +
'          ?admin1Type = wd:Q29946056 ||' + NL +
'          ?admin1Type = wd:Q24764    ||' + NL +
'          ?admin1Type = wd:Q61878' + NL +
'        )' + NL +
'      }' + NL +
'      OPTIONAL {' + NL +
'        ?admin1 wdt:P131 ?admin2 .' + NL +
'        OPTIONAL {' + NL +
'          ?admin2 wdt:P31 ?admin2Type .' + NL +
'          FILTER (' + NL +
'            ?admin2Type = wd:Q6256     ||' + NL +
'            ?admin2Type = wd:Q24698    ||' + NL +
'            ?admin2Type = wd:Q24746    ||' + NL +
'            ?admin2Type = wd:Q104157   ||' + NL +
'            ?admin2Type = wd:Q29946056 ||' + NL +
'            ?admin2Type = wd:Q24764    ||' + NL +
'            ?admin2Type = wd:Q61878' + NL +
'          )' + NL +
'        }' + NL +
'        OPTIONAL {' + NL +
'          ?admin2 wdt:P131 ?admin3 .' + NL +
'          OPTIONAL {' + NL +
'            ?admin3 wdt:P31 ?admin3Type .' + NL +
'            FILTER (' + NL +
'              ?admin3Type = wd:Q6256     ||' + NL +
'              ?admin3Type = wd:Q24698    ||' + NL +
'              ?admin3Type = wd:Q24746    ||' + NL +
'              ?admin3Type = wd:Q104157   ||' + NL +
'              ?admin3Type = wd:Q29946056 ||' + NL +
'              ?admin3Type = wd:Q24764    ||' + NL +
'              ?admin3Type = wd:Q61878' + NL +
'            )' + NL +
'          }' + NL +
'        }' + NL +
'      }' + NL +
'    }' + NL +
'  }' + NL +
'  OPTIONAL {' + NL +
'    ?marker wdt:P5130 ?island .' + NL +
'    ?island wdt:P131 ?islandAdmin .' + NL +
'    ?islandAdmin wdt:P31 ?islandAdminType .' + NL +
'    FILTER (' + NL +
'      ?islandAdminType = wd:Q104157   ||' + NL +
'      ?islandAdminType = wd:Q29946056 ||' + NL +
'      ?islandAdminType = wd:Q24764    ||' + NL +
'      ?islandAdminType = wd:Q61878' + NL +
'    )' + NL +
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
const SKIPPED_ADMIN_LABELS = {
  Q2863958 : true,  // arrondissement of Paris
  Q90870   : true,  // Arrondissement of Brussels-Capital
  Q240     : true,  // Brussels-Capital Region
  Q8165    : true,  // Karlsruhe Government Region
  Q2013767 : true,  // Mitte (locality in Mitte)
};
const ADMIN_LABEL_REPLACEMENT = {
  Q245546 : '6th arrondissement',
};

// Globals
var Markers = {};  // Hash to contain data about the historical markers
var CurrentSortModeIdx;
