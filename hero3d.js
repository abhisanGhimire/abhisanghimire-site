/* ==========================================================================
   Hero 3D: a flamingo (animated glTF model from the three.js examples, by
   mirada) flapping and gliding over a soft glow with drifting dust.
   Drag to turn it; it settles back. Needs three.js (r128) and GLTFLoader.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  if (!canvas || !wrap || typeof THREE === "undefined" || !THREE.GLTFLoader) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.4, 11);
  camera.lookAt(0, 0, 0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    wrap.classList.add("no-webgl");
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;

  // lights: warm key from the upper right, cool fill, rust rim from behind
  scene.add(new THREE.HemisphereLight(0xdfe9e3, 0x2a2420, 0.9));
  var key = new THREE.DirectionalLight(0xfff0e0, 1.5);
  key.position.set(4, 5, 6);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xc4623e, 1.4);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  // soft round sprite for the glow and dust
  var sc = document.createElement("canvas");
  sc.width = sc.height = 64;
  var sctx = sc.getContext("2d");
  var grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.4)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.08)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  var sprite = new THREE.CanvasTexture(sc);


  // drifting dust
  var dustArr = [], DUST = 160;
  for (var i = 0; i < DUST; i++) {
    dustArr.push((Math.random() - 0.5) * 11, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6 - 1);
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dustArr, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.07, map: sprite, color: 0xf6b08a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  var pivot = new THREE.Group();   // drag turns this
  var bird = new THREE.Group();    // bob and bank live here
  pivot.add(bird);
  scene.add(pivot);

  var mixer = null;

  function resize() {
    var w = wrap.clientWidth || 400, h = wrap.clientHeight || w;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  new THREE.GLTFLoader().load("/assets/3d/flamingo.glb", function (gltf) {
    var model = gltf.scene;
    model.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(model);
    var size = new THREE.Vector3(); box.getSize(size);
    var ctr = new THREE.Vector3(); box.getCenter(ctr);
    var s = 8.6 / Math.max(size.x, size.y, size.z);
    model.scale.multiplyScalar(s);
    model.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);
    bird.add(model);
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(gltf.animations[0]).setDuration(1).play();
    }
    wrap.classList.add("is-ready");
    if (reduceMotion) { if (mixer) mixer.setTime(0.3); renderer.render(scene, camera); }
  });

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
  var BASE_YAW = -1.45; // three-quarter view

  function frame(dt) {
    time += dt;
    if (mixer) mixer.update(dt);
    if (!dragging) {
      turn += velY; velY *= 0.95;
      if (Math.abs(velY) < 0.003) {
        var home = Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
        turn += (home - turn) * Math.min(1, dt * 1.2);
      }
    }
    pivot.rotation.y = BASE_YAW + turn + hoverY + Math.sin(time * 0.35) * 0.2;
    pivot.rotation.x = hoverX * 0.6;
    bird.position.y = Math.sin(time * 2.0) * 0.18;     // rises with each wing beat
    bird.rotation.z = Math.sin(time * 0.9) * 0.08;     // gentle bank
    dust.rotation.y = time * 0.03;
    dust.position.y = Math.sin(time * 0.5) * 0.15;
    renderer.render(scene, camera);
  }

  function loop() {
    raf = 0;
    if (!visible) return;
    frame(Math.min(clock.getDelta(), 0.05));
    raf = requestAnimationFrame(loop);
  }

  if (!reduceMotion) {
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !raf) { clock.getDelta(); raf = requestAnimationFrame(loop); }
      }).observe(wrap);
    }
    raf = requestAnimationFrame(loop);
  }
})();
