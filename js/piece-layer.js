(function (g) {
  "use strict";

  const unitsApi = function () { return g.FLUnits; };
  const modelsApi = function () { return g.FLUnitModels; };
  const geoApi = function () { return g.FLGeo; };

  const VERT = [
    "attribute vec3 aPos;",
    "attribute vec3 aNrm;",
    "attribute float aTint;",
    "uniform vec2 uNdc;",
    "uniform float uScale;",
    "uniform float uTilt;",
    "uniform float uYaw;",
    "uniform float uSquash;",
    "varying float vTint;",
    "varying float vLight;",
    "void main() {",
    "  vec3 p = aPos;",
    "  p.y *= uSquash * 4.4;",
    "  float cy = cos(uYaw);",
    "  float sy = sin(uYaw);",
    "  float x1 = p.x * cy + p.z * sy;",
    "  float z1 = -p.x * sy + p.z * cy;",
    "  float ct = cos(uTilt);",
    "  float st = sin(uTilt);",
    "  float y2 = p.y * ct - z1 * st;",
    "  float z2 = p.y * st + z1 * ct;",
    "  gl_Position = vec4(uNdc + vec2(x1, y2) * uScale, -z2 * 0.05, 1.0);",
    "  float ny = aNrm.y * ct - aNrm.z * st;",
    "  vLight = clamp(0.38 + 0.62 * ny, 0.25, 1.0);",
    "  vTint = aTint;",
    "}"
  ].join("\n");

  const FRAG = [
    "precision mediump float;",
    "varying float vTint;",
    "varying float vLight;",
    "uniform vec3 uFaction;",
    "uniform float uSelect;",
    "uniform float uAlpha;",
    "void main() {",
    "  vec3 hull = mix(vec3(0.88, 0.85, 0.78), uFaction, 0.5);",
    "  vec3 base = vec3(0.45, 0.38, 0.3);",
    "  vec3 stripe = mix(vec3(1.0, 0.97, 0.9), uFaction, 0.72);",
    "  vec3 color = vTint > 1.5 ? base : (vTint > 0.5 ? stripe : hull);",
    "  color = color * (0.8 + 0.2 * vLight) + vec3(uSelect * 0.18);",
    "  gl_FragColor = vec4(color, uAlpha);",
    "}"
  ].join("\n");

  let gl = null;
  let program = null;
  let cache = {};
  let buffers = {};
  let canvas = null;

  function shader(type, source) {
    const item = gl.createShader(type);
    gl.shaderSource(item, source);
    gl.compileShader(item);
    return item;
  }

  function boot(target) {
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "piece-layer";
    }
    if (canvas.parentNode !== target) target.appendChild(canvas);
    if (gl) return true;
    gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return false;
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    cache = {};
    buffers = {};
    return true;
  }

  function meshOf(id) {
    if (cache[id]) return cache[id];
    const builders = modelsApi().constructors;
    const packed = (builders[id] || builders.mass)();
    const position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.bufferData(gl.ARRAY_BUFFER, packed.positions, gl.STATIC_DRAW);
    const normal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normal);
    gl.bufferData(gl.ARRAY_BUFFER, packed.normals, gl.STATIC_DRAW);
    const tint = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tint);
    gl.bufferData(gl.ARRAY_BUFFER, packed.tints, gl.STATIC_DRAW);
    cache[id] = { position: position, normal: normal, tint: tint, count: packed.positions.length / 3 };
    return cache[id];
  }

  function hexToRgb(hex) {
    const raw = (hex || "#888888").replace("#", "");
    const value = parseInt(raw.length === 3 ? raw.split("").map(function (c) { return c + c; }).join("") : raw, 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  }

  function screenOf(svg, x, y) {
    const camera = svg.querySelector("#world-camera");
    const point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    const matrix = camera.getScreenCTM();
    if (!matrix) return null;
    const mapped = point.matrixTransform(matrix);
    const rect = svg.getBoundingClientRect();
    return { x: mapped.x - rect.left, y: mapped.y - rect.top };
  }

  function layout(count) {
    const slots = [];
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      slots.push({ col: col - (cols - 1) / 2, row: row - (Math.ceil(count / cols) - 1) / 2 });
    }
    return slots;
  }

  function anchorOf(id, domain) {
    const kind = domain === "sea" ? "sea" : domain === "air" ? "air" : "land";
    const placed = g.FLMap.point ? g.FLMap.point(id, kind) : null;
    if (placed) return placed;
    return geoApi().theatres[id];
  }

  function drawMesh(id, ndcX, ndcY, scale, tilt, yaw, faction, select, squash, alpha) {
    const mesh = meshOf(id);
    const loc = {
      pos: gl.getAttribLocation(program, "aPos"),
      nrm: gl.getAttribLocation(program, "aNrm"),
      tint: gl.getAttribLocation(program, "aTint")
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
    gl.enableVertexAttribArray(loc.pos);
    gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
    gl.enableVertexAttribArray(loc.nrm);
    gl.vertexAttribPointer(loc.nrm, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.tint);
    gl.enableVertexAttribArray(loc.tint);
    gl.vertexAttribPointer(loc.tint, 1, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(program, "uNdc"), ndcX, ndcY);
    gl.uniform1f(gl.getUniformLocation(program, "uScale"), scale);
    gl.uniform1f(gl.getUniformLocation(program, "uTilt"), tilt);
    gl.uniform1f(gl.getUniformLocation(program, "uYaw"), yaw);
    gl.uniform1f(gl.getUniformLocation(program, "uSquash"), squash);
    gl.uniform3f(gl.getUniformLocation(program, "uFaction"), faction[0], faction[1], faction[2]);
    gl.uniform1f(gl.getUniformLocation(program, "uSelect"), select);
    gl.uniform1f(gl.getUniformLocation(program, "uAlpha"), alpha);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  function appearances(report, many) {
    if (!report || report.status === "unknown") return [];
    const catalogue = unitsApi().byId;
    if (report.status === "confirmed" || (report.status === "shared" && report.units) || (report.status === "last-known" && report.units)) {
      const list = [];
      Object.keys(report.units).forEach(function (id) {
        const spec = catalogue[id];
        if (!spec) return;
        const count = report.units[id] | 0;
        const shown = many ? Math.min(count, 3) : 1;
        list.push({ id: id, domain: spec.domain, shown: shown, count: count, ghost: report.status === "last-known" });
      });
      return list;
    }
    const strength = report.forces | 0;
    if (strength < 1) return [];
    const shown = many ? Math.min(3, Math.max(1, Math.ceil(strength / 2))) : 1;
    return [{ id: "mass", domain: "land", shown: shown, count: strength, ghost: report.status === "last-known", estimated: true }];
  }

  function sync(svg, state, ui) {
    if (!svg || !state) return;
    const slot = svg.parentNode;
    if (!slot) return;
    if (!boot(slot)) return;
    const width = Math.max(1, slot.clientWidth);
    const height = Math.max(1, slot.clientHeight);
    const ratio = Math.min(g.devicePixelRatio || 1, 2);
    const pixelWidth = Math.floor(width * ratio);
    const pixelHeight = Math.floor(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const rules = g.FLRules;
    const viewer = rules.viewerFor ? rules.viewerFor(state, ui) : rules.viewerOf(state);
    const many = ui && ui.display && ui.display.pieces === "many";
    const tilt = ui && ui.display && typeof ui.display.tilt === "number" ? ui.display.tilt : 0.58;
    const origin = screenOf(svg, 0, 0);
    const step = screenOf(svg, 100, 0);
    if (!origin || !step) return;
    const pixelsPerUnit = Math.abs(step.x - origin.x) / 100;
    const modelPx = Math.max(18, Math.min(46, pixelsPerUnit * 64));
    const scale = (modelPx / Math.max(width, 1)) * 2;
    const spread = 26;
    const selected = ui && ui.selectedId;
    const highlight = ui && ui.highlightType;
    const tags = [];
    mapIds().forEach(function (id) {
      const territory = state.territories[id];
      const owner = state.countries[territory.ownerId];
      if (!owner) return;
      const report = rules.assessVisibility(state, viewer, owner.id).territories.filter(function (item) {
        return item.territoryId === id;
      })[0];
      const groups = appearances(report, many);
      if (!groups.length) return;
      const faction = rules.factionById(state, owner.factionId);
      const color = report && report.status === "last-known" ? [0.45, 0.43, 0.4] : hexToRgb(faction ? faction.color : "#888888");
      const spent = state.spent && state.spent[id];
      groups.forEach(function (group, groupIndex) {
        const anchor = anchorOf(id, group.domain);
        const slots = layout(group.shown);
        slots.forEach(function (slotAt, index) {
          const worldX = anchor.x + slotAt.col * spread;
          const worldY = anchor.y + slotAt.row * spread;
          const point = screenOf(svg, worldX, worldY);
          if (!point) return;
          const ndcX = (point.x / width) * 2 - 1;
          const ndcY = 1 - (point.y / height) * 2;
          const select = (selected === id ? 0.35 : 0) + (highlight && highlight === group.id ? 0.65 : 0);
          const squash = territory.damaged ? 0.72 : 1;
          const yaw = (spent === "attack" ? 0.5 : spent === "move" ? -0.35 : 0.2) + groupIndex * 0.15;
          const alpha = group.ghost ? 0.45 : 0.96;
          drawMesh(group.id, ndcX, ndcY, scale, tilt, yaw, color, select, squash, alpha);
        });
        if (group.count > group.shown && (report.status === "confirmed" || report.status === "shared" || report.status === "estimated" || report.status === "last-known")) {
          const point = screenOf(svg, anchor.x, anchor.y);
          if (point) tags.push({ x: point.x, y: point.y - modelPx * 0.8, text: group.estimated ? String(group.count) : "×" + group.count });
        }
      });
    });
    paintTags(slot, tags);
  }

  function mapIds() {
    return g.FLMap.ids;
  }

  function paintTags(slot, tags) {
    let layer = document.getElementById("piece-tags");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "piece-tags";
      slot.appendChild(layer);
    } else if (layer.parentNode !== slot) {
      slot.appendChild(layer);
    }
    layer.innerHTML = tags.map(function (tag) {
      return '<span style="left:' + tag.x.toFixed(1) + "px;top:" + tag.y.toFixed(1) + 'px">' + tag.text + "</span>";
    }).join("");
  }

  g.FLPieces = { sync: sync };
})(typeof globalThis !== "undefined" ? globalThis : this);
