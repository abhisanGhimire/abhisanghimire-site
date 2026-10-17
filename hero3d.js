/* ==========================================================================
   Hero 3D: a dotted globe with Nepal highlighted and its flag flying.
   Land comes from Natural Earth (public domain), drawn as dots; the flag is
   the official construction. Drag to spin, double-click to return to Nepal.
   Needs three.js (r128) and data/globe-data.js (window.GLOBE_DATA).
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  var data = window.GLOBE_DATA;
  if (!canvas || !wrap || typeof THREE === "undefined" || !data) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var R = 2;                                   // globe radius
  var NEPAL_VIEW = { lat: 28.2, lon: 84.1 };   // centre of the country
  var FLAG_AT = { lat: 27.717, lon: 85.324 };  // Kathmandu
  var REST_TILT = 0.2;                         // north pole tipped slightly toward the viewer
  var DEG = Math.PI / 180;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 9.0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    return; // no WebGL: the page still reads fine without the globe
  }
  renderer.setClearColor(0x000000, 0);

  var dotUniformSets = [];
  function size() {
    var w = wrap.clientWidth || 360;
    var h = wrap.clientHeight || w;
    var pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dotUniformSets.forEach(function (u) { u.uPixelRatio.value = pr * (h / 420); });
    if (reduceMotion) renderOnce();
  }

  // ---- helpers ----
  function latLonToVec(lat, lon, r) {
    var phi = lat * DEG, lam = lon * DEG;
    return new THREE.Vector3(
      r * Math.cos(phi) * Math.sin(lam),
      r * Math.sin(phi),
      r * Math.cos(phi) * Math.cos(lam)
    );
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(11);

  // land mask (1 degree cells, bit-packed, top row = lat 89.5)
  var bin = atob(data.land);
  var bits = new Uint8Array(bin.length);
  for (var bi = 0; bi < bin.length; bi++) bits[bi] = bin.charCodeAt(bi);
  function isLand(lat, lon) {
    var col = Math.floor(lon + 180), row = Math.floor(90 - lat);
    if (col < 0) col = 0; if (col >= data.landW) col = data.landW - 1;
    if (row < 0) row = 0; if (row >= data.landH) row = data.landH - 1;
    var idx = row * data.landW + col;
    return (bits[idx >> 3] >> (idx & 7)) & 1;
  }
  var nepal = data.nepal; // [[lon, lat], ...]
  function inNepal(lon, lat) {
    var inside = false;
    for (var i = 0, j = nepal.length - 1; i < nepal.length; j = i++) {
      var xi = nepal[i][0], yi = nepal[i][1], xj = nepal[j][0], yj = nepal[j][1];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // ---- everything that spins lives in this group ----
  var globe = new THREE.Group();
  scene.add(globe);

  // body: dark sphere with soft shading so it reads as a solid
  globe.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.996, 64, 48),
    new THREE.ShaderMaterial({
      vertexShader: [
        "varying vec3 vN;",
        "void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vN;",
        "void main(){",
        "  float l = max(dot(vN, normalize(vec3(-0.45, 0.55, 0.7))), 0.0);",
        "  vec3 base = vec3(0.070, 0.085, 0.100);",
        "  vec3 col = base * (0.55 + 0.75 * l) + vec3(0.020, 0.030, 0.034) * pow(1.0 - vN.z, 2.0);",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    })
  ));

  // graticule: faint meridians and parallels
  (function () {
    var pos = [];
    var seg = 96;
    function ring(fn) {
      for (var i = 0; i < seg; i++) {
        var a = fn(i / seg), b = fn((i + 1) / seg);
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    var lat, lon;
    for (lat = -60; lat <= 60; lat += 30) {
      (function (la) { ring(function (t) { return latLonToVec(la, t * 360 - 180, R * 1.001); }); })(lat);
    }
    for (lon = 0; lon < 180; lon += 30) {
      (function (lo) { ring(function (t) { return latLonToVec(t * 360 - 180, lo, R * 1.001); }); })(lon);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    globe.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2b3136, transparent: true, opacity: 0.55 })));
  })();

  // ---- dots (round, fade toward the limb) ----
  function dotMaterial(color, alpha, sizePx) {
    var uniforms = {
      uColor: { value: new THREE.Color(color) },
      uAlpha: { value: alpha },
      uSize: { value: sizePx },
      uPixelRatio: { value: 1 }
    };
    dotUniformSets.push(uniforms);
    return new THREE.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: [
        "uniform float uSize; uniform float uPixelRatio;",
        "attribute float aScale;",
        "varying float vFacing;",
        "void main(){",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  vec3 n = normalize(normalMatrix * normalize(position));",
        "  vFacing = dot(n, normalize(-mv.xyz));",
        "  gl_PointSize = uSize * aScale * uPixelRatio * (9.0 / -mv.z);",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uColor; uniform float uAlpha;",
        "varying float vFacing;",
        "void main(){",
        "  float d = length(gl_PointCoord - 0.5);",
        "  float a = smoothstep(0.5, 0.32, d);",
        "  float fade = smoothstep(0.0, 0.35, vFacing);",
        "  gl_FragColor = vec4(uColor * (0.62 + 0.45 * vFacing), a * fade * uAlpha);",
        "}"
      ].join("\n")
    });
  }
  function pointsFrom(positions, scales, material) {
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("aScale", new THREE.Float32BufferAttribute(scales, 1));
    return new THREE.Points(g, material);
  }

  // continents: an even spread of points on the sphere, kept where the land mask says land
  (function () {
    var N = 18000, golden = Math.PI * (3 - Math.sqrt(5));
    var pos = [], sc = [];
    for (var i = 0; i < N; i++) {
      var y = 1 - (2 * (i + 0.5)) / N;
      var r = Math.sqrt(1 - y * y);
      var th = golden * i;
      var x = Math.cos(th) * r, z = Math.sin(th) * r;
      var lat = Math.asin(y) / DEG, lon = Math.atan2(x, z) / DEG;
      if (!isLand(lat, lon) || inNepal(lon, lat)) continue;
      var k = R * 1.002;
      pos.push(x * k, y * k, z * k);
      sc.push(0.85 + rand() * 0.3);
    }
    globe.add(pointsFrom(pos, sc, dotMaterial(0x7c9385, 0.95, 3.0)));
  })();

  // Nepal: its own finer, crimson dots, plus its border
  var nepalMat;
  (function () {
    var pos = [], sc = [];
    for (var lat = 26.3; lat <= 30.5; lat += 0.2) {
      for (var lon = 80.0; lon <= 88.25; lon += 0.2) {
        if (!inNepal(lon, lat)) continue;
        var v = latLonToVec(lat, lon, R * 1.003);
        pos.push(v.x, v.y, v.z);
        sc.push(1.0 + rand() * 0.25);
      }
    }
    nepalMat = dotMaterial(0xdc143c, 1.0, 3.1);
    globe.add(pointsFrom(pos, sc, nepalMat));

    var line = [];
    nepal.forEach(function (p) {
      var v = latLonToVec(p[1], p[0], R * 1.004);
      line.push(v.x, v.y, v.z);
    });
    var lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(line, 3));
    globe.add(new THREE.LineLoop(lg, new THREE.LineBasicMaterial({ color: 0xff5a73, transparent: true, opacity: 0.95 })));
  })();

  // atmosphere glow (outside the spinning group, so it never moves)
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.14, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xc4623e) } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: [
        "varying vec3 vN;",
        "void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uColor; varying vec3 vN;",
        "void main(){",
        "  float i = pow(max(0.0, 0.66 - dot(vN, vec3(0.0, 0.0, 1.0))), 3.4);",
        "  gl_FragColor = vec4(uColor * i * 0.95, i);",
        "}"
      ].join("\n")
    })
  ));
  // thin rim light on the globe's own edge
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.008, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x9bb3a6) } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: [
        "varying vec3 vN;",
        "void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uColor; varying vec3 vN;",
        "void main(){ float i = pow(1.0 - max(vN.z, 0.0), 3.0) * 0.5; gl_FragColor = vec4(uColor * i, i); }"
      ].join("\n")
    })
  ));

  // ---- the flag on its pole ----
  var flagDir = latLonToVec(FLAG_AT.lat, FLAG_AT.lon, 1).normalize();
  var POLE_H = 0.8;
  var pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, POLE_H, 8),
    new THREE.MeshBasicMaterial({ color: 0xeceae4 })
  );
  pole.position.copy(flagDir.clone().multiplyScalar(R + POLE_H / 2));
  pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), flagDir);
  globe.add(pole);

  var tip = new THREE.Object3D();
  tip.position.copy(flagDir.clone().multiplyScalar(R + POLE_H));
  globe.add(tip);

  var FLAG_H = 0.62, FLAG_W = FLAG_H * data.flagAspect;
  var FLAG_DROP = 0.14; // how far the hoist reaches below the pole tip
  var SEG_X = 16, SEG_Y = 20;
  var flagGeo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, SEG_X, SEG_Y);
  flagGeo.translate(FLAG_W / 2, FLAG_H / 2 - FLAG_DROP, 0); // hoist on the left edge, standing mostly above the pole tip
  var flagBase = flagGeo.attributes.position.array.slice();
  var flagColors = new Float32Array(flagBase.length);
  flagColors.fill(1);
  flagGeo.setAttribute("color", new THREE.BufferAttribute(flagColors, 3));
  var flagMat = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true, alphaTest: 0.05
  });
  var flagMesh = new THREE.Mesh(flagGeo, flagMat);
  flagMesh.visible = false;
  tip.add(flagMesh);

  (function loadFlag() {
    var img = new Image();
    img.onload = function () {
      var cw = 512, ch = Math.round(cw / data.flagAspect);
      var cv = document.createElement("canvas");
      cv.width = cw; cv.height = ch;
      cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
      var tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = 4;
      flagMat.map = tex;
      flagMat.needsUpdate = true;
      flagReady = true;
      if (reduceMotion) renderOnce();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data.flagSvg);
  })();
  var flagReady = false;

  function waveFlag(t) {
    var p = flagGeo.attributes.position.array;
    var c = flagGeo.attributes.color.array;
    for (var i = 0; i < p.length; i += 3) {
      var x0 = flagBase[i], y0 = flagBase[i + 1];
      var u = x0 / FLAG_W;            // 0 at the pole, 1 at the free edge
      var v = (FLAG_H - FLAG_DROP - y0) / FLAG_H; // 0 at the top, 1 at the bottom
      var phase = u * 4.4 - t * 2.7;
      var z = Math.sin(phase) * 0.05 * u + Math.sin(u * 8.0 - t * 4.3 + v * 2.2) * 0.014 * u;
      p[i] = x0 * (1 - 0.05 * Math.abs(Math.sin(phase)) * u);
      p[i + 1] = y0 + Math.sin(phase * 0.8) * 0.012 * u * (0.3 + v);
      p[i + 2] = z;
      var slope = Math.cos(phase) * 0.05 * 4.4 * u;   // cloth shading from the slope
      var shade = 0.84 + 0.2 * Math.max(-1, Math.min(1, slope * 2.4));
      c[i] = c[i + 1] = c[i + 2] = shade;
    }
    flagGeo.attributes.position.needsUpdate = true;
    flagGeo.attributes.color.needsUpdate = true;
  }

  // a soft ping ring where the flag stands
  var rings = [0, 1].map(function (k) {
    var m = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.065, 48),
      new THREE.MeshBasicMaterial({ color: 0xff5a73, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    m.position.copy(flagDir.clone().multiplyScalar(R * 1.006));
    m.lookAt(flagDir.clone().multiplyScalar(R * 3));
    m.userData.phase = k * 0.5;
    globe.add(m);
    return m;
  });
  function pingRings(t) {
    rings.forEach(function (m) {
      var s = ((t * 0.45 + m.userData.phase) % 1);
      m.scale.setScalar(1 + s * 5.5);
      m.material.opacity = (1 - s) * (1 - s) * 0.65;
    });
  }

  // ---- view state ----
  var targetY = -NEPAL_VIEW.lon * DEG;
  globe.rotation.order = "XYZ";
  globe.rotation.x = REST_TILT;
  globe.rotation.y = reduceMotion ? targetY : targetY - 2.4; // spins in to Nepal on load
  var intro = reduceMotion ? 1 : 0;

  var qGlobe = new THREE.Quaternion();
  var flagWorldDir = new THREE.Vector3();
  function smooth(a, b, x) { var k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); }
  function renderFrame(t) {
    waveFlag(reduceMotion ? 0.6 : t);
    pingRings(reduceMotion ? 0.3 : t);
    if (nepalMat) nepalMat.uniforms.uAlpha.value = reduceMotion ? 1 : 0.88 + 0.12 * Math.sin(t * 1.6);
    globe.updateMatrixWorld(true);
    globe.getWorldQuaternion(qGlobe);
    // the pole rises and the flag unfurls as Nepal turns toward the viewer, and folds away as it turns off
    flagWorldDir.copy(flagDir).applyQuaternion(qGlobe);
    var up = smooth(0.45, 0.82, flagWorldDir.z);
    pole.visible = up > 0.005;
    pole.scale.set(1, Math.max(up, 0.001), 1);
    pole.position.copy(flagDir).multiplyScalar(R + (POLE_H * up) / 2);
    tip.position.copy(flagDir).multiplyScalar(R + POLE_H * up);
    flagMesh.scale.setScalar(Math.max(up, 0.001));
    flagMesh.visible = flagReady && up > 0.01;
    qGlobe.invert();
    flagMesh.quaternion.copy(qGlobe).multiply(camera.quaternion); // the flag always faces the viewer
    renderer.render(scene, camera);
  }
  var clock0 = performance.now();
  function renderOnce() { renderFrame((performance.now() - clock0) / 1000); }

  size();
  window.addEventListener("resize", size);

  // ==========================================================================
  // Drag to spin with momentum, double-click for Nepal, gentle auto-spin when idle
  // ==========================================================================
  var dragging = false;
  var lastX = 0, lastY = 0, velX = 0, velY = 0;
  var idle = true, idleTimer = null;
  var AUTO_SPEED = 0.12;
  var focus = null; // animation back to Nepal
  var downX = 0, downY = 0, moved = false, lastTap = 0;

  function clampTilt() { globe.rotation.x = Math.max(-1.2, Math.min(1.3, globe.rotation.x)); }
  function setIdle(val) { idle = val; wrap.classList.toggle("is-idle", val); }

  function onPointerDown(e) {
    dragging = true;
    focus = null;
    intro = 1; // a touch takes over from the opening spin
    downX = e.clientX; downY = e.clientY; moved = false;
    setIdle(false);
    lastX = e.clientX; lastY = e.clientY; velX = 0; velY = 0;
    wrap.classList.add("is-dragging");
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    clearTimeout(idleTimer);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 8) moved = true;
    var sens = 0.006;
    globe.rotation.y += dx * sens;
    globe.rotation.x += dy * sens;
    clampTilt();
    velX = dx * sens; velY = dy * sens;
    if (reduceMotion) renderOnce();
  }
  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove("is-dragging");
    idleTimer = setTimeout(function () { setIdle(true); }, 1600);
    // two quick taps (or a double-click) bring Nepal back to the front, on touch screens too
    if (!moved) {
      var now = performance.now();
      if (now - lastTap < 380) { lastTap = 0; goToNepal(); } else { lastTap = now; }
    }
  }
  function goToNepal() {
    var twoPi = Math.PI * 2;
    intro = 1;
    var from = globe.rotation.y;
    var to = targetY + Math.round((from - targetY) / twoPi) * twoPi; // nearest way round
    focus = { t0: performance.now(), dur: 1100, fromY: from, toY: to, fromX: globe.rotation.x, toX: REST_TILT };
    velX = velY = 0;
    setIdle(false);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { setIdle(true); }, 2600);
    if (reduceMotion) { globe.rotation.y = to; globe.rotation.x = REST_TILT; renderOnce(); focus = null; }
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  if (reduceMotion) { renderOnce(); return; }

  var lastT = 0;
  var paused = false;
  function ease(x) { return 1 - Math.pow(1 - x, 3); }

  function animate(now) {
    if (paused) return;
    var dt = Math.min((now - lastT) / 1000, 0.05) || 0;
    lastT = now;

    if (intro < 1) {
      intro = Math.min(1, intro + dt / 2.8);
      globe.rotation.y = targetY - 2.4 * (1 - ease(intro));
    } else if (focus) {
      var k = Math.min(1, (performance.now() - focus.t0) / focus.dur);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      globe.rotation.y = focus.fromY + (focus.toY - focus.fromY) * e;
      globe.rotation.x = focus.fromX + (focus.toX - focus.fromX) * e;
      if (k >= 1) focus = null;
    } else if (dragging) {
      // handled in pointer move
    } else if (Math.abs(velX) > 0.0002 || Math.abs(velY) > 0.0002) {
      globe.rotation.y += velX;
      globe.rotation.x += velY;
      clampTilt();
      velX *= 0.94; velY *= 0.94;
    } else if (idle) {
      globe.rotation.y += dt * AUTO_SPEED;
      globe.rotation.x += (REST_TILT - globe.rotation.x) * Math.min(1, dt * 0.8); // drift back to the resting tilt
    }

    renderFrame((now - clock0) / 1000);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  idleTimer = setTimeout(function () { setIdle(true); }, 900);

  // pause the loop offscreen to save battery
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
