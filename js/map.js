(function (g) {
  "use strict";

  // Theatre names. Coastlines live in js/geography.js (Natural Earth, public domain).
  // These ids are the rules graph. They do not change when the drawing does.
  const NAMES = {
    "north-america": "North America",
    "latin-america": "Latin America",
    "british-isles": "British Isles",
    "scandinavia": "Scandinavia",
    "france": "Western Europe",
    "germany": "Central Europe",
    "italy": "Italy",
    "balkans": "Balkans",
    "russia": "Northern Eurasia",
    "north-africa": "North Africa",
    "subsahara": "Sub-Saharan Africa",
    "middle-east": "Middle East",
    "india": "Indian Subcontinent",
    "china": "East Asia",
    "japan": "Japan",
    "oceania": "Oceania and Southeast Asia"
  };

  // Undirected links. The third flag marks a sea lane: it connects supply
  // and movement, and it is drawn as a lane rather than a shared border.
  const LINKS = [
    ["north-america", "latin-america", false],
    ["north-america", "british-isles", true],
    ["north-america", "japan", true],
    ["north-america", "oceania", true],
    ["latin-america", "oceania", true],
    ["latin-america", "subsahara", true],
    ["british-isles", "scandinavia", true],
    ["british-isles", "france", false],
    ["british-isles", "north-africa", true],
    ["british-isles", "oceania", true],
    ["scandinavia", "germany", false],
    ["scandinavia", "russia", false],
    ["france", "germany", false],
    ["france", "italy", false],
    ["france", "north-africa", false],
    ["france", "subsahara", true],
    ["germany", "italy", false],
    ["germany", "balkans", false],
    ["germany", "russia", false],
    ["italy", "balkans", false],
    ["italy", "north-africa", true],
    ["balkans", "russia", false],
    ["balkans", "middle-east", false],
    ["russia", "middle-east", false],
    ["russia", "india", false],
    ["russia", "china", false],
    ["north-africa", "middle-east", false],
    ["north-africa", "subsahara", false],
    ["subsahara", "middle-east", false],
    ["subsahara", "oceania", true],
    ["middle-east", "india", false],
    ["india", "china", false],
    ["india", "oceania", true],
    ["china", "japan", true],
    ["china", "oceania", true],
    ["japan", "oceania", true]
  ];

  const ids = Object.keys(NAMES);
  const neighbours = {};
  const seaNeighbours = {};
  ids.forEach(function (id) {
    neighbours[id] = [];
    seaNeighbours[id] = [];
  });
  LINKS.forEach(function (link) {
    const a = link[0];
    const b = link[1];
    neighbours[a].push(b);
    neighbours[b].push(a);
    if (link[2]) {
      seaNeighbours[a].push(b);
      seaNeighbours[b].push(a);
    }
  });

  function isSea(a, b) {
    return seaNeighbours[a] && seaNeighbours[a].indexOf(b) !== -1;
  }

  // Land, sea, air, port, and label anchors in map coordinates. Sea and port
  // points sit in the water off that theatre. Air sits clear of the name and
  // the ground stack. Inland theatres have no sea or port point.
  const STATIONS = {
    "north-america": { land: [780, 1340], sea: [1140, 1310], air: [860, 1255], port: [1065, 1360], label: [780, 1275] },
    "latin-america": { land: [1220, 1885], sea: [1490, 1905], air: [1160, 1805], port: [1425, 1915], label: [1220, 1810] },
    "british-isles": { land: [1780, 1152], sea: [1684, 1136], air: [1842, 1092], port: [1782, 1212], label: [1780, 1090] },
    scandinavia: { land: [1968, 1008], sea: [1842, 968], air: [2048, 930], port: [1902, 1042], label: [1988, 920] },
    france: { land: [1838, 1268], sea: [1706, 1350], air: [1896, 1204], port: [1748, 1324], label: [1838, 1196] },
    germany: { land: [1930, 1208], air: [1992, 1162], label: [1930, 1148] },
    italy: { land: [1928, 1326], sea: [1968, 1392], air: [1872, 1288], port: [1954, 1370], label: [1928, 1264] },
    balkans: { land: [2062, 1312], air: [2110, 1264], label: [2062, 1248] },
    russia: { land: [2460, 1088], sea: [3130, 1348], air: [2620, 980], port: [3100, 1326], label: [2460, 1000] },
    "north-africa": { land: [1880, 1530], sea: [1760, 1570], air: [2040, 1475], port: [1978, 1474], label: [1880, 1452] },
    subsahara: { land: [2080, 1805], sea: [1842, 1768], air: [2205, 1715], port: [1850, 1752], label: [2080, 1710] },
    "middle-east": { land: [2260, 1508], sea: [2338, 1568], air: [2325, 1440], port: [2316, 1538], label: [2260, 1432] },
    india: { land: [2575, 1568], sea: [2482, 1640], air: [2665, 1490], port: [2526, 1612], label: [2575, 1482] },
    china: { land: [2810, 1408], sea: [3058, 1498], air: [2725, 1328], port: [3012, 1476], label: [2810, 1324] },
    japan: { land: [3172, 1392], sea: [3258, 1438], air: [3130, 1338], port: [3208, 1432], label: [3172, 1324] },
    oceania: { land: [3060, 1925], sea: [3330, 1965], air: [3185, 1835], port: [3285, 1948], label: [3060, 1835] }
  };

  function point(id, kind) {
    const row = STATIONS[id];
    if (!row) return null;
    const pair = row[kind] || row.land;
    if (!pair) return row.land ? { x: row.land[0], y: row.land[1] } : null;
    return { x: pair[0], y: pair[1] };
  }

  const api = {
    names: NAMES,
    links: LINKS,
    ids: ids,
    neighbours: neighbours,
    seaNeighbours: seaNeighbours,
    isSea: isSea,
    stations: STATIONS,
    point: point
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.FLMap = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
