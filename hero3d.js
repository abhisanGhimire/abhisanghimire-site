/* ==========================================================================
   Hero 3D: a learning environment for the modern world. An open book turns
   its pages while knowledge rises from it into four floating cards (software
   engineer, educator, researcher, academia) that orbit it. Everything is built here, no model
   files. It turns on its own and ignores the pointer. Needs three.js (r128).
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
  camera.position.set(0, 2.5, 12.2);
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

  // the turning page: bends as it lifts, curling at the free edge, then lays down on the left
  var flipGeo = pageGeometry();
  var flipBaseZ = [];
  for (var fi = 0; fi < flipGeo.attributes.position.count; fi++) flipBaseZ.push(flipGeo.attributes.position.getZ(fi));
  var backTex = pageTex("left");
  backTex.wrapS = THREE.RepeatWrapping; backTex.repeat.x = -1; backTex.offset.x = 1;
  var flipFront = new THREE.Mesh(flipGeo, new THREE.MeshBasicMaterial({ map: pageTex("right"), side: THREE.FrontSide }));
  var flipBack = new THREE.Mesh(flipGeo, new THREE.MeshBasicMaterial({ map: backTex, side: THREE.BackSide }));
  var flip = new THREE.Group();
  flip.add(flipFront); flip.add(flipBack);
  book.add(flip);

  function bendFlip(e) {
    var p = flipGeo.attributes.position, cols = SEG + 1, ds = PW / SEG;
    var lag = Math.sin(e * Math.PI) * 1.15;           // how far the free edge trails
    var x = 0, y = 0.05;
    for (var c = 0; c < cols; c++) {
      var u = c / SEG;
      var slope = Math.cos(u * Math.PI * 0.85) * 0.3 * Math.PI * 0.85 / PW;
      var rest = Math.atan(slope);
      var ang = (1 - e) * rest + e * (Math.PI - rest) - lag * Math.pow(u, 1.2);
      if (c > 0) { x += Math.cos(ang) * ds; y += Math.sin(ang) * ds; }
      for (var i = c; i < p.count; i += cols) p.setXYZ(i, x, y, flipBaseZ[i]);
    }
    p.needsUpdate = true;
    flipGeo.computeVertexNormals();
  }

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

  // ---------- four floating cards: what I do ----------
  var CARDS = [
    { label: "Software Engineer", sub: "build", color: SAGE, draw: "code" },
    { label: "Educator", sub: "teach", color: LIGHT, draw: "board" },
    { label: "Researcher", sub: "discover", color: RUST, draw: "chart" },
    { label: "Academia", sub: "publish", color: CREAM, draw: "cap" }
  ];
  function cardTex(cd) {
    return canvasTex(380, 270, function (g, w, h) {
      g.fillStyle = "rgba(18,22,26,.94)"; roundRect(g, 4, 4, w - 8, h - 8, 20); g.fill();
      g.strokeStyle = cd.color; g.lineWidth = 4; roundRect(g, 4, 4, w - 8, h - 8, 20); g.stroke();
      // picture only, no text: centre the drawing in the card
      g.save(); g.translate(w / 2, h / 2); g.scale(1.12, 1.12); g.translate(-w / 2, -h / 2 - 32);
      var i, cx = w / 2;
      if (cd.draw === "code") {
        var cols = [SAGE, LIGHT, CREAM, RUST, SAGE, CREAM], ind = [0, 1, 1, 2, 1, 0];
        for (i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.fillRect(34 + ind[i] * 24, 108 + i * 24, 70 + (i * 61) % 120, 9); g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(34 + ind[i] * 24 + 80 + (i * 61) % 120, 108 + i * 24, 44, 9); }
      } else if (cd.draw === "board") {
        g.fillStyle = "#1f3a30"; roundRect(g, 34, 100, w - 68, 118, 10); g.fill();
        g.strokeStyle = "#caa57a"; g.lineWidth = 4; roundRect(g, 34, 100, w - 68, 118, 10); g.stroke();
        g.strokeStyle = CREAM; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 190); g.lineTo(110, 130); g.lineTo(160, 190); g.moveTo(75, 168); g.lineTo(145, 168); g.stroke();
        g.fillStyle = LIGHT; g.beginPath(); g.arc(250, 150, 14, 0, 7); g.fill();
        g.fillStyle = CREAM; g.fillRect(205, 186, 100, 6); g.fillRect(205, 202, 70, 6);
      } else if (cd.draw === "chart") {
        var bars = [0.35, 0.55, 0.45, 0.75, 0.65, 0.95];
        for (i = 0; i < bars.length; i++) { g.fillStyle = i === 5 ? LIGHT : RUST; var bh = bars[i] * 118; g.fillRect(40 + i * 52, 224 - bh, 34, bh); }
        g.strokeStyle = CREAM; g.lineWidth = 4; g.beginPath();
        for (i = 0; i < bars.length; i++) { var px = 57 + i * 52, py = 224 - bars[i] * 118 - 16; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
        g.stroke();
      } else {
        // graduation cap
        g.fillStyle = CREAM; g.beginPath(); g.moveTo(cx, 108); g.lineTo(cx + 96, 146); g.lineTo(cx, 184); g.lineTo(cx - 96, 146); g.closePath(); g.fill();
        g.fillStyle = "#b9ad98"; g.beginPath(); g.moveTo(cx - 56, 166); g.lineTo(cx - 56, 204); g.quadraticCurveTo(cx, 232, cx + 56, 204); g.lineTo(cx + 56, 166); g.lineTo(cx, 188); g.closePath(); g.fill();
        g.strokeStyle = LIGHT; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + 96, 146); g.lineTo(cx + 96, 200); g.stroke();
        g.fillStyle = LIGHT; g.beginPath(); g.arc(cx + 96, 206, 7, 0, 7); g.fill();
      }
      g.restore();
    });
  }
  var panels = CARDS.map(function (cd, i) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.208), new THREE.MeshBasicMaterial({ map: cardTex(cd), transparent: true, side: THREE.DoubleSide }));
    pivot.add(m);
    return { mesh: m, a: i / CARDS.length * Math.PI * 2 + 0.4, r: 2.1, y: [1.2, 2.35, 0.95, 1.8][i], speed: 0.14 + i * 0.01, bob: i * 1.3 };
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

  // ---------- render: runs on its own, ignores the pointer ----------
  var clock = new THREE.Clock();
  var visible = true, raf = 0, time = 0;
  var inv = new THREE.Quaternion();
  var FLIP = 4.6; // seconds per page turn

  function frame(dt) {
    time += dt;
    pivot.rotation.y = reduceMotion ? 0 : Math.sin(time * 0.3) * 0.38;
    pivot.rotation.x = reduceMotion ? 0 : Math.sin(time * 0.21) * 0.05;

    // page turn: a smooth sweep, then rest
    var ph = (time % FLIP) / FLIP, sweep = Math.min(1, ph / 0.6);
    var e = sweep < 0.5 ? 4 * sweep * sweep * sweep : 1 - Math.pow(-2 * sweep + 2, 3) / 2;
    flip.visible = ph < 0.6 && ph > 0.002;
    if (flip.visible) bendFlip(e);

    updateRise(time);

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
