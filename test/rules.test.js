"use strict";

const map = require("../js/map");
const scenarios = require("../js/scenarios");
const rules = require("../js/rules");
const ai = require("../js/ai");

const failures = [];
function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

function playerState(extra) {
  return rules.startCampaign(Object.assign({
    eraId: "1914",
    mode: "turn",
    role: "player",
    playerCountryId: "britain",
    aiEnabled: true,
    risk: 40
  }, extra || {}));
}

const geo = require("../js/geography");
assert(map.ids.length === 16, "map should have 16 territories");
assert(geo.places.length > 1500, "the world map should keep country detail");
map.links.forEach(function (link) {
  assert(map.neighbours[link[0]].indexOf(link[1]) !== -1, "link " + link[0] + " to " + link[1]);
  assert(map.neighbours[link[1]].indexOf(link[0]) !== -1, "reverse " + link[1]);
});
map.ids.forEach(function (id) {
  assert(geo.theatres[id] && geo.theatres[id].name, "theatre anchor " + id);
  assert(geo.places.some(function (place) { return place.territory === id && place.d.length > 80; }), "coast " + id);
});
assert(geo.places.every(function (place) { return place.d.indexOf("NaN") === -1; }), "projected coasts are finite");

Object.keys(scenarios.ERAS).forEach(function (eraId) {
  const era = scenarios.ERAS[eraId];
  const owners = {};
  map.ids.forEach(function (id) {
    const territory = era.territories[id];
    assert(territory, eraId + " missing " + id);
    owners[territory.owner] = true;
    assert(territory.forces >= 0 && territory.production >= 0, eraId + " " + id + " numbers");
  });
  assert(era.order.length === era.countries.length, eraId + " order length");
  era.countries.forEach(function (country) {
    assert(era.order.indexOf(country.id) !== -1, eraId + " order missing " + country.id);
    assert(era.territories[country.capital].owner === country.id, eraId + " capital " + country.id);
    assert(owners[country.id], eraId + " " + country.id + " owns nothing");
    assert(era.factions.some(function (f) { return f.id === country.factionId; }), "faction " + country.factionId);
  });
  Object.keys(owners).forEach(function (owner) {
    assert(era.countries.some(function (c) { return c.id === owner; }), eraId + " unknown owner " + owner);
  });
});

const supply = playerState();
assert(rules.inSupply(supply, "india"), "India starts in British supply through Oceania");
assert(rules.inSupply(supply, "british-isles"), "capital is in supply");
supply.territories.oceania.ownerId = "japan";
assert(!rules.inSupply(supply, "india"), "losing Oceania cuts India");
assert(rules.inSupply(supply, "british-isles"), "the capital remains supplied");

const ally = playerState();
const illegal = rules.legalAction(ally, {
  type: "attack", countryId: "france", fromId: "france", toId: "british-isles", amount: 1
});
assert(!illegal.ok, "allies cannot attack each other: " + illegal.reason);

const battle = playerState();
battle.territories.france.defence = 0;
const won = rules.applyAction(battle, {
  type: "attack",
  countryId: "germany",
  fromId: "germany",
  toId: "france",
  selection: { infantry: 1, artillery: 1, armour: 1 },
  useProvidedRolls: true,
  attackRolls: [1, 1, 1],
  defenceRolls: [6, 6, 6]
}, { d6: function () { throw new Error("rerolled"); } }, { fromAi: true });
assert(won.ok, won.reason || "attack should resolve");
assert(battle.combat.outcome === "attacker", "clearing the defenders takes the territory, got " + (battle.combat && battle.combat.outcome));
assert(battle.combat.attackRolls.length === 3 && battle.combat.attackHits === 3, "each attacking unit rolls");
assert(battle.combat.defenceRolls.every(function (roll) { return roll.hit === false; }), "the defence rolls miss");
assert(battle.territories.france.ownerId === "germany", "France falls");
assert(battle.territories.france.units.infantry === 1 && battle.territories.france.units.armour === 1, "the occupying stack is the units that survived");
assert(battle.countries.france.eliminated, "capital capture conquers the country");
assert(battle.territories["north-africa"].ownerId === "germany", "remaining French territory transfers");

