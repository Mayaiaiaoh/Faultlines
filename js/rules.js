(function (g) {
  "use strict";

  function load(path, key) {
    if (typeof module !== "undefined" && module.exports && typeof require === "function") {
      return require(path);
    }
    return g[key];
  }

  const map = load("./map", "FLMap");
  const sites = load("./sites", "FLSites");
  const units = load("./units", "FLUnits");
  const eras = load("./scenarios", "FLEras");

  const VERSION = 2;
  const SAVE_KEY = "faultlines.campaign.v1";
  const PROFILES = ["defensive", "expansionist", "industrial", "diplomatic", "opportunistic"];
  const CLOCK_CHOICES = [
    { seconds: 30, label: "30 seconds" },
    { seconds: 60, label: "1 minute" },
    { seconds: 120, label: "2 minutes" },
    { seconds: 300, label: "5 minutes" },
    { seconds: 900, label: "15 minutes" },
    { seconds: 3600, label: "1 hour" },
    { seconds: 28800, label: "8 hours" },
    { seconds: 86400, label: "1 day" },
    { seconds: 259200, label: "3 days" },
    { seconds: 604800, label: "1 week" }
  ];
  const CLOCK_SECONDS = CLOCK_CHOICES.map(function (choice) { return choice.seconds; });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function relKey(a, b) {
    return a < b ? a + "|" + b : b + "|" + a;
  }

  function makeRandomRng() {
    return {
      d6: function () {
        return 1 + Math.floor(Math.random() * 6);
      }
    };
  }

  function makeSeededRng(seed) {
    let s = (seed >>> 0) || 1;
    return {
      d6: function () {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return (s % 6) + 1;
      }
    };
  }

  function validDie(n) {
    return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 6;
  }

  function pushLog(state, entry) {
    if (entry.round == null) entry.round = state.round;
    if (entry.year == null) entry.year = state.year;
    if (!entry.countryId) entry.countryId = state.activeCountryId || "";
    state.log.push(entry);
    if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
  }

  function factionById(state, id) {
    return (state.factions || []).filter(function (f) { return f.id === id; })[0] || null;
  }

  function factionName(state, id) {
    const faction = factionById(state, id);
    return faction ? faction.name : id;
  }

  function isWarFaction(state, id) {
    const faction = factionById(state, id);
    return !!(faction && faction.war);
  }

  function relation(state, a, b) {
    if (a === b) return 2;
    const value = state.relations[relKey(a, b)];
    return value == null ? 0 : value;
  }

  function setRelation(state, a, b, value) {
    if (a === b) return;
    state.relations[relKey(a, b)] = value;
  }

  function sameFaction(state, a, b) {
    const left = state.countries[a];
    const right = state.countries[b];
    return !!(left && right && left.factionId === right.factionId);
  }

  function hostile(state, a, b) {
    if (!a || !b || a === b) return false;
    if (sameFaction(state, a, b)) return false;
    return relation(state, a, b) <= -1;
  }

  function defaultRelation(state, a, b) {
    const left = state.countries[a];
    const right = state.countries[b];
    if (!left || !right) return 0;
    if (left.factionId === right.factionId) return 2;
    if (isWarFaction(state, left.factionId) && isWarFaction(state, right.factionId)) return -2;
    return 0;
  }

  function rebuildRelationsFor(state, countryId) {
    Object.keys(state.countries).forEach(function (otherId) {
      if (otherId === countryId) return;
      setRelation(state, countryId, otherId, defaultRelation(state, countryId, otherId));
    });
  }

  function neighboursOf(territoryId) {
    return map.neighbours[territoryId] || [];
  }

  function ownedTerritories(state, countryId) {
    return Object.keys(state.territories).filter(function (id) {
      return state.territories[id].ownerId === countryId;
    }).map(function (id) {
      return state.territories[id];
    });
  }

  function inSupply(state, territoryId) {
    const territory = state.territories[territoryId];
    if (!territory) return false;
    const country = state.countries[territory.ownerId];
    if (!country || country.eliminated) return false;
    const capital = state.territories[country.capital];
    if (!capital || capital.ownerId !== country.id) return false;
    const seen = {};
    const queue = [country.capital];
    while (queue.length) {
      const id = queue.shift();
      if (seen[id]) continue;
      seen[id] = true;
      if (id === territoryId) return true;
      neighboursOf(id).forEach(function (nextId) {
        const next = state.territories[nextId];
        if (next && next.ownerId === country.id && !seen[nextId]) queue.push(nextId);
      });
    }
    return false;
  }

  function portIncome(state, countryId) {
    if (!state.ports) return 0;
    let extra = 0;
    Object.keys(state.ports).forEach(function (id) {
      if (!state.ports[id]) return;
      const territory = state.territories[id];
      if (!territory || territory.ownerId !== countryId) return;
      if (!inSupply(state, id)) return;
      extra += 1;
    });
    return extra;
  }

  function claimLinked(state, site) {
    const held = state.sites && state.sites[site.id];
    if (!held || !held.ownerId) return false;
    const gate = state.territories[site.gateway];
    if (!gate || gate.ownerId !== held.ownerId) return false;
    if (!state.ports || !state.ports[site.gateway]) return false;
    return inSupply(state, site.gateway);
  }

  function claimIndustry(state, countryId) {
    if (!state.sites) return 0;
    let extra = 0;
    sites.list.forEach(function (site) {
      const held = state.sites[site.id];
      if (!held || held.ownerId !== countryId) return;
      if (site.resource === "strategic") return;
      if (!claimLinked(state, site)) return;
      extra += site.yield;
    });
    return extra;
  }

  function claimInfluence(state, countryId) {
    if (!state.sites) return 0;
    let extra = 0;
    sites.list.forEach(function (site) {
      if (site.resource !== "strategic") return;
      const held = state.sites[site.id];
      if (!held || held.ownerId !== countryId) return;
      if (!claimLinked(state, site)) return;
      extra += 1;
    });
    return extra;
  }

  function productionOf(state, countryId) {
    const base = ownedTerritories(state, countryId).reduce(function (sum, territory) {
      return sum + (inSupply(state, territory.id) ? territory.production : 0);
    }, 0);
    return base + portIncome(state, countryId) + claimIndustry(state, countryId);
  }

  function totalForces(state, countryId) {
    return ownedTerritories(state, countryId).reduce(function (sum, territory) {
      return sum + territory.forces;
    }, 0);
  }

  function borders(state, a, b) {
    return ownedTerritories(state, a).some(function (territory) {
      return neighboursOf(territory.id).some(function (nextId) {
        return state.territories[nextId] && state.territories[nextId].ownerId === b;
      });
    });
  }

  function opposingFaction(state, actorId) {
    const actor = state.countries[actorId];
    const wars = state.factions.filter(function (faction) {
      return faction.war && faction.id !== actor.factionId;
    });
    if (!wars.length) return null;
    let best = wars[0];
    let bestCount = -1;
    wars.forEach(function (faction) {
      const count = Object.keys(state.territories).filter(function (id) {
        const owner = state.countries[state.territories[id].ownerId];
        return owner && !owner.eliminated && owner.factionId === faction.id;
      }).length;
      if (count > bestCount) {
        bestCount = count;
        best = faction;
      }
    });
    return best.id;
  }

  function clockWarnAt(seconds) {
    if (seconds <= 120) return 10;
    return Math.min(3600, Math.max(60, Math.floor(seconds / 10)));
  }

  function armClock(state, inactive) {
    const seconds = state.settings.clockSeconds || 60;
    if (inactive || !state.settings.clockEnabled) {
      return { remaining: seconds, warned: false, warnAt: clockWarnAt(seconds), deadline: null, vetoes: [] };
    }
    return {
      remaining: seconds,
      warned: false,
      warnAt: clockWarnAt(seconds),
      deadline: Date.now() + seconds * 1000,
      vetoes: []
    };
  }

  function beginTurn(state) {
    const id = state.order[state.turnIndex];
    const country = state.countries[id];
    state.activeCountryId = id;
    state.spent = {};
    state.orderQueue = [];
    state.phase = "orders";
    if (!country || country.eliminated || country.control === "dormant") return state;
    const income = productionOf(state, id);
    const claims = claimInfluence(state, id);
    country.industry = Math.min(12, country.industry + income);
    country.influence = Math.min(6, country.influence + 1 + claims);
    pushLog(state, {
      kind: "system",
      text: country.name + " collects " + income + " industry from supplied territories" + (claims ? ". Strategic holdings add " + claims + " influence" : "") + ". Influence is " + country.influence + "."
    });
    state.clock = armClock(state, !!country.inactive);
    if (country.inactive) {
      pushLog(state, {
        kind: "system",
        text: country.name + " is inactive. Income was collected. No orders are issued. If this country is attacked, the defence die is still rolled."
      });
    }
    return state;
  }

  function ensureYearIncome(state) {
    state.timeline = state.timeline || { playing: false, speed: 1, cursor: 0 };
    if (state.timeline.incomeYear === state.year) return state;
    state.timeline.incomeYear = state.year;
    const bits = [];
    state.order.forEach(function (id) {
      const country = state.countries[id];
      if (!country || country.eliminated || country.control === "dormant") return;
      const income = productionOf(state, id);
      const claims = claimInfluence(state, id);
      country.industry = Math.min(12, country.industry + income);
      country.influence = Math.min(6, country.influence + 1 + claims);
      bits.push(country.name + " +" + income + (claims ? " influence +" + claims : ""));
    });
    pushLog(state, {
      kind: "system",
      text: "Spring " + state.year + " production: " + bits.join(", ") + "."
    });
    return state;
  }

  function applySetupSeats(state, setup) {
    let role = setup.role || "player";
    if (role === "spectator" && !state.settings.allowSpectators) role = "player";
    if (role === "strategist" && !state.settings.allowStrategists) role = "player";
    state.seats.role = role;
    const controls = setup.countryControl || {};
    const opening = (eras.ERAS[state.eraId] && eras.ERAS[state.eraId].opening) || {};
    Object.keys(state.countries).forEach(function (id) {
      let control = controls[id] || opening[id] || "ai";
      if (!state.settings.aiEnabled && control === "ai") control = "dormant";
      if (control !== "human" && control !== "ai" && control !== "dormant") control = "ai";
      state.countries[id].control = control;
    });
    if (role === "player") {
      const playerId = setup.playerCountryId;
      if (!state.countries[playerId]) throw new Error("Choose a country to command.");
      state.countries[playerId].control = "human";
      state.seats.playerCountryId = playerId;
      state.seats.originalPlayerCountryId = playerId;
      (setup.humanCountryIds || []).forEach(function (id) {
        if (state.countries[id]) state.countries[id].control = "human";
      });
    } else if (role === "strategist") {
      const strategistId = setup.strategistCountryId || setup.playerCountryId;
      if (!state.countries[strategistId]) throw new Error("Choose a country to advise.");
      state.seats.strategistCountryId = strategistId;
      state.seats.strategistProfile = PROFILES.indexOf(setup.strategistProfile) === -1 ? "defensive" : setup.strategistProfile;
      state.seats.playerCountryId = null;
      if (state.countries[strategistId].control === "human") {
        state.countries[strategistId].control = state.settings.aiEnabled ? "ai" : "dormant";
      }
    } else {
      state.seats.playerCountryId = null;
      Object.keys(state.countries).forEach(function (id) {
        if (state.countries[id].control === "human") {
          state.countries[id].control = state.settings.aiEnabled ? "ai" : "dormant";
        }
      });
    }
  }

  function rotateOrder(state) {
    if (state.seats.role !== "player" || !state.seats.playerCountryId) return;
    const index = state.order.indexOf(state.seats.playerCountryId);
    if (index > 0) state.order = state.order.slice(index).concat(state.order.slice(0, index));
  }

  function firstActingIndex(state) {
    for (let i = 0; i < state.order.length; i += 1) {
      const country = state.countries[state.order[i]];
      if (country && !country.eliminated && country.control !== "dormant") return i;
    }
    return 0;
  }

  function openingYear(era, setup) {
    const end = era.endYear || era.startYear;
    const year = Number(setup && setup.startYear);
    if (!year || year !== Math.floor(year)) return era.startYear;
    if (year < era.startYear) return era.startYear;
    if (year > end) return end;
    return year;
  }

  function openingSeason(setup) {
    const season = Number(setup && setup.startSeason);
    if (season !== 0 && season !== 1 && season !== 2 && season !== 3) return 0;
    return season;
  }

  function copyStack(raw) {
    const copy = {};
    Object.keys(raw || {}).forEach(function (id) {
      const count = raw[id] | 0;
      if (count > 0 && units.byId[id]) copy[id] = count;
    });
    return copy;
  }

  function validateEra(era) {
    const problems = [];
    if (!era || !era.territories) return ["That scenario has no theatres."];
    map.ids.forEach(function (id) {
      const spec = era.territories[id];
      const name = map.names[id] || id;
      if (!spec) {
        problems.push((era.name || era.id) + " is missing " + name + ".");
        return;
      }
      if (!spec.units || typeof spec.units !== "object" || !Object.keys(spec.units).length && (spec.forces | 0) > 0) {
        problems.push(name + " has no unit stack.");
        return;
      }
      if (!spec.units || typeof spec.units !== "object") {
        problems.push(name + " has no unit stack.");
        return;
      }
      Object.keys(spec.units).forEach(function (unitId) {
        const count = spec.units[unitId];
        if (!units.byId[unitId] || count !== (count | 0) || count < 1) problems.push(name + " has an invalid " + unitId + " count.");
      });
      if (typeof spec.forces === "number" && spec.forces !== units.strengthOf(spec.units)) {
        problems.push(name + " lists forces " + spec.forces + " but the stack strength is " + units.strengthOf(spec.units) + ".");
      }
    });
    return problems;
  }

  function startCampaign(setup) {
    const era = eras.ERAS[setup.eraId];
    if (!era) throw new Error("Unknown era.");
    const scenarioProblems = validateEra(era);
    if (scenarioProblems.length) throw new Error(scenarioProblems[0]);
    const state = {
      version: VERSION,
      id: "fl-" + Date.now().toString(36),
      mode: setup.mode === "timeline" ? "timeline" : "turn",
      presentation: setup.presentation === "anime" ? "anime" : "board",
      eraId: era.id,
      eraName: era.name,
      year: openingYear(era, setup),
      endYear: era.endYear,
      nextEraId: era.next || null,
      round: 1,
      season: openingSeason(setup),
      seasons: ["Spring", "Summer", "Autumn", "Winter"],
      turnIndex: 0,
      activeCountryId: null,
      phase: "orders",
      factions: clone(era.factions),
      countries: {},
      territories: {},
      relations: {},
      order: era.order.slice(),
      combatRules: clone(era.combat),
      political: era.political,
      techNote: era.techNote,
      log: [],
      combat: null,
      diplomacy: null,
      orderQueue: [],
      spent: {},
      settings: {
        aiEnabled: setup.aiEnabled !== false,
        risk: clamp(setup.risk == null ? 40 : setup.risk, 0, 100),
        clockEnabled: !!setup.clockEnabled,
        clockSeconds: CLOCK_SECONDS.indexOf(setup.clockSeconds) === -1 ? 60 : setup.clockSeconds,
        clockRule: setup.clockRule === "queue" || setup.clockRule === "ai" ? setup.clockRule : "pass",
        allowSpectators: setup.allowSpectators !== false,
        allowStrategists: setup.allowStrategists !== false
      },
      seats: {
        role: "player",
        playerCountryId: null,
        strategistCountryId: null,
        strategistProfile: null,
        originalPlayerCountryId: null
      },
      clock: { remaining: 60, warned: false },
      timeline: { playing: false, speed: 1, cursor: 0, incomeYear: null },
      chronicle: [],
      legacyNote: setup.legacyNote || "",
      winner: null,
      consult: null,
      consultMemory: {},
      eventSeq: 0
    };

    era.countries.forEach(function (spec) {
      state.countries[spec.id] = {
        id: spec.id,
        name: spec.name,
        factionId: spec.factionId,
        capital: spec.capital,
        profile: spec.profile,
        loyalty: spec.loyalty,
        accent: spec.accent,
        industry: 0,
        influence: 1,
        eliminated: false,
        control: "ai"
      };
    });

    map.ids.forEach(function (id) {
      const spec = era.territories[id];
      if (!spec) throw new Error("Era " + era.id + " is missing " + id + ".");
      state.territories[id] = {
        id: id,
        name: map.names[id],
        ownerId: spec.owner,
        defence: spec.defence,
        units: copyStack(spec.units),
        forces: 0,
        production: spec.production,
        strategic: spec.strategic
      };
    });

    const countryIds = Object.keys(state.countries);
    for (let i = 0; i < countryIds.length; i += 1) {
      for (let j = i + 1; j < countryIds.length; j += 1) {
        setRelation(state, countryIds[i], countryIds[j], defaultRelation(state, countryIds[i], countryIds[j]));
      }
    }
    (era.relationOverrides || []).forEach(function (override) {
      setRelation(state, override.a, override.b, override.value);
    });

    applySetupSeats(state, setup);
    rotateOrder(state);
    ensureWorks(state);
    pushLog(state, {
      kind: "system",
      text: era.name + " opens in " + state.seasons[state.season] + " " + state.year + ". " + era.political
    });
    if (state.legacyNote) pushLog(state, { kind: "system", text: state.legacyNote });

    if (state.mode === "timeline") {
      state.turnIndex = 0;
      state.activeCountryId = null;
      state.phase = "simulation";
      if (state.season === 0) ensureYearIncome(state);
      else state.timeline.incomeYear = state.year;
    } else {
      state.turnIndex = firstActingIndex(state);
      beginTurn(state);
    }
    syncUnits(state);
    return state;
  }

  function canActAs(state, countryId) {
    if (state.winner && !state.winner.continued) {
      return { ok: false, reason: "The era has a victor. Continue the era or start the next one." };
    }
    const country = state.countries[countryId];
    if (!country || country.eliminated) return { ok: false, reason: "That country has been conquered." };
    if (state.seats.role === "spectator") return { ok: false, reason: "Spectators watch. They cannot issue orders." };
    if (state.seats.role === "strategist") return { ok: false, reason: "A strategist files a recommendation. The AI may accept, adapt, or ignore it." };
    if (country.control !== "human") return { ok: false, reason: "That country is not under your control." };
    if (country.inactive) return { ok: false, reason: country.name + " is inactive. Two players vetoed the clock, so this seat gives no orders. A defence roll is still made if it is attacked." };
    if (state.mode === "turn" && state.activeCountryId !== countryId) {
      const active = state.countries[state.activeCountryId];
      return { ok: false, reason: "It is " + (active ? active.name : "another country") + "'s turn." };
    }
    if (state.mode === "timeline" && state.timeline.playing) {
      return { ok: false, reason: "Pause the timeline before issuing orders." };
    }
    return { ok: true };
  }

  function legalAction(state, action) {
    if (!action || !action.type) return { ok: false, reason: "That order is empty." };
    if (state.engagement && action.type !== "casualties" && action.type !== "continueBattle" && action.type !== "retreat" && action.type !== "autoResolve") {
      const where = state.territories[state.engagement.toId];
      return { ok: false, reason: "A battle is still open in " + (where ? where.name : "the field") + "." };
    }
    if (action.type === "endTurn") {
      if (state.mode !== "turn") return { ok: false, reason: "Timeline mode has no end-turn step." };
      return { ok: true };
    }
    const actor = state.countries[action.countryId];
    if (!actor || actor.eliminated) return { ok: false, reason: "That country cannot act." };
    if (action.type === "reinforce") {
      const territory = state.territories[action.territoryId];
      const unitId = action.unitId || "infantry";
      const spec = units.byId[unitId];
      const amount = action.amount | 0;
      if (!territory || territory.ownerId !== actor.id) return { ok: false, reason: "Reinforce a territory you own." };
      if (!spec) return { ok: false, reason: "Unknown unit." };
      if (!inSupply(state, territory.id)) return { ok: false, reason: territory.name + " is out of supply." };
      if (!units.canPlace(unitId, territory.id)) return { ok: false, reason: spec.name + " needs a coast." };
      if (amount < 1) return { ok: false, reason: "Choose at least one unit." };
      if (actor.industry < spec.cost * amount) return { ok: false, reason: spec.name + " costs " + spec.cost + " industry. You have " + actor.industry + "." };
      return { ok: true };
    }
    if (action.type === "fortify") {
      const territory = state.territories[action.territoryId];
      if (!territory || territory.ownerId !== actor.id) return { ok: false, reason: "Fortify a territory you own." };
      if (!inSupply(state, territory.id)) return { ok: false, reason: territory.name + " is out of supply." };
      if (territory.defence >= 3) return { ok: false, reason: "Defence is already at 3." };
      if (actor.industry < 3) return { ok: false, reason: "Fortify costs 3 industry. You have " + actor.industry + "." };
      return { ok: true };
    }
    if (action.type === "casualties" || action.type === "continueBattle" || action.type === "retreat" || action.type === "autoResolve") {
      return battleOrderLegal(state, action);
    }
    if (action.type === "move" || action.type === "attack") {
      const from = state.territories[action.fromId];
      const to = state.territories[action.toId];
      const selection = cleanSelection(action.selection);
      const attacking = action.type === "attack";
      if (!from || from.ownerId !== actor.id) return { ok: false, reason: attacking ? "Attack from a territory you own." : "Move from a territory you own." };
      if (!to) return { ok: false, reason: "That destination is not on the map." };
      if (!attacking && to.ownerId !== actor.id) return { ok: false, reason: "Units move only into your own territory." };
      if (attacking && to.ownerId === actor.id) return { ok: false, reason: "That territory is already yours." };
      if (state.spent[from.id]) return { ok: false, reason: from.name + " has already acted this turn." };
      if (!units.countOf(selection)) return { ok: false, reason: "Choose the units for this order." };
      if (!units.subtractFrom(from.units, selection)) return { ok: false, reason: "Those units are not in " + from.name + "." };
      const ids = Object.keys(selection);
      for (let i = 0; i < ids.length; i += 1) {
        const spec = units.byId[ids[i]];
        if (!units.route(from.id, to.id, ids[i], friendlyOwner(state, actor.id))) {
          return { ok: false, reason: spec.name + " cannot reach " + to.name + " by " + (spec.domain === "sea" ? "sea" : spec.domain === "air" ? "air" : "land") + "." };
        }
      }
      if (attacking) {
        if (!inSupply(state, from.id)) return { ok: false, reason: "Out-of-supply units cannot attack." };
        const defender = state.countries[to.ownerId];
        if (!defender || defender.eliminated) return { ok: false, reason: "There is no defender." };
        if (!hostile(state, actor.id, defender.id)) {
          return { ok: false, reason: "Not hostile to " + defender.name + ". Open hostilities first. That costs 1 influence." };
        }
      }
      return { ok: true };
    }
    if (action.type === "openHostilities") {
      const target = state.countries[action.targetCountryId];
      if (!target || target.eliminated) return { ok: false, reason: "That country is not available." };
      if (target.id === actor.id) return { ok: false, reason: "You cannot open hostilities with yourself." };
      if (sameFaction(state, actor.id, target.id)) return { ok: false, reason: "You share an allegiance." };
      if (hostile(state, actor.id, target.id)) return { ok: false, reason: "Hostilities are already open." };
      if (actor.influence < 1) return { ok: false, reason: "Opening hostilities costs 1 influence." };
      if (!borders(state, actor.id, target.id)) return { ok: false, reason: "You can open hostilities only with a neighbour." };
      return { ok: true };
    }
    if (action.type === "allegiance") {
      const target = state.countries[action.targetCountryId];
      const faction = factionById(state, action.proposedFactionId);
      if (!target || target.eliminated) return { ok: false, reason: "That country is not available." };
      if (target.id === actor.id) return { ok: false, reason: "Choose another country." };
      if (!faction) return { ok: false, reason: "Unknown allegiance." };
      if (target.factionId === faction.id) return { ok: false, reason: target.name + " is already " + faction.name + "." };
      if (actor.influence < 2) return { ok: false, reason: "An allegiance proposal costs 2 influence." };
      if (!borders(state, actor.id, target.id) && relation(state, actor.id, target.id) < 0) {
        return { ok: false, reason: "You need a shared border, or a relation that is not hostile." };
      }
      return { ok: true };
    }
    if (action.type === "port") {
      const territory = state.territories[action.territoryId];
      if (!territory || territory.ownerId !== actor.id) return { ok: false, reason: "Build a port on a theatre you own." };
      if (!sites.coastal(territory.id)) return { ok: false, reason: territory.name + " has no coast to harbour a port." };
      if (!inSupply(state, territory.id)) return { ok: false, reason: territory.name + " is out of supply." };
      if (state.ports && state.ports[territory.id]) return { ok: false, reason: territory.name + " already has a port." };
      if (actor.industry < sites.PORT_COST) return { ok: false, reason: "A port costs " + sites.PORT_COST + " industry. You have " + actor.industry + "." };
      return { ok: true };
    }
    if (action.type === "base") {
      const territory = state.territories[action.territoryId];
      if (!territory || territory.ownerId !== actor.id) return { ok: false, reason: "Build a base on a theatre you own." };
      if (!inSupply(state, territory.id)) return { ok: false, reason: territory.name + " is out of supply." };
      if (state.bases && state.bases[territory.id]) return { ok: false, reason: territory.name + " already has a base." };
      if (actor.industry < sites.BASE_COST) return { ok: false, reason: "A base costs " + sites.BASE_COST + " industry. You have " + actor.industry + "." };
      return { ok: true };
    }
    if (action.type === "explore") {
      const site = sites.byId[action.siteId];
      const from = state.territories[action.territoryId];
      if (!site) return { ok: false, reason: "That ground is not on the map." };
      if (!from || from.id !== site.gateway) return { ok: false, reason: site.name + " is reached from " + (state.territories[site.gateway] ? state.territories[site.gateway].name : "its gateway") + "." };
      if (from.ownerId !== actor.id) return { ok: false, reason: "You need to hold " + from.name + " to reach " + site.name + "." };
      if (!inSupply(state, from.id)) return { ok: false, reason: from.name + " is out of supply." };
      if (!state.ports || !state.ports[from.id]) return { ok: false, reason: "Establish a port on " + from.name + " before exploring " + site.name + "." };
      const held = state.sites && state.sites[site.id];
      if (held && held.ownerId === actor.id) return { ok: false, reason: "You already hold " + site.name + "." };
      if (from.forces < 1 || !units.takeOne(from.units)) return { ok: false, reason: "Exploration sends 1 unit from " + from.name + "." };
      if (from.id === actor.capital && from.forces < 2) return { ok: false, reason: "The capital keeps a garrison. Reinforce it before exploring." };
      if (actor.industry < sites.EXPLORE_COST) return { ok: false, reason: "Exploration costs " + sites.EXPLORE_COST + " industry. You have " + actor.industry + "." };
      if (held && held.ownerId) {
        const holder = state.countries[held.ownerId];
        if (!holder || holder.eliminated) return { ok: false, reason: "That ground has no holder." };
        if (sameFaction(state, actor.id, holder.id)) return { ok: false, reason: holder.name + " shares your allegiance and holds " + site.name + "." };
        if (!hostile(state, actor.id, holder.id)) return { ok: false, reason: "Not hostile to " + holder.name + ". Open hostilities before seizing " + site.name + "." };
      }
      return { ok: true };
    }
    return { ok: false, reason: "Unknown order." };
  }

  function friendlyOwner(state, ownerId) {
    return function (id) {
      const territory = state.territories[id];
      return !!(territory && territory.ownerId === ownerId);
    };
  }

  function cleanSelection(raw) {
    const selection = {};
    if (!raw) return selection;
    Object.keys(raw).forEach(function (id) {
      const count = raw[id] | 0;
      if (count > 0 && units.byId[id]) selection[id] = count;
    });
    return selection;
  }

  function stackText(bag) {
    const parts = units.CATALOGUE.filter(function (spec) { return bag && bag[spec.id]; }).map(function (spec) {
      return spec.name + " " + bag[spec.id];
    });
    return parts.length ? parts.join(", ") : "none";
  }

  function stamp(state) {
    state.eventSeq = (state.eventSeq || 0) + 1;
    return state.eventSeq;
  }

  function resolveUnitCombat(input, rng) {
    const attackers = units.expand(input.attackers || {});
    const defenders = units.expand(input.defenders || {});
    const roller = rng || makeRandomRng();
    const provided = input.useProvidedRolls === true;
    function dieAt(list, index) {
      if (!provided) return roller.d6();
      if (!list || !validDie(list[index])) throw new Error("Combat dice must be whole numbers from 1 to 6.");
      return list[index];
    }
    const attackMod = input.attackModifiers || 0;
    const defenceMod = input.defenceModifiers || 0;
    const attackRolls = [];
    const defenceRolls = [];
    let attackHits = 0;
    let defenceHits = 0;
    attackers.forEach(function (spec, index) {
      const roll = dieAt(input.attackRolls, index);
      const need = Math.min(6, spec.attack + attackMod);
      const hit = need >= 1 && roll <= need;
      if (hit) attackHits += 1;
      attackRolls.push({ id: spec.id, name: spec.name, roll: roll, need: Math.max(need, 0), hit: hit });
    });
    defenders.forEach(function (spec, index) {
      const roll = dieAt(input.defenceRolls, index);
      const need = Math.min(6, spec.defence + defenceMod);
      const hit = need >= 1 && roll <= need;
      if (hit) defenceHits += 1;
      defenceRolls.push({ id: spec.id, name: spec.name, roll: roll, need: Math.max(need, 0), hit: hit });
    });
    const attackerLoss = units.removeHits(input.attackers || {}, defenceHits);
    const defenderLoss = units.removeHits(input.defenders || {}, attackHits);
    const attackersLeft = units.countOf(attackerLoss.units);
    const defendersLeft = units.countOf(defenderLoss.units);
    let outcome = "defender";
    if (attackersLeft > 0 && defendersLeft === 0) outcome = "attacker";
    else if (attackersLeft > 0) outcome = "exchange";
    return {
      attackRolls: attackRolls,
      defenceRolls: defenceRolls,
      attackRoll: attackRolls.length ? attackRolls[0].roll : 0,
      defenceRoll: defenceRolls.length ? defenceRolls[0].roll : 0,
      attackHits: attackHits,
      defenceHits: defenceHits,
      attackStrength: units.strengthOf(input.attackers || {}),
      defenceStrength: units.strengthOf(input.defenders || {}),
      attackModifiers: attackMod,
      defenceModifiers: defenceMod,
      attackTotal: attackHits,
      defenceTotal: defenceHits,
      outcome: outcome,
      attackersLeft: attackerLoss.units,
      defendersLeft: defenderLoss.units,
      attackerLoss: attackerLoss.lost,
      defenderLoss: defenderLoss.lost,
      modifierNotes: input.modifierNotes || []
    };
  }

  // Single combat resolver. Local play rolls here once. A server must pass
  // useProvidedRolls with dice it generated. This function never rerolls.
  function resolveCombat(input, rng) {
    if (input.attackers || input.defenders) return resolveUnitCombat(input, rng);
    let attackRoll;
    let defenceRoll;
    if (input.useProvidedRolls) {
      if (!validDie(input.attackRoll) || !validDie(input.defenceRoll)) {
        throw new Error("Combat dice must be whole numbers from 1 to 6.");
      }
      attackRoll = input.attackRoll;
      defenceRoll = input.defenceRoll;
    } else {
      const roller = rng || makeRandomRng();
      attackRoll = roller.d6();
      defenceRoll = roller.d6();
    }
    const attackModifiers = input.attackModifiers || 0;
    const defenceModifiers = input.defenceModifiers || 0;
    const attackTotal = input.attackStrength + attackRoll + attackModifiers;
    const defenceTotal = input.defenceStrength + defenceRoll + defenceModifiers;
    let outcome = "tie";
    if (attackTotal > defenceTotal) outcome = "attacker";
    else if (defenceTotal > attackTotal) outcome = "defender";
    return {
      attackRoll: attackRoll,
      defenceRoll: defenceRoll,
      attackStrength: input.attackStrength,
      defenceStrength: input.defenceStrength,
      attackModifiers: attackModifiers,
      defenceModifiers: defenceModifiers,
      attackTotal: attackTotal,
      defenceTotal: defenceTotal,
      outcome: outcome,
      modifierNotes: input.modifierNotes || []
    };
  }

  function combatInput(state, action) {
    const to = state.territories[action.toId];
    const rules = state.combatRules;
    const defender = state.countries[to.ownerId];
    const notes = [];
    let attackModifiers = rules.attackerBonus || 0;
    let defenceModifiers = 0;
    if (attackModifiers) notes.push("Era attack bonus +" + attackModifiers);
    const committed = units.strengthOf(cleanSelection(action.selection));
    if (rules.massAttackAt && committed >= rules.massAttackAt) {
      attackModifiers += rules.massAttackBonus || 0;
      notes.push("Mass commitment +" + (rules.massAttackBonus || 0));
    }
    const fortFactor = rules.fortFactor == null ? 1 : rules.fortFactor;
    const fort = Math.floor(to.defence * fortFactor);
    if (fort) notes.push("Fortification +" + fort);
    defenceModifiers += fort;
    if (!inSupply(state, to.id)) {
      const penalty = rules.oosPenalty || 1;
      defenceModifiers -= penalty;
      notes.push("Defender out of supply -" + penalty);
    }
    if (defender && defender.capital === to.id) {
      const bonus = rules.capitalBonus == null ? 1 : rules.capitalBonus;
      defenceModifiers += bonus;
      notes.push("Capital +" + bonus);
    }
    if (state.bases && state.bases[to.id]) {
      defenceModifiers += 1;
      notes.push("Base +1");
    }
    return {
      attackers: cleanSelection(action.selection),
      defenders: units.addTo({}, to.units),
      attackModifiers: attackModifiers,
      defenceModifiers: defenceModifiers,
      modifierNotes: notes,
      useProvidedRolls: action.useProvidedRolls === true,
      attackRolls: action.attackRolls,
      defenceRolls: action.defenceRolls
    };
  }

  function markTaken(state, ids) {
    const list = [];
    (ids || []).forEach(function (id) {
      if (id && list.indexOf(id) === -1) list.push(id);
    });
    if (!list.length) return;
    state.takenSeq = (state.takenSeq || 0) + 1;
    state.takenIds = list;
  }

  function conquer(state, victimId, conquerorId) {
    const victim = state.countries[victimId];
    const conqueror = state.countries[conquerorId];
    victim.eliminated = true;
    victim.industry = 0;
    victim.influence = 0;
    victim.control = "dormant";
    const transferred = [];
    const takenIds = [];
    Object.keys(state.territories).forEach(function (id) {
      const territory = state.territories[id];
      if (territory.ownerId !== victimId) return;
      territory.ownerId = conquerorId;
      territory.units = units.capStrength(territory.units, 2);
      units.deriveTerritory(territory);
      releaseWork(state, id);
      transferred.push(territory.name);
      takenIds.push(id);
    });
    if (transferred.length) {
      pushLog(state, {
        kind: "system",
        text: conqueror.name + " takes the rest of " + victim.name + ": " + transferred.join(", ") + "."
      });
    }
    return takenIds;
  }

  function rollPhrase(rolls) {
    if (!rolls || !rolls.length) return "no units rolled";
    return rolls.map(function (item) {
      return item.name + " " + item.roll + (item.hit ? " hit" : " miss") + " (needs " + item.need + ")";
    }).join(", ");
  }

  function battleManual(action, opts) {
    if (action && action.autoResolve === true) return false;
    if (opts && opts.fromAi && !(action && action.autoResolve === false)) return false;
    return true;
  }

  function sideOwner(engagement, side) {
    return side === "defender" ? engagement.defenderId : engagement.countryId;
  }

  function sideBag(engagement, side) {
    return side === "defender" ? engagement.defenders : engagement.attackers;
  }

  function humanChooses(state, engagement, side) {
    if (!engagement.manual) return false;
    const country = state.countries[sideOwner(engagement, side)];
    return !!(country && country.control === "human" && !country.inactive);
  }

  function retreatOptions(state, engagement) {
    const options = [];
    if (!engagement) return options;
    const types = Object.keys(engagement.attackers || {});
    if (!types.length) return options;
    const friendly = friendlyOwner(state, engagement.countryId);
    map.ids.forEach(function (id) {
      if (id === engagement.toId) return;
      if (state.territories[id].ownerId !== engagement.countryId) return;
      const routes = {};
      let cost = 0;
      for (let i = 0; i < types.length; i += 1) {
        const path = units.routePath(engagement.toId, id, types[i], friendly);
        if (!path) return;
        routes[types[i]] = path;
        if (path.distance > cost) cost = path.distance;
      }
      options.push({ id: id, name: state.territories[id].name, cost: cost, routes: routes });
    });
    return options;
  }

  function pickRetreat(engagement, options) {
    let best = options[0];
    options.forEach(function (option) {
      if (option.cost < best.cost) best = option;
      else if (option.cost === best.cost && option.id === engagement.fromId) best = option;
    });
    return best;
  }

  function syncDefenders(state, engagement) {
    const territory = state.territories[engagement.toId];
    territory.units = units.addTo({}, engagement.defenders);
    units.deriveTerritory(territory);
  }

  function publishBattle(state, summary, withRolls) {
    const engagement = state.engagement;
    const attacker = state.countries[engagement.countryId];
    const defender = state.countries[engagement.defenderId];
    const to = state.territories[engagement.toId];
    const from = state.territories[engagement.fromId];
    if (defender && defender.inactive && summary.indexOf("Forced defence") === -1) {
      summary += " Forced defence roll. " + defender.name + " is inactive and does not choose casualties.";
    }
    engagement.summary = summary;
    state.combat = {
      attackRolls: engagement.attackRolls || [],
      defenceRolls: engagement.defenceRolls || [],
      attackRoll: engagement.attackRolls && engagement.attackRolls.length ? engagement.attackRolls[0].roll : 0,
      defenceRoll: engagement.defenceRolls && engagement.defenceRolls.length ? engagement.defenceRolls[0].roll : 0,
      attackHits: engagement.attackHits || 0,
      defenceHits: engagement.defenceHits || 0,
      attackModifiers: engagement.attackModifiers || 0,
      defenceModifiers: engagement.defenceModifiers || 0,
      modifierNotes: engagement.modifierNotes || [],
      attackersLeft: units.addTo({}, engagement.attackers),
      defendersLeft: units.addTo({}, engagement.defenders),
      attackerLoss: engagement.attackerLoss || {},
      defenderLoss: engagement.defenderLoss || {},
      outcome: engagement.outcome || "round",
      round: engagement.round,
      status: engagement.status,
      summary: summary,
      attackerName: attacker.name,
      defenderName: defender.name,
      fromName: from.name,
      toName: to.name,
      kind: "battle",
      seq: stamp(state)
    };
    const rolls = withRolls === false ? "" : " Attack rolls: " + rollPhrase(engagement.attackRolls) + ". Defence rolls: " + rollPhrase(engagement.defenceRolls) + ". Hits " + (engagement.attackHits || 0) + " to " + (engagement.defenceHits || 0) + ".";
    pushLog(state, { kind: "battle", text: "Round " + engagement.round + ". " + summary + rolls });
  }

  function finishRound(state) {
    const engagement = state.engagement;
    const to = state.territories[engagement.toId];
    const attacker = state.countries[engagement.countryId];
    const defender = state.countries[engagement.defenderId];
    syncDefenders(state, engagement);
    units.deriveTerritory(state.territories[engagement.fromId]);
    const lostNote = (units.countOf(engagement.attackerLoss) ? " " + attacker.name + " loses " + stackText(engagement.attackerLoss) + "." : "") +
      (units.countOf(engagement.defenderLoss) ? " " + defender.name + " loses " + stackText(engagement.defenderLoss) + "." : "");
    if (!units.countOf(engagement.attackers)) {
      engagement.outcome = "defender";
      engagement.status = "done";
      publishBattle(state, defender.name + " holds " + to.name + "." + lostNote);
      state.engagement = null;
      state.phase = state.mode === "timeline" ? "simulation" : "orders";
      return;
    }
    if (!units.countOf(engagement.defenders)) {
      const capitalFell = defender.capital === to.id;
      to.ownerId = attacker.id;
      to.units = units.addTo({}, engagement.attackers);
      to.defence = Math.max(0, to.defence - 1);
      units.deriveTerritory(to);
      releaseWork(state, to.id);
      let summary = attacker.name + " takes " + to.name + " with " + stackText(engagement.attackers) + "." + lostNote;
      if (capitalFell) {
        summary += " " + defender.name + " is conquered.";
        const rest = conquer(state, defender.id, attacker.id) || [];
        markTaken(state, [to.id].concat(rest));
      } else markTaken(state, [to.id]);
      engagement.outcome = "attacker";
      engagement.status = "done";
      publishBattle(state, summary);
      state.engagement = null;
      state.phase = state.mode === "timeline" ? "simulation" : "orders";
      return;
    }
    engagement.outcome = "round";
    engagement.status = "decision";
    publishBattle(state, "Both sides still have units in " + to.name + ". " + attacker.name + " has " + stackText(engagement.attackers) + ". " + defender.name + " has " + stackText(engagement.defenders) + "." + lostNote);
  }

  function commitCasualty(state, side, picked) {
    const engagement = state.engagement;
    if (side === "defender") {
      engagement.defenders = picked.units;
      engagement.defenderLoss = units.addTo(engagement.defenderLoss, picked.lost);
      if (units.countOf(picked.lost)) state.territories[engagement.toId].damaged = true;
    } else {
      engagement.attackers = picked.units;
      engagement.attackerLoss = units.addTo(engagement.attackerLoss, picked.lost);
    }
    syncDefenders(state, engagement);
  }

  function applyNextCasualty(state) {
    const engagement = state.engagement;
    while (engagement.casualtyQueue && engagement.casualtyQueue.length) {
      const side = engagement.casualtyQueue[0];
      const hits = side === "defender" ? engagement.attackHits : engagement.defenceHits;
      const bag = sideBag(engagement, side);
      if (humanChooses(state, engagement, side) && units.countOf(bag) > 0 && hits > 0) {
        engagement.status = "casualties";
        engagement.pending = { side: side, hits: hits, must: Math.min(hits, units.countOf(bag)) };
        state.phase = "battle";
        const who = state.countries[sideOwner(engagement, side)];
        publishBattle(state, who.name + " chooses " + engagement.pending.must + (engagement.pending.must === 1 ? " casualty." : " casualties."));
        return;
      }
      commitCasualty(state, side, units.removeHits(bag, hits));
      engagement.casualtyQueue.shift();
    }
    engagement.pending = null;
    finishRound(state);
  }

  function playRound(state, action, rng) {
    const engagement = state.engagement;
    engagement.round += 1;
    engagement.attackerLoss = {};
    engagement.defenderLoss = {};
    const input = combatInput(state, {
      toId: engagement.toId,
      selection: engagement.attackers,
      useProvidedRolls: !!(action && action.useProvidedRolls),
      attackRolls: action && action.attackRolls,
      defenceRolls: action && action.defenceRolls
    });
    input.attackers = units.addTo({}, engagement.attackers);
    input.defenders = units.addTo({}, engagement.defenders);
    const resolved = resolveCombat(input, rng);
    engagement.attackRolls = resolved.attackRolls;
    engagement.defenceRolls = resolved.defenceRolls;
    engagement.attackHits = resolved.attackHits;
    engagement.defenceHits = resolved.defenceHits;
    engagement.attackModifiers = resolved.attackModifiers;
    engagement.defenceModifiers = resolved.defenceModifiers;
    engagement.modifierNotes = resolved.modifierNotes;
    engagement.casualtyQueue = [];
    if (resolved.attackHits > 0 && units.countOf(engagement.defenders)) engagement.casualtyQueue.push("defender");
    if (resolved.defenceHits > 0 && units.countOf(engagement.attackers)) engagement.casualtyQueue.push("attacker");
    applyNextCasualty(state);
  }

  function finishRetreat(state, toId) {
    const engagement = state.engagement;
    const dest = state.territories[toId];
    dest.units = units.addTo(dest.units, engagement.attackers);
    units.deriveTerritory(dest);
    units.deriveTerritory(state.territories[engagement.fromId]);
    syncDefenders(state, engagement);
    engagement.outcome = "retreat";
    engagement.status = "done";
    engagement.retreatTo = toId;
    publishBattle(state, state.countries[engagement.countryId].name + " retreats to " + dest.name + " with " + stackText(engagement.attackers) + ".", false);
    state.engagement = null;
    state.phase = state.mode === "timeline" ? "simulation" : "orders";
  }

  function loseStranded(state) {
    const engagement = state.engagement;
    const defender = state.countries[engagement.defenderId];
    const to = state.territories[engagement.toId];
    engagement.attackers = {};
    engagement.outcome = "defender";
    engagement.status = "done";
    publishBattle(state, defender.name + " holds " + to.name + ". The attackers had no legal retreat after " + engagement.round + " rounds, so those units are lost.", false);
    state.engagement = null;
    state.phase = state.mode === "timeline" ? "simulation" : "orders";
  }

  function driveEngagement(state, rng) {
    let guard = 0;
    while (state.engagement && guard < 12) {
      guard += 1;
      const engagement = state.engagement;
      if (engagement.status === "casualties" && engagement.pending) {
        const pending = engagement.pending;
        commitCasualty(state, pending.side, units.removeHits(sideBag(engagement, pending.side), pending.hits));
        engagement.casualtyQueue.shift();
        engagement.pending = null;
        applyNextCasualty(state);
        continue;
      }
      if (!state.engagement || state.engagement.status !== "decision") break;
      const atk = units.strengthOf(state.engagement.attackers);
      const def = units.strengthOf(state.engagement.defenders);
      const options = retreatOptions(state, state.engagement);
      if (atk >= def && state.engagement.round < 8) {
        playRound(state, {}, rng);
        continue;
      }
      if (options.length) {
        finishRetreat(state, pickRetreat(state.engagement, options).id);
        break;
      }
      if (state.engagement.round < 8) {
        playRound(state, {}, rng);
        continue;
      }
      loseStranded(state);
      break;
    }
  }

  function battleOrderLegal(state, action) {
    const engagement = state.engagement;
    if (!engagement) return { ok: false, reason: "No battle is open." };
    if (state.seats && state.seats.role === "spectator") return { ok: false, reason: "Spectators watch. They cannot direct a battle." };
    if (action.type === "casualties") {
      if (engagement.status !== "casualties" || !engagement.pending) return { ok: false, reason: "No casualty choice is waiting." };
      if (action.countryId !== sideOwner(engagement, engagement.pending.side)) return { ok: false, reason: "That country does not choose these casualties." };
      const selection = cleanSelection(action.selection);
      if (units.countOf(selection) !== engagement.pending.must) return { ok: false, reason: "Choose exactly " + engagement.pending.must + " units to lose." };
      if (!units.subtractFrom(sideBag(engagement, engagement.pending.side), selection)) return { ok: false, reason: "Those units are not in the battle." };
      return { ok: true };
    }
    if (action.countryId !== engagement.countryId) return { ok: false, reason: "Only the attacker can continue, retreat, or auto-resolve." };
    if (action.type === "autoResolve") return { ok: true };
    if (engagement.status !== "decision") return { ok: false, reason: "Resolve the casualties before the next order." };
    if (action.type === "continueBattle") return { ok: true };
    if (action.type === "retreat") {
      const match = retreatOptions(state, engagement).filter(function (option) { return option.id === action.toId; })[0];
      if (!match) {
        const name = state.territories[action.toId] ? state.territories[action.toId].name : "that theatre";
        return { ok: false, reason: "Those units have no legal retreat to " + name + "." };
      }
      return { ok: true };
    }
    return { ok: false, reason: "Unknown battle order." };
  }

  function applyAttack(state, action, rng, opts) {
    const from = state.territories[action.fromId];
    const to = state.territories[action.toId];
    const attacker = state.countries[action.countryId];
    const defender = state.countries[to.ownerId];
    const selection = cleanSelection(action.selection);
    from.units = units.subtractFrom(from.units, selection);
    units.deriveTerritory(from);
    from.damaged = true;
    state.spent[from.id] = "attack";
    state.engagement = {
      fromId: from.id,
      toId: to.id,
      countryId: attacker.id,
      defenderId: defender.id,
      attackers: selection,
      defenders: units.addTo({}, to.units),
      round: 0,
      status: "round",
      pending: null,
      casualtyQueue: [],
      attackerLoss: {},
      defenderLoss: {},
      attackRolls: [],
      defenceRolls: [],
      manual: battleManual(action, opts),
      outcome: null
    };
    state.phase = "battle";
    playRound(state, action, rng);
    if (state.engagement && !state.engagement.manual) driveEngagement(state, rng);
  }

  function applyBattleOrder(state, action, rng) {
    const engagement = state.engagement;
    if (action.type === "casualties") {
      const side = engagement.pending.side;
      const selection = cleanSelection(action.selection);
      commitCasualty(state, side, { units: units.subtractFrom(sideBag(engagement, side), selection), lost: selection });
      engagement.casualtyQueue.shift();
      engagement.pending = null;
      applyNextCasualty(state);
      if (state.engagement && !state.engagement.manual) driveEngagement(state, rng);
      return;
    }
    if (action.type === "autoResolve") {
      engagement.manual = false;
      driveEngagement(state, rng);
      return;
    }
    if (action.type === "continueBattle") {
      playRound(state, action, rng);
      return;
    }
    if (action.type === "retreat") finishRetreat(state, action.toId);
  }

  function changeAllegiance(state, targetId, factionId, because) {
    const target = state.countries[targetId];
    const before = target.factionId;
    target.factionId = factionId;
    rebuildRelationsFor(state, targetId);
    pushLog(state, {
      kind: "diplomacy",
      text: target.name + " leaves " + factionName(state, before) + " and joins " + factionName(state, factionId) + ". " + (because || "")
    });
  }

  function applyOpenHostilities(state, action) {
    const actor = state.countries[action.countryId];
    const target = state.countries[action.targetCountryId];
    actor.influence -= 1;
    let joined = "";
    if (!isWarFaction(state, target.factionId) && isWarFaction(state, actor.factionId)) {
      const join = opposingFaction(state, actor.id);
      if (join) {
        target.factionId = join;
        rebuildRelationsFor(state, target.id);
        joined = target.name + " leaves non-alignment and joins " + factionName(state, join) + ".";
      }
    }
    setRelation(state, actor.id, target.id, -2);
    const text = actor.name + " opens hostilities with " + target.name + "." + (joined ? " " + joined : "");
    pushLog(state, { kind: "diplomacy", text: text });
    state.diplomacy = {
      kind: "hostilities",
      seq: stamp(state),
      success: true,
      summary: text,
      from: target.factionId,
      to: target.factionId
    };
  }

  function applyAllegiance(state, action, rng) {
    const actor = state.countries[action.countryId];
    const target = state.countries[action.targetCountryId];
    actor.influence -= 2;
    const rel = relation(state, actor.id, target.id);
    const diplomatic = actor.profile === "diplomatic" ? 1 : 0;
    const proposed = action.proposedFactionId;
    let attackRoll;
    let defenceRoll;
    if (action.useProvidedRolls) {
      if (!validDie(action.attackRoll) || !validDie(action.defenceRoll)) {
        throw new Error("Diplomacy dice must be whole numbers from 1 to 6.");
      }
      attackRoll = action.attackRoll;
      defenceRoll = action.defenceRoll;
    } else {
      const roller = rng || makeRandomRng();
      attackRoll = roller.d6();
      defenceRoll = roller.d6();
    }
    const persuasion = 2 + rel + attackRoll + diplomatic;
    const advantage = Math.max(0, Math.min(3, Math.round((totalForces(state, target.id) - totalForces(state, actor.id)) / 4)));
    const resistance = target.loyalty + defenceRoll + advantage;
    const notes = ["Spent influence +2", "Relation " + rel];
    if (diplomatic) notes.push("Diplomatic profile +1");
    if (advantage) notes.push("Target strength +" + advantage + " resistance");
    const success = persuasion > resistance;
    const summary = success
      ? target.name + " accepts. Persuasion " + persuasion + " against resistance " + resistance + "."
      : target.name + " refuses. Persuasion " + persuasion + " against resistance " + resistance + ". The influence is spent.";
    if (success) changeAllegiance(state, target.id, proposed, summary);
    else pushLog(state, { kind: "diplomacy", text: actor.name + " proposes that " + target.name + " join " + factionName(state, proposed) + ". " + summary });
    state.diplomacy = {
      kind: "allegiance",
      seq: stamp(state),
      success: success,
      summary: summary,
      attackRoll: attackRoll,
      defenceRoll: defenceRoll,
      persuasion: persuasion,
      resistance: resistance,
      notes: notes,
      actorName: actor.name,
      targetName: target.name,
      from: success ? proposed : target.factionId,
      proposed: proposed,
      proposedName: factionName(state, proposed)
    };
  }

  function ensureWorks(state) {
    state.ports = state.ports && typeof state.ports === "object" ? state.ports : {};
    state.bases = state.bases && typeof state.bases === "object" ? state.bases : {};
    const next = {};
    sites.list.forEach(function (site) {
      const held = state.sites && state.sites[site.id];
      const ownerId = held && held.ownerId && state.countries[held.ownerId] ? held.ownerId : null;
      next[site.id] = {
        ownerId: ownerId,
        install: ownerId && (held.install === "port" || held.install === "base") ? held.install : null,
        garrison: ownerId && held.garrison > 0 ? held.garrison | 0 : 0
      };
    });
    state.sites = next;
    Object.keys(state.ports).forEach(function (id) {
      if (!state.ports[id] || !state.territories[id]) delete state.ports[id];
    });
    Object.keys(state.bases).forEach(function (id) {
      if (!state.bases[id] || !state.territories[id]) delete state.bases[id];
    });
    return state;
  }

  function releaseWork(state, territoryId) {
    const territory = state.territories[territoryId];
    if (!territory) return;
    const hadPort = !!(state.ports && state.ports[territoryId]);
    const hadBase = !!(state.bases && state.bases[territoryId]);
    if (hadPort) delete state.ports[territoryId];
    if (hadBase) delete state.bases[territoryId];
    const dropped = [];
    if (hadPort && state.sites) {
      sites.list.forEach(function (site) {
        if (site.gateway !== territoryId) return;
        const held = state.sites[site.id];
        if (!held || !held.ownerId) return;
        dropped.push(site.name);
        held.ownerId = null;
        held.install = null;
        held.garrison = 0;
      });
    }
    if (!hadPort && !hadBase && !dropped.length) return;
    const bits = [];
    if (hadPort) bits.push("the port");
    if (hadBase) bits.push("the base");
    let text = territory.name + " loses " + bits.join(" and ") + ".";
    if (dropped.length) text += " " + dropped.join(", ") + " return to unclaimed ground. Their garrisons are lost.";
    pushLog(state, { kind: "system", text: text });
  }

  function applyPort(state, action, opts) {
    const territory = state.territories[action.territoryId];
    const actor = state.countries[action.countryId];
    actor.industry -= sites.PORT_COST;
    state.ports[territory.id] = true;
    const opened = sites.forGateway(territory.id).map(function (site) { return site.name; });
    pushLog(state, {
      kind: opts.fromAi ? "ai" : "player",
      text: actor.name + " establishes a port on " + territory.name + ". It adds 1 industry while supplied" + (opened.length ? " and opens " + opened.join(", ") : "") + "." + (action.blurb ? " " + action.blurb : "")
    });
  }

  function applyBase(state, action, opts) {
    const territory = state.territories[action.territoryId];
    const actor = state.countries[action.countryId];
    actor.industry -= sites.BASE_COST;
    state.bases[territory.id] = true;
    pushLog(state, {
      kind: opts.fromAi ? "ai" : "player",
      text: actor.name + " establishes a base on " + territory.name + ". It adds +1 defence in battle and is lost if the theatre falls." + (action.blurb ? " " + action.blurb : "")
    });
  }

  function resourceLine(site) {
    if (site.resource === "oil") return "Oil pays " + site.yield + " industry";
    if (site.resource === "minerals") return "Minerals pay " + site.yield + " industry";
    return "Strategic value " + site.strategic + " pays 1 influence";
  }

  function applyExplore(state, action, rng, opts) {
    const site = sites.byId[action.siteId];
    const held = state.sites[site.id];
    const from = state.territories[site.gateway];
    const actor = state.countries[action.countryId];
    const kind = site.kind === "base" ? "base" : "port";
    actor.industry -= sites.EXPLORE_COST;
    const sentId = units.takeOne(from.units);
    const sent = {};
    sent[sentId] = 1;
    from.units = units.subtractFrom(from.units, sent);
    units.deriveTerritory(from);
    if (!held.ownerId) {
      held.ownerId = actor.id;
      held.install = kind;
      held.garrison = 1;
      pushLog(state, {
        kind: opts.fromAi ? "ai" : "player",
        text: actor.name + " explores " + site.name + " from the port on " + from.name + " and establishes a " + kind + ". One " + units.byId[sentId].name + " garrisons it. " + resourceLine(site) + " while that port stays supplied." + (action.blurb ? " " + action.blurb : "")
      });
      return;
    }
    const defender = state.countries[held.ownerId];
    const notes = [];
    let defenceModifiers = 0;
    if (held.install === "base") {
      defenceModifiers += 1;
      notes.push("Base +1");
    }
    const attackModifiers = state.combatRules.attackerBonus || 0;
    if (attackModifiers) notes.push("Era attack bonus +" + attackModifiers);
    const garrison = Math.max(1, held.garrison | 0);
    const defenders = { infantry: garrison };
    const defenceRolls = action.defenceRolls || (action.defenceRoll ? Array.from({ length: garrison }, function () { return action.defenceRoll; }) : null);
    const resolved = resolveUnitCombat({
      attackers: sent,
      defenders: defenders,
      attackModifiers: attackModifiers,
      defenceModifiers: defenceModifiers,
      modifierNotes: notes,
      useProvidedRolls: action.useProvidedRolls === true,
      attackRolls: action.attackRolls || (action.attackRoll ? [action.attackRoll] : null),
      defenceRolls: defenceRolls
    }, rng);
    let summary;
    if (resolved.outcome === "attacker") {
      held.ownerId = actor.id;
      held.install = kind;
      held.garrison = 1;
      summary = actor.name + " seizes " + site.name + " and establishes a " + kind + ". The previous installation is wrecked.";
    } else {
      if (units.countOf(resolved.attackersLeft)) {
        from.units = units.addTo(from.units, resolved.attackersLeft);
        units.deriveTerritory(from);
      }
      held.garrison = Math.max(0, units.countOf(resolved.defendersLeft));
      summary = defender.name + " holds " + site.name + ". " + (units.countOf(resolved.attackersLeft) ? "The " + units.byId[sentId].name + " returns to " + from.name + "." : "The " + units.byId[sentId].name + " is lost.");
    }
    resolved.summary = summary;
    resolved.attackerName = actor.name;
    resolved.defenderName = defender.name;
    resolved.fromName = from.name;
    resolved.toName = site.name;
    resolved.kind = "battle";
    resolved.seq = stamp(state);
    state.combat = resolved;
    pushLog(state, {
      kind: "battle",
      text: summary + " Attack rolls: " + rollPhrase(resolved.attackRolls) + ". Defence rolls: " + rollPhrase(resolved.defenceRolls) + "." + (action.blurb ? " " + action.blurb : "")
    });
  }

  function applyAction(state, action, rng, opts) {
    opts = opts || {};
    const check = legalAction(state, action);
    if (!check.ok) return { ok: false, reason: check.reason, state: state };
    if (!opts.fromAi && action.type !== "casualties" && action.type !== "continueBattle" && action.type !== "retreat" && action.type !== "autoResolve") {
      const gate = canActAs(state, action.countryId || state.activeCountryId);
      if (!gate.ok) return { ok: false, reason: gate.reason, state: state };
    }
    if (action.type === "reinforce") {
      const territory = state.territories[action.territoryId];
      const spec = units.byId[action.unitId || "infantry"];
      const amount = action.amount | 0;
      const placed = {};
      placed[spec.id] = amount;
      state.countries[action.countryId].industry -= spec.cost * amount;
      territory.units = units.addTo(territory.units, placed);
      units.deriveTerritory(territory);
      territory.damaged = false;
      pushLog(state, { kind: opts.fromAi ? "ai" : "player", text: state.countries[action.countryId].name + " places " + amount + " " + spec.name + " in " + territory.name + "." + (action.blurb ? " " + action.blurb : "") });
    } else if (action.type === "fortify") {
      const territory = state.territories[action.territoryId];
      state.countries[action.countryId].industry -= 3;
      territory.defence += 1;
      pushLog(state, { kind: opts.fromAi ? "ai" : "player", text: state.countries[action.countryId].name + " fortifies " + territory.name + " to defence " + territory.defence + "." + (action.blurb ? " " + action.blurb : "") });
    } else if (action.type === "move") {
      const from = state.territories[action.fromId];
      const to = state.territories[action.toId];
      const selection = cleanSelection(action.selection);
      from.units = units.subtractFrom(from.units, selection);
      to.units = units.addTo(to.units, selection);
      units.deriveTerritory(from);
      units.deriveTerritory(to);
      state.spent[from.id] = "move";
      const lane = map.isSea(from.id, to.id) ? " by sea lane" : "";
      pushLog(state, { kind: opts.fromAi ? "ai" : "player", text: state.countries[action.countryId].name + " moves " + stackText(selection) + " from " + from.name + " to " + to.name + lane + "." + (action.blurb ? " " + action.blurb : "") });
    } else if (action.type === "attack") {
      applyAttack(state, action, rng || makeRandomRng(), opts);
      if (action.blurb) pushLog(state, { kind: "ai", text: action.blurb });
    } else if (action.type === "casualties" || action.type === "continueBattle" || action.type === "retreat" || action.type === "autoResolve") {
      applyBattleOrder(state, action, rng || makeRandomRng());
    } else if (action.type === "openHostilities") {
      applyOpenHostilities(state, action);
      if (action.blurb) pushLog(state, { kind: "ai", text: action.blurb });
    } else if (action.type === "allegiance") {
      applyAllegiance(state, action, rng || makeRandomRng());
      if (action.blurb) pushLog(state, { kind: "ai", text: action.blurb });
    } else if (action.type === "port") {
      applyPort(state, action, opts);
    } else if (action.type === "base") {
      applyBase(state, action, opts);
    } else if (action.type === "explore") {
      applyExplore(state, action, rng || makeRandomRng(), opts);
    } else if (action.type === "endTurn") {
      advanceTurn(state);
      syncUnits(state);
      return { ok: true, state: state };
    }
    checkVictory(state);
    syncUnits(state);
    return { ok: true, state: state };
  }

  function checkVictory(state) {
    if (state.winner) return state;
    const warFactions = state.factions.filter(function (faction) { return faction.war; });
    const living = warFactions.filter(function (faction) {
      return Object.keys(state.countries).some(function (id) {
        const country = state.countries[id];
        return !country.eliminated && country.factionId === faction.id;
      });
    });
    if (warFactions.length > 1 && living.length === 1) {
      declareWinner(state, living[0], living[0].name + " is the only alliance still in the field.");
      return state;
    }
    const counts = {};
    Object.keys(state.territories).forEach(function (id) {
      const owner = state.countries[state.territories[id].ownerId];
      if (!owner) return;
      counts[owner.factionId] = (counts[owner.factionId] || 0) + 1;
    });
    state.factions.forEach(function (faction) {
      if (state.winner) return;
      if ((counts[faction.id] || 0) >= 12) {
        declareWinner(state, faction, faction.name + " controls " + counts[faction.id] + " of 16 territories.");
      }
    });
    return state;
  }

  function declareWinner(state, faction, reason) {
    state.winner = { factionId: faction.id, name: faction.name, reason: reason, continued: false };
    state.timeline.playing = false;
    pushLog(state, { kind: "system", text: "Victory. " + reason });
  }

  function advanceTurn(state, guard) {
    if ((guard || 0) > state.order.length) return state;
    const order = state.order;
    const start = state.turnIndex;
    let index = start;
    let wrapped = false;
    for (let n = 0; n < order.length; n += 1) {
      index = (index + 1) % order.length;
      if (index === 0) wrapped = true;
      const country = state.countries[order[index]];
      if (country && !country.eliminated && country.control !== "dormant") {
        if (wrapped) {
          state.year += 1;
          state.round += 1;
          pushLog(state, { kind: "system", text: "The year turns to " + state.year + ". Round " + state.round + "." });
        }
        state.turnIndex = index;
        beginTurn(state);
        const arrived = state.countries[state.activeCountryId];
        if (arrived && arrived.inactive && arrived.control === "human" && (guard || 0) < order.length) {
          return advanceTurn(state, (guard || 0) + 1);
        }
        checkVictory(state);
        syncUnits(state);
        return state;
      }
    }
    syncUnits(state);
    return state;
  }

  function advanceTimeline(state, rng, decide) {
    if (state.winner && !state.winner.continued) return state;
    if (state.season === 0) ensureYearIncome(state);
    const aiIds = state.order.filter(function (id) {
      const country = state.countries[id];
      return country && !country.eliminated && country.control === "ai";
    });
    if (!aiIds.length) {
      state.timeline.playing = false;
      pushLog(state, { kind: "system", text: "No AI country is active, so the timeline holds." });
      return state;
    }
    const countryId = aiIds[state.timeline.cursor % aiIds.length];
    state.activeCountryId = countryId;
    if (typeof decide === "function") {
      const action = decide(state, countryId);
      if (action && action.type !== "endTurn") {
        const result = applyAction(state, action, rng || makeRandomRng(), { fromAi: true });
        if (!result.ok) {
          pushLog(state, { kind: "ai", text: state.countries[countryId].name + " holds. " + result.reason });
        }
      } else if (action && action.blurb) {
        pushLog(state, { kind: "ai", text: action.blurb });
      }
    }
    state.timeline.cursor = (state.timeline.cursor + 1) % aiIds.length;
    if (state.timeline.cursor === 0) {
      if (state.season === 3) {
        state.season = 0;
        state.year += 1;
        pushLog(state, { kind: "system", text: "The year turns to " + state.year + "." });
      } else {
        state.season += 1;
        pushLog(state, { kind: "system", text: state.seasons[state.season] + " " + state.year + "." });
      }
    }
    checkVictory(state);
    return state;
  }

  function stageAction(state, action) {
    const gate = canActAs(state, action.countryId);
    if (!gate.ok) return gate;
    if (action.type === "endTurn") return { ok: false, reason: "End the turn directly. It is not a staged order." };
    const check = legalAction(state, action);
    if (!check.ok) return check;
    state.orderQueue = state.orderQueue || [];
    state.orderQueue.push(clone(action));
    return { ok: true };
  }

  function commitQueue(state, rng) {
    const queued = (state.orderQueue || []).slice();
    state.orderQueue = [];
    const notes = [];
    queued.forEach(function (action) {
      if (notes.length && notes[notes.length - 1].indexOf("Stopped") === 0) return;
      const running = Object.assign({}, action);
      if (running.type === "attack") running.autoResolve = true;
      const result = applyAction(state, running, rng || makeRandomRng(), { fromAi: false });
      if (!result.ok) notes.push("Stopped: " + result.reason);
    });
    return { ok: true, notes: notes };
  }

  function endHumanTurn(state, rng) {
    const gate = canActAs(state, state.activeCountryId);
    if (!gate.ok) return gate;
    let notes = [];
    if (state.orderQueue && state.orderQueue.length) {
      const committed = commitQueue(state, rng || makeRandomRng());
      notes = committed.notes;
    }
    advanceTurn(state);
    return { ok: true, notes: notes, state: state };
  }

  function applyClockExpiry(state, rng, decide) {
    if (state.mode !== "turn") return state;
    const active = state.countries[state.activeCountryId];
    if (!active) return state;
    const vetoes = state.clock && state.clock.vetoes || [];
    if (vetoes.length >= 2) {
      active.inactive = true;
      state.orderQueue = [];
      const names = vetoes.map(function (id) {
        return state.countries[id] ? state.countries[id].name : id;
      }).join(" and ");
      pushLog(state, {
        kind: "system",
        text: names + " vetoed the clock. " + active.name + " stays in the war and is inactive. No orders are issued. Automatic collection still stands. If " + active.name + " is attacked, the defence die is still rolled."
      });
      advanceTurn(state);
      return state;
    }
    const rule = state.settings.clockRule;
    const roller = rng || makeRandomRng();
    if (rule === "queue") {
      commitQueue(state, roller);
      pushLog(state, { kind: "system", text: active.name + " ran out of time. Staged orders were executed, then the turn passed." });
      advanceTurn(state);
    } else if (rule === "ai") {
      commitQueue(state, roller);
      pushLog(state, { kind: "system", text: active.name + " ran out of time. The " + active.profile + " profile finishes the turn." });
      const previous = active.control;
      active.control = "ai";
      if (typeof decide === "function") {
        for (let i = 0; i < 4; i += 1) {
          const action = decide(state, active.id);
          if (!action || action.type === "endTurn") break;
          const result = applyAction(state, action, roller, { fromAi: true });
          if (!result.ok) break;
        }
      }
      active.control = previous;
      advanceTurn(state);
    } else {
      state.orderQueue = [];
      pushLog(state, { kind: "system", text: active.name + " ran out of time. The turn passes with no further orders." });
      advanceTurn(state);
    }
    return state;
  }

  function castVeto(state, countryId) {
    if (!state.settings.clockEnabled || state.mode !== "turn") {
      return { ok: false, reason: "The play clock is not running." };
    }
    const country = state.countries[countryId];
    if (!country || country.eliminated || country.control !== "human") {
      return { ok: false, reason: "Only a human seat can veto the clock." };
    }
    const humans = Object.keys(state.countries).filter(function (id) {
      const seat = state.countries[id];
      return seat && seat.control === "human" && !seat.eliminated;
    });
    if (humans.length < 2) return { ok: false, reason: "A veto needs two human seats at the table." };
    state.clock = state.clock || armClock(state, false);
    state.clock.vetoes = state.clock.vetoes || [];
    if (state.clock.vetoes.indexOf(countryId) !== -1) return { ok: false, reason: country.name + " has already vetoed this turn." };
    state.clock.vetoes.push(countryId);
    pushLog(state, {
      kind: "system",
      text: country.name + " vetoes the clock (" + state.clock.vetoes.length + " of 2). Two vetoes keep a timed-out seat in the war, with no orders except automatic collection and a forced defence roll."
    });
    return { ok: true };
  }

  function restoreCountry(state, countryId) {
    const country = state.countries[countryId];
    if (!country || country.eliminated) return { ok: false, reason: "That country has been conquered." };
    if (!country.inactive) return { ok: false, reason: country.name + " is already taking turns." };
    country.inactive = false;
    pushLog(state, { kind: "system", text: country.name + " is restored. The next turn for that seat can give orders again." });
    return { ok: true };
  }

  function leaveSeat(state) {
    if (state.seats.role !== "player" || !state.seats.playerCountryId) {
      return { ok: false, reason: "You are not holding a player seat." };
    }
    if (!state.settings.allowSpectators) {
      return { ok: false, reason: "Spectators were not allowed at setup, so this seat stays filled." };
    }
    const id = state.seats.playerCountryId;
    state.countries[id].control = state.settings.aiEnabled ? "ai" : "dormant";
    state.seats.role = "spectator";
    pushLog(state, { kind: "system", text: "You left the " + state.countries[id].name + " seat on this machine. The campaign is still here." });
    return { ok: true };
  }

  function rejoinSeat(state) {
    const id = state.seats.originalPlayerCountryId;
    if (!id || !state.countries[id] || state.countries[id].eliminated) {
      return { ok: false, reason: "The original seat has been conquered." };
    }
    state.countries[id].control = "human";
    state.seats.role = "player";
    state.seats.playerCountryId = id;
    pushLog(state, { kind: "system", text: "You rejoined " + state.countries[id].name + "." });
    return { ok: true };
  }

  function setRecommendation(state, profile) {
    if (state.seats.role !== "strategist") return { ok: false, reason: "Only a strategist can file a recommendation." };
    if (!state.settings.allowStrategists) return { ok: false, reason: "Strategists were not allowed at setup." };
    if (PROFILES.indexOf(profile) === -1) return { ok: false, reason: "Unknown strategy profile." };
    state.seats.strategistProfile = profile;
    pushLog(state, { kind: "system", text: "Recommendation filed: " + profile + ". On that country's turn the AI rolls one die: 1–3 accept, 4 adapt, 5–6 ignore." });
    return { ok: true };
  }

  function previewAllegiance(state, actorId, targetId, factionId) {
    const action = { type: "allegiance", countryId: actorId, targetCountryId: targetId, proposedFactionId: factionId };
    const check = legalAction(state, action);
    const target = state.countries[targetId];
    const faction = factionById(state, factionId);
    const lines = [];
    if (target && faction) {
      lines.push("Current allegiance: " + factionName(state, target.factionId) + ".");
      lines.push("Proposed allegiance: " + faction.name + ".");
      lines.push("Cost: 2 influence. Both sides roll one die. A tie keeps the current allegiance, and the influence is still spent.");
      lines.push("If it succeeds, " + target.name + " joins " + faction.name + ". Same-faction countries become allies and cannot attack one another. Opposing war factions become hostile.");
    }
    return { ok: check.ok, reason: check.reason, lines: lines };
  }

  function previewHostilities(state, actorId, targetId) {
    const action = { type: "openHostilities", countryId: actorId, targetCountryId: targetId };
    const check = legalAction(state, action);
    const target = state.countries[targetId];
    const lines = ["Cost: 1 influence. There is no die. Attacks become legal in both directions."];
    if (target && !isWarFaction(state, target.factionId) && isWarFaction(state, state.countries[actorId].factionId)) {
      const join = opposingFaction(state, actorId);
      lines.push(target.name + " would leave non-alignment and join " + factionName(state, join) + ".");
    }
    return { ok: check.ok, reason: check.reason, lines: lines };
  }

  function destinations(state, fromId) {
    const from = state.territories[fromId];
    const legal = [];
    const blocked = [];
    if (!from) return { legal: legal, blocked: blocked };
    const types = Object.keys(from.units || {}).filter(function (id) {
      return (from.units[id] | 0) > 0 && units.byId[id];
    });
    const friendly = friendlyOwner(state, from.ownerId);
    const maxMove = types.reduce(function (best, id) { return Math.max(best, units.byId[id].move); }, 0);
    map.ids.forEach(function (id) {
      if (id === fromId) return;
      const other = state.territories[id];
      const able = {};
      const routes = {};
      const denied = [];
      types.forEach(function (unitId) {
        const path = units.routePath(fromId, id, unitId, friendly);
        if (path) {
          able[unitId] = from.units[unitId];
          routes[unitId] = path;
        } else {
          const why = units.explainBlock(fromId, id, unitId, friendly);
          if (why) denied.push(why);
        }
      });
      const any = Object.keys(able).length > 0;
      let kind = "illegal";
      if (other.ownerId === from.ownerId) kind = "move";
      else if (hostile(state, from.ownerId, other.ownerId)) kind = "attack";
      else kind = "closed";
      if (any && (kind === "move" || kind === "attack")) {
        let cost = 0;
        Object.keys(routes).forEach(function (unitId) {
          if (routes[unitId].distance > cost) cost = routes[unitId].distance;
        });
        legal.push({ toId: id, name: other.name, kind: kind, units: able, routes: routes, cost: cost, denied: denied });
        return;
      }
      const neighbour = (map.neighbours[fromId] || []).indexOf(id) !== -1;
      let tempting = neighbour;
      if (!tempting) {
        types.forEach(function (unitId) {
          if (units.routePath(fromId, id, unitId, function () { return true; }, maxMove)) tempting = true;
        });
      }
      if (!tempting && !(kind === "closed" && any)) return;
      let reason = denied[0] || (other.name + " is not a legal destination.");
      if (kind === "closed" && any) {
        const holder = state.countries[other.ownerId];
        reason = "Hostilities with " + (holder ? holder.name : "that country") + " are closed. " + other.name + " is in range.";
        if (denied.length) reason += " " + denied[0];
      }
      blocked.push({ toId: id, name: other.name, kind: any ? "closed" : "illegal", reason: reason });
    });
    return { legal: legal, blocked: blocked };
  }

  function reach(state, territoryId) {
    const territory = state.territories[territoryId];
    const moves = [];
    const attacks = [];
    const closed = [];
    if (!territory) return { moves: moves, attacks: attacks, closed: closed };
    neighboursOf(territoryId).forEach(function (id) {
      const other = state.territories[id];
      if (other.ownerId === territory.ownerId) moves.push(id);
      else if (hostile(state, territory.ownerId, other.ownerId)) attacks.push(id);
      else closed.push(id);
    });
    return { moves: moves, attacks: attacks, closed: closed };
  }

  function factionCounts(state) {
    const counts = {};
    Object.keys(state.territories).forEach(function (id) {
      const owner = state.countries[state.territories[id].ownerId];
      if (!owner) return;
      counts[owner.factionId] = (counts[owner.factionId] || 0) + 1;
    });
    return counts;
  }

  function mapSuccessor(currentEra, nextEra, state) {
    const table = currentEra.successors || {};
    const playerFrom = state.seats.originalPlayerCountryId || state.seats.playerCountryId;
    const strategistFrom = state.seats.strategistCountryId;
    let role = state.seats.role;
    let playerCountryId = playerFrom ? table[playerFrom] : null;
    let strategistCountryId = strategistFrom ? table[strategistFrom] : null;
    const nextIds = {};
    nextEra.countries.forEach(function (country) { nextIds[country.id] = true; });
    if (role === "player" && !nextIds[playerCountryId]) {
      role = state.settings.allowSpectators ? "spectator" : "player";
      if (role === "player") playerCountryId = nextEra.countries[0].id;
    }
    if (role === "strategist" && !nextIds[strategistCountryId]) {
      role = "spectator";
      strategistCountryId = null;
    }
    const countryControl = {};
    const seen = {};
    if (playerCountryId) seen[playerCountryId] = true;
    Object.keys(state.countries).forEach(function (id) {
      if (state.countries[id].control !== "human" || id === playerFrom) return;
      const dest = table[id];
      if (dest && nextIds[dest] && !seen[dest]) {
        countryControl[dest] = "human";
        seen[dest] = true;
      }
    });
    return {
      role: role,
      playerCountryId: playerCountryId,
      strategistCountryId: strategistCountryId,
      countryControl: countryControl
    };
  }

  function startNextEra(state) {
    const current = eras.ERAS[state.eraId];
    if (!current || !current.next || !eras.ERAS[current.next]) {
      return { ok: false, reason: "No further era is prepared. The Lattice War is the last scenario in this edition." };
    }
    const next = eras.ERAS[current.next];
    const counts = factionCounts(state);
    let best = null;
    Object.keys(counts).forEach(function (id) {
      if (!best || counts[id] > best.n) best = { id: id, n: counts[id] };
    });
    const playerId = state.seats.originalPlayerCountryId || state.seats.playerCountryId;
    const playerFaction = playerId && state.countries[playerId] ? state.countries[playerId].factionId : null;
    const legacy = !!(playerFaction && best && best.id === playerFaction);
    const chronicle = (state.chronicle || []).slice();
    chronicle.push({
      eraId: state.eraId,
      year: state.year,
      summary: state.eraName + " closed in " + state.year + ". " + (state.winner ? state.winner.reason : "No victory had been decided."),
      legacy: legacy
    });
    const mapped = mapSuccessor(current, next, state);
    const setup = {
      eraId: next.id,
      mode: state.mode,
      presentation: state.presentation,
      aiEnabled: state.settings.aiEnabled,
      risk: state.settings.risk,
      clockEnabled: state.settings.clockEnabled,
      clockSeconds: state.settings.clockSeconds,
      clockRule: state.settings.clockRule,
      allowSpectators: state.settings.allowSpectators,
      allowStrategists: state.settings.allowStrategists,
      role: mapped.role,
      playerCountryId: mapped.playerCountryId,
      strategistCountryId: mapped.strategistCountryId,
      strategistProfile: state.seats.strategistProfile,
      countryControl: mapped.countryControl
    };
    const fresh = startCampaign(setup);
    fresh.id = state.id;
    fresh.chronicle = chronicle;
    fresh.presentation = state.presentation;
    const heir = mapped.playerCountryId && fresh.countries[mapped.playerCountryId];
    if (legacy && heir) {
      heir.influence = Math.min(6, heir.influence + 1);
      fresh.legacyNote = "Legacy carried: your faction finished ahead on territory, so " + heir.name + " begins with 1 extra influence. Forces, ownership, and politics were reset to " + next.name + ".";
    } else {
      fresh.legacyNote = "No territorial legacy. Forces, ownership, relations, and the year were reset to " + next.name + ". The chronicle keeps the previous era.";
    }
    pushLog(fresh, { kind: "system", text: fresh.legacyNote });
    pushLog(fresh, { kind: "system", text: "Kept between eras: chronicle, seat, presentation, mode, and AI settings. Reset: countries, forces, allegiance, industry, and the year." });
    return { ok: true, state: fresh };
  }

  function syncUnits(state) {
    if (units && units.sync) units.sync(state);
    return state;
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  function validateSave(data) {
    if (!data || typeof data !== "object") return { ok: false, reason: "That save was empty." };
    if (data.version !== 1 && data.version !== VERSION) return { ok: false, reason: "That save is from a different edition." };
    if (!data.territories || !data.countries || !data.order || !data.eraId) {
      return { ok: false, reason: "That save is missing the campaign." };
    }
    if (!eras.ERAS[data.eraId]) return { ok: false, reason: "That save names an unknown era." };
    if (data.mode !== "turn" && data.mode !== "timeline") return { ok: false, reason: "That save has no recognised mode." };
    for (let i = 0; i < map.ids.length; i += 1) {
      const id = map.ids[i];
      const territory = data.territories[id];
      if (!territory) return { ok: false, reason: "That save is missing " + (map.names[id] || id) + "." };
      if (typeof territory.forces !== "number" || territory.forces < 0 || territory.forces !== Math.floor(territory.forces)) {
        return { ok: false, reason: "Forces on " + (territory.name || id) + " are invalid." };
      }
      if (!data.countries[territory.ownerId]) return { ok: false, reason: "A territory owner is missing." };
    }
    return { ok: true };
  }

  function loadFromString(raw) {
    if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "That save was empty." };
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return { ok: false, reason: "That save could not be read." };
    }
    const check = validateSave(data);
    if (!check.ok) return check;
    const incoming = data.version;
    if (!data.log) data.log = [];
    if (!data.orderQueue) data.orderQueue = [];
    if (!data.spent) data.spent = {};
    if (!data.timeline) data.timeline = { playing: false, speed: 1, cursor: 0, incomeYear: data.year };
    data.timeline.playing = false;
    if (!data.clock) data.clock = { remaining: data.settings && data.settings.clockSeconds ? data.settings.clockSeconds : 60, warned: false };
    if (!data.chronicle) data.chronicle = [];
    if (!data.consultMemory) data.consultMemory = {};
    map.ids.forEach(function (id) {
      if (data.territories[id]) data.territories[id].name = map.names[id];
    });
    ensureWorks(data);
    if (incoming === 1) {
      map.ids.forEach(function (id) {
        if (data.territories[id]) units.migrateLegacy(data.territories[id]);
      });
    }
    data.version = VERSION;
    syncUnits(data);
    return { ok: true, state: data };
  }

  const storage = {
    key: SAVE_KEY,
    save: function (state) {
      if (typeof localStorage === "undefined") return { ok: false, reason: "This browser has no local storage." };
      try {
        localStorage.setItem(SAVE_KEY, serialize(state));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: "The browser refused to store the campaign." };
      }
    },
    load: function () {
      if (typeof localStorage === "undefined") return { ok: false, reason: "This browser has no local storage." };
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ok: false, reason: "No campaign is saved in this browser." };
      const result = loadFromString(raw);
      if (!result.ok) {
        try { localStorage.setItem(SAVE_KEY + ".invalid", raw); } catch (error) { /* keep the failure reason */ }
      }
      return result;
    }
  };

  const api = {
    VERSION: VERSION,
    SAVE_KEY: SAVE_KEY,
    PROFILES: PROFILES,
    CLOCK_SECONDS: CLOCK_SECONDS,
    CLOCK_CHOICES: CLOCK_CHOICES,
    startCampaign: startCampaign,
    startNextEra: startNextEra,
    applyAction: applyAction,
    legalAction: legalAction,
    resolveCombat: resolveCombat,
    changeAllegiance: changeAllegiance,
    advanceTurn: advanceTurn,
    advanceTimeline: advanceTimeline,
    applyClockExpiry: applyClockExpiry,
    castVeto: castVeto,
    restoreCountry: restoreCountry,
    endHumanTurn: endHumanTurn,
    stageAction: stageAction,
    commitQueue: commitQueue,
    inSupply: inSupply,
    hostile: hostile,
    relation: relation,
    borders: borders,
    productionOf: productionOf,
    totalForces: totalForces,
    canActAs: canActAs,
    leaveSeat: leaveSeat,
    rejoinSeat: rejoinSeat,
    setRecommendation: setRecommendation,
    previewAllegiance: previewAllegiance,
    previewHostilities: previewHostilities,
    reach: reach,
    destinations: destinations,
    retreatOptions: retreatOptions,
    validateEra: validateEra,
    validateSave: validateSave,
    loadFromString: loadFromString,
    serialize: serialize,
    storage: storage,
    pushLog: pushLog,
    factionById: factionById,
    factionName: factionName,
    checkVictory: checkVictory,
    ensureYearIncome: ensureYearIncome,
    makeSeededRng: makeSeededRng,
    makeRandomRng: makeRandomRng,
    neighboursOf: neighboursOf,
    ownedTerritories: ownedTerritories,
    sites: sites,
    draftSelection: function (state, fromId, toId, keep) {
      const territory = state.territories[fromId];
      if (!territory) return {};
      return units.draft(territory.units, fromId, toId, keep | 0, friendlyOwner(state, territory.ownerId));
    },
    unitStrength: function (bag) { return units.strengthOf(bag); },
    syncUnits: syncUnits,
    viewerOf: function (state) { return units.viewerOf(state); },
    viewerFor: function (state, ui) {
      const ack = ui && ui.privacyAck;
      if (ack && state && ack === state.activeCountryId) {
        const country = state.countries[ack];
        if (country && country.control === "human" && !country.eliminated) return country.id;
      }
      return units.viewerOf(state);
    },
    assessVisibility: function (state, viewerId, subjectId) { return units.assessVisibility(state, viewerId, subjectId); },
    unitCatalogue: units.CATALOGUE
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.FLRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
