/* ==========================================================================
   Hero 3D: an open hardback book resting on a surface, its pages turning one
   after another. Built entirely in three.js (no model files). It runs on its
   own and ignores the pointer. Needs three.js (r128).
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  if (!canvas || !wrap || typeof THREE === "undefined") return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var RUST = "#c4623e", LIGHT = "#f2a07c", SAGE = "#8fb09f", CREAM = "#efe6d6";

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 5.4, 10.0);
  camera.lookAt(0, -0.1, 0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    wrap.classList.add("no-webgl");
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;

  // warm key light, soft sky fill, rust rim from behind
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x3a2c24, 1.0));
  var key = new THREE.DirectionalLight(0xffe4c4, 1.15);
  key.position.set(3, 7, 4);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xc4623e, 0.6);
  rim.position.set(-4, 2, -4);
  scene.add(rim);

  var pivot = new THREE.Group();
  scene.add(pivot);

  function canvasTex(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  var PW = 1.55, PH = 2.1, SEG = 20;
  function curve(u) { return Math.sin(u * Math.PI * 0.85) * 0.3 + 0.05; } // page height above the base

  // ---------- pages ----------
  function pageGeometry() {
    var geo = new THREE.PlaneGeometry(PW, PH, SEG, 1);
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var u = (p.getX(i) + PW / 2) / PW;
      p.setXYZ(i, u * PW, curve(u), -p.getY(i));
    }
    geo.computeVertexNormals();
    return geo;
  }

  // page designs: each side of the book can show any of these, so the pages that turn differ
  var VARIANTS = ["text", "code", "diagram", "chart", "list", "sketch"];
  function pageTex(variant, side) {
    return canvasTex(300, 420, function (g, w, h) {
      g.fillStyle = "#e3d9c6"; g.fillRect(0, 0, w, h);
      for (var n = 0; n < 900; n++) { g.fillStyle = "rgba(120,100,70," + (Math.random() * 0.05) + ")"; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      var sh = g.createLinearGradient(side === "left" ? w : 0, 0, side === "left" ? w - 70 : 70, 0);
      sh.addColorStop(0, "rgba(60,40,30,.45)"); sh.addColorStop(1, "rgba(60,40,30,0)");
      g.fillStyle = sh; g.fillRect(0, 0, w, h);
      var i, ink = "#8d8576";
      var accent = [RUST, "#4e6a5c", "#b5563a", "#6a8f7c"][Math.floor(Math.random() * 4)];
      g.fillStyle = accent; g.fillRect(38, 40, 60 + Math.random() * 70, 11);
      g.fillStyle = ink;
      function lines(y0, y1, step) { for (var yy = y0, k = 0; yy < y1; yy += step, k++) g.fillRect(38, yy, k % 4 === 3 ? 110 : 224, 6); }
      if (variant === "text") {
        lines(72, 390, 16);
      } else if (variant === "code") {
        lines(72, 150, 16);
        g.fillStyle = "#1c2227"; roundRect(g, 36, 172, 230, 130, 7); g.fill();
        var cols = [SAGE, LIGHT, CREAM, SAGE, LIGHT, CREAM, SAGE];
        for (i = 0; i < 7; i++) { g.fillStyle = cols[i]; g.fillRect(50 + (i % 3) * 14, 188 + i * 15, 50 + (i * 41) % 110, 6); }
        g.fillStyle = ink; lines(324, 392, 16);
      } else if (variant === "diagram") {
        lines(72, 150, 16);
        var pts = [[80, 214], [148, 186], [214, 224], [114, 266], [188, 282], [236, 170]];
        g.strokeStyle = ink; g.lineWidth = 2.5;
        [[0, 1], [1, 2], [0, 3], [1, 3], [2, 4], [3, 4], [1, 5], [2, 5]].forEach(function (e) { g.beginPath(); g.moveTo(pts[e[0]][0], pts[e[0]][1]); g.lineTo(pts[e[1]][0], pts[e[1]][1]); g.stroke(); });
        pts.forEach(function (q, k) { g.fillStyle = k % 2 ? RUST : "#4e6a5c"; g.beginPath(); g.arc(q[0], q[1], 11, 0, 7); g.fill(); });
        g.fillStyle = ink; lines(318, 392, 16);
      } else if (variant === "chart") {
        lines(72, 120, 16);
        var bars = [0.35, 0.55, 0.45, 0.8, 0.65, 0.95];
        for (i = 0; i < 6; i++) { g.fillStyle = i === 5 ? RUST : "#4e6a5c"; var bh = bars[i] * 150; g.fillRect(42 + i * 36, 300 - bh, 24, bh); }
        g.fillStyle = ink; g.fillRect(38, 304, 230, 3); lines(330, 392, 16);
      } else if (variant === "list") {
        for (i = 0; i < 7; i++) {
          var yy = 80 + i * 40;
          g.strokeStyle = ink; g.lineWidth = 2.5; g.strokeRect(40, yy, 18, 18);
          if (i % 3 !== 2) { g.strokeStyle = RUST; g.lineWidth = 4; g.beginPath(); g.moveTo(44, yy + 9); g.lineTo(49, yy + 15); g.lineTo(60, yy + 1); g.stroke(); }
          g.fillStyle = ink; g.fillRect(74, yy + 6, 120 + (i * 37) % 90, 6);
        }
      } else {
        g.strokeStyle = ink; g.lineWidth = 3;
        g.beginPath(); g.arc(120, 200, 56, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(120, 144); g.lineTo(176, 256); g.lineTo(64, 256); g.closePath(); g.stroke();
        g.strokeStyle = accent; g.lineWidth = 4; g.beginPath(); g.moveTo(40, 300); g.bezierCurveTo(100, 250, 170, 340, 262, 280); g.stroke();
        g.fillStyle = ink; lines(330, 392, 16);
      }
    });
  }
  function mirrored(t) {
    var c = t.clone(); c.needsUpdate = true;
    c.wrapS = THREE.RepeatWrapping; c.repeat.x = -1; c.offset.x = 1;
    return c;
  }
  var TR = VARIANTS.map(function (v) { return pageTex(v, "right"); });
  var TL = VARIANTS.map(function (v) { return pageTex(v, "left"); });
  var TB = TL.map(mirrored);
  var curR = 2, curL = 1;
  function pick(not) { var v; do { v = Math.floor(Math.random() * VARIANTS.length); } while (v === not); return v; }

  var book = new THREE.Group();
  pivot.add(book);

  var pageMatR = new THREE.MeshLambertMaterial({ map: TR[curR], side: THREE.DoubleSide });
  var pageMatL = new THREE.MeshLambertMaterial({ map: TL[curL], side: THREE.DoubleSide });
  var rightPage = new THREE.Mesh(pageGeometry(), pageMatR);
  var leftPage = new THREE.Mesh(pageGeometry(), pageMatL);
  leftPage.scale.x = -1;
  book.add(rightPage); book.add(leftPage);

  // ---------- page blocks (a solid under each page, with page edges showing) ----------
  var BASE = -0.16;
  function block() {
    var shape = new THREE.Shape();
    shape.moveTo(0, BASE);
    for (var c = 0; c <= SEG; c++) { var u = c / SEG; shape.lineTo(u * PW, curve(u) - 0.012); }
    shape.lineTo(PW, BASE);
    shape.lineTo(0, BASE);
    var geo = new THREE.ExtrudeGeometry(shape, { depth: PH, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -PH / 2);
    var g = new THREE.Group();
    g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xd9cfba, side: THREE.DoubleSide })));
    // page edges: fine lines following the curve on the front and back faces
    var edgeMat = new THREE.LineBasicMaterial({ color: 0x9c917c, transparent: true, opacity: 0.75 });
    var zs = [PH / 2 + 0.003, -PH / 2 - 0.003];
    zs.forEach(function (z) {
      for (var k = 1; k <= 7; k++) {
        var pts = [];
        for (var c = 0; c <= SEG; c++) { var u = c / SEG; pts.push(new THREE.Vector3(u * PW, curve(u) - 0.012 - k * 0.02, z)); }
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
      }
    });
    // outer edge
    for (var k2 = 1; k2 <= 7; k2++) {
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(PW + 0.003, curve(1) - 0.012 - k2 * 0.02, -PH / 2), new THREE.Vector3(PW + 0.003, curve(1) - 0.012 - k2 * 0.02, PH / 2)]), edgeMat));
    }
    return g;
  }
  var blockR = block(), blockL = block();
  blockL.scale.x = -1;
  book.add(blockR); book.add(blockL);

  // ---------- hardcover: leather boards, spine, gold border ----------
  var coverTex = canvasTex(512, 512, function (g, w, h) {
    g.fillStyle = "#7d3820"; g.fillRect(0, 0, w, h);
    for (var n = 0; n < 5000; n++) { g.fillStyle = "rgba(" + (Math.random() > 0.5 ? "255,190,150" : "0,0,0") + "," + (Math.random() * 0.07) + ")"; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = "rgba(235,190,120,.5)"; g.lineWidth = 3; g.strokeRect(26, 26, w - 52, h - 52);
  });
  var leather = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.65, metalness: 0.05 });
  var CW = PW + 0.14, CH = PH + 0.2, CT = 0.1;
  function board(side) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(CW, CT, CH), leather);
    m.position.set(side * (CW / 2 - 0.02), BASE - CT / 2, 0);
    return m;
  }
  book.add(board(1)); book.add(board(-1));
  // spine: a half cylinder joining the boards along the bottom
  var spine = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, CH, 24, 1, false, Math.PI, Math.PI), leather);
  spine.rotation.x = Math.PI / 2;
  spine.rotation.z = 0;
  spine.position.set(0, BASE - 0.0, 0);
  spine.scale.set(1, 1, 1);
  // orient: the half cylinder should bulge downward
  spine.rotation.set(Math.PI / 2, 0, 0);
  spine.rotation.y = 0;
  var spineGroup = new THREE.Group();
  spineGroup.add(spine);
  spineGroup.rotation.z = Math.PI;       // flip so the curve faces down
  spineGroup.position.y = BASE - CT * 0.5;
  book.add(spineGroup);

  // ribbon bookmark hanging out of the gutter
  var ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.9), new THREE.MeshLambertMaterial({ color: 0xd8573a }));
  ribbon.position.set(0.02, 0.06, PH / 2 + 0.38);
  ribbon.rotation.x = -0.18;
  book.add(ribbon);
  var ribbonTop = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.5), new THREE.MeshLambertMaterial({ color: 0xd8573a }));
  ribbonTop.position.set(0.02, 0.08, PH / 2 - 0.1);
  book.add(ribbonTop);

  // soft contact shadow on the surface
  var shTex = canvasTex(128, 128, function (g, w, h) {
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.65)"); gr.addColorStop(0.6, "rgba(0,0,0,.25)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(PW * 2 + 1.9, PH + 1.5), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = BASE - CT - 0.02;
  book.add(shadow);

  book.scale.setScalar(1.2);
  book.position.y = 0.1;

  // ---------- academia: a stack of closed books topped with a mortarboard ----------
  function closedBook(w, h, d, color) {
    var g = new THREE.Group();
    var cover = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.05 });
    var paper = new THREE.MeshLambertMaterial({ color: 0xe0d6c2 });
    var pages = new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, h - 0.07, d - 0.03), paper);
    pages.position.x = 0.02;
    g.add(pages);
    [1, -1].forEach(function (sgn) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, d), cover);
      b.position.y = sgn * (h / 2 - 0.0175);
      g.add(b);
    });
    var sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, d), cover);
    sp.position.x = -w / 2 + 0.02;
    g.add(sp);
    // gold bands on the spine
    var gold = new THREE.MeshStandardMaterial({ color: 0xd9a54a, roughness: 0.4, metalness: 0.4 });
    [-0.28, 0.28].forEach(function (zz) {
      var band = new THREE.Mesh(new THREE.BoxGeometry(0.045, h * 0.8, 0.03), gold);
      band.position.set(-w / 2 + 0.02, 0, zz * d);
      g.add(band);
    });
    return g;
  }
  var stack = new THREE.Group();
  var specs = [
    { w: 1.5, h: 0.24, d: 1.1, c: 0x8a3f26, rot: 0.1, dx: 0.0 },
    { w: 1.35, h: 0.2, d: 1.0, c: 0x3f5a4c, rot: -0.18, dx: 0.06 },
    { w: 1.25, h: 0.2, d: 0.95, c: 0x2f3b52, rot: 0.22, dx: -0.04 }
  ];
  var yy = 0;
  specs.forEach(function (sp) {
    var b = closedBook(sp.w, sp.h, sp.d, sp.c);
    b.position.set(sp.dx, yy + sp.h / 2, 0);
    b.rotation.y = sp.rot;
    stack.add(b);
    yy += sp.h;
  });

  // mortarboard
  var cap = new THREE.Group();
  var black = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.75, metalness: 0.05 });
  var board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 1.15), black);
  board.position.y = 0.26;
  cap.add(board);
  var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.26, 28), black);
  crown.position.y = 0.12;
  cap.add(crown);
  var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xd9a54a, roughness: 0.4, metalness: 0.4 }));
  knob.position.y = 0.305;
  cap.add(knob);
  var cordPts = [
    new THREE.Vector3(0, 0.31, 0), new THREE.Vector3(0.3, 0.295, 0.12), new THREE.Vector3(0.52, 0.29, 0.38),
    new THREE.Vector3(0.575, 0.27, 0.575), new THREE.Vector3(0.58, 0.1, 0.6)
  ];
  var goldMat = new THREE.MeshStandardMaterial({ color: 0xd9a54a, roughness: 0.45, metalness: 0.35 });
  cap.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 24, 0.012, 8, false), goldMat));
  var tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.2, 12), goldMat);
  tassel.position.set(0.58, 0.0, 0.6);
  cap.add(tassel);
  cap.position.y = yy - 0.04;
  cap.rotation.y = 0.55;
  cap.rotation.z = 0.04;
  stack.add(cap);

  // contact shadow under the stack
  var stackShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.8), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  stackShadow.rotation.x = -Math.PI / 2;
  stackShadow.position.y = 0.01;
  stack.add(stackShadow);

  stack.scale.setScalar(1.0);
  stack.position.set(2.55, -0.28, -0.6);
  pivot.add(stack);
  pivot.position.x = -0.95;

  // ---------- turning pages: several at once, both directions, each with its own design ----------
  var SLOTS = 5;
  var flips = [];
  for (var si = 0; si < SLOTS; si++) (function (i) {
    var geo = pageGeometry();
    var baseZ = [];
    for (var k = 0; k < geo.attributes.position.count; k++) baseZ.push(geo.attributes.position.getZ(k));
    var front = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: TR[0], side: THREE.FrontSide }));
    var back = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: TB[0], side: THREE.BackSide }));
    var grp = new THREE.Group();
    grp.add(front); grp.add(back);
    grp.position.y = 0.012 + i * 0.010;
    grp.visible = false;
    book.add(grp);
    flips.push({ geo: geo, baseZ: baseZ, grp: grp, front: front, back: back, active: false, t: 0, dur: 2.5, dir: 1, lag: 1.0, endR: -1, endL: -1 });
  })(si);

  function startFlip(f) {
    f.active = true; f.t = 0;
    f.dur = 2.2 + Math.random() * 1.2;
    f.lag = 0.8 + Math.random() * 0.8;
    f.dir = Math.random() < 0.85 ? 1 : -1;            // mostly forward, sometimes back
    f.front.material.map = TR[curR];
    f.back.material.map = TB[curL];
    f.front.material.needsUpdate = true; f.back.material.needsUpdate = true;
  }
  function endFlip(f) {
    f.active = false; f.grp.visible = false;
  }

  function bend(f, e) {
    var p = f.geo.attributes.position, cols = SEG + 1, ds = PW / SEG;
    var lag = Math.sin(e * Math.PI) * f.lag * 1.5;  // the free edge trails behind
    var x = 0, y = curve(0);
    for (var c = 0; c < cols; c++) {
      var u = c / SEG;
      var slope = Math.cos(u * Math.PI * 0.85) * 0.3 * Math.PI * 0.85 / PW;
      var rest = Math.atan(slope);
      var ang = (1 - e) * rest + e * (Math.PI - rest) - lag * Math.pow(u, 1.2);
      if (c > 0) { x += Math.cos(ang) * ds; y += Math.sin(ang) * ds; }
      for (var i = c; i < p.count; i += cols) p.setXYZ(i, x, y, f.baseZ[i]);
    }
    p.needsUpdate = true;
    f.geo.computeVertexNormals();
  }

  // ---------- sizing ----------
  function resize() {
    var w = wrap.clientWidth || 400, h = wrap.clientHeight || w;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // ---------- render: runs on its own, ignores the pointer ----------
  var clock = new THREE.Clock();
  var visible = true, raf = 0, time = 0, spawn = 0.3;

  function frame(dt) {
    time += dt;
    pivot.rotation.y = reduceMotion ? -0.35 : -0.35 + Math.sin(time * 0.28) * 0.5;
    pivot.rotation.x = reduceMotion ? 0 : Math.sin(time * 0.2) * 0.05;

    // start a new page every so often, in any free slot
    spawn -= dt;
    if (spawn <= 0) {
      for (var q = 0; q < flips.length; q++) if (!flips[q].active) { startFlip(flips[q]); break; }
      spawn = 0.7 + Math.random() * 1.1;
    }
    flips.forEach(function (f) {
      if (!f.active) return;
      f.t += dt;
      var sweep = Math.min(1, f.t / f.dur);
      var e = sweep < 0.5 ? 4 * sweep * sweep * sweep : 1 - Math.pow(-2 * sweep + 2, 3) / 2;
      if (f.dir < 0) e = 1 - e;
      f.grp.visible = true;
      bend(f, e);
      if (sweep >= 1) endFlip(f);
    });

    renderer.render(scene, camera);
  }

  function loop() {
    raf = 0;
    if (!visible) return;
    frame(Math.min(clock.getDelta(), 0.05));
    raf = requestAnimationFrame(loop);
  }

  if (reduceMotion) {
    time = 0.6;
    frame(0);
  } else {
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !raf) { clock.getDelta(); raf = requestAnimationFrame(loop); }
      }).observe(wrap);
    }
    raf = requestAnimationFrame(loop);
  }
})();
