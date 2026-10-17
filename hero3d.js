/* ==========================================================================
   Hero 3D: a dotted globe with country borders and a small satellite.
   Drag to spin; it keeps drifting on its own. Needs three.js (r128) and data/globe-data.js (window.GLOBE_DATA).
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("hero3d");
  var wrap = document.getElementById("hero3d-wrap");
  var data = window.GLOBE_DATA;
  if (!canvas || !wrap || typeof THREE === "undefined" || !data) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var R = 2;                  // globe radius
  var VIEW_LON = 102;         // resting view: Asia, where four of the five countries are
  var REST_TILT = 0.32;       // north pole tipped toward the viewer
  var DEG = Math.PI / 180;

  // dot spacing (degrees) used to fill each highlighted country; small countries need finer dots
  var FILL_STEP = { "India": 1.0, "Nepal": 0.34, "China": 1.05, "Philippines": 0.42, "United States of America": 1.05 };

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 9.0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    return; // no WebGL: the page reads fine without the globe
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

  // border arcs: delta-encoded integers -> [lon, lat] points
  var arcs = data.arcs.map(function (flat) {
    var pts = [], x = 0, y = 0;
    for (var i = 0; i < flat.length; i += 2) {
      if (i === 0) { x = flat[0]; y = flat[1]; } else { x += flat[i]; y += flat[i + 1]; }
      pts.push([x / data.q, y / data.q]);
    }
    return pts;
  });
  function ringFromArcs(list) {
    var pts = [];
    list.forEach(function (idx) {
      var a = idx >= 0 ? arcs[idx] : arcs[~idx].slice().reverse();
      for (var k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]);
    });
    return pts;
  }

  // the highlighted countries as polygons (with bounding boxes for quick tests)
  var polys = [];
  Object.keys(data.countries).forEach(function (name) {
    data.countries[name].forEach(function (list) {
      var ring = ringFromArcs(list);
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      ring.forEach(function (p) {
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
        if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      });
      polys.push({ name: name, ring: ring, box: [x0, y0, x1, y1] });
    });
  });
  function inRing(lon, lat, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inHighlighted(lon, lat) {
    for (var i = 0; i < polys.length; i++) {
      var b = polys[i].box;
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
      if (inRing(lon, lat, polys[i].ring)) return true;
    }
    return false;
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
    globe.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x232a2f, transparent: true, opacity: 0.5 })));
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

  var baseMat;
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
      if (lat < -58 || !isLand(lat, lon)) continue; // no dots on Antarctica
      var k = R * 1.002;
      pos.push(x * k, y * k, z * k);
      sc.push(0.85 + rand() * 0.3);
    }
    baseMat = dotMaterial(0x7c9385, 0.9, 3.0);
    globe.add(pointsFrom(pos, sc, baseMat));
  })();

  // ---- country borders ----
  function arcSegments(indices, radius) {
    var pos = [];
    indices.forEach(function (idx) {
      var pts = arcs[idx];
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        if (Math.abs(a[0] - b[0]) > 180) continue; // never draw across the antimeridian
        var va = latLonToVec(a[1], a[0], radius), vb = latLonToVec(b[1], b[0], radius);
        pos.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
      }
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }
  var allIdx = [];
  for (var ai = 0; ai < arcs.length; ai++) allIdx.push(ai);
  globe.add(new THREE.LineSegments(arcSegments(allIdx, R * 1.0025),
    new THREE.LineBasicMaterial({ color: 0x5f7078, transparent: true, opacity: 0.75 })));

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

  // a small satellite circling the globe on a tilted orbit
  var SAT_R = R * 1.24, satTilt = 0.9;
  var orbit = new THREE.Group();
  orbit.rotation.x = satTilt; orbit.rotation.z = -0.35;
  var ringPts = [];
  for (var oi = 0; oi <= 128; oi++) { var oa = oi / 128 * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(oa) * SAT_R, 0, Math.sin(oa) * SAT_R)); }
  orbit.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: 0xc4623e, transparent: true, opacity: 0.22 })));
  var sat = new THREE.Group();
  sat.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), new THREE.MeshBasicMaterial({ color: 0xf2a07c })));
  sat.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), new THREE.MeshBasicMaterial({ color: 0xc4623e, transparent: true, opacity: 0.25, depthWrite: false })));
  orbit.add(sat);
  scene.add(orbit);

  // ---- view state ----
  var targetY = -VIEW_LON * DEG;
  globe.rotation.order = "XYZ";
  globe.rotation.x = REST_TILT;
  // on load the globe starts with the USA facing you and sweeps across the Pacific to Asia
  var INTRO_SWEEP = 2.9;
  globe.rotation.y = reduceMotion ? targetY : targetY - INTRO_SWEEP;
  var intro = reduceMotion ? 1 : 0;

  function renderFrame(t) {
    if (baseMat) baseMat.uniforms.uAlpha.value = reduceMotion ? 0.9 : 0.8 + 0.12 * Math.sin(t * 1.3);
    var sa = t * 0.7;
    sat.position.set(Math.cos(sa) * SAT_R, 0, Math.sin(sa) * SAT_R);
    orbit.rotation.y = t * 0.05;
    renderer.render(scene, camera);
  }
  var clock0 = performance.now();
  function renderOnce() { renderFrame((performance.now() - clock0) / 1000); }

  size();
  window.addEventListener("resize", size);

  // ==========================================================================
  // Drag to spin with momentum, gentle auto-spin when idle
  // ==========================================================================
  var dragging = false;
  var lastX = 0, lastY = 0, velX = 0, velY = 0;
  var idle = true, idleTimer = null;
  var AUTO_SPEED = 0.12;

  function clampTilt() { globe.rotation.x = Math.max(-1.2, Math.min(1.3, globe.rotation.x)); }
  function setIdle(val) { idle = val; wrap.classList.toggle("is-idle", val); }

  function onPointerDown(e) {
    dragging = true;
    intro = 1; // a touch takes over from the opening sweep
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
      intro = Math.min(1, intro + dt / 3.2);
      globe.rotation.y = targetY - INTRO_SWEEP * (1 - ease(intro));
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
