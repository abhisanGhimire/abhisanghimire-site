/* ==========================================================================
   Hero 3D: a traditional Newari house from the Kathmandu Valley, in the
   Nepali brick-and-carved-timber style: red brick walls, carved lattice
   windows, wooden eave struts, a terracotta tile roof and a golden finial.
   Built entirely in three.js (r128), no model files. It turns slowly on its
   own and ignores the pointer.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  if (!canvas || !wrap || typeof THREE === "undefined") return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 2.6, 12.4);
  camera.lookAt(0, 0.9, 0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    wrap.classList.add("no-webgl");
    return;
  }
  renderer.setClearColor(0x000000, 0);

  // warm evening light with a cool fill and a rust rim from behind
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x2b2622, 0.62));
  var key = new THREE.DirectionalLight(0xffe2bd, 1.0);
  key.position.set(5, 7, 8);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xc4623e, 0.55);
  rim.position.set(-6, 3, -6);
  scene.add(rim);

  var house = new THREE.Group();
  scene.add(house);

  // ---------- textures drawn in code ----------
  function canvasTex(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // handmade red brick, laid in rows with a half-brick offset
  var brickTex = canvasTex(256, 256, function (g, w, h) {
    g.fillStyle = "#4a3028"; g.fillRect(0, 0, w, h);                     // mortar
    var bh = 21, bw = 56;
    for (var row = 0, y = 2; y < h; y += bh, row++) {
      for (var x = -(row % 2) * bw / 2; x < w; x += bw) {
        var r = 150 + rnd(-22, 22), gr = 62 + rnd(-10, 12), b = 44 + rnd(-8, 8);
        g.fillStyle = "rgb(" + (r | 0) + "," + (gr | 0) + "," + (b | 0) + ")";
        g.fillRect(x + 2, y, bw - 4, bh - 4);
      }
    }
    for (var n = 0; n < 1400; n++) { g.fillStyle = "rgba(0,0,0," + rnd(0.02, 0.09) + ")"; g.fillRect(rnd(0, w), rnd(0, h), 2, 2); }
  });

  // terracotta roof tiles, curved rows
  var tileTex = canvasTex(256, 256, function (g, w, h) {
    g.fillStyle = "#6b2d1c"; g.fillRect(0, 0, w, h);
    var th = 26, tw = 32;
    for (var row = 0, y = 0; y < h + th; y += th, row++) {
      for (var x = -(row % 2) * tw / 2; x < w; x += tw) {
        var r = 168 + rnd(-18, 18), gr = 78 + rnd(-8, 10), b = 48 + rnd(-6, 6);
        var grad = g.createLinearGradient(0, y, 0, y + th);
        grad.addColorStop(0, "rgb(" + ((r * 0.72) | 0) + "," + ((gr * 0.72) | 0) + "," + ((b * 0.72) | 0) + ")");
        grad.addColorStop(1, "rgb(" + (r | 0) + "," + (gr | 0) + "," + (b | 0) + ")");
        g.fillStyle = grad;
        g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + tw - 2, y); g.lineTo(x + tw - 4, y + th - 3); g.quadraticCurveTo(x + tw / 2, y + th + 4, x + 4, y + th - 3); g.closePath(); g.fill();
      }
    }
  });

  var woodTex = canvasTex(128, 128, function (g, w, h) {
    g.fillStyle = "#4a2a18"; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 40; i++) { g.strokeStyle = "rgba(20,10,4," + rnd(0.1, 0.35) + ")"; g.lineWidth = rnd(1, 2.5); g.beginPath(); var y0 = rnd(0, h); g.moveTo(0, y0); g.bezierCurveTo(w * 0.3, y0 + rnd(-6, 6), w * 0.7, y0 + rnd(-6, 6), w, y0 + rnd(-4, 4)); g.stroke(); }
  });

  // the carved window: dark timber frame with a diamond lattice and a gold-lit opening
  function carvedWindow(w, h, lattice) {
    return canvasTex(256, Math.round(256 * h / w), function (g, W, H) {
      g.fillStyle = "#3b2214"; g.fillRect(0, 0, W, H);
      var m = W * 0.09;
      g.fillStyle = "#120d0a"; g.fillRect(m, m, W - 2 * m, H - 2 * m);                // dark opening
      g.strokeStyle = "#c28a4b"; g.lineWidth = 2; g.strokeRect(m * 0.45, m * 0.45, W - m * 0.9, H - m * 0.9);
      g.strokeStyle = "#6a3f22"; g.lineWidth = lattice ? 5 : 7;
      var step = lattice ? W / 9 : W / 4;
      g.save(); g.beginPath(); g.rect(m, m, W - 2 * m, H - 2 * m); g.clip();
      for (var d = -H; d < W + H; d += step) {
        g.beginPath(); g.moveTo(d, 0); g.lineTo(d + H, H); g.stroke();
        g.beginPath(); g.moveTo(d, H); g.lineTo(d + H, 0); g.stroke();
      }
      g.restore();
    });
  }

  var woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8, metalness: 0.02 });
  var darkMat = new THREE.MeshStandardMaterial({ color: 0x2b170d, roughness: 0.85 });
  var goldMat = new THREE.MeshStandardMaterial({ color: 0xe0a93e, roughness: 0.32, metalness: 0.75 });
  var stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8174, roughness: 0.95 });

  // ---------- plinth and steps ----------
  var plinth = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.18, 2.7), stoneMat);
  plinth.position.y = 0.09; house.add(plinth);
  var step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.09, 0.32), stoneMat);
  step.position.set(0, 0.045, 1.45); house.add(step);
  var step2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.2), stoneMat);
  step2.position.set(0, 0.09, 1.32); house.add(step2);

  // ---------- brick walls ----------
  var BW = 2.5, BD = 2.0, BH = 2.6, BY = 0.18;
  function brickMat(rx, ry) {
    var t = brickTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
  }
  var side = brickMat(BD / 0.9, BH / 0.9), front = brickMat(BW / 0.9, BH / 0.9), cap = new THREE.MeshStandardMaterial({ color: 0x3a2018, roughness: 1 });
  var body = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), [side, side, cap, cap, front, front]);
  body.position.y = BY + BH / 2;
  house.add(body);
  var topY = BY + BH, fz = BD / 2;

  // timber beams marking the floors
  [BY + BH * 0.42, BY + BH * 0.74].forEach(function (y) {
    var beam = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.06, 0.07, BD + 0.06), woodMat);
    beam.position.y = y; house.add(beam);
  });
  [-1, 1].forEach(function (sx) {                                    // corner posts
    [-1, 1].forEach(function (sz) {
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.09, BH, 0.09), woodMat);
      post.position.set(sx * (BW / 2), BY + BH / 2, sz * (BD / 2)); house.add(post);
    });
  });

  // ---------- windows and the door (front and back faces get windows, sides get small ones) ----------
  function windowAt(x, y, w, h, z, ry, lattice) {
    var g = new THREE.Group();
    var frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.08), woodMat);
    var pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: carvedWindow(w, h, lattice), roughness: 0.7 }));
    pane.position.z = 0.045;
    g.add(frame); g.add(pane);
    g.position.set(x, y, z); g.rotation.y = ry;
    house.add(g);
  }
  var f1 = BY + 0.34, f2 = BY + BH * 0.6, f3 = BY + BH * 0.87;
  [[1, 0], [-1, Math.PI]].forEach(function (fc) {                    // front (+z) and back (-z)
    var s = fc[0], ry = fc[1], z = s * (fz + 0.02);
    // ground floor: two small windows
    windowAt(-0.85, f1, 0.34, 0.34, z, ry, false);
    windowAt(0.85, f1, 0.34, 0.34, z, ry, false);
    // first floor: wide carved window, flanked by two small ones
    windowAt(0, f2, 1.15, 0.6, z, ry, true);
    windowAt(-0.95, f2, 0.34, 0.4, z, ry, false);
    windowAt(0.95, f2, 0.34, 0.4, z, ry, false);
    // top floor: three-part window
    [-0.7, 0, 0.7].forEach(function (x) { windowAt(x, f3, 0.42, 0.44, z, ry, true); });
  });
  // the door (front only): timber double door with a gold bar
  (function () {
    var door = new THREE.Group();
    var frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.09), woodMat);
    var leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x321b0f, roughness: 0.8 }));
    leaf.position.z = 0.05;
    var bar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.02), goldMat);
    bar.position.set(0, 0.0, 0.06);
    door.add(frame); door.add(leaf); door.add(bar);
    door.position.set(0, BY + 0.35, fz + 0.02);
    house.add(door);
})();
  // small side windows
  [-1, 1].forEach(function (sx) {
    [f2, f3].forEach(function (y) { windowAt(sx * (BW / 2 + 0.02), y, 0.44, 0.46, 0, sx * Math.PI / 2, true); });
  });

  // ---------- roof: tiled hip roof with a wide overhang, supported by carved struts ----------
  function hipRoof(hw, hd, h) {
    var geo = new THREE.ConeGeometry(1, h, 4, 1, true);
    geo.rotateY(Math.PI / 4);
    geo.scale(hw / 0.7071, 1, hd / 0.7071);
    var t = tileTex.clone(); t.needsUpdate = true; t.repeat.set(4, 2.4);
    var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, side: THREE.DoubleSide }));
    return m;
  }
  var roof = hipRoof(BW / 2 + 0.55, BD / 2 + 0.5, 1.5);
  roof.position.y = topY + 0.75 + 0.02;
  house.add(roof);
  // eave rim
  var eave = new THREE.Mesh(new THREE.BoxGeometry(BW + 1.1, 0.07, BD + 1.0), woodMat);
  eave.position.y = topY + 0.02;
  house.add(eave);

  // struts under the eaves (the carved timber brackets, tundal)
  function strut(x, z, dx, dz) {
    var len = 0.62;
    var s = new THREE.Mesh(new THREE.BoxGeometry(0.07, len, 0.07), darkMat);
    s.position.set(x + dx * 0.25, topY - 0.22, z + dz * 0.25);
    s.rotation.z = -dx * 0.8; s.rotation.x = dz * 0.8;
    house.add(s);
  }
  for (var sx = -1.0; sx <= 1.01; sx += 0.5) { strut(sx, fz + 0.02, 0, 1); strut(sx, -fz - 0.02, 0, -1); }
  for (var sz = -0.6; sz <= 0.61; sz += 0.4) { strut(BW / 2 + 0.02, sz, 1, 0); strut(-BW / 2 - 0.02, sz, -1, 0); }

  // lower roof tier: a tiled skirt around all four sides, between the ground and first floor
  (function () {
    var y1 = BY + BH * 0.42, y0 = y1 - 0.4;
    var tx = BW / 2 + 0.04, tz = BD / 2 + 0.04, bx = tx + 0.62, bz = tz + 0.62;
    var P = [
      [-tx, y1, tz], [tx, y1, tz], [tx, y1, -tz], [-tx, y1, -tz],
      [-bx, y0, bz], [bx, y0, bz], [bx, y0, -bz], [-bx, y0, -bz]
    ];
    var quads = [[0, 1, 5, 4, BW], [1, 2, 6, 5, BD], [2, 3, 7, 6, BW], [3, 0, 4, 7, BD]];
    var pos = [], uv = [], idx = [], v = 0;
    quads.forEach(function (q) {
      var a = P[q[0]], b = P[q[1]], c = P[q[2]], d = P[q[3]], rep = q[4] * 1.1;
      [a, b, c, d].forEach(function (p) { pos.push(p[0], p[1], p[2]); });
      uv.push(0, 1, rep, 1, rep, 0, 0, 0);
      idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
      v += 4;
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var t = tileTex.clone(); t.needsUpdate = true; t.repeat.set(1, 1.3);
    house.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, side: THREE.DoubleSide })));
    // wooden rim and carved struts holding the skirt
    var rim = new THREE.Mesh(new THREE.BoxGeometry(bx * 2, 0.06, bz * 2), woodMat);
    rim.position.y = y0 - 0.03;
    var rimInner = new THREE.Mesh(new THREE.BoxGeometry(bx * 2 - 0.1, 0.07, bz * 2 - 0.1), new THREE.MeshStandardMaterial({ color: 0x2b170d, roughness: 0.9 }));
    rimInner.position.y = y0 - 0.032;
    house.add(rimInner);
    var fr = [[ 1, 0], [-1, 0], [0, 1], [0, -1]];
    var xs = [-0.9, -0.45, 0, 0.45, 0.9];
    xs.forEach(function (x) {
      [[x, tz + 0.02, 0, 1], [x, -tz - 0.02, 0, -1]].forEach(function (a) {
        var st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.05), darkMat);
        st.position.set(a[0], y0 - 0.1, a[1] + a[3] * 0.2); st.rotation.x = a[3] * 0.75; house.add(st);
      });
    });
    [-0.5, 0, 0.5].forEach(function (z) {
      [[tx + 0.02, z, 1], [-tx - 0.02, z, -1]].forEach(function (a) {
        var st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.05), darkMat);
        st.position.set(a[0] + a[2] * 0.2, y0 - 0.1, a[1]); st.rotation.z = -a[2] * 0.75; house.add(st);
      });
    });
    // little golden ornaments on the skirt corners
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      var o = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), goldMat);
      o.position.set(c[0] * bx, y0 + 0.07, c[1] * bz); house.add(o);
    });
  })();

  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
    var o = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 10), goldMat);
    o.position.set(c[0] * (BW / 2 + 0.52), topY + 0.12, c[1] * (BD / 2 + 0.47)); house.add(o);
  });

  // golden finial (gajur) on the ridge
  (function () {
    var y0 = topY + 1.5 + 0.02;
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.3, 14), goldMat);
    stem.position.y = y0 + 0.1; house.add(stem);
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), goldMat);
    ball.position.y = y0 + 0.3; house.add(ball);
    var spire = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 14), goldMat);
    spire.position.y = y0 + 0.52; house.add(spire);
  })();

  // ground disc and a soft shadow
  var ground = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.8, 0.1, 64), new THREE.MeshStandardMaterial({ color: 0x2c2a27, roughness: 1 }));
  ground.position.y = -0.05; house.add(ground);
  var shTex = canvasTex(128, 128, function (g, w, h) {
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.6)"); gr.addColorStop(0.65, "rgba(0,0,0,.2)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.11;
  scene.add(shadow);

  house.position.y = -1.95;
  shadow.position.y = house.position.y - 0.11;
  house.scale.setScalar(0.9);

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

  // ---------- render: turns on its own, ignores the pointer ----------
  var clock = new THREE.Clock();
  var visible = true, raf = 0, time = 0;

  function frame(dt) {
    time += dt;
    house.rotation.y = reduceMotion ? 0.12 : Math.sin(time * 0.45) * 0.42 + 0.06;
    house.rotation.x = reduceMotion ? 0 : Math.sin(time * 0.31) * 0.02;
    renderer.render(scene, camera);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    frame(Math.min(clock.getDelta(), 0.05));
  }

  if (reduceMotion) {
    frame(0);
  } else {
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) clock.getDelta();
      }).observe(wrap);
    }
    raf = requestAnimationFrame(loop);
  }
})();