const dated = playerState({ startYear: 1916, startSeason: 2 });
assert(dated.year === 1916 && dated.season === 2, "the campaign opens on the chosen date");
assert(dated.log.some(function (entry) { return entry.text.indexOf("Autumn 1916") !== -1; }), "the dispatch names the opening date");
const clamped = playerState({ startYear: 1890, startSeason: 9 });
assert(clamped.year === 1914 && clamped.season === 0, "a date outside the era is brought back to the opening");
const summer = rules.startCampaign({ eraId: "1914", mode: "timeline", role: "spectator", startYear: 1915, startSeason: 1, aiEnabled: true });
assert(summer.year === 1915 && summer.season === 1, "timeline can open in summer");
assert(summer.timeline.incomeYear === 1915, "a summer opening does not pay spring again");
assert(summer.countries.britain.industry === 0, "summer timeline has not collected yet");

const exchange = playerState();
exchange.territories.france.defence = 0;
rules.applyAction(exchange, {
  type: "attack", countryId: "germany", fromId: "germany", toId: "france",
  selection: { infantry: 1 },
  useProvidedRolls: true, attackRolls: [1], defenceRolls: [6, 6, 6]
}, null, { fromAi: true });
assert(exchange.combat.outcome === "retreat", "the attacker retreats when it is the weaker side, got " + (exchange.combat && exchange.combat.outcome));
assert(exchange.combat.retreatTo === "germany" || exchange.territories.germany.units.infantry === 1, "the retreat uses a legal destination");
assert(exchange.territories.france.ownerId === "france", "defender holds when units remain");
assert(exchange.territories.france.units.fighter === 1 && exchange.territories.france.units.destroyer === 1, "units that were not hit stay");
assert(exchange.territories.france.units.transport == null, "the hit removes the weaker unit");
assert(exchange.territories.germany.units.infantry === 1, "the surviving attacker returns");
assert(exchange.territories.germany.units.armour === 1, "units that did not fight stay at home");

const held = playerState();
rules.applyAction(held, {
  type: "attack", countryId: "germany", fromId: "germany", toId: "france",
  selection: { infantry: 1 },
  useProvidedRolls: true, attackRolls: [6], defenceRolls: [1, 6, 6]
}, null, { fromAi: true });
assert(held.combat.outcome === "defender", "defender win");
assert(held.territories.france.ownerId === "france", "France holds");
assert(held.territories.germany.units.infantry == null, "the infantry that rolled is lost");
assert(held.territories.germany.units.armour === 1 && held.territories.germany.units.artillery === 1, "units that did not fight stay");
assert(held.territories.france.units.fighter === 1 && held.territories.france.units.transport === 1 && held.territories.france.units.destroyer === 1, "a miss does not remove a defender");

const thrown = rules.resolveCombat({
  attackers: { infantry: 1 }, defenders: { infantry: 1 },
  useProvidedRolls: true, attackRolls: [2], defenceRolls: [2]
}, { d6: function () { throw new Error("rerolled"); } });
assert(thrown.attackRolls[0].roll === 2 && thrown.defenceRolls[0].roll === 2, "resolver keeps the given dice");
assert(thrown.outcome === "defender", "the defender's hit removes the attacker");

const court = playerState();
const proposal = rules.applyAction(court, {
  type: "allegiance", countryId: "britain", targetCountryId: "italy", proposedFactionId: "entente",
  useProvidedRolls: true, attackRoll: 6, defenceRoll: 1
}, { d6: function () { throw new Error("rerolled"); } }, { fromAi: false });
assert(proposal.ok, proposal.reason || "diplomacy");
assert(court.diplomacy.success, "Italy should accept " + JSON.stringify(court.diplomacy));
assert(court.countries.italy.factionId === "entente", "allegiance changes");
assert(rules.hostile(court, "italy", "germany"), "new allegiance is hostile to the Central Powers");
assert(!rules.hostile(court, "italy", "france"), "new allies are not hostile");
assert(court.countries.britain.influence === 0, "influence was spent, now " + court.countries.britain.influence);

