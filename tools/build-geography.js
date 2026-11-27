"use strict";

// Builds js/geography.js from Natural Earth 1:10m admin-0 countries.
// Source file is public domain: https://www.naturalearthdata.com/
// The raw download stays in tools/cache and is not part of the game.

const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "cache", "ne_10m_admin_0_countries.geojson");
const OUT = path.join(__dirname, "..", "js", "geography.js");
const WIDTH = 3600;
const TOLERANCE = 0.005;

const REGION = {
  CAN: "north-america", USA: "north-america", GRL: "north-america", BMU: "north-america", SPM: "north-america",
  MEX: "latin-america", BLZ: "latin-america", GTM: "latin-america", HND: "latin-america", SLV: "latin-america",
  NIC: "latin-america", CRI: "latin-america", PAN: "latin-america", CUB: "latin-america", JAM: "latin-america",
  HTI: "latin-america", DOM: "latin-america", BHS: "latin-america", PRI: "latin-america", TTO: "latin-america",
  AIA: "latin-america", ATG: "latin-america", ABW: "latin-america", BRB: "latin-america", CYM: "latin-america",
  DMA: "latin-america", GRD: "latin-america", MSR: "latin-america", KNA: "latin-america", LCA: "latin-america",
  VCT: "latin-america", SXM: "latin-america", BLM: "latin-america", MAF: "latin-america", TCA: "latin-america",
  VGB: "latin-america", VIR: "latin-america", GUY: "latin-america", SUR: "latin-america", ARG: "latin-america",
  BOL: "latin-america", BRA: "latin-america", CHL: "latin-america", COL: "latin-america", ECU: "latin-america",
  FLK: "latin-america", PRY: "latin-america", PER: "latin-america", URY: "latin-america", VEN: "latin-america",
  GBR: "british-isles", IRL: "british-isles", GGY: "british-isles", JEY: "british-isles", IMN: "british-isles",
  NOR: "scandinavia", SWE: "scandinavia", FIN: "scandinavia", DNK: "scandinavia", ISL: "scandinavia",
  EST: "scandinavia", LVA: "scandinavia", LTU: "scandinavia", FRO: "scandinavia", ALD: "scandinavia",
  GIB: "france",
  FRA: "france", ESP: "france", PRT: "france", AND: "france", BEL: "france", NLD: "france", LUX: "france",
  CHE: "france", MCO: "france",
  DEU: "germany", POL: "germany", CZE: "germany", SVK: "germany", AUT: "germany", HUN: "germany", LIE: "germany",
  ITA: "italy", SMR: "italy", VAT: "italy", MLT: "italy",
  SVN: "balkans", HRV: "balkans", BIH: "balkans", SRB: "balkans", MNE: "balkans", KOS: "balkans",
  MKD: "balkans", ALB: "balkans", GRC: "balkans", BGR: "balkans", ROU: "balkans",
  RUS: "russia", BLR: "russia", UKR: "russia", MDA: "russia", KAZ: "russia", UZB: "russia", TKM: "russia",
  KGZ: "russia", TJK: "russia", GEO: "russia", ARM: "russia", AZE: "russia",
  DZA: "north-africa", EGY: "north-africa", LBY: "north-africa", MAR: "north-africa", TUN: "north-africa", SAH: "north-africa",
  AFG: "middle-east", ARE: "middle-east", BHR: "middle-east", CYP: "middle-east", CYN: "middle-east",
  IRN: "middle-east", IRQ: "middle-east", ISR: "middle-east", JOR: "middle-east", KWT: "middle-east",
  LBN: "middle-east", OMN: "middle-east", PSX: "middle-east", QAT: "middle-east", SAU: "middle-east",
  SYR: "middle-east", TUR: "middle-east", YEM: "middle-east",
  ESB: "middle-east", WSB: "middle-east", CNM: "middle-east", KAB: "russia",
  BGD: "india", BTN: "india", IND: "india", LKA: "india", MDV: "india", NPL: "india", PAK: "india", KAS: "india",
  CHN: "china", HKG: "china", KOR: "china", MAC: "china", MNG: "china", PRK: "china", TWN: "china",
  JPN: "japan",
  AUS: "oceania", NZL: "oceania", IDN: "oceania", PHL: "oceania", PNG: "oceania", MYS: "oceania",
  BRN: "oceania", KHM: "oceania", LAO: "oceania", MMR: "oceania", SGP: "oceania", THA: "oceania",
  TLS: "oceania", VNM: "oceania", FJI: "oceania", NCL: "oceania", SLB: "oceania", VUT: "oceania",
  WSM: "oceania", TON: "oceania", TUV: "oceania", KIR: "oceania", FSM: "oceania", MHL: "oceania",
  PLW: "oceania", NRU: "oceania", MNP: "oceania", GUM: "oceania", ASM: "oceania", COK: "oceania",
  NIU: "oceania", NFK: "oceania", PCN: "oceania", PYF: "oceania", WLF: "oceania", TCA: "latin-america",
  IOT: "oceania", ATC: "oceania", IOA: "oceania", PGA: "oceania", SCR: "oceania",
  ATA: "polar", ATF: "polar", HMD: "polar", SGS: "polar"
};

