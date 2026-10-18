/* ==========================================================================
   Hero 3D: a solid Rubik's cube turning slowly on its own while it scrambles
   itself and then solves itself by undoing its moves. Built in three.js
   (r128), no model files; it ignores the pointer.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  if (!canvas || !wrap || typeof THREE === "undefined") return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 12.5);
  camera.lookAt(0, 0, 0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    wrap.classList.add("no-webgl");
    return;
  }
  renderer.setClearColor(0x000000, 0);

  // lighting: soft sky fill, warm key, rust rim from behind
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x2a2f36, 0.55));
  var key = new THREE.DirectionalLight(0xffe8d0, 0.85);
  key.position.set(4, 6, 7);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xc4623e, 0.7);
  rim.position.set(-6, -2, -5);
  scene.add(rim);

  var cube = new THREE.Group();
  cube.scale.setScalar(0.92);
  scene.add(cube);

  // ---------- the cubies ----------
  // face colours follow the site palette: rust, amber, cream, sage, slate blue, plum
  var FACE = [
    { n: [1, 0, 0], c: 0xc4623e }, { n: [-1, 0, 0], c: 0xe9a24b },
    { n: [0, 1, 0], c: 0xefe6d6 }, { n: [0, -1, 0], c: 0x7fa38f },
    { n: [0, 0, 1], c: 0x4a6fa5 }, { n: [0, 0, -1], c: 0x8a3b5e }
  ];
  function roundedSquare(size, r) {
    var h = size / 2, s = new THREE.Shape();
    s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
    s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h); s.lineTo(-h + r, h);
    s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
    return new THREE.ShapeGeometry(s, 6);
  }
  var stickerGeo = roundedSquare(0.8, 0.14);
  var bodyGeo = new THREE.BoxGeometry(0.97, 0.97, 0.97);
  var bodyMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.55, metalness: 0.2 });
  var stickerMats = FACE.map(function (f) { return new THREE.MeshStandardMaterial({ color: f.c, roughness: 0.38, metalness: 0.05 }); });

  var cubies = [];
  for (var x = -1; x <= 1; x++) for (var y = -1; y <= 1; y++) for (var z = -1; z <= 1; z++) {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, bodyMat));
    FACE.forEach(function (f, fi) {
      if (x * f.n[0] + y * f.n[1] + z * f.n[2] !== 1) return;     // only faces on the outside
      var st = new THREE.Mesh(stickerGeo, stickerMats[fi]);
      st.position.set(f.n[0] * 0.486, f.n[1] * 0.486, f.n[2] * 0.486);
      st.lookAt(f.n[0] * 2, f.n[1] * 2, f.n[2] * 2);
      g.add(st);
    });
    g.position.set(x, y, z);
    cube.add(g);
    cubies.push(g);
  }

  // ---------- face turns ----------
  var AXES = ["x", "y", "z"];
  var turner = new THREE.Group();
  cube.add(turner);
  var move = null;                 // the turn in progress
  var queue = [], history = [];
  var phase = "pause", pauseLeft = 1.2, scrambleLeft = 0;

  function randomMove(prev) {
    var m;
    do {
      m = { axis: AXES[Math.floor(Math.random() * 3)], layer: Math.floor(Math.random() * 3) - 1, dir: Math.random() < 0.5 ? 1 : -1 };
    } while (prev && prev.axis === m.axis && prev.layer === m.layer);
    return m;
  }
  function beginMove(m, dur) {
    var list = cubies.filter(function (c) { return Math.abs(c.position[m.axis] - m.layer) < 0.1; });
    list.forEach(function (c) { turner.attach(c); });
    move = { m: m, list: list, t: 0, dur: dur };
  }
  function finishMove() {
    turner.rotation.set(0, 0, 0);
    move.list.forEach(function (c) {
      cube.attach(c);
      c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
      // snap the orientation to whole quarter turns so error never builds up
      var e = new THREE.Euler().setFromQuaternion(c.quaternion);
      var q = Math.PI / 2;
      c.quaternion.setFromEuler(new THREE.Euler(Math.round(e.x / q) * q, Math.round(e.y / q) * q, Math.round(e.z / q) * q));
    });
    move = null;
  }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function updateTurns(dt) {
    if (move) {
      move.t += dt;
      var k = Math.min(1, move.t / move.dur);
      turner.rotation.set(0, 0, 0);
      turner.rotation[move.m.axis] = ease(k) * move.m.dir * Math.PI / 2;
      if (k >= 1) finishMove();
      return;
    }
    if (phase === "pause") {
      pauseLeft -= dt;
      if (pauseLeft <= 0) { phase = "scramble"; scrambleLeft = 14; }
    } else if (phase === "scramble") {
      if (scrambleLeft-- > 0) {
        var m = randomMove(history[history.length - 1]);
        history.push(m);
        beginMove(m, 0.42);
      } else { phase = "hold"; pauseLeft = 1.1; }
    } else if (phase === "hold") {
      pauseLeft -= dt;
      if (pauseLeft <= 0) phase = "solve";
    } else if (phase === "solve") {
      if (history.length) {
        var last = history.pop();
        beginMove({ axis: last.axis, layer: last.layer, dir: -last.dir }, 0.34);   // undo the last move
      } else { phase = "pause"; pauseLeft = 2.2; }
    }
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
    cube.rotation.y = reduceMotion ? 0.7 : time * 0.38;
    cube.rotation.x = reduceMotion ? 0.5 : 0.5 + Math.sin(time * 0.27) * 0.22;
    cube.rotation.z = reduceMotion ? 0 : Math.sin(time * 0.19) * 0.08;
    if (!reduceMotion) updateTurns(dt);
    renderer.render(scene, camera);
  }

  function loop() {
    raf = 0;
    if (!visible) return;
    frame(Math.min(clock.getDelta(), 0.05));
    raf = requestAnimationFrame(loop);
  }

  if (reduceMotion) {
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
