/* ==========================================================================
   Hero 3D: the Lorenz attractor, the "butterfly" of chaos theory. Glowing
   particles start almost on top of each other and drift apart along the
   attractor's two wings while it turns slowly. Built in three.js (r128), no
   model files; it runs on its own and ignores the pointer.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  if (!canvas || !wrap || typeof THREE === "undefined") return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 1.2, 11.5);
  camera.lookAt(0, 0, 0);

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

  // soft round sprite
  var sc = document.createElement("canvas");
  sc.width = sc.height = 64;
  var sctx = sc.getContext("2d");
  var grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.7)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 64, 64);
  var sprite = new THREE.CanvasTexture(sc);

  // ---------- the Lorenz system ----------
  var SIGMA = 10, RHO = 28, BETA = 8 / 3, S = 0.1;
  function step(p, dt) {
    var dx = SIGMA * (p[1] - p[0]);
    var dy = p[0] * (RHO - p[2]) - p[1];
    var dz = p[0] * p[1] - BETA * p[2];
    p[0] += dx * dt; p[1] += dy * dt; p[2] += dz * dt;
  }
  // map to the scene: butterfly stands upright, centred
  function put(arr, i, p) { arr[i] = p[0] * S; arr[i + 1] = (p[2] - 25) * S; arr[i + 2] = p[1] * S; }

  // ---------- the faint outline of the whole attractor ----------
  (function () {
    var N = 14000, arr = new Float32Array(N * 3), p = [0.1, 0, 20];
    for (var i = 0; i < 400; i++) step(p, 0.006);
    for (i = 0; i < N; i++) { for (var k = 0; k < 2; k++) step(p, 0.006); put(arr, i * 3, p); }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    pivot.add(new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.028, map: sprite, color: 0x8fb09f, transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending
    })));
  })();

  // ---------- bright particles with fading trails ----------
  var TRAIL = 520;
  var COLORS = [0xc4623e, 0xe0784f, 0xf2a07c, 0xf6c9a8, 0xcfe0d3, 0x9bc0ad, 0x6fa08a];
  var tracers = COLORS.map(function (hex, idx) {
    var p = [0.1 + idx * 0.012, 0.0, 20.0];            // almost identical starts: chaos does the rest
    for (var w = 0; w < 300; w++) step(p, 0.006);
    var pos = new Float32Array(TRAIL * 3), col = new Float32Array(TRAIL * 3);
    var c = new THREE.Color(hex);
    for (var i = 0; i < TRAIL; i++) {
      var f = Math.pow(i / (TRAIL - 1), 1.6);          // 0 at the tail, 1 at the head
      col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f;
      step(p, 0.006);
      put(pos, i * 3, p);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    var dots = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, map: sprite, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    var head = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: hex, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    head.scale.set(0.42, 0.42, 1);
    pivot.add(line); pivot.add(dots); pivot.add(head);
    return { p: p, pos: pos, geo: geo, head: head };
  });

  function advance(n) {
    tracers.forEach(function (t) {
      for (var s = 0; s < n; s++) {
        t.pos.copyWithin(0, 3);                         // slide the trail back one point
        step(t.p, 0.006);
        put(t.pos, (TRAIL - 1) * 3, t.p);
      }
      t.geo.attributes.position.needsUpdate = true;
      t.head.position.set(t.pos[(TRAIL - 1) * 3], t.pos[(TRAIL - 1) * 3 + 1], t.pos[(TRAIL - 1) * 3 + 2]);
    });
  }
  advance(1);

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
    pivot.rotation.y = reduceMotion ? 0.6 : time * 0.22;
    pivot.rotation.x = reduceMotion ? 0.12 : 0.12 + Math.sin(time * 0.17) * 0.1;
    if (!reduceMotion) advance(Math.max(1, Math.round(dt * 60 * 3)));
    renderer.render(scene, camera);
  }

  function loop() {
    raf = 0;
    if (!visible) return;
    frame(Math.min(clock.getDelta(), 0.05));
    raf = requestAnimationFrame(loop);
  }

  if (reduceMotion) {
    advance(500);
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