const broke = playerState();
broke.countries.britain.influence = 0;
const refused = rules.applyAction(broke, {
  type: "allegiance", countryId: "britain", targetCountryId: "italy", proposedFactionId: "entente"
}, null, { fromAi: false });
assert(!refused.ok, "diplomacy without influence should fail");

const pact = rules.startCampaign({ eraId: "1939", mode: "turn", role: "player", playerCountryId: "france" });
assert(rules.relation(pact, "germany", "soviet") === 0, "1939 pact");
assert(!rules.hostile(pact, "germany", "soviet"), "a pact is not a legal war");
const blocked = rules.legalAction(pact, {
  type: "attack", countryId: "germany", fromId: "germany", toId: "russia", amount: 1
});
assert(!blocked.ok, "pact blocks the attack");

const clock = playerState({ clockEnabled: true, clockSeconds: 30, clockRule: "pass" });
assert(clock.activeCountryId === "britain", "player acts first");
const beforeYear = clock.year;
rules.applyClockExpiry(clock, rules.makeSeededRng(3), function () { return { type: "endTurn" }; });
assert(clock.activeCountryId !== "britain", "expired clock passes the turn");
assert(clock.year === beforeYear, "one pass does not skip the year");
assert(clock.settings.clockSeconds === 30, "play clock is distinct from timeline speed");

const week = playerState({ clockEnabled: true, clockSeconds: 604800 });
assert(week.settings.clockSeconds === 604800, "a human turn can last a week");
assert(week.clock.deadline > Date.now(), "the week is a deadline, not a reset on each paint");
const odd = playerState({ clockEnabled: true, clockSeconds: 45 });
assert(odd.settings.clockSeconds === 60, "an unlisted duration falls back to one minute");

const vetoTable = rules.startCampaign({
  eraId: "1914",
  mode: "turn",
  role: "player",
  playerCountryId: "britain",
  aiEnabled: true,
  clockEnabled: true,
  clockSeconds: 30,
  clockRule: "ai",
  countryControl: { france: "human" }
});
assert(vetoTable.countries.france.control === "human", "france is the second human seat");
const one = rules.castVeto(vetoTable, "britain");
assert(one.ok, one.reason || "britain veto");
rules.applyClockExpiry(vetoTable, rules.makeSeededRng(2), function () { return { type: "endTurn" }; });
assert(!vetoTable.countries.britain.inactive, "one veto does not override the clock");

const vetoed = rules.startCampaign({
  eraId: "1914",
  mode: "turn",
  role: "player",
  playerCountryId: "britain",
  aiEnabled: true,
  clockEnabled: true,
  clockSeconds: 30,
  clockRule: "ai",
  countryControl: { france: "human" }
});
rules.castVeto(vetoed, "britain");
rules.castVeto(vetoed, "france");
rules.applyClockExpiry(vetoed, rules.makeSeededRng(2), function () { return { type: "endTurn" }; });
assert(vetoed.countries.britain.inactive, "two vetoes leave the timed-out seat inactive");
assert(vetoed.countries.britain.control === "human", "a veto does not hand the seat to AI");
assert(vetoed.activeCountryId !== "britain", "the game continues past the inactive seat");
vetoed.countries.france.inactive = true;
const forced = rules.applyAction(vetoed, {
  type: "attack",
  countryId: "germany",
  fromId: "germany",
  toId: "france",
  selection: { infantry: 1 },
  useProvidedRolls: true,
  attackRolls: [6],
  defenceRolls: [1, 6, 6]
}, { d6: function () { throw new Error("rerolled"); } }, { fromAi: true });
assert(forced.ok, forced.reason || "inactive defender is still attacked");
assert(forced.state.combat.defenceRolls[0].roll === 1, "the defence die is still rolled");
assert(vetoed.combat.summary.indexOf("Forced defence roll") !== -1, "the forced roll is named");
const back = rules.restoreCountry(vetoed, "britain");
assert(back.ok && !vetoed.countries.britain.inactive, "a restored seat can take a later turn");

