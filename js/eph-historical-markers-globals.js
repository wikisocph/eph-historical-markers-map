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
`SELECT ?markerQid ?coord WHERE {
  ?marker wdt:P31 wd:Q21562164 ;
          p:P625 ?coordStatement .
  ?coordStatement ps:P625 ?coord .
  FILTER NOT EXISTS { ?coordStatement pq:P582 ?endTime }
  FILTER (!wikibase:isSomeValue(?coord)) .
  BIND (SUBSTR(STR(?marker), 32) AS ?markerQid)
}`;
const SPARQL_QUERY_1 =
`SELECT ?markerQid ?markerLabel ?title ?targetLangQid ?subtitle ?titleNoValue
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
  BIND (SUBSTR(STR(?marker    ), 32) AS ?markerQid    ) .
  BIND (SUBSTR(STR(?targetLang), 32) AS ?targetLangQid) .
}`;
const SPARQL_QUERY_2 =
`SELECT ?markerQid ?locationQid ?locationLabel ?locationImage ?streetAddress
       ?islandLabel ?islandAdminTypeQid ?countryQid ?countryLabel ?directions
       ?admin0Qid ?admin0Label ?admin0TypeQid ?admin1Qid ?admin1Label ?admin1TypeQid
       ?admin2Qid ?admin2Label ?admin2TypeQid ?admin3Qid ?admin3Label ?admin3TypeQid
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
      FILTER (?admin0Type IN (
        wd:Q24698, wd:Q24746, wd:Q29946056, wd:Q106079704, wd:Q106078286, wd:Q24764,
        wd:Q15634883, wd:Q61878
      ))
    }
    OPTIONAL {
      ?admin0 wdt:P131 ?admin1 .
      OPTIONAL {
        ?admin1 wdt:P31 ?admin1Type .
        FILTER (?admin1Type IN (
          wd:Q24698, wd:Q24746, wd:Q29946056, wd:Q106079704, wd:Q106078286, wd:Q24764,
          wd:Q15634883, wd:Q61878
        ))
      }
      OPTIONAL {
        ?admin1 wdt:P131 ?admin2 .
        OPTIONAL {
          ?admin2 wdt:P31 ?admin2Type .
          FILTER (?admin2Type IN (
            wd:Q24698, wd:Q24746, wd:Q29946056, wd:Q106079704, wd:Q106078286, wd:Q24764
          ))
        }
        OPTIONAL {
          ?admin2 wdt:P131 ?admin3 .
          OPTIONAL {
            ?admin3 wdt:P31 ?admin3Type .
            FILTER (?admin3Type IN (wd:Q24698, wd:Q24746))
          }
        }
      }
    }
  }
  OPTIONAL {
    ?marker wdt:P706 ?island .
    FILTER EXISTS { ?island wdt:P31/wdt:P279* wd:Q23442 }
    ?island wdt:P131/wdt:P31 ?islandAdminType .
    FILTER (?islandAdminType IN (
      wd:Q29946056, wd:Q106079704, wd:Q106078286, wd:Q29946056, wd:Q24764, wd:Q15634883, wd:Q61878
    ))
  }
  BIND (SUBSTR(STR(?marker         ), 32) AS ?markerQid         ) .
  BIND (SUBSTR(STR(?location       ), 32) AS ?locationQid       ) .
  BIND (SUBSTR(STR(?islandAdminType), 32) AS ?islandAdminTypeQid) .
  BIND (SUBSTR(STR(?country        ), 32) AS ?countryQid        ) .
  BIND (SUBSTR(STR(?admin0         ), 32) AS ?admin0Qid         ) .
  BIND (SUBSTR(STR(?admin1         ), 32) AS ?admin1Qid         ) .
  BIND (SUBSTR(STR(?admin2         ), 32) AS ?admin2Qid         ) .
  BIND (SUBSTR(STR(?admin3         ), 32) AS ?admin3Qid         ) .
  BIND (SUBSTR(STR(?admin0Type     ), 32) AS ?admin0TypeQid     ) .
  BIND (SUBSTR(STR(?admin1Type     ), 32) AS ?admin1TypeQid     ) .
  BIND (SUBSTR(STR(?admin2Type     ), 32) AS ?admin2TypeQid     ) .
  BIND (SUBSTR(STR(?admin3Type     ), 32) AS ?admin3TypeQid     ) .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}`;
const SPARQL_QUERY_3 =
`SELECT ?markerQid ?inscription ?inscriptionNoValue
WHERE {
  <SPARQLVALUESCLAUSE>
  ?marker p:P1684 ?inscriptionStatement .
  OPTIONAL { ?inscriptionStatement ps:P1684 ?inscription }
  OPTIONAL {
    ?inscriptionStatement a ?inscriptionNoValue .
    FILTER (?inscriptionNoValue = wdno:P1684)
  }
  BIND (SUBSTR(STR(?marker), 32) AS ?markerQid)
}`;
const SPARQL_QUERY_4 =
`SELECT ?markerQid ?date ?datePrecision ?targetLangQid
WHERE {
  <SPARQLVALUESCLAUSE>
  ?marker p:P571 ?dateStatement .
  OPTIONAL { ?dateStatement pq:P518 ?targetLang }
  ?dateStatement psv:P571 ?dateValue .
  ?dateValue wikibase:timeValue ?date .
  ?dateValue wikibase:timePrecision ?datePrecision .
  BIND (SUBSTR(STR(?marker    ), 32) AS ?markerQid    ) .
  BIND (SUBSTR(STR(?targetLang), 32) AS ?targetLangQid) .
}`;
const SPARQL_QUERY_5 =
`SELECT ?markerQid ?image ?targetLangQid ?ordinal ?vicinityImage
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
  BIND (SUBSTR(STR(?marker    ), 32) AS ?markerQid    ) .
  BIND (SUBSTR(STR(?targetLang), 32) AS ?targetLangQid) .
}`;
const SPARQL_QUERY_6 =
`SELECT ?markerQid ?commemoratesQid ?commemoratesLabel ?commemoratesArticle
WHERE {
  <SPARQLVALUESCLAUSE>
  ?marker wdt:P547 ?commemorates .
  ?commemorates rdfs:label ?commemoratesLabel
  FILTER (LANG(?commemoratesLabel) = "en")
  OPTIONAL {
    ?commemoratesArticle schema:about ?commemorates ;
                         schema:isPartOf <https://en.wikipedia.org/> .
  }
  BIND (SUBSTR(STR(?marker      ), 32) AS ?markerQid      ) .
  BIND (SUBSTR(STR(?commemorates), 32) AS ?commemoratesQid) .
}`;
const ABOUT_SPARQL_QUERY =
`SELECT ?marker ?markerLabel ?coord ?title ?subtitle ?date ?image WHERE {
  ?marker wdt:P31 wd:Q21562164 ;
          p:P625 ?coordStatement .
  ?coordStatement ps:P625 ?coord .
  FILTER NOT EXISTS { ?coordStatement pq:P582 ?endTime }
  FILTER (!wikibase:isSomeValue(?coord)) .
  OPTIONAL {
    ?marker p:P1476 ?titleStatement .
    ?titleStatement ps:P1476 ?title .
    OPTIONAL { ?titleStatement pq:P1680 ?subtitle }
  }
  OPTIONAL { ?marker wdt:P571 ?date }
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
var CurrentSortModeIdx;
