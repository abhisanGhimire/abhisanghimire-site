/* ==========================================================================
   Hero 3D: an antique desk globe on a wooden stand: a brass meridian ring,
   a curved brass arm and a turned wooden base. The world is painted in code
   from Natural Earth data (land mask and country borders, public domain).
   The globe turns slowly on its tilted axis; the stand faces the viewer and
   the whole thing ignores the pointer. Needs three.js (r128) and
   data/globe-data.js.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  var data = window.GLOBE_DATA;
  if (!canvas || !wrap || typeof THREE === "undefined" || !data) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.7, 12.6);
  camera.lookAt(0, 0.05, 0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    wrap.classList.add("no-webgl");
    return;
  }
  renderer.setClearColor(0x000000, 0);

  // warm key, soft sky fill, rust rim from behind
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x28231f, 0.7));
  var key = new THREE.DirectionalLight(0xffe6c4, 1.15);
  key.position.set(4, 6, 8);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xc4623e, 0.6);
  rim.position.set(-6, 2, -5);
  scene.add(rim);

  function canvasTex(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // ---------- paint the world ----------
  var TW = 2048, TH = 1024;
  var worldTex = canvasTex(TW, TH, function (g, W, H) {
    // 1. land mask (1 degree cells), scaled up smoothly
    var bits = atob(data.land), LW = data.landW, LH = data.landH;
    var small = document.createElement("canvas");
    small.width = LW; small.height = LH;
    var sg = small.getContext("2d"), img = sg.createImageData(LW, LH);
    for (var i = 0; i < LW * LH; i++) {
      var on = (bits.charCodeAt(i >> 3) >> (i & 7)) & 1;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = on ? 255 : 0;
    }
    sg.putImageData(img, 0, 0);
    var big = document.createElement("canvas");
    big.width = W; big.height = H;
    var bg = big.getContext("2d");
    bg.imageSmoothingEnabled = true; bg.imageSmoothingQuality = "high";
    bg.drawImage(small, 0, 0, W, H);
    var m = bg.getImageData(0, 0, W, H).data;

    // 2. colour: deep teal sea with a lighter shallows halo, warm parchment land
    var out = g.createImageData(W, H), o = out.data;
    for (var y = 0; y < H; y++) {
      var lat = Math.abs(0.5 - y / H) * 2;                    // 0 equator, 1 poles
      for (var x = 0; x < W; x++) {
        var p = (y * W + x) * 4, a = m[p + 3] / 255;
        var n = rnd(-5, 5);
        var sr = 20 + n - lat * 6, sgc = 50 + n - lat * 10, sb = 62 + n - lat * 8;     // sea
        var halo = smooth(0.08, 0.46, a) * 0.55;
        sr += (56 - sr) * halo; sgc += (108 - sgc) * halo; sb += (112 - sb) * halo;
        var lr = 214 + n - lat * 18, lg = 188 + n - lat * 14, lb = 146 + n - lat * 8; // land
        var t = smooth(0.47, 0.53, a);
        o[p] = sr + (lr - sr) * t; o[p + 1] = sgc + (lg - sgc) * t; o[p + 2] = sb + (lb - sb) * t; o[p + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);

    // 3. graticule
    g.strokeStyle = "rgba(255,240,210,0.10)"; g.lineWidth = 1;
    for (var lon = -180; lon <= 180; lon += 15) { var xx = (lon + 180) / 360 * W; g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx, H); g.stroke(); }
    for (var la = -75; la <= 75; la += 15) { var yy = (90 - la) / 180 * H; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }

    // 4. country borders from the Natural Earth arcs (delta-encoded, 0.02 degree units)
    g.strokeStyle = "rgba(122,56,34,0.7)"; g.lineWidth = 1.5; g.lineJoin = "round";
    var q = data.q;
    data.arcs.forEach(function (arc) {
      var px = 0, py = 0, prevX = null;
      g.beginPath();
      for (var k = 0; k < arc.length; k += 2) {
        px += arc[k]; py += arc[k + 1];
        var X = (px / q + 180) / 360 * W, Y = (90 - py / q) / 180 * H;
        if (prevX === null || Math.abs(X - prevX) > W / 2) g.moveTo(X, Y); else g.lineTo(X, Y);
        prevX = X;
      }
      g.stroke();
    });
  });

  // ---------- the stand ----------
  var woodTex = canvasTex(128, 128, function (g, w, h) {
    g.fillStyle = "#4a2a18"; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 40; i++) { g.strokeStyle = "rgba(20,10,4," + rnd(0.1, 0.35) + ")"; g.lineWidth = rnd(1, 2.5); g.beginPath(); var y0 = rnd(0, h); g.moveTo(0, y0); g.bezierCurveTo(w * 0.3, y0 + rnd(-6, 6), w * 0.7, y0 + rnd(-6, 6), w, y0 + rnd(-4, 4)); g.stroke(); }
  });
  var woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, metalness: 0.05 });
  var brass = new THREE.MeshStandardMaterial({ color: 0xdcae52, roughness: 0.3, metalness: 0.7 });

  var R = 1.5;
  var stand = new THREE.Group();
  scene.add(stand);

  // the tilted axis group: globe, meridian ring and pole caps share the 23.5 degree lean
  var TILT = -0.41;
  var tilt = new THREE.Group();
  tilt.position.y = 0.55;
  tilt.rotation.z = TILT;
  stand.add(tilt);

  var globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: worldTex, roughness: 0.42, metalness: 0.05 }));
  tilt.add(globe);
  // a soft glow around it
  tilt.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 48, 32), new THREE.MeshBasicMaterial({ color: 0xc4623e, transparent: true, opacity: 0.07, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));

  var RR = R + 0.16;
  var ring = new THREE.Mesh(new THREE.TorusGeometry(RR, 0.035, 14, 128), brass);
  tilt.add(ring);
  // degree ticks on the ring
  for (var d = 0; d < 360; d += 10) {
    var tick = new THREE.Mesh(new THREE.BoxGeometry(d % 30 === 0 ? 0.05 : 0.03, 0.012, 0.075), new THREE.MeshStandardMaterial({ color: 0x3a2a14, roughness: 0.6 }));
    var a = d * Math.PI / 180;
    tick.position.set(Math.cos(a) * RR, Math.sin(a) * RR, 0);
    tick.rotation.z = a + Math.PI / 2;
    tilt.add(tick);
  }
  [1, -1].forEach(function (s) {                    // brass caps where the axis meets the ring
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 20), brass);
    cap.position.y = s * (RR + 0.0);
    tilt.add(cap);
    var knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), brass);
    knob.position.y = s * (RR + 0.16);
    tilt.add(knob);
  });

  // curved brass arm from the base up to the bottom of the ring
  var bx = Math.sin(TILT) * RR * -1 * -1, by = tilt.position.y - Math.cos(TILT) * RR; // bottom of the tilted ring
  bx = Math.sin(TILT) * RR;
  var baseTop = -1.78;
  var arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, baseTop, 0),
    new THREE.Vector3(0.02, baseTop + 0.32, 0),
    new THREE.Vector3(bx * 0.55, (baseTop + by) / 2 + 0.05, 0),
    new THREE.Vector3(bx, by - 0.04, 0)
  ]), 40, 0.075, 14, false), brass);
  stand.add(arm);

  // turned wooden base with brass bands
  var baseGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(1.18, 0), new THREE.Vector2(1.22, 0.05), new THREE.Vector2(1.2, 0.11),
    new THREE.Vector2(1.0, 0.17), new THREE.Vector2(0.86, 0.2), new THREE.Vector2(0.74, 0.3), new THREE.Vector2(0.58, 0.34),
    new THREE.Vector2(0.38, 0.4), new THREE.Vector2(0.22, 0.5), new THREE.Vector2(0.16, 0.58), new THREE.Vector2(0, 0.58)
  ], 64);
  var base = new THREE.Mesh(baseGeo, woodMat);
  base.position.y = baseTop - 0.56;
  stand.add(base);
  var band = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.025, 10, 80), brass);
  band.rotation.x = Math.PI / 2; band.position.y = baseTop - 0.56 + 0.075;
  stand.add(band);

  // soft contact shadow
  var shTex = canvasTex(128, 128, function (g, w, h) {
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.6)"); gr.addColorStop(0.6, "rgba(0,0,0,.22)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = baseTop - 0.58;
  stand.add(shadow);

  stand.position.y = 0.1;
  stand.scale.setScalar(0.98);
  globe.rotation.y = -1.9;                  // start with Asia towards you

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
  var visible = true, raf = 0;

  function frame(dt) {
    if (!reduceMotion) globe.rotation.y += dt * 0.3;
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
