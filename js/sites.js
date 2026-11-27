(function (g) {
  "use strict";

  function load(path, key) {
    if (typeof module !== "undefined" && module.exports && typeof require === "function") return require(path);
    return g[key];
  }

  const map = load("./map", "FLMap");
  const WIDTH = 3600;

  // Remote grounds. They are not theatres: capturing one does not move a border
  // and does not count toward the sixteen. A port on the gateway theatre is the
  // way in. The installation on the ground is a port or a base.
  const LIST = [
    { id: "greenland", name: "Greenland", resource: "minerals", yield: 2, strategic: 2, gateway: "north-america", kind: "port", lon: -41.5, lat: 71.8 },
    { id: "hawaii", name: "Hawaii", resource: "strategic", yield: 0, strategic: 2, gateway: "north-america", kind: "base", lon: -157.5, lat: 20.6 },
    { id: "falklands", name: "Falkland Shelf", resource: "oil", yield: 2, strategic: 1, gateway: "latin-america", kind: "port", lon: -59.2, lat: -51.7 },
    { id: "azores", name: "Azores", resource: "strategic", yield: 0, strategic: 2, gateway: "british-isles", kind: "base", lon: -28, lat: 38.6 },
    { id: "svalbard", name: "Svalbard", resource: "minerals", yield: 1, strategic: 2, gateway: "scandinavia", kind: "base", lon: 16.8, lat: 78.2 },
    { id: "canaries", name: "Canary Shelf", resource: "oil", yield: 2, strategic: 1, gateway: "france", kind: "port", lon: -15.5, lat: 28.3 },
    { id: "sakhalin", name: "Sakhalin Shelf", resource: "oil", yield: 2, strategic: 1, gateway: "russia", kind: "port", lon: 143, lat: 50.5 },
    { id: "persian-gulf", name: "Persian Gulf", resource: "oil", yield: 3, strategic: 2, gateway: "middle-east", kind: "port", lon: 51.2, lat: 27.2 },
    { id: "guinea", name: "Gulf of Guinea", resource: "oil", yield: 2, strategic: 1, gateway: "subsahara", kind: "port", lon: 4.2, lat: 3.4 },
    { id: "bengal", name: "Bay of Bengal", resource: "strategic", yield: 0, strategic: 3, gateway: "india", kind: "port", lon: 88, lat: 15 },
    { id: "yellow-sea", name: "Yellow Sea Shelf", resource: "oil", yield: 2, strategic: 1, gateway: "china", kind: "port", lon: 123.5, lat: 36.2 },
    { id: "kurils", name: "Kuril Station", resource: "strategic", yield: 0, strategic: 2, gateway: "japan", kind: "base", lon: 148.5, lat: 46.2 },
    { id: "china-sea", name: "South China Sea", resource: "oil", yield: 2, strategic: 2, gateway: "oceania", kind: "port", lon: 114, lat: 11.5 },
    { id: "chagos", name: "Chagos", resource: "strategic", yield: 0, strategic: 3, gateway: "oceania", kind: "base", lon: 72.4, lat: -7.3 }
  ];

  function project(lon, lat) {
    const lambda = lon * Math.PI / 180;
    const phi = Math.max(-84, Math.min(84, lat)) * Math.PI / 180;
    const x = (lambda + Math.PI) / (2 * Math.PI) * WIDTH;
    const merc = Math.log(Math.tan(Math.PI / 4 + phi / 2));
    const y = (Math.PI - merc) / (2 * Math.PI) * WIDTH;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }

  const byId = {};
  LIST.forEach(function (site) {
    const at = project(site.lon, site.lat);
    site.x = at.x;
    site.y = at.y;
    byId[site.id] = site;
  });

  function coastal(id) {
    if (id === "russia") return true;
    return !!(map.seaNeighbours[id] && map.seaNeighbours[id].length);
  }

  function forGateway(id) {
    return LIST.filter(function (site) { return site.gateway === id; });
  }

  const api = {
    list: LIST,
    byId: byId,
    coastal: coastal,
    forGateway: forGateway,
    PORT_COST: 4,
    BASE_COST: 3,
    EXPLORE_COST: 3
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.FLSites = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
