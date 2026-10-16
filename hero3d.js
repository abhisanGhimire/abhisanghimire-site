/* ==========================================================================
   Hero 3D — a small, draggable node network.
   Simple on purpose: a sphere of connected points you can grab and spin,
   with a soft glowing core. Auto-rotates gently until touched.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  if (!canvas || !wrap || typeof THREE === "undefined") return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var COLOR_RUST = 0xc4623e;
  var COLOR_SAGE = 0x7c9385;
  var COLOR_GOLD = 0xe8b84b;
  var COLOR_EDGE = 0x54606a;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 7.6);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    return; // no WebGL — caption still stands on its own
  }
  renderer.setClearColor(0x000000, 0);

  function size() {
    var w = wrap.clientWidth || 360;
    var h = wrap.clientHeight || w;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener("resize", size);

  // lighting — soft, so the faceted nodes read as gently 3D
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  var key = new THREE.PointLight(0xffffff, 1.0);
  key.position.set(4, 5, 6);
  scene.add(key);
  var rim = new THREE.PointLight(0xc4623e, 0.5);
  rim.position.set(-5, -3, -3);
  scene.add(rim);

  var group = new THREE.Group();
  scene.add(group);

  // seeded pseudo-random so the layout is stable across reloads
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(7);

  // ---- soft glowing core ----
  var core = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 24),
    new THREE.MeshBasicMaterial({ color: COLOR_GOLD, transparent: true, opacity: 0.14 })
  );
  group.add(core);
  var coreInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 20),
    new THREE.MeshStandardMaterial({ color: COLOR_GOLD, roughness: 0.35, metalness: 0.2 })
  );
  group.add(coreInner);

  // ---- nodes, evenly spread on a sphere (fibonacci sphere) ----
  var NODE_COUNT = 34;
  var RADIUS = 2.5;
  var nodes = [];
  var nodeGeo = new THREE.IcosahedronGeometry(0.1, 0);

  var goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < NODE_COUNT; i++) {
    var yFrac = 1 - (i / (NODE_COUNT - 1)) * 2; // 1..-1
    var radiusAtY = Math.sqrt(1 - yFrac * yFrac);
    var theta = goldenAngle * i;
    var jitter = 0.06;
    var pos = new THREE.Vector3(
      Math.cos(theta) * radiusAtY * RADIUS + (rand() - 0.5) * jitter,
      yFrac * RADIUS + (rand() - 0.5) * jitter,
      Math.sin(theta) * radiusAtY * RADIUS + (rand() - 0.5) * jitter
    );
    var color = i % 3 === 0 ? COLOR_GOLD : (i % 2 === 0 ? COLOR_RUST : COLOR_SAGE);
    var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.15 });
    var mesh = new THREE.Mesh(nodeGeo, mat);
    mesh.position.copy(pos);
    var s = 0.75 + rand() * 0.9;
    mesh.userData.baseScale = s;
    mesh.scale.setScalar(s);
    mesh.userData.spin = (rand() - 0.5) * 1.4;
    group.add(mesh);
    nodes.push(mesh);
  }

  // ---- edges: connect each node to its few nearest neighbours ----
  var linePositions = [];
  var K = 3;
  for (var a = 0; a < nodes.length; a++) {
    var dists = [];
    for (var b = 0; b < nodes.length; b++) {
      if (a === b) continue;
      dists.push([nodes[a].position.distanceTo(nodes[b].position), b]);
    }
    dists.sort(function (x, y) { return x[0] - y[0]; });
    for (var k = 0; k < K; k++) {
      var bi = dists[k][1];
      if (bi > a) {
        linePositions.push(
          nodes[a].position.x, nodes[a].position.y, nodes[a].position.z,
          nodes[bi].position.x, nodes[bi].position.y, nodes[bi].position.z
        );
      }
    }
    // spoke to the core, faint
    linePositions.push(0, 0, 0, nodes[a].position.x, nodes[a].position.y, nodes[a].position.z);
  }
  var lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  var lineMat = new THREE.LineBasicMaterial({ color: COLOR_EDGE, transparent: true, opacity: 0.32 });
  group.add(new THREE.LineSegments(lineGeo, lineMat));

  group.rotation.x = 0.22;

  // ==========================================================================
  // Drag-to-rotate with momentum, gentle auto-spin when idle
  // ==========================================================================
  var dragging = false;
  var lastX = 0, lastY = 0;
  var velX = 0, velY = 0;
  var idleTimer = null;
  var idle = true;
  var AUTO_SPEED = 0.14;

  function setIdle(val) {
    idle = val;
    wrap.classList.toggle("is-idle", val);
  }

  function onPointerDown(e) {
    dragging = true;
    setIdle(false);
    lastX = e.clientX;
    lastY = e.clientY;
    velX = 0; velY = 0;
    wrap.classList.add("is-dragging");
    wrap.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    clearTimeout(idleTimer);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    var sens = 0.006;
    group.rotation.y += dx * sens;
    group.rotation.x += dy * sens;
    group.rotation.x = Math.max(-1.25, Math.min(1.25, group.rotation.x));
    velX = dx * sens;
    velY = dy * sens;
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove("is-dragging");
    idleTimer = setTimeout(function () { setIdle(true); }, 1600);
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  if (reduceMotion) {
    renderer.render(scene, camera);
    return;
  }

  var lastT = 0;
  var paused = false;

  function animate(t) {
    if (paused) return;
    var dt = Math.min((t - lastT) / 1000, 0.05) || 0;
    lastT = t;

    if (dragging) {
      // handled directly in pointer move
    } else if (Math.abs(velX) > 0.0002 || Math.abs(velY) > 0.0002) {
      group.rotation.y += velX;
      group.rotation.x += velY;
      group.rotation.x = Math.max(-1.25, Math.min(1.25, group.rotation.x));
      velX *= 0.94;
      velY *= 0.94;
    } else if (idle) {
      group.rotation.y += dt * AUTO_SPEED;
    }

    var pulse = 1 + Math.sin(t * 0.0011) * 0.06;
    coreInner.scale.setScalar(pulse);
    core.scale.setScalar(pulse * 1.05);

    nodes.forEach(function (n, idx) {
      n.rotation.y += n.userData.spin * dt;
      n.rotation.x += n.userData.spin * 0.6 * dt;
    });

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  idleTimer = setTimeout(function () { setIdle(true); }, 900);

  // pause loop offscreen to save battery
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          paused = true;
        } else if (paused) {
          paused = false;
          lastT = performance.now();
          requestAnimationFrame(animate);
        }
      });
    }, { threshold: 0.01 });
    io.observe(wrap);
  }
})();
