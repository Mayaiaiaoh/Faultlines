(function (g) {
  "use strict";

  function load(path, key) {
    if (typeof module !== "undefined" && module.exports && typeof require === "function") return require(path);
    return g[key];
  }

  const map = load("./map", "FLMap");
  const sites = load("./sites", "FLSites");

  // Stacks are the game data. territory.forces is derived from them.
  // attack and defence are the D6 the unit hits on (roll that number or less). 0 cannot hit.
  // move is how many theatres this order may cross. Land stays on land edges,
  // sea on sea lanes, air on either.
  const CATALOGUE = [
    { id: "infantry", name: "Infantry", domain: "land", attack: 1, defence: 2, move: 1, cost: 2, strength: 1 },
    { id: "artillery", name: "Artillery", domain: "land", attack: 2, defence: 2, move: 1, cost: 4, strength: 2 },
    { id: "armour", name: "Armour", domain: "land", attack: 3, defence: 3, move: 2, cost: 6, strength: 3 },
    { id: "fighter", name: "Fighter", domain: "air", attack: 3, defence: 4, move: 2, cost: 6, strength: 2 },
    { id: "bomber", name: "Bomber", domain: "air", attack: 4, defence: 1, move: 3, cost: 8, strength: 3 },
    { id: "transport", name: "Transport", domain: "sea", attack: 0, defence: 1, move: 2, cost: 4, strength: 1 },
    { id: "submarine", name: "Submarine", domain: "sea", attack: 2, defence: 1, move: 2, cost: 4, strength: 2 },
    { id: "destroyer", name: "Destroyer", domain: "sea", attack: 2, defence: 2, move: 2, cost: 6, strength: 2 },
    { id: "carrier", name: "Carrier", domain: "sea", attack: 1, defence: 2, move: 2, cost: 10, strength: 3 },
    { id: "battleship", name: "Battleship", domain: "sea", attack: 4, defence: 4, move: 2, cost: 12, strength: 4 }
  ];

  const byId = {};
  CATALOGUE.forEach(function (unit) { byId[unit.id] = unit; });

  function coastal(id) {
    return !!(sites.coastal && sites.coastal(id));
  }

  function cloneUnits(units) {
    const copy = {};
    if (!units) return copy;
    Object.keys(units).forEach(function (id) {
      const count = units[id] | 0;
      if (count > 0 && byId[id]) copy[id] = count;
    });
    return copy;
  }

  function strengthOf(units) {
    let total = 0;
    if (!units) return 0;
    Object.keys(units).forEach(function (id) {
      const spec = byId[id];
      if (spec) total += spec.strength * (units[id] | 0);
    });
    return total;
  }

  function compose(budget, isCoastal) {
    const units = {};
    let left = Math.max(0, budget | 0);
    const order = isCoastal
      ? ["destroyer", "fighter", "artillery", "submarine", "transport", "armour", "bomber", "carrier", "battleship"]
      : ["armour", "artillery", "fighter", "bomber"];
    order.forEach(function (id) {
      const spec = byId[id];
      if ((id === "battleship" || id === "carrier") && left < spec.strength + 2) return;
      if (left >= spec.strength) {
        units[id] = 1;
        left -= spec.strength;
      }
    });
    if (left > 0) units.infantry = left;
    return units;
  }

  function countOf(units) {
    let total = 0;
    if (!units) return 0;
    Object.keys(units).forEach(function (id) {
      if (byId[id]) total += units[id] | 0;
    });
    return total;
  }

  function weakestFirst() {
    return CATALOGUE.slice().sort(function (a, b) {
      return a.strength - b.strength || a.cost - b.cost;
    });
  }

  function canPlace(unitId, territoryId) {
    const spec = byId[unitId];
    if (!spec) return false;
    if (spec.domain === "sea") return coastal(territoryId);
    return true;
  }

  function edgeAllows(spec, fromId, toId) {
    const sea = map.isSea(fromId, toId);
    if (spec.domain === "land") return !sea;
    if (spec.domain === "sea") return sea;
    return true;
  }

  function routePath(fromId, toId, unitId, isFriendly, moveCap) {
    const spec = byId[unitId];
    if (!spec || !fromId || !toId || fromId === toId) return null;
    const budget = moveCap == null ? spec.move : moveCap;
    const seen = {};
    const queue = [{ id: fromId, dist: 0, steps: [fromId] }];
    seen[fromId] = true;
    while (queue.length) {
      const step = queue.shift();
      const nexts = map.neighbours[step.id] || [];
      for (let i = 0; i < nexts.length; i += 1) {
        const next = nexts[i];
        if (seen[next]) continue;
        if (!edgeAllows(spec, step.id, next)) continue;
        const dist = step.dist + 1;
        if (dist > budget) continue;
        const steps = step.steps.concat(next);
        if (next === toId) return { distance: dist, steps: steps };
        const flyover = spec.domain === "air";
        if (flyover || (isFriendly && isFriendly(next))) {
          seen[next] = true;
          queue.push({ id: next, dist: dist, steps: steps });
        }
      }
    }
    return null;
  }

  function route(fromId, toId, unitId, isFriendly) {
    return !!routePath(fromId, toId, unitId, isFriendly);
  }

  function explainBlock(fromId, toId, unitId, isFriendly) {
    const spec = byId[unitId];
    const name = map.names[toId] || toId;
    if (!spec) return "Unknown unit.";
    if (routePath(fromId, toId, unitId, isFriendly)) return null;
    const nexts = map.neighbours[fromId] || [];
    if (nexts.indexOf(toId) !== -1 && !edgeAllows(spec, fromId, toId)) {
      if (spec.domain === "land") return spec.name + " cannot cross the sea lane to " + name + ".";
      if (spec.domain === "sea") return spec.name + " cannot move inland to " + name + ".";
      return spec.name + " cannot use that border to reach " + name + ".";
    }
    if (routePath(fromId, toId, unitId, function () { return true; })) {
      return "The path to " + name + " crosses a theatre " + spec.name + " cannot enter.";
    }
    if (routePath(fromId, toId, unitId, isFriendly, 99)) {
      return spec.name + " moves " + spec.move + ". " + name + " is farther than that.";
    }
    return spec.name + " cannot reach " + name + " by " + (spec.domain === "sea" ? "sea" : spec.domain === "air" ? "air" : "land") + ".";
  }

  function removeHits(units, hits) {
    const left = cloneUnits(units);
    const lost = {};
    let remaining = Math.max(0, hits | 0);
    const order = weakestFirst();
    while (remaining > 0) {
      let found = false;
      for (let i = 0; i < order.length; i += 1) {
        const id = order[i].id;
        if ((left[id] || 0) < 1) continue;
        left[id] -= 1;
        if (!left[id]) delete left[id];
        lost[id] = (lost[id] || 0) + 1;
        remaining -= 1;
        found = true;
        break;
      }
      if (!found) break;
    }
    return { units: left, lost: lost };
  }

  function capStrength(units, max) {
    const left = cloneUnits(units);
    const order = CATALOGUE.slice().sort(function (a, b) { return b.strength - a.strength; });
    while (strengthOf(left) > max) {
      let found = false;
      for (let i = 0; i < order.length; i += 1) {
        const id = order[i].id;
        if ((left[id] || 0) < 1) continue;
        left[id] -= 1;
        if (!left[id]) delete left[id];
        found = true;
        break;
      }
      if (!found) break;
    }
    return left;
  }

  function takeOne(units) {
    const order = weakestFirst();
    for (let i = 0; i < order.length; i += 1) {
      const id = order[i].id;
      if ((units[id] || 0) > 0) return id;
    }
    return null;
  }

  function expand(units) {
    const list = [];
    CATALOGUE.forEach(function (spec) {
      const count = units && units[spec.id] ? units[spec.id] | 0 : 0;
      for (let i = 0; i < count; i += 1) list.push(spec);
    });
    return list;
  }

  function draft(unitsObj, fromId, toId, keepStrength, isFriendly) {
    const home = cloneUnits(unitsObj);
    let kept = strengthOf(home);
    const send = {};
    weakestFirst().forEach(function (spec) {
      while ((home[spec.id] || 0) > 0 && kept - spec.strength >= keepStrength && route(fromId, toId, spec.id, isFriendly)) {
        home[spec.id] -= 1;
        if (!home[spec.id]) delete home[spec.id];
        send[spec.id] = (send[spec.id] || 0) + 1;
        kept -= spec.strength;
      }
    });
    return send;
  }

  function addTo(units, extra) {
    const next = cloneUnits(units);
    Object.keys(extra || {}).forEach(function (id) {
      if (!byId[id]) return;
      next[id] = (next[id] || 0) + (extra[id] | 0);
      if (next[id] < 1) delete next[id];
    });
    return next;
  }

  function subtractFrom(units, extra) {
    const next = cloneUnits(units);
    const ids = Object.keys(extra || {});
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      if ((next[id] || 0) < (extra[id] | 0)) return null;
      next[id] -= extra[id] | 0;
      if (next[id] < 1) delete next[id];
    }
    return next;
  }

  function deriveTerritory(territory) {
    if (!territory) return;
    if (!territory.units) territory.units = {};
    territory.units = cloneUnits(territory.units);
    territory.forces = strengthOf(territory.units);
  }

  // Play and new scenarios never invent a stack from a force number.
  // migrateLegacy is only for a version-1 save whose stack was never stored.
  function adoptTerritory(territory) {
    if (!territory) return;
    if (territory.units == null) territory.units = {};
    deriveTerritory(territory);
  }

  function migrateLegacy(territory) {
    if (!territory || territory.units != null) {
      deriveTerritory(territory);
      return;
    }
    territory.units = (territory.forces | 0) > 0 ? compose(territory.forces, coastal(territory.id)) : {};
    deriveTerritory(territory);
  }

  function relation(state, a, b) {
    if (!a || !b || a === b) return 2;
    const key = a < b ? a + "|" + b : b + "|" + a;
    const value = state.relations ? state.relations[key] : 0;
    return value == null ? 0 : value;
  }

  function bordersViewer(state, viewerId, territoryId) {
    const neighbours = map.neighbours[territoryId] || [];
    for (let i = 0; i < neighbours.length; i += 1) {
      const other = state.territories[neighbours[i]];
      if (other && other.ownerId === viewerId) return true;
    }
    return false;
  }

  function treatyBetween(state, viewerId, ownerId) {
    if (!viewerId || !ownerId) return "none";
    if (viewerId === ownerId) return "own";
    const viewer = state.countries[viewerId];
    const owner = state.countries[ownerId];
    if (!viewer || !owner) return "none";
    const rel = relation(state, viewerId, ownerId);
    if (viewer.factionId === owner.factionId && rel >= 0) return "allied";
    if (rel >= 2) return "allied";
    if (rel === 1) return "cordial";
    if (rel <= -1) return "enemy";
    return "neutral";
  }

  // One place for who may see a stack. Renderers ask this; they do not invent it.
  function look(state, viewerId, territoryId) {
    const territory = state.territories[territoryId];
    if (!territory) return { territoryId: territoryId, status: "unknown", forces: null, units: null };
    const owner = state.countries[territory.ownerId];
    if (!owner) return { territoryId: territoryId, status: "unknown", forces: null, units: null, ownerId: territory.ownerId };
    const base = { territoryId: territoryId, ownerId: owner.id, name: territory.name };
    if (!viewerId || !state.countries[viewerId]) {
      return Object.assign(base, { status: "unknown", forces: null, units: null, treaty: "none" });
    }
    const treaty = treatyBetween(state, viewerId, owner.id);
    if (treaty === "own") {
      const advising = state.seats && state.seats.role === "strategist";
      return Object.assign(base, {
        status: advising ? "shared" : "confirmed",
        treaty: treaty,
        forces: territory.forces,
        units: cloneUnits(territory.units)
      });
    }
    if (treaty === "allied") {
      return Object.assign(base, {
        status: "shared",
        treaty: treaty,
        forces: territory.forces,
        units: cloneUnits(territory.units)
      });
    }
    if (treaty === "cordial") {
      return Object.assign(base, {
        status: "shared",
        treaty: treaty,
        forces: territory.forces,
        units: null,
        types: "withheld"
      });
    }
    if (bordersViewer(state, viewerId, territoryId)) {
      return Object.assign(base, {
        status: "estimated",
        treaty: treaty,
        forces: territory.forces,
        units: null,
        types: "withheld"
      });
    }
    return Object.assign(base, { status: "unknown", treaty: treaty, forces: null, units: null });
  }

  function viewerOf(state) {
    if (!state || !state.countries) return null;
    if (state.seats && state.seats.role === "spectator") return null;
    const seat = state.seats && state.seats.playerCountryId;
    if (seat && state.countries[seat] && !state.countries[seat].eliminated) return seat;
    if (state.seats && state.seats.role === "strategist" && state.seats.strategistCountryId) return state.seats.strategistCountryId;
    const active = state.countries[state.activeCountryId];
    if (active && active.control === "human" && !active.eliminated) return active.id;
    return null;
  }

  function observe(state, viewerId) {
    if (!state || !viewerId || !state.countries[viewerId]) return state;
    state.intel = state.intel || {};
    const bag = state.intel[viewerId] || (state.intel[viewerId] = {});
    map.ids.forEach(function (id) {
      const seen = look(state, viewerId, id);
      if (seen.status === "unknown") return;
      bag[id] = {
        forces: seen.forces,
        units: seen.units ? cloneUnits(seen.units) : null,
        round: state.round,
        year: state.year,
        season: state.season,
        quality: seen.status
      };
    });
    return state;
  }

  function sync(state) {
    if (!state || !state.territories) return state;
    map.ids.forEach(function (id) { adoptTerritory(state.territories[id]); });
    observe(state, viewerOf(state));
    return state;
  }

  function assessVisibility(state, viewerId, subjectId) {
    const subject = state.countries[subjectId];
    const viewer = viewerId && state.countries[viewerId];
    if (!subject) return { viewerId: viewerId, subjectId: subjectId, territories: [], resources: "unknown", treaty: "none" };
    const treaty = viewer ? treatyBetween(state, viewerId, subjectId) : "none";
    const resources = treaty === "own" ? "confirmed" : treaty === "allied" ? "shared" : "unknown";
    const memory = state.intel && viewerId ? state.intel[viewerId] : null;
    const territories = [];
    map.ids.forEach(function (id) {
      if (state.territories[id].ownerId !== subjectId) return;
      const current = look(state, viewerId, id);
      if (current.status !== "unknown") {
        territories.push(current);
        return;
      }
      const prior = memory && memory[id];
      if (prior) {
        const season = state.seasons && state.seasons[prior.season] != null ? state.seasons[prior.season] : prior.season;
        territories.push({
          territoryId: id,
          ownerId: subjectId,
          name: state.territories[id].name,
          status: "last-known",
          treaty: treaty,
          forces: prior.forces,
          units: prior.units ? cloneUnits(prior.units) : null,
          types: prior.units ? null : "withheld",
          round: prior.round,
          year: prior.year,
          season: season,
          observed: "Round " + prior.round + ", " + season + " " + prior.year
        });
        return;
      }
      territories.push(current);
    });
    return {
      viewerId: viewerId,
      subjectId: subjectId,
      treaty: treaty,
      resources: resources,
      territories: territories
    };
  }

  const api = {
    CATALOGUE: CATALOGUE,
    byId: byId,
    strengthOf: strengthOf,
    countOf: countOf,
    compose: compose,
    deriveTerritory: deriveTerritory,
    adoptTerritory: adoptTerritory,
    migrateLegacy: migrateLegacy,
    canPlace: canPlace,
    route: route,
    routePath: routePath,
    explainBlock: explainBlock,
    removeHits: removeHits,
    capStrength: capStrength,
    takeOne: takeOne,
    expand: expand,
    draft: draft,
    addTo: addTo,
    subtractFrom: subtractFrom,
    sync: sync,
    observe: observe,
    viewerOf: viewerOf,
    treatyBetween: treatyBetween,
    assessVisibility: assessVisibility
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.FLUnits = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
