(function (g) {
  "use strict";

  function country(spec) {
    return spec;
  }

  const ERAS = {
    "1914": {
      id: "1914",
      name: "The Powder Keg",
      startYear: 1914,
      endYear: 1918,
      next: "1939",
      political: "The Entente and the Central Powers are already hostile. Italy, the United States, China, Scandinavia, and the Latin Republics are non-aligned and can be courted. Japan begins inside the Entente.",
      techNote: "Trenches. Fortifications add their full value to the defence total.",
      combat: { attackerBonus: 0, massAttackAt: null, massAttackBonus: 0, fortFactor: 1, capitalBonus: 1, oosPenalty: 1 },
      factions: [
        { id: "entente", name: "Entente", war: true, color: "#2c4c7c" },
        { id: "central", name: "Central Powers", war: true, color: "#8a3530" },
        { id: "neutral", name: "Non-Aligned", war: false, color: "#8d7440" }
      ],
      countries: [
        country({ id: "germany", name: "German Empire", factionId: "central", capital: "germany", profile: "expansionist", loyalty: 4, accent: "#a6543c" }),
        country({ id: "austria", name: "Austria-Hungary", factionId: "central", capital: "balkans", profile: "opportunistic", loyalty: 3, accent: "#b5813f" }),
        country({ id: "ottoman", name: "Ottoman Empire", factionId: "central", capital: "middle-east", profile: "defensive", loyalty: 3, accent: "#7d4a38" }),
        country({ id: "britain", name: "United Kingdom", factionId: "entente", capital: "british-isles", profile: "industrial", loyalty: 4, accent: "#3e6a8a" }),
        country({ id: "france", name: "French Republic", factionId: "entente", capital: "france", profile: "defensive", loyalty: 4, accent: "#4f7d78" }),
        country({ id: "russia", name: "Russian Empire", factionId: "entente", capital: "russia", profile: "expansionist", loyalty: 3, accent: "#3f5f86" }),
        country({ id: "japan", name: "Empire of Japan", factionId: "entente", capital: "japan", profile: "opportunistic", loyalty: 3, accent: "#35586a" }),
        country({ id: "america", name: "United States", factionId: "neutral", capital: "north-america", profile: "industrial", loyalty: 4, accent: "#5d6e4a" }),
        country({ id: "italy", name: "Kingdom of Italy", factionId: "neutral", capital: "italy", profile: "diplomatic", loyalty: 2, accent: "#8a7344" }),
        country({ id: "china", name: "Republic of China", factionId: "neutral", capital: "china", profile: "defensive", loyalty: 4, accent: "#8a5a3c" }),
        country({ id: "scandinavia", name: "Scandinavian Compact", factionId: "neutral", capital: "scandinavia", profile: "defensive", loyalty: 4, accent: "#6d7c88" }),
        country({ id: "latins", name: "Latin Republics", factionId: "neutral", capital: "latin-america", profile: "diplomatic", loyalty: 3, accent: "#6e8f62" })
      ],
      territories: {
        "north-america": { owner: "america", units: { destroyer: 1 }, forces: 2, defence: 1, production: 5, strategic: 8 },
        "latin-america": { owner: "latins", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 4 },
        "british-isles": { owner: "britain", units: { transport: 1, destroyer: 1 }, forces: 3, defence: 1, production: 3, strategic: 8 },
        "scandinavia": { owner: "scandinavia", units: { destroyer: 1 }, forces: 2, defence: 1, production: 2, strategic: 4 },
        "france": { owner: "france", units: { fighter: 1, transport: 1, destroyer: 1 }, forces: 5, defence: 1, production: 4, strategic: 8 },
        "germany": { owner: "germany", units: { infantry: 1, artillery: 1, armour: 1 }, forces: 6, defence: 1, production: 6, strategic: 9 },
        "italy": { owner: "italy", units: { transport: 1, destroyer: 1 }, forces: 3, defence: 0, production: 3, strategic: 6 },
        "balkans": { owner: "austria", units: { infantry: 1, armour: 1 }, forces: 4, defence: 1, production: 3, strategic: 6 },
        "russia": { owner: "russia", units: { fighter: 1, transport: 1, destroyer: 1 }, forces: 5, defence: 1, production: 5, strategic: 9 },
        "north-africa": { owner: "france", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 5 },
        "subsahara": { owner: "britain", units: { transport: 1 }, forces: 1, defence: 0, production: 1, strategic: 4 },
        "middle-east": { owner: "ottoman", units: { armour: 1 }, forces: 3, defence: 1, production: 2, strategic: 6 },
        "india": { owner: "britain", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 7 },
        "china": { owner: "china", units: { transport: 1, destroyer: 1 }, forces: 3, defence: 1, production: 3, strategic: 7 },
        "japan": { owner: "japan", units: { transport: 1, destroyer: 1 }, forces: 3, defence: 1, production: 3, strategic: 6 },
        "oceania": { owner: "britain", units: { transport: 1 }, forces: 1, defence: 0, production: 1, strategic: 5 }
      },
      relationOverrides: [
        { a: "italy", b: "germany", value: 1 },
        { a: "italy", b: "austria", value: 1 }
      ],
      order: ["germany", "austria", "ottoman", "britain", "france", "russia", "japan", "america", "italy", "china", "scandinavia", "latins"],
      successors: {
        germany: "germany",
        austria: "germany",
        ottoman: "britain",
        britain: "britain",
        france: "france",
        russia: "soviet",
        japan: "japan",
        america: "america",
        italy: "italy",
        china: "china",
        scandinavia: "scandinavia",
        latins: "latins"
      }
    },
    "1939": {
      id: "1939",
      name: "The Fracture",
      startYear: 1939,
      endYear: 1945,
      next: "2045",
      political: "Three teams open the war: Europe, the United States, and the Axis. They begin hostile to one another. France stands for Europe, with the United Kingdom waiting to be added to that team. Germany and Italy stand for the Axis, with Japan waiting to be added. The Soviet Union and the non-aligned countries wait until a player brings them in. Germany and the Soviet Union keep a pact at relation 0 until hostilities are opened.",
      techNote: "Combined arms. An attack that commits 5 or more forces gains +1.",
      combat: { attackerBonus: 0, massAttackAt: 5, massAttackBonus: 1, fortFactor: 1, capitalBonus: 1, oosPenalty: 1 },
      factions: [
        { id: "europe", name: "Europe", war: true, color: "#2c4c7c" },
        { id: "america", name: "United States", war: true, color: "#3d6a4a" },
        { id: "axis", name: "Axis", war: true, color: "#8a3530" },
        { id: "comintern", name: "Comintern", war: true, color: "#6e4a28" },
        { id: "neutral", name: "Non-Aligned", war: false, color: "#8d7440" }
      ],
      countries: [
        country({ id: "germany", name: "Germany", factionId: "axis", capital: "germany", profile: "expansionist", loyalty: 5, accent: "#a6543c" }),
        country({ id: "italy", name: "Italy", factionId: "axis", capital: "italy", profile: "opportunistic", loyalty: 3, accent: "#8a7344" }),
        country({ id: "japan", name: "Japan", factionId: "axis", capital: "japan", profile: "expansionist", loyalty: 4, accent: "#8d4d55" }),
        country({ id: "soviet", name: "Soviet Union", factionId: "comintern", capital: "russia", profile: "opportunistic", loyalty: 5, accent: "#7a5340" }),
        country({ id: "britain", name: "United Kingdom", factionId: "europe", capital: "british-isles", profile: "industrial", loyalty: 4, accent: "#3e6a8a" }),
        country({ id: "france", name: "France", factionId: "europe", capital: "france", profile: "defensive", loyalty: 3, accent: "#4f7d78" }),
        country({ id: "china", name: "China", factionId: "neutral", capital: "china", profile: "defensive", loyalty: 4, accent: "#8a5a3c" }),
        country({ id: "america", name: "United States", factionId: "america", capital: "north-america", profile: "industrial", loyalty: 4, accent: "#5d6e4a" }),
        country({ id: "yugoslavia", name: "Yugoslavia", factionId: "neutral", capital: "balkans", profile: "defensive", loyalty: 3, accent: "#6d7c88" }),
        country({ id: "scandinavia", name: "Scandinavia", factionId: "neutral", capital: "scandinavia", profile: "defensive", loyalty: 4, accent: "#7d8b96" }),
        country({ id: "latins", name: "Latin Republics", factionId: "neutral", capital: "latin-america", profile: "diplomatic", loyalty: 3, accent: "#6e8f62" })
      ],
      territories: {
        "north-america": { owner: "america", units: { transport: 1, destroyer: 1 }, forces: 3, defence: 1, production: 6, strategic: 8 },
        "latin-america": { owner: "latins", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 4 },
        "british-isles": { owner: "britain", units: { transport: 1, destroyer: 1 }, forces: 3, defence: 1, production: 3, strategic: 8 },
        "scandinavia": { owner: "scandinavia", units: { destroyer: 1 }, forces: 2, defence: 1, production: 2, strategic: 4 },
        "france": { owner: "france", units: { fighter: 1, destroyer: 1 }, forces: 4, defence: 1, production: 4, strategic: 8 },
        "germany": { owner: "germany", units: { artillery: 1, armour: 1, fighter: 1 }, forces: 7, defence: 1, production: 6, strategic: 9 },
        "italy": { owner: "italy", units: { fighter: 1, destroyer: 1 }, forces: 4, defence: 0, production: 3, strategic: 6 },
        "balkans": { owner: "yugoslavia", units: { armour: 1 }, forces: 3, defence: 1, production: 2, strategic: 5 },
        "russia": { owner: "soviet", units: { artillery: 1, fighter: 1, destroyer: 1 }, forces: 6, defence: 1, production: 5, strategic: 9 },
        "north-africa": { owner: "france", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 5 },
        "subsahara": { owner: "britain", units: { transport: 1 }, forces: 1, defence: 0, production: 1, strategic: 4 },
        "middle-east": { owner: "britain", units: { infantry: 1 }, forces: 1, defence: 0, production: 1, strategic: 6 },
        "india": { owner: "britain", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 7 },
        "china": { owner: "china", units: { fighter: 1, destroyer: 1 }, forces: 4, defence: 1, production: 3, strategic: 7 },
        "japan": { owner: "japan", units: { fighter: 1, destroyer: 1 }, forces: 4, defence: 1, production: 3, strategic: 7 },
        "oceania": { owner: "britain", units: { transport: 1 }, forces: 1, defence: 0, production: 1, strategic: 4 }
      },
      relationOverrides: [
        { a: "germany", b: "soviet", value: 0 }
      ],
      order: ["germany", "italy", "japan", "soviet", "britain", "france", "china", "america", "yugoslavia", "scandinavia", "latins"],
      opening: {
        germany: "ai",
        italy: "ai",
        japan: "dormant",
        soviet: "dormant",
        britain: "dormant",
        france: "ai",
        china: "dormant",
        america: "ai",
        yugoslavia: "dormant",
        scandinavia: "dormant",
        latins: "dormant"
      },
      teams: [
        { name: "Europe", text: "France is at the table. Add the United Kingdom to this team." },
        { name: "United States", text: "The United States is a starting team." },
        { name: "Axis", text: "Germany and Italy are at the table. Add Japan to this team." }
      ],
      successors: {
        germany: "europa",
        italy: "med",
        japan: "eastasia",
        soviet: "eurasia",
        britain: "europa",
        france: "europa",
        china: "eastasia",
        america: "nac",
        yugoslavia: "med",
        scandinavia: "europa",
        latins: "andes"
      }
    },
    "2045": {
      id: "2045",
      name: "The Lattice War",
      startYear: 2045,
      endYear: 2052,
      next: null,
      political: "The Atlantic Accord and the Meridian Pact are hostile. Six compacts remain non-aligned and can change the war by allegiance. Precision fires favour the attacker and blunt forts.",
      techNote: "Precision fires. Attacks gain +1. Fortifications count at half, rounded down.",
      combat: { attackerBonus: 1, massAttackAt: null, massAttackBonus: 0, fortFactor: 0.5, capitalBonus: 1, oosPenalty: 1 },
      factions: [
        { id: "atlantic", name: "Atlantic Accord", war: true, color: "#24556e" },
        { id: "meridian", name: "Meridian Pact", war: true, color: "#8a3d45" },
        { id: "neutral", name: "Non-Aligned", war: false, color: "#8d7440" }
      ],
      countries: [
        country({ id: "eurasia", name: "Eurasian Directorate", factionId: "meridian", capital: "russia", profile: "expansionist", loyalty: 4, accent: "#8d4d55" }),
        country({ id: "eastasia", name: "East Asian Combine", factionId: "meridian", capital: "china", profile: "industrial", loyalty: 4, accent: "#a45a48" }),
        country({ id: "nac", name: "North American Commonwealth", factionId: "atlantic", capital: "north-america", profile: "industrial", loyalty: 4, accent: "#3d6d78" }),
        country({ id: "europa", name: "European Federation", factionId: "atlantic", capital: "france", profile: "defensive", loyalty: 4, accent: "#3e6280" }),
        country({ id: "med", name: "Mediterranean League", factionId: "neutral", capital: "italy", profile: "diplomatic", loyalty: 2, accent: "#8a7344" }),
        country({ id: "nile", name: "Nile-Levant Compact", factionId: "neutral", capital: "middle-east", profile: "opportunistic", loyalty: 3, accent: "#a06b3e" }),
        country({ id: "india", name: "Subcontinent Union", factionId: "neutral", capital: "india", profile: "defensive", loyalty: 4, accent: "#6e8f62" }),
        country({ id: "austral", name: "Austral Coalition", factionId: "neutral", capital: "oceania", profile: "industrial", loyalty: 3, accent: "#4f7d78" }),
        country({ id: "sahel", name: "Southern Accord", factionId: "neutral", capital: "subsahara", profile: "diplomatic", loyalty: 3, accent: "#b08948" }),
        country({ id: "andes", name: "Andean Compact", factionId: "neutral", capital: "latin-america", profile: "diplomatic", loyalty: 3, accent: "#5d6e4a" })
      ],
      territories: {
        "north-america": { owner: "nac", units: { fighter: 1, transport: 1, destroyer: 1 }, forces: 5, defence: 1, production: 6, strategic: 8 },
        "latin-america": { owner: "andes", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 4 },
        "british-isles": { owner: "europa", units: { destroyer: 1 }, forces: 2, defence: 1, production: 2, strategic: 6 },
        "scandinavia": { owner: "europa", units: { transport: 1 }, forces: 1, defence: 1, production: 2, strategic: 4 },
        "france": { owner: "europa", units: { transport: 1, destroyer: 1 }, forces: 3, defence: 1, production: 3, strategic: 8 },
        "germany": { owner: "europa", units: { armour: 1 }, forces: 3, defence: 1, production: 4, strategic: 7 },
        "italy": { owner: "med", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 5 },
        "balkans": { owner: "med", units: { artillery: 1 }, forces: 2, defence: 1, production: 2, strategic: 5 },
        "russia": { owner: "eurasia", units: { artillery: 1, fighter: 1, destroyer: 1 }, forces: 6, defence: 1, production: 5, strategic: 9 },
        "north-africa": { owner: "nile", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 5 },
        "subsahara": { owner: "sahel", units: { destroyer: 1 }, forces: 2, defence: 0, production: 2, strategic: 4 },
        "middle-east": { owner: "nile", units: { artillery: 1 }, forces: 2, defence: 1, production: 2, strategic: 6 },
        "india": { owner: "india", units: { transport: 1, destroyer: 1 }, forces: 3, defence: 1, production: 3, strategic: 7 },
        "china": { owner: "eastasia", units: { fighter: 1, destroyer: 1 }, forces: 4, defence: 1, production: 4, strategic: 8 },
        "japan": { owner: "eastasia", units: { transport: 1, destroyer: 1 }, forces: 3, defence: 1, production: 3, strategic: 6 },
        "oceania": { owner: "austral", units: { destroyer: 1 }, forces: 2, defence: 1, production: 2, strategic: 5 }
      },
      relationOverrides: [],
      order: ["eurasia", "eastasia", "nac", "europa", "med", "nile", "india", "austral", "sahel", "andes"],
      successors: {}
    }
  };

  const api = { ERAS: ERAS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.FLEras = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