const queued = playerState({ clockRule: "queue", clockEnabled: true });
const staged = rules.stageAction(queued, { type: "reinforce", countryId: "britain", territoryId: "british-isles", amount: 1 });
assert(staged.ok, staged.reason || "stage");
rules.applyClockExpiry(queued, rules.makeRandomRng(), function () { return { type: "endTurn" }; });
assert(queued.territories["british-isles"].forces === 4, "queued reinforce resolves on expiry");

const bad = rules.loadFromString("{");
assert(!bad.ok, "broken save");
const wrong = rules.loadFromString(JSON.stringify({ version: 99 }));
assert(!wrong.ok && /edition/.test(wrong.reason), "wrong edition");
const round = rules.loadFromString(rules.serialize(playerState()));
assert(round.ok, round.reason || "round trip");
assert(round.state.territories.france.ownerId === "france", "loaded owner");

const later = playerState();
later.territories.germany.forces = 1;
const shifted = rules.startNextEra(later);
assert(shifted.ok, shifted.reason || "next era");
assert(shifted.state.eraId === "1939", "next era id");
assert(shifted.state.year === 1939, "next era year");
assert(shifted.state.chronicle.length === 1, "chronicle kept");
assert(shifted.state.territories.germany.forces === 7, "forces reset to the 1939 scenario");
assert(shifted.state.seats.playerCountryId === "britain", "player seat maps forward");
assert(shifted.state.mode === "turn", "mode is kept");

const austria = rules.startCampaign({ eraId: "1914", mode: "turn", role: "player", playerCountryId: "austria" });
const passed = rules.startNextEra(austria);
assert(passed.state.seats.playerCountryId === "germany", "Austria-Hungary's seat passes to Germany");

const sim = rules.startCampaign({ eraId: "1914", mode: "timeline", role: "spectator", aiEnabled: true, risk: 50 });
assert(sim.timeline.speed === 1, "timeline speed starts at 1");
assert(sim.settings.clockSeconds === 60, "clock seconds are not the timeline speed");
const incomeYear = sim.timeline.incomeYear;
rules.advanceTimeline(sim, rules.makeSeededRng(9), function (state, id) {
  return ai.chooseAction(state, id, ai.consult(state, id, rules.makeSeededRng(9)));
});
assert(sim.timeline.incomeYear === incomeYear, "spring income is not paid twice");
assert(sim.clock.remaining === 60, "a timeline tick does not spend the play clock");

const advisor = rules.startCampaign({
  eraId: "1914", mode: "turn", role: "strategist", strategistCountryId: "germany", strategistProfile: "diplomatic", aiEnabled: true
});
assert(advisor.activeCountryId === "germany", "scenario order leads when there is no player seat");
ai.runAiTurn(advisor, rules.makeSeededRng(2));
assert(advisor.log.some(function (entry) { return /hears the strategist/.test(entry.text); }), "strategist die is logged");

const marathon = rules.startCampaign({ eraId: "1914", mode: "turn", role: "spectator", aiEnabled: true, risk: 45 });
const rng = rules.makeSeededRng(11);
try {
  for (let turn = 0; turn < 24; turn += 1) ai.runAiTurn(marathon, rng);
} catch (error) {
  failures.push("AI marathon threw: " + error.stack);
}
map.ids.forEach(function (id) {
  const territory = marathon.territories[id];
  assert(territory.forces >= 0 && territory.forces === Math.floor(territory.forces), "forces " + id);
  assert(marathon.countries[territory.ownerId], "owner " + id);
});
assert(marathon.year >= 1915, "the campaign year advanced, got " + marathon.year);
assert(marathon.log.length > 0, "dispatches were written");

