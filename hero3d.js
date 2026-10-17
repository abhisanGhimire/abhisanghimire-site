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
  camera.position.set(0, 5.4, 9.6);
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

  function pageTex(kind) {
    return canvasTex(300, 420, function (g, w, h) {
      g.fillStyle = "#e3d9c6"; g.fillRect(0, 0, w, h);
      // paper grain
      for (var n = 0; n < 900; n++) { g.fillStyle = "rgba(120,100,70," + (Math.random() * 0.05) + ")"; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      // shadow in the gutter
      var s = g.createLinearGradient(kind === "left" ? w : 0, 0, kind === "left" ? w - 70 : 70, 0);
      s.addColorStop(0, "rgba(60,40,30,.45)"); s.addColorStop(1, "rgba(60,40,30,0)");
      g.fillStyle = s; g.fillRect(0, 0, w, h);
      var i, y;
      g.fillStyle = RUST; g.fillRect(38, 40, 100, 11);
      g.fillStyle = "#8d8576";
      for (y = 72, i = 0; y < 172; y += 16, i++) g.fillRect(38, y, i % 4 === 3 ? 120 : 224, 6);
      if (kind === "left") {
        g.fillStyle = "#1c2227"; roundRect(g, 36, 196, 230, 104, 7); g.fill();
        var cols = [SAGE, LIGHT, CREAM, SAGE, LIGHT, CREAM];
        for (i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.fillRect(50 + (i % 3) * 14, 210 + i * 14, 56 + (i * 41) % 100, 6); }
        g.fillStyle = "#8d8576";
        for (y = 322; y < 392; y += 16) g.fillRect(38, y, 224, 6);
      } else {
        var pts = [[80, 236], [148, 208], [214, 246], [114, 286], [188, 300]];
        g.strokeStyle = "#8d8576"; g.lineWidth = 2.5;
        [[0, 1], [1, 2], [0, 3], [1, 3], [2, 4], [3, 4]].forEach(function (e) {
          g.beginPath(); g.moveTo(pts[e[0]][0], pts[e[0]][1]); g.lineTo(pts[e[1]][0], pts[e[1]][1]); g.stroke();
        });
        pts.forEach(function (q, i) { g.fillStyle = i % 2 ? RUST : "#4e6a5c"; g.beginPath(); g.arc(q[0], q[1], 11, 0, 7); g.fill(); });
        g.fillStyle = "#8d8576";
        for (y = 336; y < 396; y += 16) g.fillRect(38, y, 224, 6);
      }
    });
  }
  var texRight = pageTex("right"), texLeft = pageTex("left");
  var texBack = pageTex("left");
  texBack.wrapS = THREE.RepeatWrapping; texBack.repeat.x = -1; texBack.offset.x = 1;

  var book = new THREE.Group();
  pivot.add(book);

  var pageMatR = new THREE.MeshLambertMaterial({ map: texRight, side: THREE.DoubleSide });
  var pageMatL = new THREE.MeshLambertMaterial({ map: texLeft, side: THREE.DoubleSide });
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

  book.scale.setScalar(1.36);
  book.position.y = 0.1;

  // ---------- turning pages: three in a rolling sequence ----------
  var FLIP = 5.4;                    // seconds for a whole cycle of one page (turn + rest)
  var flips = [0, 1, 2].map(function (i) {
    var geo = pageGeometry();
    var baseZ = [];
    for (var k = 0; k < geo.attributes.position.count; k++) baseZ.push(geo.attributes.position.getZ(k));
    var front = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: texRight, side: THREE.FrontSide }));
    var back = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: texBack, side: THREE.BackSide }));
    var grp = new THREE.Group();
    grp.add(front); grp.add(back);
    grp.position.y = 0.012 + i * 0.012;
    grp.visible = false;
    book.add(grp);
    return { geo: geo, baseZ: baseZ, grp: grp, offset: i * (FLIP / 3) };
  });

  function bend(f, e) {
    var p = f.geo.attributes.position, cols = SEG + 1, ds = PW / SEG;
    var lag = Math.sin(e * Math.PI) * 1.2;      // the free edge trails behind
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
  var visible = true, raf = 0, time = 0;

  function frame(dt) {
    time += dt;
    pivot.rotation.y = reduceMotion ? -0.35 : -0.35 + Math.sin(time * 0.28) * 0.5;
    pivot.rotation.x = reduceMotion ? 0 : Math.sin(time * 0.2) * 0.05;

    flips.forEach(function (f) {
      var ph = ((time + f.offset) % FLIP) / FLIP;
      var sweep = Math.min(1, ph / 0.5);
      var e = sweep < 0.5 ? 4 * sweep * sweep * sweep : 1 - Math.pow(-2 * sweep + 2, 3) / 2;
      f.grp.visible = ph < 0.5 && ph > 0.002;
      if (f.grp.visible) bend(f, e);
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