// Distant parts of these countries are classified by where they actually sit.
const HOME = {
  FRA: [-6, 10, 41, 51.6],
  ESP: [-19, 5, 27, 44],
  PRT: [-32, -6, 30, 43],
  NLD: [3, 7.5, 50.5, 54],
  USA: [-179, -66, 17, 72],
  GBR: [-14.5, 2.2, 49, 61.2],
  NOR: [-10, 35, 57, 82],
  RUS: [19, 180, 41, 82],
  AUS: [112, 154, -44, -10],
  NZL: [166, 179, -48, -34],
  IND: [68, 98, 5, 36],
  CHL: [-110, -66, -56, -17]
};

const ANCHORS = {
  "north-america": [-98, 39],
  "latin-america": [-63, -14],
  "british-isles": [-2.2, 53.5],
  scandinavia: [15, 63],
  france: [1.5, 46],
  germany: [13, 50.5],
  italy: [12.4, 42.8],
  balkans: [22, 43],
  russia: [62, 58],
  "north-africa": [12, 27],
  subsahara: [24, -2],
  "middle-east": [44, 27],
  india: [78, 22],
  china: [104, 36],
  japan: [138, 37],
  oceania: [132, -18]
};

const THEATRE_NAMES = {
  "north-america": "North America",
  "latin-america": "Latin America",
  "british-isles": "British Isles",
  scandinavia: "Scandinavia",
  france: "Western Europe",
  germany: "Central Europe",
  italy: "Italy",
  balkans: "Balkans",
  russia: "Northern Eurasia",
  "north-africa": "North Africa",
  subsahara: "Sub-Saharan Africa",
  "middle-east": "Middle East",
  india: "Indian Subcontinent",
  china: "East Asia",
  japan: "Japan",
  oceania: "Oceania and Southeast Asia"
};

function project(lon, lat) {
  const λ = lon * Math.PI / 180;
  const φ = Math.max(-84, Math.min(84, lat)) * Math.PI / 180;
  const x = (λ + Math.PI) / (2 * Math.PI) * WIDTH;
  const merc = Math.log(Math.tan(Math.PI / 4 + φ / 2));
  const y = (Math.PI - merc) / (2 * Math.PI) * WIDTH;
  return [x, y];
}

function distPoint(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
}

function simplify(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const pair = stack.pop();
    const a = pair[0];
    const b = pair[1];
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i += 1) {
      const d = distPoint(points[i], points[a], points[b]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx !== -1 && max > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i += 1) if (keep[i]) out.push(points[i]);
  return out;
}

function prepare(ring) {
  const pts = ring.map(function (p) { return [p[0], p[1]]; });
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) pts.pop();
  }
  return normalizeRing(pts);
}

function normalizeRing(ring) {
  let min = 180;
  let max = -180;
  ring.forEach(function (p) {
    if (p[0] < min) min = p[0];
    if (p[0] > max) max = p[0];
  });
  let pts = ring;
  if (max - min > 180) {
    pts = ring.map(function (p) { return [p[0] < 0 ? p[0] + 360 : p[0], p[1]]; });
  }
  let sum = 0;
  pts.forEach(function (p) { sum += p[0]; });
  const avg = sum / pts.length;
  if (avg > 180) pts = pts.map(function (p) { return [p[0] - 360, p[1]]; });
  return pts;
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}

function ringCenter(ring) {
  let x = 0;
  let y = 0;
  ring.forEach(function (p) { x += p[0]; y += p[1]; });
  return [x / ring.length, y / ring.length];
}

function insideHome(iso, lon, lat) {
  const box = HOME[iso];
  if (!box) return true;
  if (iso === "RUS" && lon < -168 && lat > 60) return true;
  if (iso === "USA" && lon > 170 && lat > 50) return true;
  return lon >= box[0] && lon <= box[1] && lat >= box[2] && lat <= box[3];
}

