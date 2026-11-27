(function (g) {
  "use strict";

  function load(path, key) {
    if (typeof module !== "undefined" && module.exports && typeof require === "function") {
      return require(path);
    }
    return g[key];
  }

  const rules = load("./rules", "FLRules");

  function adaptProfile(own, recommended) {
    if (own === recommended) return own;
    const table = {
      "defensive|expansionist": "opportunistic",
      "expansionist|defensive": "opportunistic",
      "industrial|expansionist": "opportunistic",
      "expansionist|industrial": "industrial",
      "diplomatic|expansionist": "opportunistic",
      "expansionist|diplomatic": "diplomatic",
      "defensive|diplomatic": "diplomatic",
      "diplomatic|defensive": "defensive",
      "opportunistic|defensive": "defensive",
      "defensive|opportunistic": "opportunistic",
      "industrial|diplomatic": "diplomatic",
      "diplomatic|industrial": "industrial"
    };
    return table[own + "|" + recommended] || "opportunistic";
  }

  function consult(state, countryId, rng) {
    const country = state.countries[countryId];
    const own = country.profile;
    if (state.seats.role !== "strategist" || state.seats.strategistCountryId !== countryId) return own;
    const stamp = state.mode === "timeline" ? state.year + ":" + state.season : "round:" + state.round;
    const key = countryId + ":" + stamp;
    state.consultMemory = state.consultMemory || {};
    if (state.consultMemory[key]) return state.consultMemory[key].used;
    const roll = (rng || rules.makeRandomRng()).d6();
    const recommended = state.seats.strategistProfile || own;
    let mode = "ignore";
    let used = own;
    if (roll <= 3) {
      mode = "accept";
      used = recommended;
    } else if (roll === 4) {
      mode = "adapt";
      used = adaptProfile(own, recommended);
    }
    const record = { countryId: countryId, roll: roll, recommended: recommended, own: own, used: used, mode: mode };
    state.consultMemory[key] = record;
    state.consult = record;
    rules.pushLog(state, {
      kind: "ai",
      text: country.name + " hears the strategist. Die " + roll + ": " + mode + ". Profile used: " + used + "."
    });
    return used;
  }

  function threat(state, territoryId) {
    const territory = state.territories[territoryId];
    let enemy = 0;
    rules.neighboursOf(territoryId).forEach(function (id) {
      const other = state.territories[id];
      if (rules.hostile(state, territory.ownerId, other.ownerId)) enemy += other.forces;
    });
    return enemy - territory.forces;
  }

  function threshold(profile) {
    if (profile === "defensive") return 1.45;
    if (profile === "expansionist") return 1.02;
    if (profile === "opportunistic") return 1.15;
    if (profile === "diplomatic") return 1.35;
    return 1.25;
  }

  function commitAmount(territory, country) {
    if (territory.forces < 1) return 0;
    if (territory.id === country.capital) {
      if (territory.forces <= 2) return 0;
      return territory.forces - 2;
    }
    return territory.forces;
  }

  function chooseAction(state, countryId, profile) {
    const country = state.countries[countryId];
    const risk = state.settings.risk || 0;
    const need = threshold(profile) - (risk / 100) * 0.4;
    const floor = 26 - risk * 0.12;
    const candidates = [];

    rules.ownedTerritories(state, countryId).forEach(function (territory) {
      if (state.spent[territory.id] || territory.forces < 1) return;
      const board = rules.destinations(state, territory.id);
      board.legal.forEach(function (option) {
        const dest = state.territories[option.toId];
        const selection = rules.draftSelection(state, territory.id, option.toId, territory.id === country.capital ? 2 : 1);
        const amount = rules.unitStrength(selection);
        if (amount < 1) return;
        if (option.kind === "move") {
          const gain = threat(state, dest.id) - threat(state, territory.id);
          const distant = option.cost > 1 && gain > 0 && dest.strategic >= 7;
          if (gain < 2 && !distant) return;
          const action = { type: "move", countryId: countryId, fromId: territory.id, toId: dest.id, selection: selection };
          if (!rules.legalAction(state, action).ok) return;
          candidates.push({
            score: gain * 4 + dest.strategic - option.cost,
            action: action,
            blurb: country.name + " moves " + amount + " strength along " + option.cost + " theatres from " + territory.name + " to " + dest.name + "."
          });
          return;
        }
        const defender = state.countries[dest.ownerId];
        if (!defender || defender.eliminated) return;
        const defence = dest.forces + Math.floor(dest.defence * (state.combatRules.fortFactor == null ? 1 : state.combatRules.fortFactor));
        const ratio = amount / Math.max(1, defence);
        let attackScore = dest.strategic * 4 + (amount - defence) * 7 - option.cost;
        if (defender.capital === dest.id) attackScore += 22;
        if (profile === "expansionist") attackScore += 8;
        if (profile === "diplomatic") attackScore -= 8;
        if (profile === "defensive") attackScore -= 4;
        if (!rules.hostile(state, countryId, defender.id)) {
          const opening = { type: "openHostilities", countryId: countryId, targetCountryId: defender.id };
          if (profile === "diplomatic") return;
          if (option.cost > 1) return;
          if (ratio < need || attackScore < floor) return;
          if (!rules.legalAction(state, opening).ok) return;
          candidates.push({
            score: attackScore - 6,
            action: opening,
            blurb: country.name + " (" + profile + ") opens hostilities with " + defender.name + " before a move on " + dest.name + "."
          });
          return;
        }
        if (!rules.inSupply(state, territory.id)) return;
        if (ratio + 0.001 < need) return;
        const attack = { type: "attack", countryId: countryId, fromId: territory.id, toId: dest.id, selection: selection, autoResolve: true };
        if (!rules.legalAction(state, attack).ok) return;
        candidates.push({
          score: attackScore,
          action: attack,
          blurb: country.name + " (" + profile + ") attacks " + dest.name + " from " + territory.name + " with " + amount + " along " + option.cost + " theatres."
        });
      });
    });

    if (country.industry >= 2) {
      let best = null;
      let bestScore = 0;
      rules.ownedTerritories(state, countryId).forEach(function (territory) {
        if (!rules.inSupply(state, territory.id)) return;
        const pressure = threat(state, territory.id);
        if (pressure <= 0 && profile !== "defensive" && profile !== "industrial") return;
        let score = pressure * 7 + territory.strategic * 2;
        if (territory.id === country.capital) score += 10;
        if (profile === "industrial" || profile === "defensive") score += 8;
        if (score > bestScore) {
          bestScore = score;
          best = territory;
        }
      });
      if (best && bestScore > 12) {
        const action = { type: "reinforce", countryId: countryId, territoryId: best.id, unitId: "infantry", amount: 1 };
        if (rules.legalAction(state, action).ok) {
          candidates.push({
            score: bestScore,
            action: action,
            blurb: country.name + " (" + profile + ") reinforces " + best.name + " against nearby enemy strength."
          });
        }
      }
    }

    if (country.industry >= 3) {
      rules.ownedTerritories(state, countryId).forEach(function (territory) {
        if (territory.defence >= 2 || !rules.inSupply(state, territory.id)) return;
        const pressure = threat(state, territory.id);
        if (pressure < 1 && territory.id !== country.capital) return;
        let score = pressure * 5 + (territory.id === country.capital ? 8 : 0);
        if (profile === "defensive") score += 8;
        if (profile !== "defensive" && profile !== "industrial") score -= 4;
        const action = { type: "fortify", countryId: countryId, territoryId: territory.id };
        if (!rules.legalAction(state, action).ok) return;
        candidates.push({
          score: score,
          action: action,
          blurb: country.name + " fortifies " + territory.name + " while the border is under pressure."
        });
      });
    }

    if (country.influence >= 2 && (profile === "diplomatic" || profile === "opportunistic" || country.influence >= 5)) {
      Object.keys(state.countries).forEach(function (otherId) {
        const other = state.countries[otherId];
        if (!other || other.eliminated || otherId === countryId || other.factionId === country.factionId) return;
        const faction = rules.factionById(state, other.factionId);
        const neutral = faction && !faction.war;
        if (!neutral && profile !== "diplomatic") return;
        const action = {
          type: "allegiance",
          countryId: countryId,
          targetCountryId: otherId,
          proposedFactionId: country.factionId
        };
        if (!rules.legalAction(state, action).ok) return;
        if (!rules.borders(state, countryId, otherId) && profile !== "diplomatic") return;
        let score = 16 + (neutral ? 12 : 0) - other.loyalty * 2;
        if (profile === "diplomatic") score += 14;
        candidates.push({
          score: score,
          action: action,
          blurb: country.name + " (" + profile + ") proposes that " + other.name + " join " + rules.factionName(state, country.factionId) + "."
        });
      });
    }

    candidates.sort(function (a, b) { return b.score - a.score; });
    if (!candidates.length || candidates[0].score < floor) {
      return {
        type: "endTurn",
        countryId: countryId,
        blurb: country.name + " (" + profile + ") holds. No order cleared the risk line."
      };
    }
    const best = candidates[0];
    best.action.blurb = best.blurb;
    return best.action;
  }

  function runAiTurn(state, rng) {
    const countryId = state.activeCountryId;
    const country = state.countries[countryId];
    if (!country || country.eliminated || country.control === "dormant") {
      rules.advanceTurn(state);
      return state;
    }
    const profile = consult(state, countryId, rng);
    for (let step = 0; step < 6; step += 1) {
      const action = chooseAction(state, countryId, profile);
      if (!action || action.type === "endTurn") {
        if (action && action.blurb) rules.pushLog(state, { kind: "ai", text: action.blurb });
        break;
      }
      const result = rules.applyAction(state, action, rng, { fromAi: true });
      if (!result.ok) {
        rules.pushLog(state, { kind: "ai", text: country.name + " stands down. " + result.reason });
        break;
      }
    }
    rules.advanceTurn(state);
    return state;
  }

  const api = {
    consult: consult,
    chooseAction: chooseAction,
    runAiTurn: runAiTurn,
    adaptProfile: adaptProfile
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.FLAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
