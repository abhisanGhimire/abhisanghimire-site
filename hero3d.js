/* ==========================================================================
   Hero 3D: a glowing torus knot made of dots and fine wire, with a small
   crystal turning inside it and rings of dust around. Always turning;
   drag to spin it faster. Needs three.js (r128).
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  if (!canvas || !wrap || typeof THREE === "undefined") return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 9.5);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    wrap.classList.add("no-webgl");
    return;
  }
  renderer.setClearColor(0x000000, 0);

  var root = new THREE.Group();
  scene.add(root);

  // soft round dot sprite
  var sc = document.createElement("canvas");
  sc.width = sc.height = 64;
  var sctx = sc.getContext("2d");
  var grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.9)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  var sprite = new THREE.CanvasTexture(sc);

  var RUST = new THREE.Color(0xc4623e), LIGHT = new THREE.Color(0xf6b08a), SAGE = new THREE.Color(0x8fb09f);

  // ---------- the knot: dots along the tube, coloured rust to sage along its length ----------
  var knotGeo = new THREE.TorusKnotGeometry(1.5, 0.42, 260, 28, 2, 3);
  var count = knotGeo.attributes.position.count;
  var colors = new Float32Array(count * 3);
  var tube = 29; // vertices per ring of the tube (radialSegments + 1)
  for (var i = 0; i < count; i++) {
    var t = Math.floor(i / tube) / 261;           // 0..1 along the knot
    var m = 0.5 + 0.5 * Math.sin(t * Math.PI * 4); // two full colour sweeps
    var c = RUST.clone().lerp(m > 0.5 ? LIGHT : SAGE, Math.abs(m - 0.5) * 1.1);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  var dotsGeo = new THREE.BufferGeometry();
  dotsGeo.setAttribute("position", knotGeo.attributes.position);
  dotsGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  var knotDots = new THREE.Points(dotsGeo, new THREE.PointsMaterial({
    size: 0.085, map: sprite, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending
  }));
  var knotWire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusKnotGeometry(1.5, 0.42, 130, 10, 2, 3)),
    new THREE.LineBasicMaterial({ color: 0x8fb09f, transparent: true, opacity: 0.16, depthWrite: false }));
  var knot = new THREE.Group();
  knot.add(knotDots);
  knot.add(knotWire);
  root.add(knot);

  // ---------- crystal in the middle, turning the other way ----------
  var crystal = new THREE.Group();
  var ico = new THREE.IcosahedronGeometry(0.62, 1);
  crystal.add(new THREE.LineSegments(new THREE.EdgesGeometry(ico),
    new THREE.LineBasicMaterial({ color: 0xf6b08a, transparent: true, opacity: 0.9 })));
  crystal.add(new THREE.Points(ico, new THREE.PointsMaterial({
    size: 0.12, map: sprite, color: 0xffd8bf, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  })));
  var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0xc4623e, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(2.6, 2.6, 1);
  crystal.add(glow);
  root.add(crystal);

  // ---------- rings of dust ----------
  function ring(radius, n, size, color, opacity, tiltX, tiltZ) {
    var arr = [];
    for (var k = 0; k < n; k++) {
      var a = (k / n) * Math.PI * 2, jitter = (Math.random() - 0.5) * 0.08;
      arr.push(Math.cos(a) * (radius + jitter), (Math.random() - 0.5) * 0.06, Math.sin(a) * (radius + jitter));
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    var p = new THREE.Points(g, new THREE.PointsMaterial({ size: size, map: sprite, color: color, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.rotation.x = tiltX; p.rotation.z = tiltZ;
    root.add(p);
    return p;
  }
  var rings = [
    ring(3.0, 220, 0.05, 0x8fb09f, 0.7, 1.25, 0.2),
    ring(3.4, 260, 0.04, 0xf6b08a, 0.55, -0.7, 0.9),
    ring(3.8, 300, 0.035, 0xefe6d6, 0.4, 0.3, -0.5)
  ];

  // ---------- sizing ----------
  function resize() {
    var w = wrap.clientWidth || 400, h = wrap.clientHeight || w;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.z = aspectZ(camera.aspect);
  }
  function aspectZ(a) { return a < 1 ? 11.5 / Math.max(a, 0.6) : 11.5; }
  resize();
  window.addEventListener("resize", resize);

  // ---------- drag to spin ----------
  var dragging = false, lastX = 0, lastY = 0, velX = 0, velY = 0, hoverX = 0, hoverY = 0;
  wrap.addEventListener("pointerdown", function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY; velX = velY = 0;
    wrap.classList.add("is-dragging");
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  });
  wrap.addEventListener("pointermove", function (e) {
    if (dragging) {
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      velY = dx * 0.008; velX = dy * 0.008;
      root.rotation.y += velY; root.rotation.x += velX;
    } else if (e.pointerType === "mouse") {
      var r = wrap.getBoundingClientRect();
      hoverY = ((e.clientX - r.left) / r.width - 0.5) * 0.4;
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
  root.rotation.x = 0.35;

  function frame(dt) {
    time += dt;
    if (!dragging) {
      root.rotation.y += velY; root.rotation.x += velX;
      velY *= 0.95; velX *= 0.95;
      // ease the tilt back so it never ends up upside down
      root.rotation.x += (0.35 - root.rotation.x) * Math.min(1, dt * 0.8);
    }
    var k = reduceMotion ? 0 : 1;
    knot.rotation.y = time * 0.35 * k + hoverY;
    knot.rotation.x = Math.sin(time * 0.4) * 0.25 * k + hoverX;
    knot.rotation.z = time * 0.12 * k;
    crystal.rotation.y = -time * 0.9 * k;
    crystal.rotation.x = time * 0.6 * k;
    var pulse = 1 + 0.08 * Math.sin(time * 1.6) * k;
    crystal.scale.set(pulse, pulse, pulse);
    rings.forEach(function (r, i) { r.rotation.y = time * (0.12 + i * 0.07) * (i % 2 ? -1 : 1) * k; });
    renderer.render(scene, camera);
  }

  function loop() {
    raf = 0;
    if (!visible) return;
    frame(Math.min(clock.getDelta(), 0.05));
    raf = requestAnimationFrame(loop);
  }

  if (reduceMotion) {
    time = 1.2;
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