function geoRegion(lon, lat) {
  if (lat <= -60) return "polar";
  if (lat <= -51 && lon >= -3 && lon <= 8) return "polar";
  if (lon >= -11 && lon <= 2 && lat >= 49.2 && lat <= 61) return "british-isles";
  if (lon >= -26 && lon <= -12 && lat >= 63 && lat <= 67.5) return "scandinavia";
  if (lon >= 4 && lon <= 32 && lat >= 54.5 && lat <= 72) return "scandinavia";
  if (lon <= -25 || (lon < -30 && lat < 72)) {
    if (lon < -130 && lat < 50) return "oceania";
    if (lat >= 32) return "north-america";
    return "latin-america";
  }
  if (lat >= 36 && lat <= 47.2 && lon >= 7 && lon <= 18.6) return "italy";
  if (lat >= 36 && lat < 49.5 && lon >= -10 && lon <= 8) return "france";
  if (lat >= 45 && lat <= 55 && lon >= 5 && lon <= 24) return "germany";
  if (lat >= 36 && lat <= 48 && lon >= 13 && lon <= 30) return "balkans";
  if (lon >= 25 && lon <= 63 && lat >= 12 && lat <= 43) return "middle-east";
  if (lon >= 60 && lon <= 98 && lat >= 5 && lat <= 37) return "india";
  if (lon >= 73 && lon <= 135 && lat >= 18 && lat <= 54) return "china";
  if (lon >= 129 && lon <= 146 && lat >= 30 && lat <= 46) return "japan";
  if (lon >= -20 && lon <= 52 && lat >= -36 && lat <= 38) {
    if (lat >= 19 && lon <= 40) return "north-africa";
    return "subsahara";
  }
  if (lon >= 40 && lon <= 75 && lat >= -28 && lat <= -4) return "subsahara";
  if (lat > 42 && lon >= 20 && lon <= 180) return "russia";
  if (lon > 95 || lat < 20 && lon > 95) return "oceania";
  if (lon > 50) return "oceania";
  return "subsahara";
}

function zoomFor(area) {
  if (area > 40) return 2.1;
  if (area > 6) return 3.1;
  if (area > 0.6) return 4.8;
  if (area > 0.05) return 7.5;
  return 11;
}

