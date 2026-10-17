/* ==========================================================================
   Hero 3D: a learning environment for the modern world. An open book turns
   its pages while knowledge rises from it into floating windows (code, data,
   a model, an AI chat) that orbit it. Everything is built here, no model
   files. Drag to turn it; it settles back. Needs three.js (r128).
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  if (!canvas || !wrap || typeof THREE === "undefined") return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var RUST = "#c4623e", LIGHT = "#f2a07c", SAGE = "#8fb09f", CREAM = "#efe6d6", INK = "#14181c";

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 2.4, 11.2);
  camera.lookAt(0, 0.9, 0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    wrap.classList.add("no-webgl");
    return;
  }
  renderer.setClearColor(0x000000, 0);

  var pivot = new THREE.Group();
  scene.add(pivot);

  function canvasTex(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // ---------- the book ----------
  var PW = 1.55, PH = 2.1, SEG = 18;

  function pageGeometry() {
    var geo = new THREE.PlaneGeometry(PW, PH, SEG, 1);
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var u = (p.getX(i) + PW / 2) / PW;
      var z = p.getY(i);
      p.setXYZ(i, u * PW, Math.sin(u * Math.PI * 0.85) * 0.3 + 0.04, -z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function pageTex(kind) {
    return canvasTex(256, 360, function (g, w, h) {
      g.fillStyle = "#d8cebd"; g.fillRect(0, 0, w, h);
      var s = g.createLinearGradient(kind === "left" ? w : 0, 0, kind === "left" ? w - 50 : 50, 0);
      s.addColorStop(0, "rgba(60,40,30,.35)"); s.addColorStop(1, "rgba(60,40,30,0)");
      g.fillStyle = s; g.fillRect(0, 0, w, h);
      g.fillStyle = RUST; g.fillRect(30, 34, 90, 10);
      g.fillStyle = "#8d8576";
      for (var y = 62, i = 0; y < 150; y += 14, i++) g.fillRect(30, y, i % 4 === 3 ? 100 : 190, 5);
      if (kind === "left") {
        // a code block
        g.fillStyle = "#1c2227"; roundRect(g, 28, 168, 200, 86, 6); g.fill();
        var cols = [SAGE, LIGHT, CREAM, SAGE, LIGHT];
        for (var k = 0; k < 5; k++) { g.fillStyle = cols[k]; g.fillRect(40 + (k % 2) * 14, 182 + k * 14, 60 + (k * 37) % 80, 5); }
        g.fillStyle = "#8d8576";
        for (y = 272; y < 330; y += 14) g.fillRect(30, y, 190, 5);
      } else {
        // a small diagram: nodes and links
        var pts = [[70, 205], [128, 180], [186, 215], [100, 250], [165, 262]];
        g.strokeStyle = "#8d8576"; g.lineWidth = 2;
        [[0, 1], [1, 2], [0, 3], [1, 3], [2, 4], [3, 4]].forEach(function (e) {
          g.beginPath(); g.moveTo(pts[e[0]][0], pts[e[0]][1]); g.lineTo(pts[e[1]][0], pts[e[1]][1]); g.stroke();
        });
        pts.forEach(function (q, i) { g.fillStyle = i % 2 ? RUST : "#4e6a5c"; g.beginPath(); g.arc(q[0], q[1], 9, 0, 7); g.fill(); });
        g.fillStyle = "#8d8576";
        for (y = 290; y < 335; y += 14) g.fillRect(30, y, 190, 5);
      }
    });
  }

  var book = new THREE.Group();
  book.rotation.x = 0.0;
  pivot.add(book);

  var rightPage = new THREE.Mesh(pageGeometry(), new THREE.MeshBasicMaterial({ map: pageTex("right"), side: THREE.DoubleSide }));
  var leftPage = new THREE.Mesh(pageGeometry(), new THREE.MeshBasicMaterial({ map: pageTex("left"), side: THREE.DoubleSide }));
  leftPage.scale.x = -1;
  book.add(rightPage); book.add(leftPage);

  // the turning page
  var flip = new THREE.Group();
  var flipMesh = new THREE.Mesh(pageGeometry(), new THREE.MeshBasicMaterial({ map: pageTex("right"), side: THREE.DoubleSide }));
  flipMesh.position.y = 0.02;
  flip.add(flipMesh);
  book.add(flip);

  // covers and page block
  var coverMat = new THREE.MeshBasicMaterial({ color: 0x8a3f26 });
  var cover = new THREE.Mesh(new THREE.BoxGeometry(PW * 2 + 0.2, 0.1, PH + 0.18), coverMat);
  cover.position.y = -0.07;
  book.add(cover);
  var block = new THREE.Mesh(new THREE.BoxGeometry(PW * 2 + 0.02, 0.07, PH + 0.02), new THREE.MeshBasicMaterial({ color: 0xcfc4b0 }));
  block.position.y = -0.0;
  book.add(block);
  book.position.y = -1.15; book.scale.setScalar(1.2);
  book.rotation.x = 0.0;

  // ---------- floating windows: code, data, a model, an AI chat ----------
  function panelTex(kind) {
    return canvasTex(300, 220, function (g, w, h) {
      var accent = kind === "chat" ? LIGHT : kind === "data" ? SAGE : kind === "model" ? RUST : SAGE;
      g.fillStyle = "rgba(18,22,26,.92)"; roundRect(g, 3, 3, w - 6, h - 6, 14); g.fill();
      g.strokeStyle = accent; g.lineWidth = 3; roundRect(g, 3, 3, w - 6, h - 6, 14); g.stroke();
      [RUST, LIGHT, SAGE].forEach(function (c, i) { g.fillStyle = c; g.beginPath(); g.arc(24 + i * 16, 24, 5, 0, 7); g.fill(); });
      g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(14, 40, w - 28, 2);
      var i, y;
      if (kind === "code") {
        var cols = [SAGE, LIGHT, CREAM, RUST, SAGE, CREAM, LIGHT];
        var ind = [0, 1, 1, 2, 2, 1, 0];
        for (i = 0; i < 7; i++) { g.fillStyle = cols[i]; g.fillRect(24 + ind[i] * 18, 58 + i * 21, 50 + (i * 53) % 110, 7); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(24 + ind[i] * 18 + 60 + (i * 53) % 110, 58 + i * 21, 40, 7); }
      } else if (kind === "data") {
        var bars = [0.4, 0.65, 0.5, 0.85, 0.7, 0.95];
        for (i = 0; i < bars.length; i++) { g.fillStyle = i === 5 ? LIGHT : SAGE; var bh = bars[i] * 120; g.fillRect(28 + i * 42, 190 - bh, 28, bh); }
        g.strokeStyle = CREAM; g.lineWidth = 3; g.beginPath();
        for (i = 0; i < bars.length; i++) { var px = 42 + i * 42, py = 190 - bars[i] * 120 - 14; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
        g.stroke();
      } else if (kind === "model") {
        var layers = [3, 5, 4, 2];
        var pts = layers.map(function (n, li) { var a = []; for (var j = 0; j < n; j++) a.push([46 + li * 70, 120 + (j - (n - 1) / 2) * 30]); return a; });
        g.strokeStyle = "rgba(239,230,214,.28)"; g.lineWidth = 1.5;
        for (var l = 0; l < pts.length - 1; l++) pts[l].forEach(function (a) { pts[l + 1].forEach(function (b) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }); });
        pts.forEach(function (layer, li) { layer.forEach(function (q, j) { g.fillStyle = (li + j) % 3 === 0 ? LIGHT : RUST; g.beginPath(); g.arc(q[0], q[1], 8, 0, 7); g.fill(); }); });
      } else {
        g.fillStyle = "rgba(255,255,255,.16)"; roundRect(g, 24, 58, 170, 42, 12); g.fill();
        g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(38, 72, 110, 6); g.fillRect(38, 84, 70, 6);
        g.fillStyle = LIGHT; roundRect(g, 90, 116, 186, 56, 12); g.fill();
        g.fillStyle = INK; g.fillRect(104, 130, 140, 6); g.fillRect(104, 142, 150, 6); g.fillRect(104, 154, 90, 6);
        g.fillStyle = SAGE; for (i = 0; i < 3; i++) { g.beginPath(); g.arc(34 + i * 14, 190, 4, 0, 7); g.fill(); }
      }
    });
  }
  var kinds = ["code", "data", "model", "chat"];
  var panels = kinds.map(function (k, i) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.03), new THREE.MeshBasicMaterial({ map: panelTex(k), transparent: true, side: THREE.DoubleSide }));
    pivot.add(m);
    return { mesh: m, a: i / kinds.length * Math.PI * 2, r: 2.35, y: [1.5, 2.1, 1.1, 1.8][i], speed: 0.16 + i * 0.012, bob: i * 1.3 };
  });

  // ---------- beams from the book to each window ----------
  var beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(panels.length * 6), 3));
  var beams = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ color: 0xc4623e, transparent: true, opacity: 0.28 }));
  pivot.add(beams);

  // ---------- knowledge rising from the pages ----------
  var sc = document.createElement("canvas");
  sc.width = sc.height = 64;
  var sctx = sc.getContext("2d");
  var grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 64, 64);
  var sprite = new THREE.CanvasTexture(sc);

  var N = 130, seeds = [], arr = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) seeds.push({ x: (Math.random() * 2 - 1) * PW * 0.85, z: (Math.random() * 2 - 1) * PH * 0.4, p: Math.random(), v: 0.18 + Math.random() * 0.25, w: Math.random() * 6 });
  var riseGeo = new THREE.BufferGeometry();
  riseGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  riseGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  pivot.add(new THREE.Points(riseGeo, new THREE.PointsMaterial({
    size: 0.13, map: sprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  })));
  var cR = new THREE.Color(0xf2a07c), cS = new THREE.Color(0x8fb09f);

  function updateRise(t) {
    for (var i = 0; i < N; i++) {
      var s = seeds[i], k = (s.p + t * s.v * 0.35) % 1;           // 0 at the page, 1 at the top
      arr[i * 3] = s.x * (1 - k * 0.5) + Math.sin(t + s.w) * 0.08 * k;
      arr[i * 3 + 1] = -0.7 + k * 3.8;
      arr[i * 3 + 2] = s.z * (1 - k * 0.5) + Math.cos(t * 0.8 + s.w) * 0.08 * k;
      var f = Math.sin(k * Math.PI);                              // fade in and out
      var c = cR.clone().lerp(cS, k);
      col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f;
    }
    riseGeo.attributes.position.needsUpdate = true;
    riseGeo.attributes.color.needsUpdate = true;
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

  // ---------- drag to turn ----------
  var dragging = false, lastX = 0, velY = 0, turn = 0, hoverX = 0, hoverY = 0;
  wrap.addEventListener("pointerdown", function (e) {
    dragging = true; lastX = e.clientX; velY = 0;
    wrap.classList.add("is-dragging");
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  });
  wrap.addEventListener("pointermove", function (e) {
    if (dragging) {
      velY = (e.clientX - lastX) * 0.01; lastX = e.clientX;
      turn += velY;
    } else if (e.pointerType === "mouse") {
      var r = wrap.getBoundingClientRect();
      hoverY = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      hoverX = ((e.clientY - r.top) / r.height - 0.5) * 0.3;
    }
  });
  function end() { dragging = false; wrap.classList.remove("is-dragging"); }
  wrap.addEventListener("pointerup", end);
  wrap.addEventListener("pointercancel", end);
  wrap.addEventListener("pointerleave", function () { hoverX = hoverY = 0; });

  // ---------- render ----------
  var clock = new THREE.Clock();
  var visible = true, raf = 0, time = 0;
  var inv = new THREE.Quaternion();
  var FLIP = 3.2; // seconds per page turn

  function frame(dt) {
    time += dt;
    if (!dragging) {
      turn += velY; velY *= 0.95;
      if (Math.abs(velY) < 0.003) {
        var home = Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
        turn += (home - turn) * Math.min(1, dt * 1.2);
      }
    }
    pivot.rotation.y = turn + hoverY + Math.sin(time * 0.3) * 0.3;
    pivot.rotation.x = hoverX * 0.5;

    // page turn: 0..1 sweep, then rest
    var ph = (time % FLIP) / FLIP, sweep = Math.min(1, ph / 0.55);
    var e = sweep < 0.5 ? 2 * sweep * sweep : 1 - Math.pow(-2 * sweep + 2, 2) / 2;
    flip.rotation.z = e * Math.PI;
    flip.visible = ph < 0.55 && ph > 0.001;
    flipMesh.position.y = 0.02 + Math.sin(e * Math.PI) * 0.12;

    updateRise(time);

    pivot.updateMatrixWorld(true);
    inv.copy(pivot.quaternion).invert();
    var pos = beamGeo.attributes.position.array;
    panels.forEach(function (p, i) {
      var a = p.a + time * p.speed;
      var x = Math.cos(a) * p.r, z = Math.sin(a) * p.r, y = p.y + Math.sin(time * 0.9 + p.bob) * 0.12;
      p.mesh.position.set(x, y, z);
      p.mesh.quaternion.copy(inv).multiply(camera.quaternion);   // always face the viewer
      pos[i * 6] = 0; pos[i * 6 + 1] = -0.3; pos[i * 6 + 2] = 0;
      pos[i * 6 + 3] = x; pos[i * 6 + 4] = y - 0.5; pos[i * 6 + 5] = z;
    });
    beamGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  function loop() {
    raf = 0;
    if (!visible) return;
    frame(Math.min(clock.getDelta(), 0.05));
    raf = requestAnimationFrame(loop);
  }

  if (reduceMotion) {
    time = 0.5;
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
