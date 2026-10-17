/* ==========================================================================
   Hero 3D: my initials, "AB", built from dots with depth, held in a small
   orrery. Three orbits stand for the three things I do: engineer (sage),
   educator (light rust), researcher (cream). Drag to turn it; it settles
   back to face front. Needs three.js (r128).
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  if (!canvas || !wrap || typeof THREE === "undefined") return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var RUST = 0xc4623e, LIGHT = 0xf2a07c, SAGE = 0x7c9385, CREAM = 0xefe6d6;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 11.6);

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
  var spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = spriteCanvas.height = 64;
  var sctx = spriteCanvas.getContext("2d");
  var grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.95)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  var sprite = new THREE.CanvasTexture(spriteCanvas);

  function dotMaterial(color, size, opacity) {
    return new THREE.PointsMaterial({
      color: color, size: size, map: sprite, transparent: true, opacity: opacity,
      depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending
    });
  }
  function pointsFrom(arr, mat) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.Points(geo, mat);
  }

  // ---------- the "AB" monogram: sample a bold glyph into dots, stacked in depth ----------
  var gw = 260, gh = 160;
  var gc = document.createElement("canvas");
  gc.width = gw; gc.height = gh;
  var g = gc.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, gw, gh);
  g.fillStyle = "#fff";
  g.font = "800 150px Georgia, 'Times New Roman', serif";
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillText("AB", gw / 2, gh * 0.82);
  var px = g.getImageData(0, 0, gw, gh).data;

  var STEP = 4, LAYERS = 7, DEPTH = 0.62;
  var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, x, y, l;
  for (y = 0; y < gh; y += STEP) {
    for (x = 0; x < gw; x += STEP) {
      if (px[(y * gw + x) * 4] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  var fit = 4.5 / (maxX - minX);
  var body = [], faces = [];
  for (y = 0; y < gh; y += STEP) {
    for (x = 0; x < gw; x += STEP) {
      if (px[(y * gw + x) * 4] <= 128) continue;
      for (l = 0; l < LAYERS; l++) {
        var z = (l / (LAYERS - 1) - 0.5) * DEPTH;
        var target = (l === 0 || l === LAYERS - 1) ? faces : body;
        target.push((x - cx) * fit + (Math.random() - 0.5) * 0.015, -(y - cy) * fit + (Math.random() - 0.5) * 0.015, z);
      }
    }
  }
  var monogram = new THREE.Group();
  monogram.add(pointsFrom(body, dotMaterial(RUST, 0.1, 0.85)));
  monogram.add(pointsFrom(faces, dotMaterial(LIGHT, 0.115, 1)));
  root.add(monogram);

  // ---------- orbits: engineer, educator, researcher ----------
  var orbits = [
    { r: 3.05, tilt: 1.15, spin: 0.0, speed: 0.55, color: SAGE },
    { r: 3.45, tilt: -0.55, spin: 1.9, speed: -0.38, color: LIGHT },
    { r: 3.85, tilt: 0.2, spin: 3.7, speed: 0.27, color: CREAM }
  ];
  var beads = [];
  orbits.forEach(function (o, i) {
    var holder = new THREE.Group();
    holder.rotation.x = o.tilt;
    holder.rotation.z = o.spin;
    var ring = [], N = 160;
    for (var k = 0; k < N; k++) {
      var a = (k / N) * Math.PI * 2;
      ring.push(Math.cos(a) * o.r, Math.sin(a) * o.r, 0);
    }
    holder.add(pointsFrom(ring, dotMaterial(o.color, 0.07, 1)));

    var bead = new THREE.Group();
    bead.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 20), new THREE.MeshBasicMaterial({ color: o.color })));
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: o.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(0.55, 0.55, 1);
    bead.add(halo);
    holder.add(bead);
    beads.push({ obj: bead, o: o, phase: i * 2.1 });
    root.add(holder);
  });

  // ---------- faint dust for depth ----------
  var dust = [];
  for (var d = 0; d < 260; d++) {
    var u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, rr = 4.6 + Math.random() * 1.8;
    var s = Math.sqrt(1 - u * u);
    dust.push(rr * s * Math.cos(t), rr * u * 0.8, rr * s * Math.sin(t));
  }
  var dustPts = pointsFrom(dust, dotMaterial(SAGE, 0.035, 0.35));
  scene.add(dustPts);

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

  // ---------- interaction: drag to turn, then settle back to face front ----------
  var dragX = 0, dragY = 0, velX = 0, velY = 0, dragging = false, lastX = 0, lastY = 0, hoverX = 0, hoverY = 0;
  wrap.addEventListener("pointerdown", function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY; velX = velY = 0;
    wrap.classList.add("is-dragging");
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  });
  wrap.addEventListener("pointermove", function (e) {
    if (dragging) {
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      velY = dx * 0.006; velX = dy * 0.006;
      dragY += velY;
      dragX = Math.max(-1.0, Math.min(1.0, dragX + velX));
    } else if (e.pointerType === "mouse") {
      var r = wrap.getBoundingClientRect();
      hoverY = ((e.clientX - r.left) / r.width - 0.5) * 0.35;
      hoverX = ((e.clientY - r.top) / r.height - 0.5) * 0.25;
    }
  });
  function end() { dragging = false; wrap.classList.remove("is-dragging"); }
  wrap.addEventListener("pointerup", end);
  wrap.addEventListener("pointercancel", end);
  wrap.addEventListener("pointerleave", function () { hoverX = hoverY = 0; });

  // ---------- render ----------
  var clock = new THREE.Clock();
  var visible = true, raf = 0, time = 0;

  function frame(dt) {
    time += dt;
    if (!dragging) {
      dragY += velY; velY *= 0.94;
      dragX += velX; velX *= 0.94;
      if (Math.abs(velY) < 0.002) {
        var home = Math.round(dragY / (Math.PI * 2)) * Math.PI * 2;
        dragY += (home - dragY) * Math.min(1, dt * 1.4);
      }
      dragX += (0 - dragX) * Math.min(1, dt * 1.4);
    }
    var sway = reduceMotion ? 0 : Math.sin(time * 0.45) * 0.38;
    var bob = reduceMotion ? 0 : Math.sin(time * 0.6) * 0.04;
    root.rotation.y = sway + dragY + hoverY;
    root.rotation.x = -0.12 + dragX + hoverX + bob;
    dustPts.rotation.y = time * 0.02;

    beads.forEach(function (b) {
      var a = b.phase + time * b.o.speed;
      b.obj.position.set(Math.cos(a) * b.o.r, Math.sin(a) * b.o.r, 0);
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