function pathFromRings(rings) {
  let d = "";
  rings.forEach(function (ring) {
    if (ring.length < 3) return;
    d += "M" + ring.map(function (p) {
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
        throw new Error("Projected coordinate is not finite");
      }
      return p[0].toFixed(1) + " " + p[1].toFixed(1);
    }).join("L") + "Z";
  });
  return d;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  const missing = [];
  const moves = [];
  const places = [];
  const polarRings = [];
  let kept = 0;
  let dropped = 0;

  raw.features.forEach(function (feature) {
    const iso = feature.properties.ADM0_A3;
    const name = feature.properties.NAME;
    let region = REGION[iso];
    if (!region) {
      const continent = feature.properties.CONTINENT;
      if (continent === "Africa") region = "subsahara";
      else if (continent === "Oceania" || continent === "Seven seas (open ocean)") region = "oceania";
      else if (continent === "South America" || continent === "North America") region = "latin-america";
      else missing.push(iso + " " + name + " (" + continent + ")");
    }
    if (!region) return;
    const geometry = feature.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    let largest = null;
    let largestArea = 0;
    const featurePlaces = [];
    polygons.forEach(function (polygon) {
      const outer = prepare(polygon[0]);
      const center = ringCenter(outer);
      let target = region;
      if (region !== "polar" && !insideHome(iso, center[0], center[1])) {
        target = geoRegion(center[0], center[1]);
        moves.push(name + " part → " + target + " @ " + center[0].toFixed(1) + "," + center[1].toFixed(1));
      }
      const rings = [];
      polygon.forEach(function (ring) {
        const simplified = simplify(prepare(ring), TOLERANCE);
        if (simplified.length >= 3) {
          rings.push(simplified.map(function (p) { return project(p[0], p[1]); }));
        }
        else dropped += 1;
      });
      if (!rings.length) return;
      kept += rings.length;
      const area = ringArea(outer);
      if (target === "polar") {
        polarRings.push(rings);
        return;
      }
      const projectedCenter = project(center[0], center[1]);
      const place = {
        name: name,
        territory: target,
        rings: rings,
        x: projectedCenter[0],
        y: projectedCenter[1],
        zoom: zoomFor(area),
        area: area,
        label: false
      };
      places.push(place);
      featurePlaces.push(place);
      if (area > largestArea) {
        largestArea = area;
        largest = place;
      }
    });
    if (largest) {
      featurePlaces.forEach(function (place) {
        place.label = place === largest || (place.area > 2 && place.territory !== largest.territory);
      });
    }
  });

  if (missing.length) {
    console.error("Unassigned countries:\n" + missing.join("\n"));
    process.exit(1);
  }

  const theatres = {};
  Object.keys(THEATRE_NAMES).forEach(function (id) {
    const anchor = project(ANCHORS[id][0], ANCHORS[id][1]);
    theatres[id] = { name: THEATRE_NAMES[id], x: anchor[0], y: anchor[1] };
  });

  const north = project(0, 84)[1];
  const south = project(0, -58)[1];
  const view = { x: -30, y: north - 20, w: WIDTH + 60, h: (south - north) + 40 };

  let graticule = "";
  for (let lon = -180; lon <= 180; lon += 15) {
    const a = project(lon, 84);
    const b = project(lon, -58);
    graticule += "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1);
  }
  for (let lat = -60; lat <= 80; lat += 15) {
    const a = project(-180, lat);
    const b = project(180, lat);
    graticule += "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1);
  }

  const oceans = [
    ["ATLANTIC", -42, 28],
    ["PACIFIC", -150, 18],
    ["PACIFIC", 168, 12],
    ["INDIAN", 78, -18]
  ].map(function (item) {
    const p = project(item[1], item[2]);
    return { name: item[0], x: p[0], y: p[1] };
  });

  const payload = {
    source: "Natural Earth 1:10m admin-0 countries, public domain",
    width: WIDTH,
    view: view,
    graticule: graticule,
    oceans: oceans,
    theatres: theatres,
    places: places.map(function (place) {
      return {
        name: place.name,
        territory: place.territory,
        d: pathFromRings(place.rings),
        x: Number(place.x.toFixed(1)),
        y: Number(place.y.toFixed(1)),
        zoom: place.zoom,
        label: !!place.label
      };
    }),
    polar: pathFromRings(polarRings.flat())
  };

  const byTheatre = {};
  payload.places.forEach(function (place) {
    byTheatre[place.territory] = (byTheatre[place.territory] || 0) + 1;
  });
  Object.keys(THEATRE_NAMES).forEach(function (id) {
    if (!byTheatre[id]) {
      console.error("Theatre has no land: " + id);
      process.exit(1);
    }
  });

  const expect = {
    "United Kingdom": "british-isles",
    Ireland: "british-isles",
    France: "france",
    Spain: "france",
    Germany: "germany",
    Poland: "germany",
    Italy: "italy",
    Norway: "scandinavia",
    Greece: "balkans",
    Russia: "russia",
    Ukraine: "russia",
    Egypt: "north-africa",
    Nigeria: "subsahara",
    Turkey: "middle-east",
    India: "india",
    China: "china",
    Japan: "japan",
    Australia: "oceania",
    Brazil: "latin-america",
    Canada: "north-america",
    "United States of America": "north-america"
  };
  Object.keys(expect).forEach(function (name) {
    const parts = payload.places.filter(function (place) { return place.name === name; });
    if (!parts.length) {
      console.error("Missing country " + name);
      process.exit(1);
    }
    parts.sort(function (a, b) { return a.zoom - b.zoom; });
    if (parts[0].territory !== expect[name]) {
      console.error(name + " landed in " + parts[0].territory + ", expected " + expect[name]);
      process.exit(1);
    }
    if (parts[0].d.indexOf("NaN") !== -1) {
      console.error(name + " has a broken coordinate");
      process.exit(1);
    }
  });

  const body = "/* Generated by tools/build-geography.js. Do not edit by hand.\n   Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.\n   Natural Earth is in the public domain. */\n"
    + "(function (g) {\n\"use strict\";\nconst api = "
    + JSON.stringify(payload)
    + ";\nif (typeof module !== \"undefined\" && module.exports) module.exports = api;\ng.FLGeo = api;\n})(typeof globalThis !== \"undefined\" ? globalThis : this);\n";

  fs.writeFileSync(OUT, body);
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log("places", payload.places.length, "rings kept", kept, "dropped", dropped, "file", kb + "KB");
  console.log("theatres", JSON.stringify(byTheatre));
  console.log("reclassified", moves.length);
  moves.slice(0, 40).forEach(function (line) { console.log("  " + line); });
}

main();