const units = require("../js/units");
const models = require("../js/unit-models");
for (let budget = 1; budget <= 12; budget += 1) {
  [false, true].forEach(function (coast) {
    const stack = units.compose(budget, coast);
    assert(units.strengthOf(stack) === budget, "stack " + budget + (coast ? " coastal" : " inland") + " sums to the force total");
  });
}
const stacked = playerState();
map.ids.forEach(function (id) {
  const territory = stacked.territories[id];
  assert(units.strengthOf(territory.units) === territory.forces, "opening units match forces on " + id);
});
const own = rules.assessVisibility(stacked, "britain", "britain");
assert(own.resources === "confirmed" && own.treaty === "own", "own roster is confirmed");
assert(own.territories.every(function (item) { return item.status === "confirmed" && item.units; }), "own stacks list types");
const allyView = rules.assessVisibility(stacked, "britain", "france");
assert(allyView.treaty === "allied" && allyView.resources === "shared", "an ally shares the roster");
assert(allyView.territories.every(function (item) { return item.status === "shared" && item.units; }), "allied types are shared");
const enemyView = rules.assessVisibility(stacked, "britain", "germany");
assert(enemyView.treaty === "enemy" && enemyView.resources === "unknown", "an unseen enemy hides resources");
assert(enemyView.territories.every(function (item) { return item.status === "unknown" && item.forces == null; }), "Germany is not beside a British theatre");
const borderView = rules.assessVisibility(stacked, "britain", "ottoman");
const middle = borderView.territories.filter(function (item) { return item.territoryId === "middle-east"; })[0];
assert(middle && middle.status === "estimated" && middle.units == null && middle.forces != null, "a bordering enemy strength is an estimate");
const cordial = rules.assessVisibility(stacked, "germany", "italy");
assert(cordial.treaty === "cordial" && cordial.resources === "unknown", "a cordial treaty does not share industry");
assert(cordial.territories.every(function (item) { return item.status === "shared" && item.units == null && item.forces != null; }), "a cordial treaty shares strength and withholds types");
const memory = playerState();
memory.territories.india.ownerId = "france";
memory.territories.subsahara.ownerId = "france";
memory.territories.oceania.ownerId = "france";
memory.intel = { britain: { "middle-east": { forces: 3, units: null, round: 1, year: 1914, season: 0, quality: "estimated" } } };
const remembered = rules.assessVisibility(memory, "britain", "ottoman");
const old = remembered.territories.filter(function (item) { return item.territoryId === "middle-east"; })[0];
assert(old && old.status === "last-known" && old.observed.indexOf("1914") !== -1, "a force that left sight stays as last-known intelligence");
const before = stacked.activeCountryId;
rules.assessVisibility(stacked, "britain", "germany");
assert(stacked.activeCountryId === before, "inspection does not change the country on the clock");
assert(rules.viewerOf(playerState({ role: "spectator" })) == null, "a spectator has no private view");
const handed = playerState();
handed.countries.france.control = "human";
handed.activeCountryId = "france";
assert(rules.viewerOf(handed) === "britain", "another human on the clock does not become the seated view");
assert(rules.viewerFor(handed, { privacyAck: "france" }) === "france", "the keyboard handoff reveals only that human");
assert(rules.viewerFor(handed, { privacyAck: "germany" }) === "britain", "acknowledging an AI country does not open its roster");
assert(handed.activeCountryId === "france", "the handoff does not change whose turn it is");
units.CATALOGUE.forEach(function (unit) {
  const mesh = models.constructors[unit.id]();
  assert(mesh.positions.length > 30 && mesh.positions.length % 3 === 0, unit.id + " has a mesh");
  assert(mesh.positions.length === mesh.normals.length, unit.id + " normals match");
  assert(mesh.tints.length === mesh.positions.length / 3, unit.id + " tints match");
});
const block = models.constructors.mass();
assert(block.positions.length > 30, "an unidentified stack has a block, not a letter");

const seaMove = rules.legalAction(playerState(), {
  type: "move", countryId: "britain", fromId: "british-isles", toId: "north-america",
  selection: { infantry: 1 }
});
assert(!seaMove.ok, "infantry cannot cross a sea lane: " + seaMove.reason);
const ship = playerState();
const naval = rules.legalAction(ship, {
  type: "move", countryId: "britain", fromId: "british-isles", toId: "oceania",
  selection: { destroyer: 1 }
});
assert(naval.ok, "a destroyer can use a sea lane: " + naval.reason);
const flyer = playerState();
flyer.territories["british-isles"].units.fighter = 1;
const airLane = rules.legalAction(flyer, {
  type: "move", countryId: "britain", fromId: "british-isles", toId: "oceania",
  selection: { fighter: 1 }
});
assert(airLane.ok, "a fighter can cross a sea lane: " + airLane.reason);
const inland = playerState();
inland.territories.germany.units.destroyer = 1;
const landShip = rules.legalAction(inland, {
  type: "attack", countryId: "germany", fromId: "germany", toId: "france",
  selection: { destroyer: 1 }
});
assert(!landShip.ok && landShip.reason.indexOf("cannot reach") !== -1, "a ship cannot move inland: " + landShip.reason);

