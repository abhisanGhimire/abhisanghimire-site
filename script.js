/* ==========================================================================
   Abhisan Ghimire: Portfolio
   Site behavior: menu and submenus, old-link redirects, scroll-reveal,
   footer year, GitHub projects
   ========================================================================== */
(function () {
  "use strict";

  // the menu collapses into the button at this width (keep in sync with styles.css)
  var MOBILE_NAV_MAX = 860;

  // runs straight away: old one-page links (#research, #publications, ...) go to their new pages
  initLegacyAnchors();
  window.addEventListener("hashchange", initLegacyAnchors);

  document.addEventListener("DOMContentLoaded", function () {
    setFooterYear();
    initNav();
    initScrollReveal();
    initHeaderScrollState();
    initGitHubProjects();
  });

  /* ============ Old one-page links ============ */
  function initLegacyAnchors() {
    if (location.pathname !== "/" || !location.hash) return;
    var map = {
      "#research": "/research/",
      "#publications": "/publications/",
      "#experience": "/experience/",
      "#projects": "/projects/",
      "#github": "/github/",
      "#toolkit": "/toolkit/",
      "#education": "/cv/",
      "#about": "/about/",
      "#contact": "/contact/"
    };
    var target = map[location.hash];
    if (target) location.replace(target);
  }

  /* ============ Footer year ============ */
  function setFooterYear() {
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  /* ============ Menu: submenus and the mobile panel ============ */
  function initNav() {
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("main-nav");
    if (!toggle || !nav) return;
    var parents = Array.prototype.slice.call(nav.querySelectorAll(".nav-parent"));

    function isMobile() { return window.innerWidth <= MOBILE_NAV_MAX; }

    function closeSubs(except) {
      parents.forEach(function (btn) {
        if (btn === except) return;
        btn.setAttribute("aria-expanded", "false");
        btn.parentNode.classList.remove("open");
      });
    }

    function closeNav() {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("open");
      document.body.classList.remove("nav-open");
      closeSubs(null);
    }

    function openNav() {
      toggle.setAttribute("aria-expanded", "true");
      nav.classList.add("open");
      document.body.classList.add("nav-open");
    }

    toggle.addEventListener("click", function () {
      if (toggle.getAttribute("aria-expanded") === "true") closeNav();
      else openNav();
    });

    // a group button opens or closes its own submenu
    parents.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = btn.getAttribute("aria-expanded") === "true";
        closeSubs(btn);
        btn.setAttribute("aria-expanded", String(!open));
        btn.parentNode.classList.toggle("open", !open);
      });
    });

    // choosing a page closes everything
    nav.querySelectorAll("a[data-nav]").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });

    // clicking anywhere else closes an open submenu
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) closeSubs(null);
    });

    // Escape closes the menu and returns focus to the group button on desktop
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var openBtn = parents.filter(function (b) { return b.getAttribute("aria-expanded") === "true"; })[0];
      closeNav();
      if (openBtn && !isMobile()) openBtn.focus();
    });

    // growing back to desktop size resets the mobile panel
    window.addEventListener("resize", function () {
      if (!isMobile()) closeNav();
    });
  }
  /* ============ Scroll-reveal fade-ins ============ */
  function initScrollReveal() {
    var reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // apply the reveal treatment to the main content blocks
    var targets = document.querySelectorAll(
      ".section-inner > *, .project-card, .experience-item, .pub-entry"
    );

    if (!targets.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("reveal", "is-visible"); });
      return;
    }

    targets.forEach(function (el) { el.classList.add("reveal"); });

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ============ Header background state on scroll ============ */
  function initHeaderScrollState() {
    var header = document.getElementById("site-header");
    if (!header) return;

    function update() {
      if (window.scrollY > 8) {
        header.classList.add("is-scrolled");
      } else {
        header.classList.remove("is-scrolled");
      }
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ============ GitHub projects ============ */
  function initGitHubProjects() {
    var grid = document.getElementById("gh-grid");
    if (!grid) return;

    var USER = "abhisanGhimire";
    var PAGES_BASE = "https://abhisanghimire.github.io/";
    var API_URL = "https://api.github.com/users/" + USER + "/repos?per_page=100&sort=pushed";
    var FALLBACK_URL = "/data/github-repos.json";
    var DESCRIPTIONS_URL = "/data/project-descriptions.json";
    // repos that are not shown: this site, the profile README repo, a GitHub training repo,
    // projects the owner chose to hide, and empty placeholder repos
    var HIDDEN = [
      "abhisanghimire-site", "abhisanghimire", "github-slideshow",
      "i-dont-know-github", "urnotes", "emmanuel-opoku", "sherylmemorialfund", "abhisan-app",
      "my-history", "download-app", "soft_delete_force_delete", "kotlin_practice_with_android"
    ];
    var ALL_LIMIT = 12;

    var state = { repos: [], view: "live", forks: false, showAll: false };
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".gh-tab"));
    var forksBox = document.getElementById("gh-show-forks");
    var moreBtn = document.getElementById("gh-more");
    var countLive = document.getElementById("gh-count-live");
    var countAll = document.getElementById("gh-count-all");

    // the grid sits inside a scroll-reveal container: make sure it is never left hidden
    grid.classList.add("is-visible");

    // display names where the repo name does not turn into a good title automatically
    var TITLES = {
      "image2pdf": "Image to PDF",
      "hpsg-website": "HPSG Website",
      "covidtracker": "COVID Tracker",
      "corona_map": "Corona Map",
      "d3_server": "D3 Server",
      "3D_modeling_with_three_js": "3D Modeling with Three.js",
      "completeLaravel": "Complete Laravel",
      "kobo_form_with_lee": "KoBo Form with Lee",
      "flask_csci245": "Flask Attendance (CSCI 245)",
      "research_clark_image_processing": "Clark Image Processing Research",
      "nabin_forked": "Food Ordering App",
      "ecom": "E-commerce Store"
    };

    function prettyName(name) {
      if (TITLES[name]) return TITLES[name];
      return name
        .replace(/[-_]+/g, " ")
        .replace(/\.py$/, "")
        .trim()
        .replace(/\b([a-z])/g, function (m) { return m.toUpperCase(); });
    }

    function normalize(r, descriptions) {
      var live = "";
      if (r.has_pages) {
        live = PAGES_BASE + encodeURIComponent(r.name) + "/";
      } else if (!r.fork && r.homepage && /^https:\/\//.test(r.homepage)) {
        live = r.homepage;
      }
      return {
        name: r.name,
        title: prettyName(r.name),
        // hand-written description first, then the GitHub one
        description: String((descriptions && descriptions[r.name]) || r.description || "").trim(),
        url: r.html_url,
        live: live,
        language: r.language || "",
        pushed: r.pushed_at ? new Date(r.pushed_at) : null,
        fork: !!r.fork,
        stars: r.stargazers_count || 0
      };
    }

    function visibleRepos() {
      return state.repos
        .filter(function (r) { return state.forks || !r.fork; })
        .filter(function (r) { return state.view === "all" || r.live; });
    }

    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function link(href, className, label) {
      var a = el("a", className, label);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      return a;
    }

    function card(r, view) {
      // live demos are only offered on the "Live demos" tab; "All repositories" links to code only
      var showLive = view === "live" && !!r.live;
      var article = el("article", "project-card gh-card");
      article.appendChild(el("p", "status-tag " + (showLive ? "status-pub" : "status-project"),
        r.fork ? "Fork" : (showLive ? "Live demo" : "Repository")));
      article.appendChild(el("h3", "", r.title));

      var desc = el("p", "project-field" + (r.description ? "" : " is-empty"),
        r.description || (r.fork ? "Forked repository." : "No description yet."));
      article.appendChild(desc);

      var meta = el("p", "gh-meta");
      if (r.language) meta.appendChild(el("span", "gh-lang", r.language));
      if (r.stars) meta.appendChild(el("span", "", "★ " + r.stars));
      if (r.pushed) {
        meta.appendChild(el("span", "", "Updated " +
          r.pushed.toLocaleDateString("en-US", { month: "short", year: "numeric" })));
      }
      article.appendChild(meta);

      var actions = el("div", "gh-actions");
      if (showLive) actions.appendChild(link(r.live, "btn btn-primary btn-small", "View live ↗"));
      actions.appendChild(link(r.url, "btn btn-outline btn-small", "View code ↗"));
      article.appendChild(actions);
      return article;
    }

    function updateCounts() {
      var base = state.repos.filter(function (r) { return state.forks || !r.fork; });
      if (countLive) countLive.textContent = "(" + base.filter(function (r) { return r.live; }).length + ")";
      if (countAll) countAll.textContent = "(" + base.length + ")";
    }

    function render() {
      var list = visibleRepos();
      var limited = state.view === "all" && !state.showAll && list.length > ALL_LIMIT;
      var shown = limited ? list.slice(0, ALL_LIMIT) : list;

      grid.textContent = "";
      if (!shown.length) {
        grid.appendChild(el("p", "gh-status", "Nothing to show here yet."));
      } else {
        shown.forEach(function (r) { grid.appendChild(card(r, state.view)); });
      }

      if (moreBtn) {
        moreBtn.hidden = !limited;
        if (limited) moreBtn.textContent = "Show all " + list.length + " repositories";
      }
      updateCounts();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.view = tab.getAttribute("data-view");
        state.showAll = false;
        tabs.forEach(function (t) { t.setAttribute("aria-selected", String(t === tab)); });
        render();
      });
    });
    if (forksBox) {
      forksBox.addEventListener("change", function () {
        state.forks = forksBox.checked;
        state.showAll = false;
        render();
      });
    }
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        state.showAll = true;
        render();
      });
    }

    function load(raw, descriptions) {
      state.repos = raw
        .filter(function (r) { return !r.private && !r.archived; })
        .filter(function (r) { return HIDDEN.indexOf(String(r.name).toLowerCase()) === -1; })
        .map(function (r) { return normalize(r, descriptions); })
        .sort(function (a, b) { return (b.pushed || 0) - (a.pushed || 0); });
      render();
    }

    function fetchJson(url) {
      return fetch(url, { headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    }

    // live data from GitHub first (always current), saved copy if the API is unavailable
    var descriptionsPromise = fetchJson(DESCRIPTIONS_URL).catch(function () { return {}; });

    fetchJson(API_URL)
      .catch(function () { return fetchJson(FALLBACK_URL); })
      .then(function (raw) {
        return descriptionsPromise.then(function (descriptions) { load(raw, descriptions); });
      })
      .catch(function () {
        grid.textContent = "";
        var p = el("p", "gh-status", "Couldn't load the project list right now. ");
        p.appendChild(link("https://github.com/" + USER + "?tab=repositories", "", "Browse my repositories on GitHub ↗"));
        grid.appendChild(p);
      });
  }
})();
