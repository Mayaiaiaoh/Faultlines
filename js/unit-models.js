(function (g) {
  "use strict";

  function Mesh() {
    this.pos = [];
    this.nrm = [];
    this.tint = [];
  }

  function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  Mesh.prototype.tri = function (a, b, c, tint) {
    const n = cross(sub(b, a), sub(c, a));
    const length = Math.hypot(n[0], n[1], n[2]) || 1;
    n[0] /= length;
    n[1] /= length;
    n[2] /= length;
    [a, b, c].forEach(function (point) {
      this.pos.push(point[0], point[1], point[2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.tint.push(tint);
    }, this);
  };

  Mesh.prototype.quad = function (a, b, c, d, tint) {
    this.tri(a, b, c, tint);
    this.tri(a, c, d, tint);
  };

  Mesh.prototype.box = function (x, y, z, w, h, d, tint) {
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const y0 = y;
    const y1 = y + h;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], tint);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], tint);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], tint);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], tint);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], tint);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], tint);
  };

  Mesh.prototype.pack = function () {
    return {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.nrm),
      tints: new Float32Array(this.tint)
    };
  };

  function base(mesh, w, d) {
    mesh.box(0, 0, 0, w, 0.06, d, 2);
  }

  function infantry() {
    const mesh = new Mesh();
    base(mesh, 0.7, 0.7);
    mesh.box(-0.08, 0.06, 0, 0.1, 0.28, 0.1, 0);
    mesh.box(0.08, 0.06, 0, 0.1, 0.28, 0.1, 0);
    mesh.box(0, 0.34, 0, 0.28, 0.32, 0.16, 0);
    mesh.box(0, 0.7, 0, 0.16, 0.16, 0.16, 0);
    mesh.box(0.22, 0.48, 0.08, 0.08, 0.08, 0.42, 1);
    return mesh.pack();
  }

  function artillery() {
    const mesh = new Mesh();
    base(mesh, 1.1, 0.7);
    mesh.box(-0.28, 0.06, 0, 0.16, 0.22, 0.16, 0);
    mesh.box(0.28, 0.06, 0, 0.16, 0.22, 0.16, 0);
    mesh.box(0, 0.2, -0.05, 0.7, 0.16, 0.28, 0);
    mesh.box(0, 0.34, 0.22, 0.1, 0.1, 0.7, 1);
    mesh.box(0, 0.16, -0.28, 0.16, 0.08, 0.28, 0);
    return mesh.pack();
  }

  function armour() {
    const mesh = new Mesh();
    base(mesh, 1.15, 0.8);
    mesh.box(-0.38, 0.06, 0, 0.16, 0.22, 0.72, 0);
    mesh.box(0.38, 0.06, 0, 0.16, 0.22, 0.72, 0);
    mesh.box(0, 0.28, 0, 0.62, 0.22, 0.84, 0);
    mesh.box(0, 0.5, -0.06, 0.36, 0.18, 0.4, 1);
    mesh.box(0, 0.56, 0.28, 0.08, 0.08, 0.46, 1);
    return mesh.pack();
  }

  function fighter() {
    const mesh = new Mesh();
    base(mesh, 1.2, 0.9);
    mesh.box(0, 0.1, 0, 0.16, 0.12, 0.9, 0);
    mesh.box(0, 0.16, 0.05, 1.05, 0.05, 0.28, 1);
    mesh.box(0, 0.2, -0.32, 0.42, 0.04, 0.16, 0);
    mesh.box(0, 0.22, 0.28, 0.12, 0.08, 0.16, 0);
    return mesh.pack();
  }

  function bomber() {
    const mesh = new Mesh();
    base(mesh, 1.35, 1.05);
    mesh.box(0, 0.12, 0, 0.2, 0.16, 1.15, 0);
    mesh.box(0, 0.2, 0.02, 1.3, 0.05, 0.36, 1);
    mesh.box(-0.28, 0.24, -0.42, 0.08, 0.14, 0.16, 0);
    mesh.box(0.28, 0.24, -0.42, 0.08, 0.14, 0.16, 0);
    mesh.box(0, 0.22, 0.36, 0.16, 0.1, 0.2, 0);
    return mesh.pack();
  }

  function transport() {
    const mesh = new Mesh();
    base(mesh, 1.2, 0.7);
    mesh.box(0, 0.06, 0, 0.95, 0.22, 0.42, 0);
    mesh.box(0, 0.28, -0.02, 0.55, 0.2, 0.32, 1);
    mesh.box(0.18, 0.48, 0, 0.12, 0.18, 0.12, 0);
    return mesh.pack();
  }

  function submarine() {
    const mesh = new Mesh();
    base(mesh, 1.25, 0.45);
    mesh.box(0, 0.08, 0, 1.15, 0.16, 0.22, 0);
    mesh.box(-0.05, 0.24, 0, 0.22, 0.12, 0.16, 1);
    mesh.box(-0.05, 0.36, 0, 0.03, 0.12, 0.03, 0);
    return mesh.pack();
  }

  function destroyer() {
    const mesh = new Mesh();
    base(mesh, 1.35, 0.5);
    mesh.box(0, 0.06, 0, 1.2, 0.14, 0.28, 0);
    mesh.box(-0.05, 0.2, 0, 0.4, 0.16, 0.2, 1);
    mesh.box(0.32, 0.2, 0, 0.08, 0.08, 0.28, 1);
    mesh.box(-0.28, 0.36, 0, 0.06, 0.14, 0.06, 0);
    return mesh.pack();
  }

  function carrier() {
    const mesh = new Mesh();
    base(mesh, 1.4, 0.7);
    mesh.box(0, 0.06, 0, 1.25, 0.16, 0.4, 0);
    mesh.box(0, 0.22, 0, 1.35, 0.05, 0.5, 1);
    mesh.box(0.42, 0.27, 0.02, 0.16, 0.16, 0.22, 0);
    return mesh.pack();
  }

  function battleship() {
    const mesh = new Mesh();
    base(mesh, 1.45, 0.62);
    mesh.box(0, 0.06, 0, 1.3, 0.18, 0.36, 0);
    mesh.box(0, 0.24, 0, 0.4, 0.2, 0.24, 1);
    mesh.box(0.38, 0.24, 0, 0.22, 0.1, 0.22, 1);
    mesh.box(-0.38, 0.24, 0, 0.22, 0.1, 0.22, 1);
    mesh.box(0.38, 0.34, 0.16, 0.06, 0.06, 0.2, 1);
    mesh.box(-0.38, 0.34, 0.16, 0.06, 0.06, 0.2, 1);
    mesh.box(0.08, 0.44, 0, 0.08, 0.16, 0.08, 0);
    return mesh.pack();
  }

  function mass() {
    const mesh = new Mesh();
    base(mesh, 0.8, 0.8);
    mesh.box(0, 0.06, 0, 0.46, 0.28, 0.46, 0);
    mesh.box(0, 0.34, 0, 0.22, 0.12, 0.22, 1);
    return mesh.pack();
  }

  const constructors = {
    infantry: infantry,
    artillery: artillery,
    armour: armour,
    fighter: fighter,
    bomber: bomber,
    transport: transport,
    submarine: submarine,
    destroyer: destroyer,
    carrier: carrier,
    battleship: battleship,
    mass: mass
  };

  const api = { constructors: constructors };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.FLUnitModels = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
