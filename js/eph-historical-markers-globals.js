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
const SPARQL_QUERY_0 =
`SELECT ?marker ?coord WHERE {
  ?marker wdt:P31 wd:Q21562164 ;
          p:P625 ?coordStatement .
  ?coordStatement ps:P625 ?coord .
  FILTER NOT EXISTS { ?coordStatement pq:P582 ?endTime }
  FILTER (!ISBLANK(?coord)) .
}`;
const SPARQL_QUERY_1 =
`SELECT ?marker ?location ?locationLabel ?locationImage ?streetAddress
       ?islandLabel ?islandAdminType ?country ?countryLabel ?directions
       ?admin0 ?admin0Label ?admin0Type ?admin1 ?admin1Label ?admin1Type
       ?admin2 ?admin2Label ?admin2Type ?admin3 ?admin3Label ?admin3Type
WHERE {
  <SPARQLVALUESCLAUSE>
  ?marker wdt:P17 ?country
  OPTIONAL {
    ?marker wdt:P276 ?location .
    OPTIONAL { ?location wdt:P18 ?locationImage }
  }
  OPTIONAL { ?marker wdt:P6375 ?streetAddress }
  OPTIONAL { ?marker wdt:P2795 ?directions }
  OPTIONAL {
    ?marker wdt:P131 ?admin0 .
    OPTIONAL {
      ?admin0 wdt:P31 ?admin0Type .
      FILTER (
        ?admin0Type = wd:Q24698    ||
        ?admin0Type = wd:Q24746    ||
        ?admin0Type = wd:Q104157   ||
        ?admin0Type = wd:Q29946056 ||
        ?admin0Type = wd:Q24764    ||
        ?admin0Type = wd:Q15634883 ||
        ?admin0Type = wd:Q61878
      )
    }
    OPTIONAL {
      ?admin0 wdt:P131 ?admin1 .
      OPTIONAL {
        ?admin1 wdt:P31 ?admin1Type .
        FILTER (
          ?admin1Type = wd:Q24698    ||
          ?admin1Type = wd:Q24746    ||
          ?admin1Type = wd:Q104157   ||
          ?admin1Type = wd:Q29946056 ||
          ?admin1Type = wd:Q24764    ||
          ?admin1Type = wd:Q15634883 ||
          ?admin1Type = wd:Q61878
        )
      }
      OPTIONAL {
        ?admin1 wdt:P131 ?admin2 .
        OPTIONAL {
          ?admin2 wdt:P31 ?admin2Type .
          FILTER (
            ?admin2Type = wd:Q24698    ||
            ?admin2Type = wd:Q24746    ||
            ?admin2Type = wd:Q104157   ||
            ?admin2Type = wd:Q29946056 ||
            ?admin2Type = wd:Q24764
          )
        }
        OPTIONAL {
          ?admin2 wdt:P131 ?admin3 .
          OPTIONAL {
            ?admin3 wdt:P31 ?admin3Type .
            FILTER (
              ?admin3Type = wd:Q24698    ||
              ?admin3Type = wd:Q24746
            )
          }
        }
      }
    }
  }
  OPTIONAL {
    ?marker wdt:P706 ?island .
    FILTER EXISTS { ?island wdt:P31/wdt:P279* wd:Q23442 }
    ?island wdt:P131 ?islandAdmin .
    ?islandAdmin wdt:P31 ?islandAdminType .
    FILTER (
      ?islandAdminType = wd:Q104157   ||
      ?islandAdminType = wd:Q29946056 ||
      ?islandAdminType = wd:Q24764    ||
      ?islandAdminType = wd:Q15634883 ||
      ?islandAdminType = wd:Q61878
    )
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}`;
const SPARQL_QUERY_2 =
`SELECT ?marker ?markerLabel ?title ?targetLang ?subtitle ?titleNoValue
WHERE {
  <SPARQLVALUESCLAUSE>
  ?marker p:P1476 ?titleStatement .
  OPTIONAL {
    ?titleStatement ps:P1476 ?title .
    OPTIONAL { ?titleStatement pq:P518 ?targetLang }
    OPTIONAL { ?titleStatement pq:P1680 ?subtitle }
  }
  OPTIONAL {
    ?titleStatement a ?titleNoValue .
    FILTER (?titleNoValue = wdno:P1476)
    OPTIONAL { ?titleStatement pq:P518 ?targetLang }
    ?marker rdfs:label ?markerLabel .
    FILTER (LANG(?markerLabel) = "en")
  }
}`;
const SPARQL_QUERY_3 =
`SELECT ?marker ?inscription ?inscriptionNoValue
WHERE {
  <SPARQLVALUESCLAUSE>
  ?marker p:P1684 ?inscriptionStatement .
  OPTIONAL { ?inscriptionStatement ps:P1684 ?inscription }
  OPTIONAL {
    ?inscriptionStatement a ?inscriptionNoValue .
    FILTER (?inscriptionNoValue = wdno:P1684)
  }
}`;
const SPARQL_QUERY_4 =
`SELECT ?marker ?date ?datePrecision ?targetLang
WHERE {
  <SPARQLVALUESCLAUSE>
  ?marker p:P571 ?dateStatement .
  OPTIONAL { ?dateStatement pq:P518 ?targetLang }
  ?dateStatement psv:P571 ?dateValue .
  ?dateValue wikibase:timeValue ?date .
  ?dateValue wikibase:timePrecision ?datePrecision .
}`;
const SPARQL_QUERY_5 =
`SELECT ?marker ?image ?targetLang ?ordinal ?vicinityImage
WHERE {
  <SPARQLVALUESCLAUSE>
  ?marker p:P18 ?imageStatement .
  OPTIONAL {
    ?imageStatement ps:P18 ?image .
    OPTIONAL { ?imageStatement pq:P518 ?targetLang }
    OPTIONAL { ?imageStatement pq:P1545 ?ordinal }
    FILTER NOT EXISTS { ?imageStatement pq:P3831 wd:Q16968816 }
  }
  OPTIONAL {
    ?imageStatement ps:P18 ?vicinityImage .
    FILTER EXISTS { ?imageStatement pq:P3831 wd:Q16968816 }
  }
}`;
const SPARQL_QUERY_6 =
`SELECT ?marker ?commemorates ?commemoratesLabel ?commemoratesArticle
WHERE {
  <SPARQLVALUESCLAUSE>
  ?marker wdt:P547 ?commemorates .
  ?commemorates rdfs:label ?commemoratesLabel
  FILTER (LANG(?commemoratesLabel) = "en")
  OPTIONAL {
    ?commemoratesArticle schema:about ?commemorates ;
                         schema:isPartOf <https://en.wikipedia.org/> .
  }
}`;
const ABOUT_SPARQL_QUERY =
`SELECT ?marker ?markerLabel ?coord ?title ?subtitle ?date ?image WHERE {
  ?marker wdt:P31 wd:Q21562164 ;
          p:P625 ?coordStatement .
  ?coordStatement ps:P625 ?coord .
  FILTER NOT EXISTS { ?coordStatement pq:P582 ?endTime }
  FILTER (!ISBLANK(?coord)) .
  OPTIONAL {
    ?marker p:P1476 ?titleStatement .
    ?titleStatement ps:P1476 ?title .
    OPTIONAL { ?titleStatement pq:P1680 ?subtitle }
  }
  OPTIONAL {
    ?marker p:P571 ?dateStatement .
    ?dateStatement psv:P571 ?dateValue .
    ?dateValue wikibase:timeValue ?date .
  }
  OPTIONAL {
    ?marker p:P18 ?imageStatement .
    ?imageStatement ps:P18 ?image .
    FILTER NOT EXISTS { ?imageStatement pq:P3831 wd:Q16968816 }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}`;
const ADDRESS_LABEL_REPLACEMENT = {
  Q245546 : '6th arrondissement',
};
const SKIPPED_ADDRESS_LABELS = {
  Q2863958  : true,  // arrondissement of Paris
  Q16665915 : true,  // Metropolis of Greater Paris
  Q90870    : true,  // Arrondissement of Brussels-Capital
  Q240      : true,  // Brussels-Capital Region
  Q8165     : true,  // Karlsruhe Government Region
  Q2013767  : true,  // Mitte (locality in Mitte)
};
const METRO_MANILA_QID = 'Q13580';
const SORT_MODES              = [
  { id: 'alpha', label: 'alphabetically'  },
  { id: 'qid'  , label: 'by Wikidata QID' },
];

// Globals
var Markers = {};  // Hash to contain data about the historical markers
var SparqlValuesClause;  // SPARQL "VALUES" clause containing the QIDs of all relevant historical marker Wikidata items
var CurrentSortModeIdx;
