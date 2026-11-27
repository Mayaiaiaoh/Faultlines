(function () {
  "use strict";

  const rules = window.FLRules;
  const ai = window.FLAI;
  const renderApi = window.FLRender;
  const eras = window.FLEras;

  const rng = rules.makeRandomRng();
  let state = null;
  let session = 0;
  let pumping = false;
  let clockHandle = null;
  let timelineHandle = null;
  let aiHandle = null;

  const ui = {
    screen: "setup",
    setup: {
      eraId: "1914",
      startYear: 1914,
      startSeason: 0,
      mode: "turn",
      role: "player",
      playerCountryId: "britain",
      strategistCountryId: "germany",
      strategistProfile: "diplomatic",
      presentation: "board",
      aiEnabled: true,
      risk: 40,
      clockEnabled: true,
      clockSeconds: 60,
      clockRule: "pass",
      allowSpectators: true,
      allowStrategists: true,
      countryControl: {}
    },
    selectedId: "british-isles",
    amount: 1,
    stage: false,
    diploTarget: "italy",
    diploFaction: "entente",
    commandId: null,
    notice: "",
    modal: null,
    hideSeq: 0,
    resumeOk: false,
    resumeError: "",
    map: { x: 0, y: 0, k: 1 },
    suppressMapClick: false,
    display: { pieces: "single", names: true, lanes: true, grid: true, sites: true, tilt: 0.58 },
    casualtyPick: {},
    casualtyToken: "",
  };

  const DISPLAY_KEY = "faultlines.display.v1";

  const MAP_MIN = 1;
  const MAP_MAX = 24;

  function halt() {
    session += 1;
    pumping = false;
    clearTimeout(aiHandle);
    clearInterval(clockHandle);
    clearInterval(timelineHandle);
    clockHandle = null;
    timelineHandle = null;
  }

  function syncLoops() {
    clearInterval(clockHandle);
    clearInterval(timelineHandle);
    clockHandle = null;
    timelineHandle = null;
    if (!state || ui.screen !== "game") return;
    if (state.mode === "turn" && state.settings.clockEnabled && !(state.winner && !state.winner.continued)) {
      const active = state.countries[state.activeCountryId];
      if (active && active.control === "human") clockHandle = setInterval(tickClock, 1000);
    }
    if (state.mode === "timeline" && state.timeline.playing && !(state.winner && !state.winner.continued)) {
      const speed = [1, 2, 4, 8].indexOf(state.timeline.speed) === -1 ? 1 : state.timeline.speed;
      timelineHandle = setInterval(tickTimeline, 1600 / speed);
    }
  }

  function capture() {
    const side = document.getElementById("side");
    const log = document.getElementById("log-list");
    return { side: side ? side.scrollTop : 0, log: log ? log.scrollTop : 0 };
  }

  function restore(saved) {
    const side = document.getElementById("side");
    const log = document.getElementById("log-list");
    if (side) side.scrollTop = saved.side;
    if (log) log.scrollTop = saved.log;
  }

  function mapSvgEl() {
    return document.getElementById("world-map");
  }

  function clampMap() {
    const view = window.FLGeo && window.FLGeo.view;
    if (!view) return;
    if (ui.map.k <= MAP_MIN) {
      ui.map.k = MAP_MIN;
      ui.map.x = 0;
      ui.map.y = 0;
      return;
    }
    if (ui.map.k > MAP_MAX) ui.map.k = MAP_MAX;
    const k = ui.map.k;
    const margin = 140;
    const minX = view.x + margin - 3900 * k;
    const maxX = view.x + view.w - margin + 200 * k;
    const minY = view.y + margin - 3900 * k;
    const maxY = view.y + view.h - margin;
    ui.map.x = Math.min(maxX, Math.max(minX, ui.map.x));
    ui.map.y = Math.min(maxY, Math.max(minY, ui.map.y));
  }

  function applyMapView() {
    const svg = mapSvgEl();
    const camera = document.getElementById("world-camera");
    if (!camera) return;
    clampMap();
    camera.setAttribute("transform", "translate(" + ui.map.x + " " + ui.map.y + ") scale(" + ui.map.k + ")");
    const readout = document.getElementById("zoom-readout");
    if (readout) readout.textContent = Math.round(ui.map.k * 100) + "%";
    if (state) renderApi.syncMapZoom(svg, ui.map.k);
    if (state && window.FLPieces) {
      try { window.FLPieces.sync(svg, state, ui); }
      catch (error) { console.error(error); }
    }
  }

  function viewPoint(svg, clientX, clientY) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return point.matrixTransform(ctm.inverse());
  }

  function zoomAt(factor, clientX, clientY) {
    const svg = mapSvgEl();
    if (!svg) return;
    const next = Math.max(MAP_MIN, Math.min(MAP_MAX, ui.map.k * factor));
    let vx;
    let vy;
    if (clientX == null || clientY == null) {
      const box = svg.viewBox.baseVal;
      vx = box.x + box.width / 2;
      vy = box.y + box.height / 2;
    } else {
      const hit = viewPoint(svg, clientX, clientY);
      if (!hit) return;
      vx = hit.x;
      vy = hit.y;
    }
    const wx = (vx - ui.map.x) / ui.map.k;
    const wy = (vy - ui.map.y) / ui.map.k;
    ui.map.k = next;
    ui.map.x = vx - wx * next;
    ui.map.y = vy - wy * next;
    applyMapView();
  }

  function bindMap(frame) {
    if (!frame || frame.dataset.mapBound) return;
    frame.dataset.mapBound = "1";
    const pointers = new Map();
    let drag = null;
    let pinch = null;

    frame.addEventListener("wheel", function (event) {
      if (!mapSvgEl()) return;
      event.preventDefault();
      let dy = event.deltaY;
      if (event.deltaMode === 1) dy *= 16;
      if (event.deltaMode === 2) dy *= 160;
      const factor = Math.exp(Math.max(-0.7, Math.min(0.7, -dy * 0.0015)));
      zoomAt(factor, event.clientX, event.clientY);
    }, { passive: false });

    frame.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      if (event.target.closest(".zoom-bar")) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      frame.setPointerCapture(event.pointerId);
      if (pointers.size >= 2) {
        const pts = Array.from(pointers.values());
        const svg = mapSvgEl();
        const mid = viewPoint(svg, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        pinch = {
          dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
          k: ui.map.k,
          wx: mid ? (mid.x - ui.map.x) / ui.map.k : 0,
          wy: mid ? (mid.y - ui.map.y) / ui.map.k : 0
        };
        drag = null;
        frame.classList.add("dragging");
      } else {
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: ui.map.x, oy: ui.map.y, moved: false };
      }
    });

    frame.addEventListener("pointermove", function (event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const svg = mapSvgEl();
      if (!svg) return;
      if (pointers.size >= 2 && pinch) {
        const pts = Array.from(pointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        const mid = viewPoint(svg, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        if (!mid) return;
        ui.map.k = Math.max(MAP_MIN, Math.min(MAP_MAX, pinch.k * (dist / pinch.dist)));
        ui.map.x = mid.x - pinch.wx * ui.map.k;
        ui.map.y = mid.y - pinch.wy * ui.map.k;
        applyMapView();
        ui.suppressMapClick = true;
        return;
      }
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 5) {
        drag.moved = true;
        frame.classList.add("dragging");
      }
      const rect = svg.getBoundingClientRect();
      const scale = rect.width / svg.viewBox.baseVal.width;
      ui.map.x = drag.ox + dx / scale;
      ui.map.y = drag.oy + dy / scale;
      applyMapView();
    });

    function endPointer(event) {
      pointers.delete(event.pointerId);
      if (drag && event.pointerId === drag.id) {
        if (drag.moved) ui.suppressMapClick = true;
        drag = null;
      }
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) frame.classList.remove("dragging");
    }

    frame.addEventListener("pointerup", endPointer);
    frame.addEventListener("pointercancel", endPointer);
  }

  function focusToken() {
    if (!state) return "";
    const battle = state.engagement ? state.engagement.fromId + ">" + state.engagement.toId + ":" + state.engagement.round : "";
    return state.activeCountryId + "|" + state.round + "|" + (ui.selectedId || "") + "|" + battle;
  }

  function interestIds() {
    const ids = [];
    const seen = {};
    function add(id) {
      if (!id || seen[id] || !state.territories[id]) return;
      seen[id] = true;
      ids.push(id);
    }
    if (state.activeCountryId) {
      window.FLMap.ids.forEach(function (id) {
        if (state.territories[id].ownerId === state.activeCountryId) add(id);
      });
    }
    add(ui.selectedId);
    if (ui.selectedId && window.FLRules.destinations && state.territories[ui.selectedId].ownerId === state.activeCountryId) {
      window.FLRules.destinations(state, ui.selectedId).legal.forEach(function (option) { add(option.toId); });
    }
    if (state.engagement) {
      add(state.engagement.fromId);
      add(state.engagement.toId);
    }
    return ids;
  }

  function frameInterest() {
    const view = window.FLGeo && window.FLGeo.view;
    if (!view || !state) return;
    const ids = interestIds();
    if (!ids.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    ids.forEach(function (id) {
      const at = window.FLMap.point(id, "land") || window.FLGeo.theatres[id];
      minX = Math.min(minX, at.x);
      maxX = Math.max(maxX, at.x);
      minY = Math.min(minY, at.y);
      maxY = Math.max(maxY, at.y);
    });
    const padX = Math.max(220, (maxX - minX) * 0.28);
    const padY = Math.max(160, (maxY - minY) * 0.28);
    const bw = Math.max(320, maxX - minX + padX * 2);
    const bh = Math.max(220, maxY - minY + padY * 2);
    let k = Math.min(view.w / bw, view.h / bh);
    k = Math.max(1.2, Math.min(2.7, k));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    ui.map.k = k;
    ui.map.x = (view.x + view.w / 2) - cx * k;
    ui.map.y = (view.y + view.h / 2) - cy * k;
    ui.focusToken = focusToken();
    applyMapView();
  }

  function maybeFrame() {
    if (!state || ui.screen !== "game") return;
    if (ui.focusToken === focusToken()) return;
    frameInterest();
  }

  function draw() {
    if (state && ui.seenActive !== state.activeCountryId) {
      ui.seenActive = state.activeCountryId;
      ui.inspectId = state.activeCountryId;
      ui.privacyAck = "";
      ui.highlightType = "";
    }
    if (state && state.engagement && state.engagement.pending) {
      const token = state.engagement.round + ":" + state.engagement.pending.side + ":" + state.engagement.pending.must;
      if (ui.casualtyToken !== token) {
        ui.casualtyToken = token;
        ui.casualtyPick = {};
      }
    } else if (ui.casualtyToken) {
      ui.casualtyToken = "";
      ui.casualtyPick = {};
    }
    const saved = capture();
    const presentation = state ? state.presentation : ui.setup.presentation;
    const mode = presentation === "anime" ? "anime" : "board";
    document.body.dataset.presentation = mode;
    const existing = document.getElementById("world-map");
    const held = existing && state && ui.screen === "game" && existing.getAttribute("data-presentation") === mode ? existing : null;
    if (held) held.remove();
    const app = document.getElementById("app");
    try {
      app.innerHTML = state && ui.screen === "game" ? renderApi.game(state, ui) : renderApi.setup(ui);
      const slot = document.getElementById("map-slot");
      if (slot && state && ui.screen === "game") {
        if (held) slot.appendChild(held);
        else slot.innerHTML = renderApi.mapSvg(state);
        renderApi.paintMap(slot.querySelector("#world-map"), state, ui);
        bindMap(slot.parentNode);
        maybeFrame();
        applyMapView();
      }
    } catch (error) {
      app.textContent = "The table failed to draw. " + (error && error.message ? error.message : "Unknown error.");
      console.error(error);
      return;
    }
    restore(saved);
    syncLoops();
  }

  function autosave() {
    if (!state) return;
    const result = rules.storage.save(state);
    if (!result.ok) ui.notice = result.reason;
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

  function adopt(next) {
    halt();
    state = next;
    ui.screen = "game";
    ui.modal = null;
    ui.notice = "";
    ui.hideSeq = 0;
    const player = state.seats.playerCountryId && state.countries[state.seats.playerCountryId];
    ui.selectedId = player ? player.capital : state.countries[state.order[0]].capital;
    ui.commandId = player ? player.id : null;
    ui.amount = 1;
    ui.map = { x: 0, y: 0, k: 1 };
    const actor = renderApi.actingId(state, ui);
    if (actor) {
      ui.diploFaction = state.countries[actor].factionId;
    }
    draw();
    pumpAi();
  }

  function buildSetup() {
    const setup = ui.setup;
    return {
      eraId: setup.eraId,
      mode: setup.mode,
      role: setup.role,
      playerCountryId: setup.playerCountryId,
      strategistCountryId: setup.strategistCountryId,
      strategistProfile: setup.strategistProfile,
      presentation: setup.presentation,
      aiEnabled: setup.aiEnabled,
      risk: Number(setup.risk),
      clockEnabled: setup.mode === "turn" && !!setup.clockEnabled,
      clockSeconds: Number(setup.clockSeconds),
      clockRule: setup.clockRule,
      startYear: setup.startYear,
      startSeason: setup.startSeason,
      allowSpectators: setup.allowSpectators,
      allowStrategists: setup.allowStrategists,
      countryControl: Object.assign({}, setup.countryControl)
    };
  }

  function orderAmount(kind, actor, territory) {
    let amount = ui.amount | 0;
    if (amount < 1) amount = 1;
    if (kind === "reinforce") {
      const cap = Math.floor(actor.industry / 2);
      return Math.max(1, Math.min(amount, cap || 1));
    }
    return Math.max(1, Math.min(amount, territory && territory.forces ? territory.forces : 1));
  }

  function issue(action) {
    const battle = action.type === "casualties" || action.type === "continueBattle" || action.type === "retreat" || action.type === "autoResolve";
    if (ui.stage && state.mode === "turn" && !battle) {
      const staged = rules.stageAction(state, action);
      ui.notice = staged.ok ? "Staged. It resolves when you end the turn or the clock executes the queue." : staged.reason;
    } else {
      const result = rules.applyAction(state, action, rng);
      ui.notice = result.ok ? "" : result.reason;
      if (result.ok) ui.hideSeq = 0;
    }
    autosave();
    draw();
  }

  function pumpAi() {
    if (!state || state.mode !== "turn" || ui.screen !== "game") return;
    if (state.winner && !state.winner.continued) return;
    const active = state.countries[state.activeCountryId];
    if (!active || active.control !== "ai") return;
    const humanWaiting = Object.keys(state.countries).some(function (id) {
      const country = state.countries[id];
      return country.control === "human" && !country.eliminated;
    });
    if (!humanWaiting || pumping) return;
    pumping = true;
    const token = session;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    aiHandle = setTimeout(function () {
      pumping = false;
      if (token !== session || !state) return;
      const current = state.countries[state.activeCountryId];
      if (!current || current.control !== "ai") return;
      const profile = ai.consult(state, current.id, rng);
      const action = ai.chooseAction(state, current.id, profile);
      if (!action || action.type === "endTurn") {
        if (action && action.blurb) rules.pushLog(state, { kind: "ai", text: action.blurb });
        rules.advanceTurn(state);
      } else {
        const result = rules.applyAction(state, action, rng, { fromAi: true });
        if (!result.ok) {
          rules.pushLog(state, { kind: "ai", text: current.name + " stands down. " + result.reason });
          rules.advanceTurn(state);
        }
      }
      ui.hideSeq = 0;
      autosave();
      draw();
      pumpAi();
    }, reduced ? 0 : 380);
  }

  function tickClock() {
    if (!state || state.mode !== "turn" || !state.settings.clockEnabled) return;
    const active = state.countries[state.activeCountryId];
    if (!active || active.control !== "human" || active.inactive) return;
    if (state.clock && state.clock.deadline) {
      state.clock.remaining = Math.max(0, Math.ceil((state.clock.deadline - Date.now()) / 1000));
    } else if (state.clock) {
      state.clock.remaining -= 1;
    }
    const warnAt = state.clock && state.clock.warnAt || 10;
    if (state.clock && !state.clock.warned && state.clock.remaining <= warnAt && state.clock.remaining > 0) {
      state.clock.warned = true;
      rules.pushLog(state, { kind: "system", text: clockLabel(state.clock.remaining) + " remain on the play clock." });
      autosave();
      draw();
      return;
    }
    if (state.clock && state.clock.remaining <= 0) {
      rules.applyClockExpiry(state, rng, function (current, id) {
        return ai.chooseAction(current, id, ai.consult(current, id, rng));
      });
      autosave();
      draw();
      pumpAi();
      return;
    }
    const el = document.getElementById("clock-readout");
    if (el && state.clock) {
      el.innerHTML = "Play clock <strong>" + clockLabel(state.clock.remaining) + "</strong>";
      el.classList.toggle("warn", state.clock.remaining <= warnAt);
    }
  }

  function tickTimeline() {
    if (!state || !state.timeline.playing) return;
    rules.advanceTimeline(state, rng, function (current, id) {
      return ai.chooseAction(current, id, ai.consult(current, id, rng));
    });
    ui.hideSeq = 0;
    autosave();
    draw();
  }

  function download(campaign) {
    const blob = new Blob([rules.serialize(campaign)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "faultlines-" + campaign.eraId + "-" + campaign.year + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function setEra(id) {
    if (!eras.ERAS[id]) return;
    ui.setup.eraId = id;
    const era = eras.ERAS[id];
    if (!era.countries.some(function (country) { return country.id === ui.setup.playerCountryId; })) {
      ui.setup.playerCountryId = era.countries[0].id;
    }
    if (!era.countries.some(function (country) { return country.id === ui.setup.strategistCountryId; })) {
      ui.setup.strategistCountryId = era.countries[0].id;
    }
    ui.setup.countryControl = {};
    ui.setup.startYear = era.startYear;
    ui.setup.startSeason = 0;
    ui.diploFaction = era.countries[0].factionId;
  }

  function onClick(event) {
    if (ui.suppressMapClick) {
      ui.suppressMapClick = false;
      return;
    }
    if (event.target.classList && event.target.classList.contains("modal-back")) {
      ui.modal = null;
      draw();
      return;
    }
    const node = event.target.closest("[data-act]");
    if (!node) {
      const territory = event.target.closest("[data-id]");
      if (territory && state && ui.screen === "game") {
        ui.selectedId = territory.getAttribute("data-id");
        const picked = state.territories[ui.selectedId];
        if (picked) ui.amount = Math.max(1, picked.forces || 1);
        ui.notice = "";
        draw();
      }
      return;
    }
    const act = node.dataset.act;
    if (act === "era") setEra(node.dataset.era);
    else if (act === "mode") ui.setup.mode = node.dataset.value === "timeline" ? "timeline" : "turn";
    else if (act === "role") {
      const role = node.dataset.value;
      if (role === "spectator" && !ui.setup.allowSpectators) return;
      if (role === "strategist" && !ui.setup.allowStrategists) return;
      ui.setup.role = role;
    } else if (act === "presentation") {
      if (node.dataset.value) ui.setup.presentation = node.dataset.value === "anime" ? "anime" : "board";
      else if (state) {
        state.presentation = state.presentation === "anime" ? "board" : "anime";
        autosave();
      }
    } else if (act === "start") {
      try {
        adopt(rules.startCampaign(buildSetup()));
        autosave();
      } catch (error) {
        ui.notice = error.message || "The campaign could not start.";
      }
      draw();
      return;
    } else if (act === "resume") {
      const loaded = rules.storage.load();
      if (!loaded.ok) {
        ui.resumeOk = false;
        ui.resumeError = loaded.reason;
        ui.notice = loaded.reason;
      } else adopt(loaded.state);
      draw();
      return;
    } else if (act === "rules") ui.modal = "rules";
    else if (act === "online") ui.modal = "online";
    else if (act === "close-modal") ui.modal = null;
    else if (act === "load-open") ui.modal = "load";
    else if (act === "new-game") ui.modal = state ? "abandon" : null;
    else if (act === "confirm-new") {
      halt();
      state = null;
      ui.screen = "setup";
      ui.modal = null;
      ui.notice = "";
    } else if (act === "save" && state) {
      const stored = rules.storage.save(state);
      download(state);
      ui.notice = stored.ok ? "Saved in this browser, and a JSON copy was downloaded." : stored.reason;
    } else if (act === "select" && state) {
      ui.selectedId = node.dataset.id;
      ui.highlightType = node.dataset.type || "";
      const picked = state.territories[ui.selectedId];
      if (picked && rules.viewerFor) {
        const owner = state.countries[picked.ownerId];
        const report = owner ? rules.assessVisibility(state, rules.viewerFor(state, ui), owner.id) : null;
        const known = report && report.territories.filter(function (item) { return item.territoryId === picked.id; })[0];
        if (known && known.status !== "unknown" && known.forces != null) ui.amount = Math.max(1, known.forces);
      }
    } else if (act === "inspect" && state) {
      ui.inspectId = node.dataset.country || "";
    } else if (act === "locate" && state) {
      ui.selectedId = node.dataset.id;
      ui.highlightType = node.dataset.type || "";
    } else if (act === "highlight-type") {
      ui.highlightType = node.dataset.type || "";
    } else if (act === "reveal-turn" && state) {
      ui.privacyAck = state.activeCountryId;
    } else if (act === "tilt") {
      const tilt = Number(node.dataset.tilt);
      if (tilt === 0.5 || tilt === 1.05) ui.display.tilt = tilt;
      saveDisplay();
    } else if (act === "dismiss" && state) {
      ui.hideSeq = Math.max(state.combat && state.combat.seq || 0, state.diplomacy && state.diplomacy.seq || 0);
    } else if (act === "pause" && state) state.timeline.playing = false;
    else if (act === "play" && state) {
      if (state.winner && !state.winner.continued) ui.notice = "Continue this era, or start the next one, before the timeline runs.";
      else state.timeline.playing = true;
    } else if (act === "speed" && state) {
      const speed = Number(node.dataset.speed);
      if ([1, 2, 4, 8].indexOf(speed) !== -1) state.timeline.speed = speed;
    } else if (act === "continue" && state && state.winner) state.winner.continued = true;
    else if (act === "ask-next") ui.modal = "next";
    else if (act === "confirm-next" && state) {
      const shifted = rules.startNextEra(state);
      if (!shifted.ok) ui.notice = shifted.reason;
      else {
        adopt(shifted.state);
        autosave();
      }
      draw();
      return;
    } else if (act === "veto" && state) {
      const veto = rules.castVeto(state, node.dataset.country);
      ui.notice = veto.ok ? "" : veto.reason;
      if (veto.ok) autosave();
    } else if (act === "restore" && state) {
      const restored = rules.restoreCountry(state, node.dataset.country);
      ui.notice = restored.ok ? "" : restored.reason;
      if (restored.ok) autosave();
    } else if (act === "leave" && state) {
      const left = rules.leaveSeat(state);
      ui.notice = left.ok ? "" : left.reason;
      if (left.ok) {
        autosave();
        draw();
        pumpAi();
        return;
      }
    } else if (act === "rejoin" && state) {
      const back = rules.rejoinSeat(state);
      ui.notice = back.ok ? "" : back.reason;
      if (back.ok) autosave();
    } else if (act === "recommend" && state) {
      const filed = rules.setRecommendation(state, node.dataset.profile);
      ui.notice = filed.ok ? "" : filed.reason;
      if (filed.ok) autosave();
    } else if (act === "advance-ai" && state) {
      const active = state.countries[state.activeCountryId];
      if (active && active.control === "human") ui.notice = "It is still a human turn.";
      else {
        ai.runAiTurn(state, rng);
        ui.hideSeq = 0;
        autosave();
      }
    } else if (act === "end-turn" && state) {
      const ended = rules.endHumanTurn(state, rng);
      ui.notice = ended.ok ? ((ended.notes && ended.notes[0]) || "") : ended.reason;
      if (ended.ok) {
        autosave();
        draw();
        pumpAi();
        return;
      }
    } else if (act === "casualty-add" && state && state.engagement && state.engagement.pending) {
      const bag = state.engagement.pending.side === "defender" ? state.engagement.defenders : state.engagement.attackers;
      const id = node.dataset.unit;
      ui.casualtyPick = ui.casualtyPick || {};
      if ((ui.casualtyPick[id] | 0) < (bag[id] | 0)) ui.casualtyPick[id] = (ui.casualtyPick[id] | 0) + 1;
    } else if (act === "casualty-clear") ui.casualtyPick = {};
    else if (act === "casualties" && state && state.engagement) {
      const selection = {};
      Object.keys(ui.casualtyPick || {}).forEach(function (id) {
        if (ui.casualtyPick[id] > 0) selection[id] = ui.casualtyPick[id];
      });
      issue({ type: "casualties", countryId: node.dataset.country, selection: selection });
      return;
    } else if (act === "continue-battle" && state && state.engagement) {
      issue({ type: "continueBattle", countryId: state.engagement.countryId });
      return;
    } else if (act === "retreat" && state && state.engagement) {
      issue({ type: "retreat", countryId: state.engagement.countryId, toId: node.dataset.to });
      return;
    } else if (act === "auto-resolve" && state && state.engagement) {
      issue({ type: "autoResolve", countryId: state.engagement.countryId });
      return;
    } else if (act === "commit" && state) {
      const committed = rules.commitQueue(state, rng);
      ui.notice = committed.notes && committed.notes[0] ? committed.notes[0] : "";
      ui.hideSeq = 0;
      autosave();
    } else if (act === "pieces") {
      ui.display.pieces = node.dataset.value === "many" ? "many" : "single";
      saveDisplay();
    } else if (act === "display-toggle") {
      const key = node.dataset.key;
      if (key === "names" || key === "lanes" || key === "grid" || key === "sites") {
        ui.display[key] = !ui.display[key];
        saveDisplay();
      }
    } else if (act === "zoom-in") {
      zoomAt(1.4);
      return;
    } else if (act === "zoom-out") {
      zoomAt(1 / 1.4);
      return;
    } else if (act === "zoom-fit") {
      ui.map = { x: 0, y: 0, k: 1 };
      ui.focusToken = focusToken();
      applyMapView();
      return;
    } else if (act === "focus") {
      frameInterest();
      return;
    } else if (act === "clear-queue" && state) state.orderQueue = [];
    else if (act === "unstage" && state) state.orderQueue.splice(Number(node.dataset.index), 1);
    else if (["reinforce", "fortify", "move", "attack", "propose", "open-war", "port", "base", "explore"].indexOf(act) !== -1 && state) {
      const actorId = renderApi.actingId(state, ui);
      const actor = actorId && state.countries[actorId];
      const territory = state.territories[ui.selectedId];
      if (!actor) {
        ui.notice = state.mode === "timeline" && state.timeline.playing ? "Pause the timeline before issuing orders." : "You cannot give that order now.";
      } else if ((act === "reinforce" || act === "fortify" || act === "move" || act === "attack" || act === "port" || act === "base" || act === "explore") && !territory) {
        ui.notice = "Select a territory first.";
      } else if (act === "reinforce") issue({ type: "reinforce", countryId: actor.id, territoryId: territory.id, unitId: node.dataset.unit || "infantry", amount: Number(node.dataset.count) || 1 });
      else if (act === "fortify") issue({ type: "fortify", countryId: actor.id, territoryId: territory.id });
      else if (act === "port") issue({ type: "port", countryId: actor.id, territoryId: territory.id });
      else if (act === "base") issue({ type: "base", countryId: actor.id, territoryId: territory.id });
      else if (act === "explore") issue({ type: "explore", countryId: actor.id, territoryId: territory.id, siteId: node.dataset.site });
      else if (act === "move") {
        const moved = {};
        moved[node.dataset.unit] = Number(node.dataset.count) || 1;
        issue({ type: "move", countryId: actor.id, fromId: territory.id, toId: node.dataset.to, selection: moved });
      } else if (act === "attack") {
        const committed = {};
        committed[node.dataset.unit] = Number(node.dataset.count) || 1;
        issue({ type: "attack", countryId: actor.id, fromId: territory.id, toId: node.dataset.to, selection: committed });
      }
      else if (act === "propose") issue({ type: "allegiance", countryId: actor.id, targetCountryId: ui.diploTarget, proposedFactionId: ui.diploFaction });
      else if (act === "open-war") issue({ type: "openHostilities", countryId: actor.id, targetCountryId: ui.diploTarget });
    }
    draw();
  }

  function onChange(event) {
    const field = event.target.dataset ? event.target.dataset.field : "";
    if (event.target.id === "file-load") {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        const loaded = rules.loadFromString(String(reader.result || ""));
        if (!loaded.ok) {
          ui.notice = loaded.reason;
          draw();
          return;
        }
        adopt(loaded.state);
        autosave();
      };
      reader.readAsText(file);
      return;
    }
    if (event.target.id === "amount") {
      ui.amount = Number(event.target.value) || 1;
      draw();
      return;
    }
    if (!field) return;
    if (field === "player") ui.setup.playerCountryId = event.target.value;
    else if (field === "control") ui.setup.countryControl[event.target.dataset.country] = event.target.value;
    else if (field === "strategist") ui.setup.strategistCountryId = event.target.value;
    else if (field === "strategist-profile") ui.setup.strategistProfile = event.target.value;
    else if (field === "clock-seconds") {
      ui.setup.clockSeconds = Number(event.target.value);
      ui.setup.clockEnabled = true;
    }
    else if (field === "clock-rule") ui.setup.clockRule = event.target.value;
    else if (field === "ai") ui.setup.aiEnabled = event.target.checked;
    else if (field === "clock") ui.setup.clockEnabled = event.target.checked;
    else if (field === "allow-spectators") {
      ui.setup.allowSpectators = event.target.checked;
      if (!ui.setup.allowSpectators && ui.setup.role === "spectator") ui.setup.role = "player";
    } else if (field === "allow-strategists") {
      ui.setup.allowStrategists = event.target.checked;
      if (!ui.setup.allowStrategists && ui.setup.role === "strategist") ui.setup.role = "player";
    } else if (field === "stage") ui.stage = event.target.checked;
    else if (field === "diplo-target") ui.diploTarget = event.target.value;
    else if (field === "diplo-faction") ui.diploFaction = event.target.value;
    else if (field === "command") ui.commandId = event.target.value;
    else if (field === "risk") ui.setup.risk = Number(event.target.value);
    else if (field === "start-year") ui.setup.startYear = Number(event.target.value);
    else if (field === "start-season") ui.setup.startSeason = Number(event.target.value);
    draw();
  }

  function onInput(event) {
    if (event.target.id === "amount") {
      ui.amount = Number(event.target.value) || 1;
      const label = document.getElementById("amount-label");
      if (label) label.textContent = String(ui.amount);
      return;
    }
    if (event.target.dataset && event.target.dataset.field === "risk") {
      ui.setup.risk = Number(event.target.value);
      const label = event.target.parentNode;
      if (label && label.firstChild) label.firstChild.textContent = "AI risk " + ui.setup.risk + " ";
    }
  }

  function onKey(event) {
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (state && ui.screen === "game" && (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_" || event.key === "0")) {
      event.preventDefault();
      if (event.key === "0") ui.map = { x: 0, y: 0, k: 1 };
      else zoomAt(event.key === "-" || event.key === "_" ? 1 / 1.4 : 1.4);
      if (event.key === "0") applyMapView();
      return;
    }
    if (event.code !== "Space" || !state || state.mode !== "timeline" || ui.screen !== "game") return;
    event.preventDefault();
    if (state.winner && !state.winner.continued) return;
    state.timeline.playing = !state.timeline.playing;
    draw();
  }

  function peekSave() {
    try {
      const raw = localStorage.getItem(rules.SAVE_KEY);
      if (!raw) return { ok: false, empty: true };
      return rules.loadFromString(raw);
    } catch (error) {
      return { ok: false, reason: "The saved campaign could not be read." };
    }
  }

  function saveDisplay() {
    try {
      localStorage.setItem(DISPLAY_KEY, JSON.stringify(ui.display));
    } catch (error) {
      ui.notice = "This browser refused to store the display settings.";
    }
  }

  function loadDisplay() {
    try {
      const raw = JSON.parse(localStorage.getItem(DISPLAY_KEY) || "null");
      if (!raw || typeof raw !== "object") return;
      ui.display.pieces = raw.pieces === "many" ? "many" : "single";
      ui.display.names = raw.names !== false;
      ui.display.lanes = raw.lanes !== false;
      ui.display.grid = raw.grid !== false;
      ui.display.sites = raw.sites !== false;
      if (raw.tilt === 0.5 || raw.tilt === 0.58 || raw.tilt === 1.05) ui.display.tilt = raw.tilt;
    } catch (error) {
      ui.display = { pieces: "single", names: true, lanes: true, grid: true, sites: true, tilt: 0.58 };
    }
  }

  function boot() {
    loadDisplay();
    const app = document.getElementById("app");
    app.addEventListener("click", onClick);
    app.addEventListener("change", onChange);
    app.addEventListener("input", onInput);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", function () {
      if (state && ui.screen === "game") applyMapView();
    });
    const saved = peekSave();
    ui.resumeOk = !!saved.ok;
    ui.resumeError = saved.ok || saved.empty ? "" : saved.reason;
    draw();
    window.FAULTLINES = { rules: rules, ai: ai, read: function () { return state; } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
