(function (g) {
  "use strict";

  function load(path, key) {
    if (typeof module !== "undefined" && module.exports && typeof require === "function") return require(path);
    return g[key];
  }

  const map = load("./map", "FLMap");
  const rules = load("./rules", "FLRules");
  const eras = load("./scenarios", "FLEras");
  const geo = load("./geography", "FLGeo");

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function hash(text) {
    let n = 0;
    const s = String(text);
    for (let i = 0; i < s.length; i += 1) n = (n * 33 + s.charCodeAt(i)) >>> 0;
    return n;
  }

  function hex(n) {
    const s = n.toString(16);
    return s.length === 1 ? "0" + s : s;
  }

  function mix(a, b, t) {
    const pa = parseInt(String(a).slice(1), 16);
    const pb = parseInt(String(b).slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
    const gch = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
    const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
    return "#" + hex(r) + hex(gch) + hex(bl);
  }

  function card(title, body) {
    return '<section class="card"><h2>' + esc(title) + "</h2>" + body + "</section>";
  }

  function die(face, caption) {
    const n = Math.max(1, Math.min(6, face | 0));
    let pips = "";
    for (let i = 0; i < 9; i += 1) pips += "<i></i>";
    return '<div><div class="die" data-face="' + n + '" role="img" aria-label="' + esc(caption) + " " + n + '">' + pips + '</div><div class="die-cap">' + esc(caption) + "</div></div>";
  }

  function portrait(country, factionColor) {
    const n = hash(country.id);
    const skin = ["#f3d2b5", "#e7b48a", "#c68642", "#8d5524", "#f6e0cc"][n % 5];
    const hair = ["#1c1a22", "#3a2a24", "#6b3a2a", "#22262e", "#4a3428"][Math.floor(n / 5) % 5];
    const style = n % 4;
    const hairPath = [
      '<path d="M18 46c2-20 14-30 28-30s26 12 28 32c-8-8-16-10-28-8-10 2-18 2-28 6z" fill="' + hair + '"/>',
      '<path d="M16 50c4-24 16-34 30-32 12 2 22 12 26 30-6-14-18-18-30-16-8 1-16 6-26 18z" fill="' + hair + '"/>',
      '<path d="M22 44c0-16 10-26 24-26s24 10 24 26v8H22z" fill="' + hair + '"/>',
      '<path d="M20 48c6-22 18-30 34-28 4 10 4 20 2 28-8-10-16-12-24-10-6 2-10 4-12 10z" fill="' + hair + '"/>'
    ][style];
    return '<svg class="portrait" viewBox="0 0 80 104" role="img" aria-label="Original portrait plate for ' + esc(country.name) + '">' +
      '<rect width="80" height="104" fill="' + factionColor + '"/>' +
      '<circle cx="40" cy="42" r="22" fill="' + skin + '"/>' + hairPath +
      '<rect x="18" y="68" width="44" height="28" rx="6" fill="' + country.accent + '"/>' +
      '<circle cx="40" cy="78" r="4" fill="' + factionColor + '"/>' +
      "</svg>";
  }

  function sigil(country, factionColor) {
    const n = hash(country.id);
    const charge = n % 3;
    const inner = charge === 0
      ? '<rect x="34" y="22" width="12" height="36" fill="' + factionColor + '"/>'
      : charge === 1
        ? '<polygon points="40,20 52,44 28,44" fill="' + factionColor + '"/>'
        : '<circle cx="40" cy="34" r="10" fill="none" stroke="' + factionColor + '" stroke-width="3"/>';
    return '<svg class="sigil" viewBox="0 0 80 80" role="img" aria-label="Board sigil for ' + esc(country.name) + '">' +
      '<circle cx="40" cy="40" r="34" fill="#1a140e" stroke="' + country.accent + '" stroke-width="3"/>' +
      inner + '<path d="M24 58h32" stroke="' + country.accent + '" stroke-width="2"/>' +
      "</svg>";
  }

  function shortName(id) {
    const names = {
      "north-america": "N. America",
      "latin-america": "Latin America",
      "british-isles": "Britain",
      scandinavia: "Scandinavia",
      france: "W. Europe",
      germany: "C. Europe",
      italy: "Italy",
      balkans: "Balkans",
      russia: "N. Eurasia",
      "north-africa": "N. Africa",
      subsahara: "Sub-Saharan",
      "middle-east": "Middle East",
      india: "India",
      china: "E. Asia",
      japan: "Japan",
      oceania: "SE Asia"
    };
    return names[id] || map.names[id];
  }

  function seatCountryId(state) {
    if (!state || !state.seats) return null;
    if (state.seats.role === "strategist") return state.seats.strategistCountryId || null;
    if (state.seats.role === "player") return state.seats.playerCountryId || null;
    return null;
  }

  function holdingsOf(state, countryId) {
    const country = state.countries[countryId];
    return rules.ownedTerritories(state, countryId).slice().sort(function (a, b) {
      if (a.id === country.capital) return -1;
      if (b.id === country.capital) return 1;
      return b.name.localeCompare(a.name);
    });
  }

  function actingId(state, ui) {
    if (!state || state.seats.role !== "player") return null;
    if (state.winner && !state.winner.continued) return null;
    if (state.mode === "turn") {
      const active = state.countries[state.activeCountryId];
      return active && active.control === "human" && !active.eliminated && !active.inactive ? active.id : null;
    }
    if (state.timeline.playing) return null;
    const preferred = ui.commandId || state.seats.playerCountryId;
    const country = preferred && state.countries[preferred];
    if (country && country.control === "human" && !country.eliminated) return preferred;
    const ids = Object.keys(state.countries);
    for (let i = 0; i < ids.length; i += 1) {
      const item = state.countries[ids[i]];
      if (item.control === "human" && !item.eliminated) return ids[i];
    }
    return null;
  }

  function clockLabel(seconds) {
    const s = Math.max(0, seconds | 0);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (days > 0) return days + "d " + hours + "h " + minutes + "m";
    if (hours > 0) return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    return minutes + ":" + String(secs).padStart(2, "0");
  }

  function expiryName(rule) {
    if (rule === "queue") return "execute staged orders";
    if (rule === "ai") return "hand the rest of the turn to AI";
    return "auto-pass";
  }

  function relationWord(n) {
    if (n >= 2) return "allied";
    if (n === 1) return "cordial";
    if (n === 0) return "uncommitted";
    if (n === -1) return "hostile";
    return "at war";
  }

  function fillFor(state, country) {
    const faction = rules.factionById(state, country.factionId);
    return mix(country.accent, faction ? faction.color : "#888888", 0.5);
  }

  function landFill(state, country) {
    if (!country) return "#d9d3c6";
    return mix(fillFor(state, country), "#f6f1e6", 0.58);
  }

  function mapSvg(state) {
    const view = geo.view;
    const anime = state.presentation === "anime";
    const groups = {};
    map.ids.forEach(function (id) { groups[id] = []; });
    const ordered = geo.places.slice().sort(function (a, b) { return a.zoom - b.zoom; });
    ordered.forEach(function (place) {
      if (!groups[place.territory]) return;
      groups[place.territory].push('<path fill-rule="evenodd" d="' + place.d + '"><title>' + esc(place.name) + "</title></path>");
    });
    const land = map.ids.map(function (id) {
      return '<g class="territory" data-id="' + id + '">' + groups[id].join("") + "</g>";
    }).join("");
    let lanes = "";
    map.links.forEach(function (link) {
      if (!link[2]) return;
      const a = geo.theatres[link[0]];
      const b = geo.theatres[link[1]];
      lanes += '<line class="sea-lane" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
    });
    const oceans = geo.oceans.map(function (ocean) {
      return '<g class="ocean-label" data-pin data-x="' + ocean.x + '" data-y="' + ocean.y + '"><text text-anchor="middle">' + esc(ocean.name) + "</text></g>";
    }).join("");
    const theatres = map.ids.map(function (id) {
      const at = (map.point && map.point(id, "label")) || geo.theatres[id];
      return '<g class="theatre-label" data-id="' + id + '" data-pin data-x="' + at.x + '" data-y="' + at.y + '"><text class="t-label" data-short="' + esc(shortName(id)) + '" data-full="' + esc(map.names[id]) + '" y="0" text-anchor="middle">' + esc(shortName(id)) + "</text></g>";
    }).join("");
    const places = geo.places.filter(function (place) { return place.label; }).map(function (place) {
      return '<text class="place-label" data-zoom="' + place.zoom + '" x="' + place.x + '" y="' + place.y + '" text-anchor="middle">' + esc(place.name) + "</text>";
    }).join("");
    return '<svg id="world-map" data-presentation="' + (anime ? "anime" : "board") + '" viewBox="' +
      view.x + " " + view.y + " " + view.w + " " + view.h +
      '" role="img" aria-label="World map. Coastlines and country borders are Natural Earth, public domain. Colours are the sixteen theatres.">' +
      '<g id="world-camera">' +
      '<rect class="ocean-fill" x="-4000" y="-4000" width="16000" height="16000"/>' +
      '<path class="graticule" d="' + geo.graticule + '"/>' +
      oceans +
      (geo.polar ? '<path class="polar" d="' + geo.polar + '"/>' : "") +
      '<g id="land">' + land + "</g>" +
      '<g id="lanes">' + lanes + "</g>" +
      '<g id="markers"></g>' +
      '<g id="place-labels">' + places + "</g>" +
      '<g id="theatre-labels">' + theatres + "</g>" +
      "</g></svg>";
  }

  function markerScale(k) {
    return (geo.view.w / 2100) / (k || 1);
  }

  function plantedScale() {
    return geo.view.w / 2100;
  }

  function displayOf(ui) {
    const raw = ui && ui.display ? ui.display : {};
    return {
      pieces: raw.pieces === "many" ? "many" : "single",
      names: raw.names !== false,
      lanes: raw.lanes !== false,
      grid: raw.grid !== false,
      sites: raw.sites !== false
    };
  }

  function syncMapZoom(svg, k) {
    if (!svg) return;
    const screen = markerScale(k).toFixed(4);
    const planted = plantedScale().toFixed(4);
    const names = svg.getAttribute("data-names") !== "off";
    svg.querySelectorAll("[data-pin]").forEach(function (node) {
      const scale = node.hasAttribute("data-map") ? planted : screen;
      node.setAttribute("transform", "translate(" + node.getAttribute("data-x") + " " + node.getAttribute("data-y") + ") scale(" + scale + ")");
    });
    svg.querySelectorAll(".place-label").forEach(function (node) {
      const need = Number(node.getAttribute("data-zoom")) || 1;
      node.style.display = names && k + 0.05 >= Math.max(need, 4.6) ? "" : "none";
    });
    svg.querySelectorAll(".ocean-label").forEach(function (node) {
      node.setAttribute("opacity", names && k <= 2.4 ? "1" : "0");
    });
    svg.querySelectorAll(".theatre-label").forEach(function (node) {
      const text = node.querySelector("text");
      const selected = node.getAttribute("data-id") && node.getAttribute("data-id") === svg.getAttribute("data-selected");
      const full = text && (selected || k >= 3.2);
      if (text) {
        text.textContent = full ? text.getAttribute("data-full") : text.getAttribute("data-short");
        text.style.fontSize = selected ? "18px" : "13px";
      }
      node.setAttribute("opacity", names && (selected || k < 4.2) ? "1" : "0");
    });
  }

  function applyDisplay(svg, ui) {
    if (!svg) return;
    const display = displayOf(ui);
    svg.setAttribute("data-names", display.names ? "on" : "off");
    svg.setAttribute("data-pieces", display.pieces);
    const lanes = svg.querySelector("#lanes");
    if (lanes) lanes.setAttribute("visibility", display.lanes ? "visible" : "hidden");
    const grid = svg.querySelector(".graticule");
    if (grid) grid.setAttribute("visibility", display.grid ? "visible" : "hidden");
  }

  function pieceShape(anime, color, small) {
    if (anime) {
      const outer = small ? 7 : 15;
      const inner = small ? 3.2 : 7;
      return '<polygon points="0,-' + outer + " " + (outer * 0.86).toFixed(1) + ",0 0," + outer + " -" + (outer * 0.86).toFixed(1) + ',0" fill="#fffaf2" stroke="#1c1a33" stroke-width="1.5"/>' +
        '<polygon points="0,-' + inner + " " + (inner * 0.8).toFixed(1) + ",0 0," + inner + " -" + (inner * 0.8).toFixed(1) + ',0" fill="' + color + '"/>';
    }
    const outer = small ? 6.2 : 15;
    const inner = small ? 3.5 : 10.5;
    return '<circle class="ring" r="' + outer + '" fill="' + color + '"/>' +
      '<circle r="' + inner + '" fill="#16120e"/>';
  }

  function pieceInk(anime) {
    return anime ? "#1c1a33" : "#f4ecdc";
  }

  function forceMarkers(anime, color, count, many) {
    const forces = Math.max(0, count | 0);
    if (!many) {
      return '<g class="unit-token">' + pieceShape(anime, color, false) +
        '<text y="4" text-anchor="middle" fill="' + pieceInk(anime) + '">' + forces + "</text></g>";
    }
    if (!forces) return "";
    const cap = 8;
    const shown = Math.min(forces, cap);
    const cols = shown > 4 ? 2 : 1;
    let body = "";
    for (let i = shown - 1; i >= 0; i -= 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = ((col - (cols - 1) / 2) * 14).toFixed(1);
      const y = (-row * 9).toFixed(1);
      body += '<g class="unit-token piece" transform="translate(' + x + " " + y + ')">' + pieceShape(anime, color, true) + "</g>";
    }
    if (forces > cap) {
      const y = (-Math.ceil(cap / cols) * 9 - 6).toFixed(1);
      body += '<text class="piece-more" y="' + y + '" text-anchor="middle">+' + (forces - cap) + "</text>";
    }
    return body;
  }

  function paintMap(svg, state, ui) {
    if (!svg || !state) return;
    const anime = svg.getAttribute("data-presentation") === "anime";
    const selected = ui.selectedId && state.territories[ui.selectedId] ? ui.selectedId : null;
    const board = selected && rules.destinations ? rules.destinations(state, selected) : { legal: [] };
    const moves = {};
    const attacks = {};
    board.legal.forEach(function (option) {
      if (option.kind === "move") moves[option.toId] = true;
      if (option.kind === "attack") attacks[option.toId] = true;
    });
    const bright = {};
    const activeCountry = state.countries[state.activeCountryId];
    if (activeCountry) {
      map.ids.forEach(function (id) {
        if (state.territories[id].ownerId === activeCountry.id) bright[id] = true;
      });
    }
    if (selected) bright[selected] = true;
    Object.keys(moves).forEach(function (id) { bright[id] = true; });
    Object.keys(attacks).forEach(function (id) { bright[id] = true; });
    if (state.engagement) {
      bright[state.engagement.fromId] = true;
      bright[state.engagement.toId] = true;
    }
    svg.querySelectorAll(".territory").forEach(function (node) {
      const id = node.getAttribute("data-id");
      const territory = state.territories[id];
      if (!territory) return;
      const owner = state.countries[territory.ownerId];
      node.setAttribute("fill", landFill(state, owner));
      node.classList.toggle("selected", id === selected);
      node.classList.toggle("interest", !!bright[id] && id !== selected);
      node.classList.toggle("quiet", !bright[id]);
      node.classList.toggle("legal-move", !!moves[id]);
      node.classList.toggle("legal-attack", !!attacks[id]);
      let title = node.firstChild && node.firstChild.localName === "title" ? node.firstChild : null;
      if (!title) {
        title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        node.insertBefore(title, node.firstChild);
      }
      const viewerReport = owner ? rules.assessVisibility(state, rules.viewerFor(state, ui), owner.id) : null;
      const known = viewerReport ? viewerReport.territories.filter(function (item) { return item.territoryId === id; })[0] : null;
      const forceText = !known || known.status === "unknown" ? "Strength unknown" : known.status === "estimated" ? "Estimated strength " + known.forces : known.status === "last-known" ? "Last known strength " + known.forces : "Strength " + known.forces;
      title.textContent = territory.name + ". " + (owner ? owner.name : "Unheld") + ". " + forceText + ".";
    });
    let markers = "";
    map.ids.forEach(function (id) {
      const territory = state.territories[id];
      const land = (map.point && map.point(id, "land")) || geo.theatres[id];
      const supplied = rules.inSupply(state, id);
      markers += '<g class="supply-pin" data-pin data-map data-x="' + land.x + '" data-y="' + land.y + '">' +
        '<circle class="supply-dot" cx="0" cy="-8" r="2.4" fill="' + (supplied ? "#9cba78" : "#c46a45") + '"><title>' + (supplied ? "In supply" : "Out of supply") + "</title></circle></g>";
      if (state.ports && state.ports[id]) {
        const portAt = (map.point && map.point(id, "port")) || land;
        markers += '<g class="work-mark port" data-id="' + id + '" data-pin data-map data-x="' + portAt.x + '" data-y="' + portAt.y + '">' +
          '<path class="port-glyph" d="M-5 3 H5 M0 3 V-5" fill="none" stroke="#1b140e" stroke-width="2.4"/>' +
          '<path class="port-glyph" d="M-5 3 H5 M0 3 V-5" fill="none" stroke="#e6c98a" stroke-width="1.2"/>' +
          "<title>Port on " + esc(territory.name) + "</title></g>";
      }
      if (state.bases && state.bases[id]) {
        markers += '<g class="work-mark base" data-id="' + id + '" data-pin data-map data-x="' + land.x + '" data-y="' + land.y + '"><g transform="translate(10 -8)">' +
          '<rect class="base-glyph" x="-4" y="-4" width="8" height="8" fill="#1b140e"/>' +
          '<rect class="base-glyph" x="-2.6" y="-2.6" width="5.2" height="5.2" fill="none" stroke="#e6c98a" stroke-width="1.2"/>' +
          "</g><title>Base on " + esc(territory.name) + "</title></g>";
      }
    });
    const showSites = !ui || !ui.display || ui.display.sites !== false;
    const catalog = showSites && rules.sites && rules.sites.list ? rules.sites.list : [];
    catalog.forEach(function (site) {
      const held = state.sites && state.sites[site.id];
      const owner = held && held.ownerId ? state.countries[held.ownerId] : null;
      const fill = owner ? fillFor(state, owner) : "#c6ad7a";
      const install = held && held.install === "base" ? "base" : held && held.install === "port" ? "port" : "unclaimed";
      const who = owner ? owner.name : "Unclaimed";
      const glyph = site.resource === "oil"
        ? '<path d="M0,-5.2 C1.6,-2.2 3.4,0.2 0,5.4 C-3.4,0.2 -1.6,-2.2 0,-5.2 Z" fill="#1b140e"/>'
        : site.resource === "minerals"
          ? '<path d="M0,-5.5 L4.6,0 L0,5.5 L-4.6,0 Z" fill="#1b140e"/>'
          : '<path d="M0,-6 L1.5,-1.4 L6,-1.2 L2.4,1.6 L3.6,6 L0,3.4 L-3.6,6 L-2.4,1.6 L-6,-1.2 L-1.5,-1.4 Z" fill="#1b140e"/>';
      const kind = site.resource === "oil" ? "oil ground" : site.resource === "minerals" ? "mineral ground" : "strategic station";
      markers += '<g class="site-mark ' + install + '" data-pin data-map data-act="select" data-id="' + site.gateway + '" data-x="' + site.x + '" data-y="' + site.y + '">' +
        '<circle r="8" fill="' + fill + '" stroke="#1b140e" stroke-width="1.2"/>' +
        glyph +
        "<title>" + esc(site.name) + ". " + kind + ". " + esc(who) + ". " + install + ".</title></g>";
    });
    const layer = svg.querySelector("#markers");
    if (layer) layer.innerHTML = markers;
    applyDisplay(svg, ui);
    svg.setAttribute("data-selected", ui.selectedId || "");
    syncMapZoom(svg, ui.map && ui.map.k ? ui.map.k : 1);
  }

  function displayBar(ui) {
    const display = displayOf(ui);
    function pieceButton(value, label) {
      const on = display.pieces === value;
      return '<button type="button" class="btn' + (on ? " on" : "") + '" data-act="pieces" data-value="' + value + '" aria-pressed="' + (on ? "true" : "false") + '">' + label + "</button>";
    }
    function toggleButton(key, label) {
      const on = !!display[key];
      return '<button type="button" class="btn' + (on ? " on" : "") + '" data-act="display-toggle" data-key="' + key + '" aria-pressed="' + (on ? "true" : "false") + '">' + label + "</button>";
    }
    return '<div class="display-bar" role="toolbar" aria-label="Display">' +
      '<span class="display-label">Pieces</span>' +
      pieceButton("single", "One") +
      pieceButton("many", "Many") +
      '<span class="display-label">Show</span>' +
      toggleButton("names", "Names") +
      toggleButton("lanes", "Sea lanes") +
      toggleButton("grid", "Grid") +
      toggleButton("sites", "Sites") +
      '<span class="display-label">Model</span>' +
      '<button type="button" class="btn" data-act="tilt" data-tilt="0.5">Side</button>' +
      '<button type="button" class="btn" data-act="tilt" data-tilt="1.05">Top</button>' +
      "</div>";
  }

  function unitsCount(bag) {
    let total = 0;
    Object.keys(bag || {}).forEach(function (id) { total += bag[id] | 0; });
    return total;
  }

  function resolution(state, ui) {
    const battle = state.combat;
    const diplomacy = state.diplomacy;
    const bSeq = battle && battle.seq ? battle.seq : 0;
    const dSeq = diplomacy && diplomacy.seq ? diplomacy.seq : 0;
    const item = bSeq === 0 && dSeq === 0 ? null : (bSeq >= dSeq ? battle : diplomacy);
    if (!item || (ui.hideSeq && item.seq <= ui.hideSeq)) return "";
    if (item.kind === "battle" && item.attackRolls) {
      const engagement = state.engagement;
      let headline = "Round " + (item.round || 1);
      if (item.outcome === "attacker") headline = "Attackers occupy the territory";
      else if (item.outcome === "retreat") headline = "Attackers retreat";
      else if (item.outcome === "defender") headline = "Defenders hold";
      else if (engagement && engagement.status === "casualties") headline = "Choose casualties";
      else if (engagement && engagement.status === "decision") headline = "Continue or retreat";
      const notes = (item.modifierNotes && item.modifierNotes.length) ? item.modifierNotes.map(esc).join(". ") + "." : "No modifiers.";
      const lines = item.attackRolls.concat(item.defenceRolls || []).map(function (roll) {
        return "<li>" + esc(roll.name) + " rolls " + roll.roll + (roll.hit ? ", hit" : ", miss") + " (needs " + roll.need + " or less)</li>";
      }).join("");
      let remain = "";
      if (item.attackersLeft || item.defendersLeft) {
        remain = "<p>Attackers left: " + esc(stackLabel(item.attackersLeft)) + ". Defenders left: " + esc(stackLabel(item.defendersLeft)) + ".</p>";
        if (unitsCount(item.attackerLoss) || unitsCount(item.defenderLoss)) {
          remain += "<p>This round lost " + esc(stackLabel(item.attackerLoss)) + " from the attack and " + esc(stackLabel(item.defenderLoss)) + " from the defence.</p>";
        }
      }
      let controls = "";
      if (engagement && engagement.status === "casualties" && engagement.pending) {
        const bag = engagement.pending.side === "defender" ? engagement.defenders : engagement.attackers;
        const ownerId = engagement.pending.side === "defender" ? engagement.defenderId : engagement.countryId;
        const pick = ui.casualtyPick || {};
        let picked = 0;
        Object.keys(pick).forEach(function (id) { picked += pick[id] | 0; });
        controls += "<p>Choose exactly " + engagement.pending.must + ". Selected " + picked + ".</p><div class=\"stack\">";
        Object.keys(bag).forEach(function (id) {
          const spec = (rules.unitCatalogue || []).filter(function (unit) { return unit.id === id; })[0];
          controls += '<button class="btn" data-act="casualty-add" data-unit="' + id + '">Mark ' + esc(spec ? spec.name : id) + " (" + bag[id] + " here, " + (pick[id] | 0) + " marked)</button>";
        });
        controls += '<button class="btn-quiet" data-act="casualty-clear">Clear marks</button>';
        controls += '<button class="btn primary" data-act="casualties" data-country="' + ownerId + '"' + (picked === engagement.pending.must ? "" : " disabled") + ">Confirm casualties</button>";
        controls += '<button class="btn" data-act="auto-resolve">Auto-resolve</button></div>';
      } else if (engagement && engagement.status === "decision") {
        const options = rules.retreatOptions ? rules.retreatOptions(state, engagement) : [];
        controls += '<div class="stack"><button class="btn primary" data-act="continue-battle">Continue battle</button>';
        controls += '<button class="btn" data-act="auto-resolve">Auto-resolve</button>';
        options.forEach(function (option) {
          const sample = option.routes[Object.keys(option.routes)[0]];
          controls += '<button class="btn" data-act="retreat" data-to="' + option.id + '">Retreat to ' + esc(option.name) + " · " + option.cost + " movement · " + esc(pathNames(state, sample && sample.steps)) + "</button>";
        });
        if (!options.length) controls += '<p class="faint">No legal retreat. These units cannot leave the battle.</p>';
        controls += "</div>";
      }
      return '<div class="resolution"><div class="resolution-copy"><h2>' + headline + "</h2>" +
        "<ul class=\"holding-list\">" + lines + "</ul>" +
        "<p>Hits " + item.attackHits + " against the defender, " + item.defenceHits + " against the attacker.</p>" +
        remain +
        "<p>" + esc(item.attackerName) + " against " + esc(item.defenderName) + " for " + esc(item.toName) + ".</p>" +
        '<p class="faint">' + notes + "</p><p>" + esc(item.summary) + "</p>" + controls +
        (engagement ? "" : '<button class="btn-quiet" data-act="dismiss">Dismiss</button>') + "</div></div>";
    }
    if (item.kind === "battle") {
      const headline = item.outcome === "attacker" ? "Attacker takes the territory" : item.outcome === "tie" ? "Tie. The defender holds" : "Defender holds";
      const notes = (item.modifierNotes && item.modifierNotes.length) ? item.modifierNotes.map(esc).join(". ") + "." : "No modifiers.";
      return '<div class="resolution"><div class="dice">' + die(item.attackRoll, "Attack die") + die(item.defenceRoll, "Defence die") + '</div><div class="resolution-copy"><h2>' + headline + "</h2>" +
        '<p class="formula">Attack total ' + item.attackTotal + " = strength " + item.attackStrength + " + die " + item.attackRoll + " + modifiers " + item.attackModifiers + "</p>" +
        '<p class="formula">Defence total ' + item.defenceTotal + " = strength " + item.defenceStrength + " + die " + item.defenceRoll + " + modifiers " + item.defenceModifiers + "</p>" +
        "<p>" + esc(item.attackerName) + " against " + esc(item.defenderName) + " for " + esc(item.toName) + ".</p>" +
        '<p class="faint">' + notes + "</p><p>" + esc(item.summary) + '</p><button class="btn-quiet" data-act="dismiss">Dismiss</button></div></div>';
    }
    if (item.kind === "allegiance") {
      return '<div class="resolution"><div class="dice">' + die(item.attackRoll, "Persuasion die") + die(item.defenceRoll, "Resistance die") + '</div><div class="resolution-copy"><h2>' + (item.success ? "Allegiance changes" : "Allegiance holds") + "</h2>" +
        '<p class="formula">Persuasion ' + item.persuasion + " = 2 + relation + die " + item.attackRoll + " + profile</p>" +
        '<p class="formula">Resistance ' + item.resistance + " = loyalty + die " + item.defenceRoll + " + strength</p>" +
        "<p>" + esc(item.actorName) + " asked " + esc(item.targetName) + " to join " + esc(item.proposedName) + ".</p>" +
        "<p>" + esc(item.summary) + '</p><p class="faint">' + (item.persuasion === item.resistance ? "A tie keeps the current allegiance. The influence is spent either way." : "The influence is spent either way.") + '</p><button class="btn-quiet" data-act="dismiss">Dismiss</button></div></div>';
    }
    return '<div class="resolution"><div class="resolution-copy"><h2>Hostilities</h2><p>' + esc(item.summary || "Hostilities are open.") + '</p><p class="faint">Opening hostilities has no die. It costs 1 influence and makes attacks legal.</p><button class="btn-quiet" data-act="dismiss">Dismiss</button></div></div>';
  }

  function treatyWord(treaty) {
    if (treaty === "own") return "Your country";
    if (treaty === "allied") return "Allied";
    if (treaty === "cordial") return "Cordial";
    if (treaty === "enemy") return "Enemy";
    if (treaty === "neutral") return "Neutral";
    return "No contact";
  }

  function statusWord(status) {
    if (status === "confirmed") return "Confirmed";
    if (status === "shared") return "Shared";
    if (status === "estimated") return "Estimated";
    if (status === "last-known") return "Last known";
    return "Unknown";
  }

  function visibilityReport(state, countryId, ui) {
    if (!countryId || !rules.assessVisibility) return null;
    const viewer = rules.viewerFor ? rules.viewerFor(state, ui) : rules.viewerOf(state);
    return rules.assessVisibility(state, viewer, countryId);
  }

  function overviewBlock(state, countryId, heading, blurb, ui) {
    const country = state.countries[countryId];
    if (!country) return "";
    const faction = rules.factionById(state, country.factionId);
    const report = visibilityReport(state, countryId, ui);
    const owned = holdingsOf(state, countryId);
    const control = country.eliminated ? "Conquered" : country.control === "human" ? "Human" : country.control === "dormant" ? "Dormant" : "AI · " + country.profile;
    let theatres = "";
    if (!owned.length || country.eliminated) {
      theatres = "<p class=\"faint\">No theatres remain.</p>";
    } else {
      theatres = '<ul class="holding-list">' + owned.map(function (territory) {
        const known = report && report.territories.filter(function (item) { return item.territoryId === territory.id; })[0];
        const strength = !known || known.status === "unknown" ? "strength unknown" : statusWord(known.status) + " strength " + known.forces;
        const supplied = known && known.status === "confirmed" && rules.inSupply(state, territory.id) ? " · in supply" : "";
        return '<li><button type="button" data-act="locate" data-id="' + territory.id + '"><strong>' + esc(territory.name) + "</strong> " + esc(strength + supplied) + "</button></li>";
      }).join("") + "</ul>";
    }
    const money = country.eliminated
      ? "<p>Conquered. Industry and influence are gone with the capital.</p>"
      : (!report || report.resources === "unknown")
        ? "<p>Industry and influence are not shared with you.</p>"
        : '<p class="ledger-money"><span>Industry <strong>' + country.industry + "</strong> <em>" + statusWord(report.resources) + ", cap 12</em></span><span>Influence <strong>" + country.influence + "</strong> <em>cap 6</em></span></p>";
    return '<section class="card ledger"><h2>' + esc(heading) + "</h2>" +
      "<p>" + esc(country.name) + " · " + esc(faction.name) + " · " + esc(control) + "</p>" +
      (blurb ? '<p class="faint">' + esc(blurb) + "</p>" : "") +
      money + theatres + "</section>";
  }

  function turnOverviews(state, ui) {
    const seatId = seatCountryId(state);
    const activeId = state.activeCountryId;
    const seat = seatId && state.countries[seatId] ? state.countries[seatId] : null;
    const active = activeId && state.countries[activeId] ? state.countries[activeId] : null;
    const yoursOnClock = seat && active && seat.id === active.id;
    let html = "";
    if (seat) {
      const heading = yoursOnClock ? "Your turn" : (state.seats.role === "strategist" ? "Your brief" : "Your position");
      const blurb = yoursOnClock
        ? "Forces, industry, and influence for the country you are moving."
        : state.seats.role === "strategist"
          ? "You advise this country. You do not spend its industry or move its forces."
          : "Your country keeps these figures while someone else is on the clock.";
      html += overviewBlock(state, seat.id, heading, blurb, ui);
    }
    if (active && !yoursOnClock) {
      const heading = state.mode === "timeline" ? "On the clock" : "This turn";
      const blurb = active.control === "human"
        ? "Hotseat. You see only what your treaties and the map allow. Taking this seat does not reveal a private roster."
        : "What you can see of the country on the clock. Hidden stacks stay hidden.";
      html += overviewBlock(state, active.id, heading, blurb, ui);
    }
    if (!seat && !active) html += card("Position", "<p>No country is on the clock.</p>");
    return html;
  }

  function resourcePills(state, ui) {
    const country = state.countries[state.activeCountryId];
    if (!country || country.eliminated) return "";
    const report = visibilityReport(state, country.id, ui);
    if (!report || report.resources === "unknown") return "<span class=\"pill\">Resources <strong>hidden</strong></span>";
    let strength = 0;
    holdingsOf(state, country.id).forEach(function (territory) { strength += territory.forces | 0; });
    return "<span class=\"pill\">Industry <strong>" + country.industry + "</strong></span><span class=\"pill\">Influence <strong>" + country.influence + "</strong></span><span class=\"pill\">Strength <strong>" + strength + "</strong></span>";
  }

  function theatreChips(state, ui, actor) {
    if (!actor) return "";
    const report = visibilityReport(state, actor.id, ui);
    const owned = holdingsOf(state, actor.id);
    if (!owned.length) return "";
    return '<div class="holding-chips">' + owned.map(function (territory) {
      const known = report && report.territories.filter(function (item) { return item.territoryId === territory.id; })[0];
      const mark = !known || known.status === "unknown" ? "—" : known.forces;
      const on = ui.selectedId === territory.id ? " on" : "";
      return '<button type="button" class="holding-chip' + on + '" data-act="locate" data-id="' + territory.id + '">' + esc(shortName(territory.id)) + " <strong>" + mark + "</strong></button>";
    }).join("") + "</div>";
  }

  function dispatchPanel(state) {
    const active = state.countries[state.activeCountryId];
    const current = state.log.filter(function (entry) {
      return entry.round === state.round && entry.countryId === state.activeCountryId;
    });
    const shown = (current.length ? current : state.log.slice(-2)).slice(-5);
    const earlier = state.log.filter(function (entry) { return shown.indexOf(entry) === -1; }).slice(-6);
    const line = function (entry) {
      return '<p class="log-line ' + esc(entry.kind || "system") + '">' + esc(entry.text) + "</p>";
    };
    const older = earlier.length
      ? "<details class=\"earlier-log\"><summary>Earlier</summary>" + earlier.slice().reverse().map(line).join("") + "</details>"
      : "";
    return '<section class="dispatch" aria-live="polite"><h2>This turn · ' + esc(active ? active.name : "Waiting") + '</h2><div id="log-list">' +
      shown.slice().reverse().map(line).join("") + older + "</div></section>";
  }

  function boardLedger(state, ui) {
    const seatId = seatCountryId(state);
    const activeId = state.activeCountryId;
    const ids = [];
    if (seatId && state.countries[seatId]) ids.push(seatId);
    if (activeId && state.countries[activeId] && ids.indexOf(activeId) === -1) ids.push(activeId);
    if (!ids.length) return "";
    const blocks = ids.map(function (id) {
      const country = state.countries[id];
      const yours = id === seatId;
      const onClock = id === activeId;
      const label = yours && onClock ? "Your turn" : yours ? (state.seats.role === "strategist" ? "Your brief" : "You") : (state.mode === "timeline" ? "On the clock" : "This turn");
      const owned = holdingsOf(state, id);
      const report = visibilityReport(state, id, ui);
      const chips = owned.map(function (territory) {
        const known = report && report.territories.filter(function (item) { return item.territoryId === territory.id; })[0];
        const mark = !known || known.status === "unknown" ? "—" : known.forces;
        return '<button type="button" class="holding-chip" data-act="locate" data-id="' + territory.id + '">' + esc(shortName(territory.id)) + " <strong>" + mark + "</strong></button>";
      }).join("");
      const money = !report || report.resources === "unknown"
        ? "<span>Resources <strong>unknown</strong></span>"
        : "<span>Industry <strong>" + country.industry + "</strong></span><span>Influence <strong>" + country.influence + "</strong></span>";
      return '<div class="ledger-block' + (onClock ? " on-clock" : "") + '">' +
        '<p class="ledger-head"><span class="swatch" style="background:' + fillFor(state, country) + '"></span><strong>' + esc(label) + " · " + esc(country.name) + "</strong></p>" +
        '<p class="ledger-money">' + money + "</p>" +
        '<div class="holding-chips">' + (chips || '<span class="faint">No theatres</span>') + "</div></div>";
    }).join("");
    return '<div class="board-ledger" aria-label="Forces and currency on the board">' + blocks + "</div>";
  }

  function countryRows(state, ui) {
    const active = state.activeCountryId;
    const inspect = ui && ui.inspectId;
    return state.order.map(function (id) {
      const country = state.countries[id];
      const faction = rules.factionById(state, country.factionId);
      const report = visibilityReport(state, id, ui);
      const control = country.eliminated ? "Conquered" : country.control === "human" ? "Human" : country.control === "dormant" ? "Dormant" : "AI";
      const mark = id === active ? "On the clock" : inspect === id ? "Inspecting" : treatyWord(report ? report.treaty : "none");
      return '<button class="country-row' + (id === active ? " on-clock" : "") + (id === inspect ? " inspecting" : "") + '" data-act="inspect" data-country="' + id + '"><span class="swatch" style="background:' + fillFor(state, country) + '"></span><span><strong>' + esc(country.name) + "</strong><br><span class=\"faint\">" + esc(faction.name) + " · " + esc(control) + " · " + esc(mark) + "</span></span></button>";
    }).join("");
  }

  function rosterBlock(state, report) {
    if (!report) return "<p>Nothing is on record.</p>";
    const catalogue = rules.unitCatalogue || [];
    const totals = {};
    let lines = "";
    report.territories.forEach(function (item) {
      if (item.status === "unknown") {
        lines += "<li><strong>" + esc(item.name || "Theatre") + "</strong> Unknown</li>";
        return;
      }
      if (item.units) {
        const bits = catalogue.filter(function (unit) { return item.units[unit.id]; }).map(function (unit) {
          totals[unit.id] = (totals[unit.id] || 0) + item.units[unit.id];
          return unit.name + " " + item.units[unit.id];
        });
        const when = item.status === "last-known" && item.observed ? " · " + item.observed : "";
        lines += '<li><button type="button" data-act="locate" data-id="' + item.territoryId + '"><strong>' + esc(item.name) + "</strong> " + esc(statusWord(item.status) + " · " + bits.join(", ") + when) + "</button></li>";
        return;
      }
      const when = item.observed ? " · " + item.observed : "";
      lines += '<li><button type="button" data-act="locate" data-id="' + item.territoryId + '"><strong>' + esc(item.name) + "</strong> " + esc(statusWord(item.status) + " strength " + item.forces + ". Types withheld" + when) + "</button></li>";
    });
    const summary = catalogue.filter(function (unit) { return totals[unit.id]; }).map(function (unit) {
      return '<button type="button" class="btn" data-act="highlight-type" data-type="' + unit.id + '">' + esc(unit.name) + " " + totals[unit.id] + "</button>";
    }).join("");
    return (summary ? '<div class="row-actions">' + summary + "</div>" : "") + '<ul class="holding-list">' + lines + "</ul>";
  }

  function playerCard(state, countryId, prominent, ui) {
    const country = state.countries[countryId];
    if (!country) return "";
    const faction = rules.factionById(state, country.factionId);
    const report = visibilityReport(state, countryId, ui);
    const phase = state.phase || "orders";
    const resources = !report || report.resources === "unknown"
      ? "Resources unknown"
      : statusWord(report.resources) + " industry " + country.industry + ", influence " + country.influence;
    const viewer = rules.viewerFor ? rules.viewerFor(state, ui) : null;
    const handoff = prominent && country.control === "human" && viewer !== countryId && ui && ui.privacyAck !== countryId;
    const reveal = handoff
      ? '<p><button class="btn" data-act="reveal-turn">This player is at the keyboard</button></p><p class="faint">Until then, this card stays within the seated player’s treaties.</p>'
      : "";
    return '<section class="card player-card' + (prominent ? " prominent" : "") + '"><h2>' + (prominent ? "On the clock" : "Inspection") + "</h2>" +
      "<p><strong>" + esc(country.name) + "</strong> · " + esc(faction.name) + "</p>" +
      "<p>Phase <strong>" + esc(phase) + "</strong> · " + esc(resources) + "</p>" +
      '<p class="faint">Inspection does not move the turn or give you this country. Labels are confirmed, shared, estimated, or unknown.</p>' +
      reveal +
      rosterBlock(state, report) + "</section>";
  }

  function playerCards(state, ui) {
    const active = state.activeCountryId;
    const inspect = ui.inspectId && state.countries[ui.inspectId] ? ui.inspectId : active;
    let html = playerCard(state, active, true, ui);
    html += '<div class="country-list" aria-label="Inspect a country">' + countryRows(state, ui) + "</div>";
    html += '<p class="faint">The highlighted name is the country on the clock. Another row only changes this inspection.</p>';
    if (inspect && inspect !== active) html += playerCard(state, inspect, false, ui);
    return html;
  }

  function ordersCard(state, ui, actor) {
    if (state.seats.role === "strategist") {
      const buttons = rules.PROFILES.map(function (profile) {
        const on = state.seats.strategistProfile === profile ? " primary" : "";
        return '<button class="btn' + on + '" data-act="recommend" data-profile="' + profile + '">' + esc(profile) + "</button>";
      }).join("");
      const last = state.consult && state.consult.countryId === state.seats.strategistCountryId
        ? "<p>Last consultation: die " + state.consult.roll + ", " + esc(state.consult.mode) + ", using " + esc(state.consult.used) + ".</p>"
        : "<p class=\"faint\">The AI rolls when that country acts. 1–3 accept, 4 adapt, 5–6 ignore.</p>";
      const advance = state.mode === "turn" ? '<button class="btn" data-act="advance-ai">Advance AI turn</button>' : "";
      return card("Strategist", "<p>You advise " + esc(state.countries[state.seats.strategistCountryId].name) + ". You do not move its forces. The recommendation is optional for the AI, and the die is shown.</p><div class=\"row-actions\">" + buttons + "</div>" + last + advance);
    }
    if (state.seats.role === "spectator") {
      return card("Orders", '<p>You are a spectator. You cannot move forces, attack, or change allegiance. Hidden stacks stay hidden.</p>' + (state.mode === "turn" ? '<button class="btn" data-act="advance-ai">Advance AI turn</button>' : ""));
    }
    if (!actor) {
      const active = state.countries[state.activeCountryId];
      const why = state.mode === "timeline" && state.timeline.playing
        ? "The timeline is running. Pause it before issuing orders."
        : "Waiting for " + (active ? active.name : "the next country") + ".";
      const noHuman = !Object.keys(state.countries).some(function (id) {
        return state.countries[id].control === "human" && !state.countries[id].eliminated;
      });
      return card("Orders", "<p>" + esc(why) + "</p>" + (noHuman && state.mode === "turn" ? '<button class="btn" data-act="advance-ai">Advance AI turn</button>' : ""));
    }
    const selected = ui.selectedId && state.territories[ui.selectedId];
    const ownOrders = rules.viewerFor && rules.viewerFor(state, ui) === actor.id;
    let body = '<p class="split"><span>Ordering <strong>' + esc(actor.name) + "</strong></span><span>" + (ownOrders ? actor.industry + " industry · " + actor.influence + " influence" : "Resources hidden on this seat") + "</span></p>";
    body += '<p class="notice">' + esc(nextActionText(state)) + "</p>";
    body += theatreChips(state, ui, actor);
    if (state.mode === "timeline") {
      const humans = Object.keys(state.countries).filter(function (id) {
        return state.countries[id].control === "human" && !state.countries[id].eliminated;
      });
      if (humans.length > 1) {
        body += '<label class="field">Hotseat country<select data-field="command">';
        humans.forEach(function (id) {
          body += '<option value="' + id + '"' + (id === actor.id ? " selected" : "") + ">" + esc(state.countries[id].name) + "</option>";
        });
        body += "</select></label>";
      }
    }
    if (!selected) {
      body += "<p>Select a territory on the board.</p>";
    } else {
      const owner = state.countries[selected.ownerId];
      const look = rules.assessVisibility(state, rules.viewerFor(state, ui), owner.id).territories.filter(function (item) { return item.territoryId === selected.id; })[0];
      const strengthLine = !look || look.status === "unknown" ? "Strength unknown" : statusWord(look.status) + " strength " + look.forces;
      const supplied = selected.ownerId === actor.id && rules.inSupply(state, selected.id);
      body += "<p><strong>" + esc(selected.name) + "</strong> · " + esc(owner.name) + "</p>";
      const unitLine = look && look.units ? " · " + Object.keys(look.units).map(function (id) {
        const spec = (rules.unitCatalogue || []).filter(function (item) { return item.id === id; })[0];
        return (spec ? spec.name : id) + " " + look.units[id];
      }).join(", ") : "";
      body += '<p class="faint">' + esc(strengthLine + unitLine) + " · production " + selected.production + " · strategic value " + selected.strategic + (selected.ownerId === actor.id ? " · " + (supplied ? "in supply" : "out of supply") : "") + (owner.capital === selected.id ? " · capital" : "") + ".</p>";
      const spent = state.spent && state.spent[selected.id];
      if (spent && ownOrders && selected.ownerId === actor.id) body += '<p class="notice">' + esc(selected.name) + " has already " + esc(spent === "attack" ? "attacked" : "moved") + " this turn.</p>";
      if (!ownOrders && actor.control === "human") {
        body += "<p>This human's forces and resources stay hidden until they take the keyboard. Inspection does not change whose turn it is.</p>";
      } else {
      const catalogue = rules.unitCatalogue || [];
      const shown = Math.max(1, ui.amount | 0);
      const gate = rules.canActAs(state, actor.id);
      if (!state.engagement && selected.ownerId === actor.id) {
        const board = rules.destinations ? rules.destinations(state, selected.id) : { legal: [], blocked: [] };
        const quick = [];
        board.legal.forEach(function (option) {
          const verb = option.kind === "attack" ? "Attack" : "Move";
          Object.keys(option.units).forEach(function (unitId) {
            const spec = catalogue.filter(function (item) { return item.id === unitId; })[0];
            if (!spec) return;
            const count = Math.max(1, Math.min(shown, option.units[unitId] | 0));
            const route = option.routes[unitId];
            const label = verb + " " + shortName(option.toId) + " · " + count + " " + spec.name;
            const detail = verb + " " + count + " " + spec.name + " to " + option.name + ", " + route.distance + " movement, " + pathNames(state, route.steps);
            const selection = {};
            selection[unitId] = count;
            const action = option.kind === "attack"
              ? { type: "attack", countryId: actor.id, fromId: selected.id, toId: option.toId, selection: selection }
              : { type: "move", countryId: actor.id, fromId: selected.id, toId: option.toId, selection: selection };
            const verdict = rules.legalAction(state, action);
            const ok = gate.ok && verdict.ok;
            const act = option.kind === "attack" ? "attack" : "move";
            quick.push('<button class="btn quick ' + option.kind + '" data-act="' + act + '" data-to="' + option.toId + '" data-unit="' + unitId + '" data-count="' + count + '" title="' + esc(detail) + '"' + (ok ? "" : " disabled") + ">" + esc(label) + "</button>");
          });
        });
        if (quick.length) body += '<div class="quick-moves">' + quick.join("") + "</div>";
        else body += '<p class="faint">No legal move leaves this theatre.</p>';
        if (board.blocked.length) {
          body += "<details class=\"closed-routes\"><summary>" + board.blocked.length + " destinations are closed</summary>";
          board.blocked.slice(0, 8).forEach(function (option) {
            body += "<p>" + esc(shortName(option.toId)) + ": " + esc(option.reason) + "</p>";
          });
          if (board.blocked.length > 8) body += "<p>" + (board.blocked.length - 8) + " more are out of reach.</p>";
          body += "</details>";
        }
      }
      body += '<label class="field">How many of a type <strong id="amount-label">' + shown + '</strong><input id="amount" type="range" min="1" max="8" value="' + Math.min(shown, 8) + '"></label>';
      const fortify = rules.legalAction(state, { type: "fortify", countryId: actor.id, territoryId: selected.id });
      body += '<details class="build-orders"><summary>Build, fortify, port, base</summary><div class="stack">';
      if (selected.ownerId === actor.id) {
        catalogue.forEach(function (spec) {
          const reinforce = rules.legalAction(state, { type: "reinforce", countryId: actor.id, territoryId: selected.id, unitId: spec.id, amount: 1 });
          if (!reinforce.ok && spec.domain === "sea") return;
          body += buttonOrWhy("reinforce", "Place " + spec.name + " (" + spec.cost + " industry)", gate.ok && reinforce.ok, gate.ok ? reinforce.reason : gate.reason, null, null, ' data-unit="' + spec.id + '" data-count="1"');
        });
      }
      body += buttonOrWhy("fortify", "Fortify (3 industry)", gate.ok && fortify.ok, gate.ok ? fortify.reason : gate.reason);
      if (selected.ownerId === actor.id && rules.sites) {
        const port = rules.legalAction(state, { type: "port", countryId: actor.id, territoryId: selected.id });
        const baseOrder = rules.legalAction(state, { type: "base", countryId: actor.id, territoryId: selected.id });
        body += buttonOrWhy("port", "Port (4 industry)", gate.ok && port.ok, gate.ok ? port.reason : gate.reason);
        body += buttonOrWhy("base", "Base (3 industry)", gate.ok && baseOrder.ok, gate.ok ? baseOrder.reason : gate.reason);
        rules.sites.forGateway(selected.id).forEach(function (site) {
          const explore = rules.legalAction(state, { type: "explore", countryId: actor.id, territoryId: selected.id, siteId: site.id });
          const held = state.sites && state.sites[site.id];
          const verb = held && held.ownerId ? "Seize " : "Explore ";
          body += buttonOrWhy("explore", verb + site.name + " (3 industry, 1 force)", gate.ok && explore.ok, gate.ok ? explore.reason : gate.reason, null, site.id);
        });
      }
      body += "</div></details>";
      if (ownOrders && selected.ownerId === actor.id && selected.id === actor.capital && selected.forces > 0 && (ui.amount | 0) >= selected.forces) {
        body += '<p class="notice">That order would leave the capital with no garrison.</p>';
      }
      }
    }
    if (state.mode === "turn") {
      body += '<label class="checks"><span><input type="checkbox" data-field="stage"' + (ui.stage ? " checked" : "") + "> Stage instead of resolving now</span></label>";
      body += '<p class="faint">Staged orders resolve in order when you end the turn, or if the play clock is set to execute them. A later order can fail if an earlier one spent the resource.</p>';
      const queue = state.orderQueue || [];
      if (queue.length) {
        body += queue.map(function (action, index) {
          return '<div class="queue-row"><span></span><span>' + esc(orderLabel(state, action)) + '</span><button class="btn-quiet" data-act="unstage" data-index="' + index + '">Remove</button></div>';
        }).join("");
        body += '<div class="row-actions"><button class="btn" data-act="commit">Resolve staged orders</button><button class="btn-quiet" data-act="clear-queue">Clear</button></div>';
      }
      body += '<button class="btn primary" data-act="end-turn">End turn</button>';
    }
    if (ui.notice) body += '<p class="notice">' + esc(ui.notice) + "</p>";
    return card("Orders", body);
  }

  function buttonOrWhy(act, label, ok, reason, to, site, extra) {
    const attr = (to ? ' data-to="' + to + '"' : "") + (site ? ' data-site="' + site + '"' : "") + (extra || "");
    if (ok) return '<button class="btn" data-act="' + act + '"' + attr + ">" + esc(label) + "</button>";
    return '<button class="btn" data-act="' + act + '"' + attr + ' disabled>' + esc(label) + '</button><p class="faint">' + esc(reason || "Not available.") + "</p>";
  }

  function stackLabel(selection) {
    if (!selection) return "units";
    return Object.keys(selection).map(function (id) {
      const spec = (rules.unitCatalogue || []).filter(function (item) { return item.id === id; })[0];
      return (spec ? spec.name : id) + " " + selection[id];
    }).join(", ");
  }

  function nextActionText(state) {
    const engagement = state.engagement;
    if (engagement && engagement.status === "casualties" && engagement.pending) {
      const who = state.countries[engagement.pending.side === "defender" ? engagement.defenderId : engagement.countryId];
      return "Next: " + (who ? who.name : "A player") + " chooses " + engagement.pending.must + (engagement.pending.must === 1 ? " casualty. The turn stays with the attacker." : " casualties. The turn stays with the attacker.");
    }
    if (engagement && engagement.status === "decision") {
      return "Next: continue the battle, retreat to a legal theatre, or auto-resolve.";
    }
    const queue = state.orderQueue || [];
    if (queue.length) return "Next: resolve " + queue.length + " staged order" + (queue.length === 1 ? "" : "s") + ", or end the turn.";
    return "Phase: orders. Select a theatre, then a unit move or attack. End the turn when nothing remains.";
  }

  function pathNames(state, steps) {
    return (steps || []).map(function (id) {
      return state.territories[id] ? state.territories[id].name : id;
    }).join(" → ");
  }

  function orderLabel(state, action) {
    if (action.type === "reinforce") {
      const spec = (rules.unitCatalogue || []).filter(function (item) { return item.id === (action.unitId || "infantry"); })[0];
      return "Place " + (spec ? spec.name : "infantry") + " in " + state.territories[action.territoryId].name;
    }
    if (action.type === "fortify") return "Fortify " + state.territories[action.territoryId].name;
    if (action.type === "move") return "Move " + stackLabel(action.selection) + " to " + state.territories[action.toId].name;
    if (action.type === "attack") return "Attack " + state.territories[action.toId].name + " with " + stackLabel(action.selection);
    if (action.type === "openHostilities") return "Open hostilities with " + state.countries[action.targetCountryId].name;
    if (action.type === "allegiance") return "Propose " + state.countries[action.targetCountryId].name + " join " + rules.factionName(state, action.proposedFactionId);
    if (action.type === "port") return "Port on " + state.territories[action.territoryId].name;
    if (action.type === "base") return "Base on " + state.territories[action.territoryId].name;
    if (action.type === "explore") {
      const site = rules.sites && rules.sites.byId[action.siteId];
      return (site ? site.name : "Ground") + " from " + state.territories[action.territoryId].name;
    }
    return action.type;
  }

  function diplomacyCard(state, ui, actor) {
    if (!actor) {
      return card("Diplomacy", "<p class=\"faint\">Allegiance changes and declarations appear here when you can act. " + (state.seats.role === "spectator" ? "Spectators cannot propose them." : "Wait until you can give orders.") + "</p>");
    }
    const targetId = ui.diploTarget && state.countries[ui.diploTarget] ? ui.diploTarget : Object.keys(state.countries).filter(function (id) { return id !== actor.id && !state.countries[id].eliminated; })[0];
    const factionId = ui.diploFaction && rules.factionById(state, ui.diploFaction) ? ui.diploFaction : actor.factionId;
    let options = "";
    Object.keys(state.countries).forEach(function (id) {
      if (id === actor.id || state.countries[id].eliminated) return;
      options += '<option value="' + id + '"' + (id === targetId ? " selected" : "") + ">" + esc(state.countries[id].name) + "</option>";
    });
    let factions = "";
    state.factions.forEach(function (faction) {
      factions += '<option value="' + faction.id + '"' + (faction.id === factionId ? " selected" : "") + ">" + esc(faction.name) + "</option>";
    });
    const preview = targetId ? rules.previewAllegiance(state, actor.id, targetId, factionId) : { ok: false, reason: "Choose a country.", lines: [] };
    const war = targetId ? rules.previewHostilities(state, actor.id, targetId) : { ok: false, reason: "Choose a country.", lines: [] };
    const rel = targetId ? rules.relation(state, actor.id, targetId) : 0;
    const lines = (preview.lines || []).map(function (line) { return "<p>" + esc(line) + "</p>"; }).join("");
    const warLines = (war.lines || []).map(function (line) { return "<p>" + esc(line) + "</p>"; }).join("");
    return card("Diplomacy",
      '<label class="field">Country<select data-field="diplo-target">' + options + "</select></label>" +
      '<label class="field">Proposed allegiance<select data-field="diplo-faction">' + factions + "</select></label>" +
      (targetId ? "<p>Relation now: " + rel + " (" + relationWord(rel) + ").</p>" : "") +
      lines +
      '<button class="btn" data-act="propose"' + (preview.ok ? "" : " disabled") + ">Propose allegiance (2 influence)</button>" +
      (preview.ok ? "" : '<p class="faint">' + esc(preview.reason) + "</p>") +
      warLines +
      '<button class="btn" data-act="open-war"' + (war.ok ? "" : " disabled") + ">Open hostilities (1 influence)</button>" +
      (war.ok ? "" : '<p class="faint">' + esc(war.reason) + "</p>"));
  }

  function modeCard(state) {
    if (state.mode === "timeline") {
      const speeds = [1, 2, 4, 8].map(function (speed) {
        return '<button class="btn' + (state.timeline.speed === speed ? " primary" : "") + '" data-act="speed" data-speed="' + speed + '">' + speed + "×</button>";
      }).join("");
      const toggle = state.timeline.playing
        ? '<button class="btn primary" data-act="pause">Pause</button>'
        : '<button class="btn primary" data-act="play">Play</button>';
      return card("Timeline",
        "<p>Each tick, one AI country takes one legal action. After every AI country has acted, the season changes. After winter, the year advances and spring production is paid.</p>" +
        "<p><strong>" + esc(state.seasons[state.season]) + " " + state.year + "</strong> · " + (state.timeline.playing ? "Running" : "Paused") + "</p>" +
        '<div class="row-actions">' + toggle + speeds + "</div>" +
        '<p class="faint">1× waits 1.6 seconds. 2×, 4×, and 8× divide that wait. Timeline speed is not the turn-mode play clock. Pause stays available at every speed.</p>');
    }
    const rule = expiryName(state.settings.clockRule);
    const clock = state.settings.clockEnabled
      ? "Local play clock: " + clockLabel(state.settings.clockSeconds) + " on each human turn. One warning fires as the time runs down. If it expires, the rule is: " + rule + ". Two human seats can veto that. The timed-out country then stays in the war, gives no orders, and still rolls a defence die if attacked."
      : "Local play clock is off. A human turn ends when you press End turn.";
    const vetoes = state.clock && state.clock.vetoes || [];
    let veto = "";
    if (state.settings.clockEnabled) {
      const humans = state.order.filter(function (id) {
        const country = state.countries[id];
        return country && country.control === "human" && !country.eliminated;
      });
      veto = '<p class="faint">Vetoes this turn: ' + vetoes.length + " of 2.</p>";
      if (humans.length < 2) {
        veto += '<p class="faint">A veto needs two human seats. This table has fewer than two.</p>';
      } else {
        veto += humans.map(function (id) {
          const done = vetoes.indexOf(id) !== -1;
          return '<button class="btn" data-act="veto" data-country="' + id + '"' + (done ? " disabled" : "") + ">Veto as " + esc(state.countries[id].name) + "</button>";
        }).join("");
      }
      state.order.forEach(function (id) {
        const country = state.countries[id];
        if (country && country.inactive) veto += '<button class="btn" data-act="restore" data-country="' + id + '">Restore ' + esc(country.name) + "</button>";
      });
    }
    return card("Turn order",
      "<p>Countries act in the scenario order, rotated so your seat goes first. AI countries use the same orders you do.</p>" +
      "<p>" + esc(clock) + "</p>" +
      veto +
      '<p class="faint">The play clock is a per-turn deadline, from 30 seconds to a week. It does not change how fast a timeline would run. Closing the table does not reset a week; the deadline is a time of day.</p>');
  }

  function seatCard(state) {
    const role = state.seats.role === "strategist"
      ? "Strategist for " + state.countries[state.seats.strategistCountryId].name
      : state.seats.role === "spectator"
        ? "Spectator"
        : "Player for " + (state.countries[state.seats.playerCountryId] ? state.countries[state.seats.playerCountryId].name : "an open seat");
    let extra = "<p>Local seat: <strong>" + esc(role) + "</strong>. Spectators " + (state.settings.allowSpectators ? "are" : "are not") + " allowed. Strategists " + (state.settings.allowStrategists ? "are" : "are not") + " allowed.</p>";
    if (state.seats.role === "player" && state.settings.allowSpectators) {
      extra += '<button class="btn-quiet" data-act="leave">Leave seat</button><p class="faint">Your country passes to AI if AI is enabled, otherwise it goes dormant. The campaign stays on this machine.</p>';
    }
    if (state.seats.role !== "player" && state.seats.originalPlayerCountryId && state.countries[state.seats.originalPlayerCountryId] && !state.countries[state.seats.originalPlayerCountryId].eliminated) {
      extra += '<button class="btn" data-act="rejoin">Rejoin ' + esc(state.countries[state.seats.originalPlayerCountryId].name) + "</button>";
    }
    extra += '<p class="faint">Online player, strategist, and spectator seats need a server. This build does not open a room.</p>';
    extra += '<button class="btn-quiet" data-act="online">Online rooms — not connected</button>';
    return card("Seat", extra);
  }

  function game(state, ui) {
    const actorId = actingId(state, ui);
    const actor = actorId ? state.countries[actorId] : null;
    const active = state.countries[state.activeCountryId];
    const anime = state.presentation === "anime";
    const status = [];
    status.push("<span class=\"pill\"><strong>" + esc(state.eraName) + "</strong> " + esc(state.seasons[state.season] || "Spring") + " " + state.year + "</span>");
    if (state.mode === "timeline") {
      status.push("<span class=\"pill\">Timeline · " + esc(state.seasons[state.season]) + " · " + state.timeline.speed + "× · " + (state.timeline.playing ? "running" : "paused") + "</span>");
    } else if (active) {
      const who = active.control === "human" ? "your order" : active.control === "ai" ? "AI · " + active.profile : "dormant";
      const phase = state.engagement ? "Battle" : (state.phase === "orders" ? "Orders" : "Turn");
      status.push("<span class=\"pill\">" + phase + " · <strong>" + esc(active.name) + "</strong> · " + esc(who) + " · round " + state.round + "</span>");
      if (state.settings.clockEnabled && active.control === "human") {
        const warnAt = state.clock && state.clock.warnAt || 10;
        const warn = state.clock.remaining <= warnAt ? " warn" : "";
        status.push('<span class="pill' + warn + '" id="clock-readout">Play clock <strong>' + clockLabel(state.clock.remaining) + "</strong></span>");
      }
    }
    status.push("<span class=\"pill\">" + esc(state.seats.role) + "</span>");
    status.push(resourcePills(state, ui));
    const plateCountry = actor || active || state.countries[state.order[0]];
    const faction = rules.factionById(state, plateCountry.factionId);
    const plate = anime ? portrait(plateCountry, faction.color) : sigil(plateCountry, faction.color);
    let winner = "";
    if (state.winner && !state.winner.continued) {
      winner = card("Victory", "<p>" + esc(state.winner.reason) + '</p><div class="row-actions"><button class="btn primary" data-act="continue">Continue this era</button>' + (state.nextEraId ? '<button class="btn" data-act="ask-next">Start next era</button>' : "") + "</div>");
    }
    const hotseat = actor && state.seats.playerCountryId && actor.id !== state.seats.playerCountryId
      ? '<p class="notice">Hotseat. Pass this machine to ' + esc(actor.name) + ".</p>" : "";
    const html = '<div class="shell">' +
      '<header class="topbar"><div class="brand">' + mark() + "<div><h1>FAULTLINES</h1><p>" + (anime ? "2D anime board" : "Strategy board") + "</p></div></div>" +
      '<div class="top-status">' + status.join("") + "</div>" +
      '<div class="top-actions">' +
      '<button class="btn" data-act="presentation">' + (anime ? "Strategy board" : "2D anime") + "</button>" +
      '<button class="btn-quiet" data-act="new-game">New</button>' +
      '<button class="btn-quiet" data-act="save">Save</button>' +
      '<button class="btn-quiet" data-act="load-open">Load</button>' +
      '<button class="btn-quiet" data-act="rules">Rules</button>' +
      "</div></header>" +
      '<div class="stage"><div class="map-column"><div class="map-frame"><div id="map-slot"></div>' +
      '<div class="zoom-bar"><button type="button" class="btn" data-act="zoom-in" aria-label="Zoom in">+</button>' +
      '<button type="button" class="btn" data-act="zoom-out" aria-label="Zoom out">−</button>' +
      '<button type="button" class="btn" data-act="zoom-fit" aria-label="Fit the world">Fit</button>' +
      '<button type="button" class="btn" data-act="focus" aria-label="Show this turn">Turn</button>' +
      '<span id="zoom-readout">100%</span></div></div>' +
      displayBar(ui) +
      "</div><aside class=\"side\" id=\"side\">" +
      winner + hotseat +
      (state.mode === "timeline" ? modeCard(state) : "") +
      resolution(state, ui) +
      ordersCard(state, ui, actor) +
      dispatchPanel(state) +
      "<details class=\"more-table\"><summary>Position, countries, and diplomacy</summary>" +
      turnOverviews(state, ui) +
      diplomacyCard(state, ui, actor) +
      card("Countries", playerCards(state, ui)) + seatCard(state) +
      card("Era", "<p><strong>" + esc(state.eraName) + "</strong> · horizon " + state.endYear + "</p><p>" + esc(state.techNote) + "</p><p class=\"faint\">" + esc(state.political) + "</p>" +
        (state.year >= state.endYear ? '<p class="notice">The marked horizon is ' + state.endYear + ". The scenario does not change by itself.</p>" : "") +
        (state.legacyNote ? "<p>" + esc(state.legacyNote) + "</p>" : "") +
        (state.chronicle.length ? "<p class=\"faint\">Chronicle entries: " + state.chronicle.length + ".</p>" : "") +
        (state.nextEraId ? '<button class="btn" data-act="ask-next">Start next era</button>' : '<p class="faint">The Lattice War is the last scenario in this edition.</p>') +
        '<p class="faint">Next era resets forces, ownership, allegiance, industry, and the year. It keeps the chronicle, seat, mode, presentation, and AI settings.</p>') +
      "</details></aside></div>" +
      modal(ui) + "</div>";
    return html;
  }

  function mark() {
    return '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="8" fill="#1b140e"/><path d="M8 18h48M10 40l14-16 8 10 10-18 12 24" fill="none" stroke="#c6ad7a" stroke-width="3"/></svg>';
  }

  function setup(ui) {
    const setupState = ui.setup;
    const era = eras.ERAS[setupState.eraId];
    const eraCards = Object.keys(eras.ERAS).map(function (id) {
      const item = eras.ERAS[id];
      return '<button class="era-card' + (id === era.id ? " on" : "") + '" data-act="era" data-era="' + id + '"><h2>' + esc(item.name) + '</h2><p class="faint">' + item.startYear + (item.endYear ? "–" + item.endYear : "") + '</p><p>' + esc(item.political) + "</p></button>";
    }).join("");
    const countries = era.countries.map(function (country) {
      const faction = era.factions.filter(function (f) { return f.id === country.factionId; })[0];
      const yours = setupState.role === "player" && setupState.playerCountryId === country.id;
      const control = setupState.countryControl[country.id] || "ai";
      const select = yours ? "<span>You</span>" : '<select data-field="control" data-country="' + country.id + '">' +
        ["ai", "human", "dormant"].map(function (value) {
          const label = value === "ai" ? "AI" : value === "human" ? "Human hotseat" : "Dormant";
          return '<option value="' + value + '"' + (control === value ? " selected" : "") + ">" + label + "</option>";
        }).join("") + "</select>";
      return '<label class="country-pick"><input type="radio" name="player" data-field="player" value="' + country.id + '"' + (setupState.playerCountryId === country.id ? " checked" : "") + (setupState.role === "player" ? "" : " disabled") + '><span><strong>' + esc(country.name) + '</strong><br><span class="faint">' + esc(faction.name) + " · " + esc(country.profile) + "</span></span>" + select + "</label>";
    }).join("");
    const strategistOptions = era.countries.map(function (country) {
      return '<option value="' + country.id + '"' + (setupState.strategistCountryId === country.id ? " selected" : "") + ">" + esc(country.name) + "</option>";
    }).join("");
    const profiles = rules.PROFILES.map(function (profile) {
      return '<option value="' + profile + '"' + (setupState.strategistProfile === profile ? " selected" : "") + ">" + esc(profile) + "</option>";
    }).join("");
    const endYear = era.endYear || era.startYear;
    const years = [];
    for (let year = era.startYear; year <= endYear; year += 1) years.push(year);
    const startYear = years.indexOf(Number(setupState.startYear)) === -1 ? era.startYear : Number(setupState.startYear);
    const seasons = ["Spring", "Summer", "Autumn", "Winter"];
    const startSeason = seasons[setupState.startSeason] ? setupState.startSeason : 0;
    const yearOptions = years.map(function (year) {
      return '<option value="' + year + '"' + (year === startYear ? " selected" : "") + ">" + year + "</option>";
    }).join("");
    const seasonOptions = seasons.map(function (name, index) {
      return '<option value="' + index + '"' + (index === startSeason ? " selected" : "") + ">" + name + "</option>";
    }).join("");
    return '<div class="setup"><header class="setup-bar"><div class="brand">' + mark() + "<div><h1>FAULTLINES</h1><p>A world at war, on the table.</p></div></div></header>" +
      "<p class=\"lede\">Choose an era, a mode, and a seat. The first scenario is ready to play. The other two use the same rules with their own countries and politics.</p>" +
      (ui.notice ? '<p class="notice">' + esc(ui.notice) + "</p>" : "") +
      (ui.resumeOk ? '<p><button class="btn primary" data-act="resume">Resume saved campaign</button></p>' : "") +
      (ui.resumeError ? '<p class="notice">' + esc(ui.resumeError) + "</p>" : "") +
      card("Era", '<div class="era-grid">' + eraCards + "</div>") +
      card("Start date", '<div class="date-row"><label class="field">Season<select data-field="start-season">' + seasonOptions + "</select></label>" +
        '<label class="field">Year<select data-field="start-year">' + yearOptions + "</select></label></div>" +
        '<p class="faint">The campaign opens on ' + seasons[startSeason] + " " + startYear + ", before the first order. The countries and politics stay those of " + esc(era.name) + ". The horizon is still " + endYear + ".</p>") +
      card("Mode", '<div class="choice-grid two">' +
        choice("mode", "turn", "Turn-based", "Countries act in order. You end your turn. A local play clock can pass, execute staged orders, or hand the rest to AI.", setupState.mode === "turn") +
        choice("mode", "timeline", "Timeline", "AI acts on ticks while you watch. Pause to give orders. Speed is 1×, 2×, 4×, or 8×, separate from the play clock.", setupState.mode === "timeline") +
        "</div>") +
      card("Seat", '<div class="choice-grid">' +
        choice("role", "player", "Player", "Command a country. Other countries can be AI, a hotseat human, or dormant.", setupState.role === "player") +
        choice("role", "strategist", "Strategist", "Recommend a profile. The AI rolls a die and may accept, adapt, or ignore it.", setupState.role === "strategist", !setupState.allowStrategists) +
        choice("role", "spectator", "Spectator", "Watch the open board. You cannot change the campaign.", setupState.role === "spectator", !setupState.allowSpectators) +
        "</div>" +
        '<div class="checks"><label><input type="checkbox" data-field="allow-spectators"' + (setupState.allowSpectators ? " checked" : "") + "> Allow spectators</label>" +
        '<label><input type="checkbox" data-field="allow-strategists"' + (setupState.allowStrategists ? " checked" : "") + "> Allow strategists</label></div>" +
        (setupState.role === "strategist" ? '<label class="field">Advise<select data-field="strategist">' + strategistOptions + "</select></label><label class=\"field\">Recommendation<select data-field=\"strategist-profile\">" + profiles + "</select></label>" : "") +
        '<div class="country-picks">' + countries + "</div>") +
      card("AI and clock",
        '<label class="checks"><input type="checkbox" data-field="ai"' + (setupState.aiEnabled ? " checked" : "") + "> AI countries act</label>" +
        '<label class="field">AI risk ' + setupState.risk + '<input type="range" min="0" max="100" data-field="risk" value="' + setupState.risk + '"></label>' +
        '<p class="faint">Risk changes how thin a chance the AI will accept. Dice stay the only hidden numbers, and they are shown.</p>' +
        (setupState.mode === "turn"
          ? '<label class="checks"><input type="checkbox" data-field="clock"' + (setupState.clockEnabled ? " checked" : "") + "> Local play clock</label>" +
            '<label class="field">Time for a human turn<select data-field="clock-seconds">' + (rules.CLOCK_CHOICES || rules.CLOCK_SECONDS.map(function (n) { return { seconds: n, label: String(n) }; })).map(function (choice) {
              return '<option value="' + choice.seconds + '"' + (Number(setupState.clockSeconds) === choice.seconds ? " selected" : "") + ">" + esc(choice.label) + "</option>";
            }).join("") + "</select></label>" +
            '<label class="field">If time expires<select data-field="clock-rule"><option value="pass"' + (setupState.clockRule === "pass" ? " selected" : "") + '>Auto-pass</option><option value="queue"' + (setupState.clockRule === "queue" ? " selected" : "") + '>Execute staged orders</option><option value="ai"' + (setupState.clockRule === "ai" ? " selected" : "") + ">Hand the rest to AI</option></select></label>" +
            '<p class="faint">From 30 seconds to a week. Two human seats can veto an expiry. The timed-out country then gives no orders, keeps automatic collection, and still rolls if attacked. This clock is not the timeline speed.</p>'
          : '<p class="faint">Timeline speed is chosen on the board after the campaign starts. It is not this clock.</p>') +
        '<div class="choice-grid two">' +
        choice("presentation", "board", "Strategy board", "Felt, brass, and counters. The default table.", setupState.presentation !== "anime") +
        choice("presentation", "anime", "2D anime", "Same rules and state. Original portrait plates and diamond tokens.", setupState.presentation === "anime") +
        "</div>") +
      '<div class="row-actions"><button class="btn primary" data-act="start">Begin campaign</button><button class="btn-quiet" data-act="rules">Rules</button><button class="btn-quiet" data-act="online">Online rooms — not connected</button></div>' +
      modal(ui) + "</div>";
  }

  function choice(field, value, title, text, on, disabled) {
    return '<button class="choice' + (on ? " on" : "") + '" data-act="' + field + '" data-value="' + value + '"' + (disabled ? " disabled" : "") + "><strong>" + esc(title) + "</strong><p class=\"faint\">" + esc(text) + (disabled ? " The host turned this seat off." : "") + "</p></button>";
  }

  function rulesHtml() {
    return '<div class="modal" role="dialog" aria-labelledby="rules-title"><h2 id="rules-title">Rules</h2>' +
      "<p>FAULTLINES keeps treaty visibility. You see your own stacks exactly. An ally shares them. A cordial neighbour shares strength and withholds types. A neighbour you do not share with is an estimate. Anything farther is unknown, until a battle puts the units that actually rolled on the table.</p>" +
      "<h3>Map</h3><p>The drawing is Natural Earth 1:10m coastlines and modern country borders, which are in the public domain. Sixteen theatre colours sit on that map. They are the spaces the rules use. Zoom and pan do not change adjacency, supply, or combat.</p>" +
      "<h3>Display</h3><p>The bar under the map stays off the board. One draws one model of each unit type present. Many draws up to three of that type. Names switch from a short label to the theatre name as you zoom in, then give way to city labels. Sea lanes, the grid, and the exploration sites can be hidden. Side and Top change the piece view. Display does not change the stacks.</p>" +
      "<h3>Position</h3><p>The top of the table shows industry, influence, and strength for the country on the clock. The side lists quick moves for the selected theatre and the notes from this turn. Position, the other countries, and diplomacy stay one step further down. Industry pays for new units and fortify. Influence pays for allegiance and opening hostilities. A theatre out of supply is listed and adds nothing to income.</p>" +
      "<h3>Resources</h3><ul><li>Industry is collected from supplied territories at the start of a turn, or each spring in timeline mode. The stockpile caps at 12.</li><li>Each unit has its own industry cost. Infantry is 2. A new unit is placed on a supplied theatre you own. Ships need a coast.</li><li>Fortify costs 3 industry and adds 1 defence, to a maximum of 3.</li><li>Influence rises by 1 at the same time, to a maximum of 6. Allegiance costs 2. Opening hostilities costs 1.</li></ul>" +
      "<h3>Supply</h3><p>A territory is in supply when you can trace a path of your own territories, including sea lanes, back to your capital. Out of supply, it produces nothing, cannot be reinforced, and cannot attack. Its defence rolls take −1. If the capital falls, the country is conquered and its other territories transfer.</p>" +
      "<h3>Movement and war</h3><p>Each order moves or attacks with the units you choose. Land units use land borders, ships use sea lanes, and aircraft can use either. A unit can cross as many theatres as its movement allows, and the theatres in between must be yours, except aircraft. One order leaves each origin each turn. Attacks require open hostilities. Same-faction countries are allies and cannot attack one another. A neighbour at relation 0, including the 1939 German–Soviet pact, is not a legal target until someone opens hostilities. Declaring against a non-aligned country from a war faction brings that country into the opposing alliance.</p>" +
      "<h3>Combat</h3><p>A battle continues in rounds until one side is eliminated or the attacker retreats. Each unit rolls one D6 and hits on that roll or less, using its own attack or defence. Modifiers, the same for a human and the AI, are the era attack bonus, the mass-commitment bonus, fortification times the era fort factor, the capital bonus, a base, and −1 when the defender is out of supply. The total needed to hit is never above 6, and a value below 1 cannot hit. The owner of the damaged units chooses which units are lost. An AI country, an inactive seat, and auto-resolve remove the weakest unit first: lowest strength, then lowest cost. If both sides remain, the attacker may continue, auto-resolve, or retreat. A retreat destination must be a theatre the attacker owns, and every surviving unit must have a legal route there from the battle. Auto-resolve and the AI keep fighting while their remaining strength is at least the defender's, for at most 8 rounds, then retreat by the shortest legal route, preferring the theatre they left. They never retreat on an illegal route. If no retreat exists after that, the attackers are lost. Occupation happens only when the defenders are gone, and only the surviving attackers move in.</p>" +
      "<h3>Diplomacy</h3><p>Persuasion = 2 + relation + one D6 + 1 if your profile is diplomatic. Resistance = loyalty + one D6 + a strength advantage up to 3. Higher persuasion changes allegiance and rebuilds that country's relations. A tie refuses. The influence is spent either way.</p>" +
      "<h3>Modes</h3><p>Turn mode walks the country order. Timeline mode lets each AI country take one action per tick, then advances the season. Four seasons make a year. The speeds 1×, 2×, 4×, and 8× change only the wait between ticks. The play clock is a separate countdown. You can always pause a timeline.</p>" +
      "<p>Before the campaign starts, choose the season and year. The choice has to sit inside the era. A summer opening in timeline mode does not pay that year's spring income again. The play clock, from 30 seconds to a week, is separate. Two human seats can veto an expiry: that country then gives no orders, and a defence die is still rolled if it is attacked.</p>" +
      "<h3>Eras</h3><p>1914, 1939, and 2045 are separate scenarios. Starting the next era does not pretend the armies carried over. It keeps the chronicle, seat, mode, presentation, and AI settings. If your faction held the most territories, your heir starts with 1 extra influence. Everything else is the new scenario.</p>" +
      "<h3>AI</h3><p>Each country has a profile: defensive, expansionist, industrial, diplomatic, or opportunistic. It reinforces, moves, attacks, fortifies, or negotiates only through legal orders. Risk, set at the start, widens what it will attempt. A strategist's advice is accepted on a die of 1–3, adapted on 4, and ignored on 5–6.</p>" +
      '<button class="btn" data-act="close-modal">Close</button></div>';
  }

  function onlineHtml() {
    return '<div class="modal" role="dialog" aria-labelledby="online-title"><h2 id="online-title">Online rooms are not connected</h2>' +
      "<p>This edition has no authoritative server, so it does not invent a room code or a shared match. Local seats are real: player, strategist, and spectator behave on this machine, and the host chooses whether spectators and strategists are allowed.</p>" +
      "<p>The campaign state is a plain object. Orders go through applyAction, battles through resolveCombat, and the clock rule is stored with the campaign. A server can own that object later. See docs/ONLINE.md for the room, timer, reconnect, and dice work that is still required.</p>" +
      '<button class="btn" data-act="close-modal">Close</button></div>';
  }

  function modal(ui) {
    if (!ui.modal) return "";
    let inner = "";
    if (ui.modal === "rules") inner = rulesHtml();
    else if (ui.modal === "online") inner = onlineHtml();
    else if (ui.modal === "load") {
      inner = '<div class="modal" role="dialog"><h2>Load</h2><p>Resume the campaign in this browser, or open a JSON file from a previous save.</p>' +
        (ui.resumeOk ? '<button class="btn primary" data-act="resume">Resume browser save</button>' : '<p class="faint">No valid browser save is waiting.</p>') +
        '<p><input id="file-load" type="file" accept="application/json,.json"></p>' +
        (ui.notice ? '<p class="notice">' + esc(ui.notice) + "</p>" : "") +
        '<button class="btn-quiet" data-act="close-modal">Close</button></div>';
    } else if (ui.modal === "next") {
      inner = '<div class="modal" role="dialog"><h2>Start the next era</h2><p>Forces, ownership, allegiance, relations, industry, and the year reset to the next scenario. The chronicle, seat, presentation, mode, and AI settings stay. A winning faction on territory leaves 1 influence to its heir.</p><div class="row-actions"><button class="btn primary" data-act="confirm-next">Start next era</button><button class="btn-quiet" data-act="close-modal">Stay</button></div></div>';
    } else if (ui.modal === "abandon") {
      inner = '<div class="modal" role="dialog"><h2>New campaign</h2><p>Leave the table and return to setup. The browser save remains until a new campaign starts and writes over it.</p><div class="row-actions"><button class="btn primary" data-act="confirm-new">Return to setup</button><button class="btn-quiet" data-act="close-modal">Keep playing</button></div></div>';
    }
    return '<div class="modal-back">' + inner + "</div>";
  }

  const api = { setup: setup, game: game, actingId: actingId, mapSvg: mapSvg, paintMap: paintMap, syncMapZoom: syncMapZoom };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.FLRender = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