const migrated = playerState();
const rawSave = JSON.parse(rules.serialize(migrated));
rawSave.version = 1;
delete rawSave.territories.germany.units;
rawSave.territories.germany.forces = 6;
const restored = rules.loadFromString(JSON.stringify(rawSave));
assert(restored.ok, restored.reason || "version 1 save");
assert(restored.state.version === 2, "the save is brought forward");
assert(restored.state.territories.germany.units.armour === 1, "a missing stack is filled once");
restored.state.territories.germany.forces = 1;
rules.syncUnits(restored.state);
assert(restored.state.territories.germany.units.armour === 1, "sync does not rebuild the stack from the scalar");
assert(restored.state.territories.germany.forces === units.strengthOf(restored.state.territories.germany.units), "forces are derived from the stack");

const hidden = rules.assessVisibility(playerState(), "britain", "germany");
assert(hidden.territories.every(function (item) { return item.units == null && item.status === "unknown"; }), "an inspection does not reveal a hidden stack");

["1914", "1939", "2045"].forEach(function (eraId) {
  const problems = rules.validateEra(scenarios.ERAS[eraId]);
  assert(!problems.length, (problems[0] || eraId));
  const started = rules.startCampaign({ eraId: eraId, mode: "turn", role: "spectator", aiEnabled: false });
  map.ids.forEach(function (id) {
    const territory = started.territories[id];
    assert(territory.units && units.countOf(territory.units) > 0, eraId + " " + id + " starts from an explicit stack");
    assert(territory.forces === units.strengthOf(territory.units), eraId + " " + id + " derives forces");
  });
});

const rounds = playerState();
rounds.territories.france.defence = 0;
rounds.countries.france.control = "ai";
const opened = rules.applyAction(rounds, {
  type: "attack", countryId: "germany", fromId: "germany", toId: "france",
  selection: { infantry: 1 }, autoResolve: false,
  useProvidedRolls: true, attackRolls: [1], defenceRolls: [6, 6, 6]
}, { d6: function () { throw new Error("rerolled"); } }, { fromAi: true });
assert(opened.ok, opened.reason || "the first round opens");
assert(rounds.engagement && rounds.engagement.status === "decision", "a manual battle waits after the round");
assert(rounds.engagement.round === 1, "the battle records the round");
assert(rounds.territories.france.units.transport == null, "AI casualties remove the weakest unit");
assert(rounds.territories.france.units.fighter === 1, "the heavier defender stays for the next round");
const second = rules.applyAction(rounds, {
  type: "continueBattle", countryId: "germany",
  useProvidedRolls: true, attackRolls: [1], defenceRolls: [6, 6]
}, { d6: function () { throw new Error("rerolled"); } }, { fromAi: true });
assert(second.ok && rounds.engagement && rounds.engagement.round === 2, "continue fights another round");
assert(rounds.territories.france.units.fighter == null && rounds.territories.france.units.destroyer === 1, "the second hit removes the next weakest unit");
const third = rules.applyAction(rounds, {
  type: "continueBattle", countryId: "germany",
  useProvidedRolls: true, attackRolls: [1], defenceRolls: [6]
}, { d6: function () { throw new Error("rerolled"); } }, { fromAi: true });
assert(third.ok && rounds.combat.outcome === "attacker", "the attackers occupy only after the defenders are gone");
assert(rounds.territories.france.ownerId === "germany" && rounds.territories.france.units.infantry === 1, "the occupying stack is the surviving infantry");
assert(!rounds.engagement, "the battle closes when the territory is taken");

const choice = playerState();
choice.territories.france.defence = 0;
choice.countries.france.control = "human";
rules.applyAction(choice, {
  type: "attack", countryId: "germany", fromId: "germany", toId: "france",
  selection: { infantry: 1 }, autoResolve: false,
  useProvidedRolls: true, attackRolls: [1], defenceRolls: [6, 6, 6]
}, { d6: function () { throw new Error("rerolled"); } }, { fromAi: true });
assert(choice.engagement && choice.engagement.pending && choice.engagement.pending.side === "defender", "the human defender chooses casualties");
assert(choice.territories.france.units.fighter === 1 && choice.territories.france.units.transport === 1, "nothing is removed before the choice");
const picked = rules.applyAction(choice, {
  type: "casualties", countryId: "france", selection: { fighter: 1 }
}, { d6: function () { throw new Error("rerolled"); } }, { fromAi: true });
assert(picked.ok, picked.reason || "casualty choice");
assert(choice.territories.france.units.fighter == null && choice.territories.france.units.transport === 1, "the chosen unit is lost, not the weakest");
const pulled = rules.applyAction(choice, { type: "retreat", countryId: "germany", toId: "germany" }, null, { fromAi: true });
assert(pulled.ok && choice.combat.outcome === "retreat", "the attacker can retreat after the choice");
assert(choice.territories.germany.units.infantry === 1 && choice.territories.france.ownerId === "france", "the retreat lands on the chosen theatre");
const illegalRetreat = playerState();
illegalRetreat.territories.france.defence = 0;
rules.applyAction(illegalRetreat, {
  type: "attack", countryId: "germany", fromId: "germany", toId: "france",
  selection: { infantry: 1 }, autoResolve: false,
  useProvidedRolls: true, attackRolls: [6], defenceRolls: [6, 6, 6]
}, { d6: function () { throw new Error("rerolled"); } }, { fromAi: true });
const blockedRetreat = rules.legalAction(illegalRetreat, { type: "retreat", countryId: "germany", toId: "north-america" });
assert(!blockedRetreat.ok && /legal retreat/.test(blockedRetreat.reason), "an illegal retreat is explained: " + blockedRetreat.reason);

const hop = playerState();
hop.territories.balkans.ownerId = "germany";
hop.territories.balkans.units = { infantry: 1 };
hop.territories["middle-east"].ownerId = "france";
hop.territories["middle-east"].units = { infantry: 1 };
rules.syncUnits(hop);
const far = rules.destinations(hop, "germany");
const east = far.legal.filter(function (option) { return option.toId === "middle-east" && option.kind === "attack" && option.units.armour; })[0];
assert(east && east.cost === 2 && east.routes.armour.steps.indexOf("balkans") !== -1, "armour lists the two-theatre attack");
const foot = rules.legalAction(hop, {
  type: "attack", countryId: "germany", fromId: "germany", toId: "middle-east", selection: { infantry: 1 }
});
assert(!foot.ok && /farther|cannot reach|cannot enter/.test(foot.reason), "infantry is told why the longer route fails: " + foot.reason);
const britainBoard = rules.destinations(playerState(), "british-isles");
const closedSea = britainBoard.blocked.filter(function (option) { return option.toId === "north-america"; })[0];
assert(closedSea && /closed|sea lane/.test(closedSea.reason), "a tempting sea destination explains itself: " + (closedSea && closedSea.reason));

const aiHop = playerState();
aiHop.countries.germany.control = "ai";
aiHop.activeCountryId = "germany";
aiHop.territories.balkans.ownerId = "germany";
aiHop.territories.balkans.units = { infantry: 1 };
aiHop.territories.france.units = { battleship: 2 };
aiHop.territories.russia.units = { battleship: 2 };
aiHop.territories["middle-east"].ownerId = "france";
aiHop.territories["middle-east"].units = { infantry: 1 };
rules.syncUnits(aiHop);
const planned = ai.chooseAction(aiHop, "germany", "expansionist");
assert(planned.type === "attack" && planned.toId === "middle-east", "the AI uses a legal route beyond the neighbouring theatres, got " + planned.type + " " + planned.toId);
assert(map.neighbours.germany.indexOf("middle-east") === -1, "the Middle East is not a neighbour of Central Europe");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("rules tests passed");
