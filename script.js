/* ==========================================================================
   Abhisan Ghimire — Portfolio
   Site behavior: mobile nav, active-link tracking, scroll-reveal, footer year
   ========================================================================== */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    setFooterYear();
    initMobileNav();
    initActiveNavTracking();
    initScrollReveal();
    initHeaderScrollState();
    initGitHubProjects();
  });

  /* ============ Footer year ============ */
  function setFooterYear() {
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  /* ============ Mobile nav toggle ============ */
  function initMobileNav() {
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("main-nav");
    if (!toggle || !nav) return;

    function closeNav() {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("open");
    }

    function openNav() {
      toggle.setAttribute("aria-expanded", "true");
      nav.classList.add("open");
    }

    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) {
        closeNav();
      } else {
        openNav();
      }
    });

    // close the mobile menu whenever a nav link is used
    nav.querySelectorAll("a[data-nav]").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });

    // close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });

    // close if the viewport grows back to desktop size
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1150) closeNav();
    });
  }

  /* ============ Active nav-link highlighting on scroll ============ */
  function initActiveNavTracking() {
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('a[data-nav]'));
    if (!navLinks.length || !("IntersectionObserver" in window)) return;

    var sections = navLinks
      .map(function (link) {
        var id = link.getAttribute("href");
        if (!id || id.charAt(0) !== "#") return null;
        var el = document.querySelector(id);
        return el ? { id: id, el: el, link: link } : null;
      })
      .filter(Boolean);

    if (!sections.length) return;

    var header = document.getElementById("site-header");
    var headerHeight = header ? header.offsetHeight : 68;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var match = sections.find(function (s) { return s.el === entry.target; });
          if (!match) return;
          if (entry.isIntersecting) {
            navLinks.forEach(function (l) { l.classList.remove("active"); });
            match.link.classList.add("active");
          }
        });
      },
      {
        root: null,
        rootMargin: "-" + (headerHeight + 8) + "px 0px -55% 0px",
        threshold: 0,
      }
    );

    sections.forEach(function (s) { observer.observe(s.el); });
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
    var FALLBACK_URL = "data/github-repos.json";
    // repos that are not "projects": this site, the profile README repo, a GitHub training repo
    var HIDDEN = ["abhisanghimire-site", "abhisanghimire", "github-slideshow"];
    var ALL_LIMIT = 12;

    var state = { repos: [], view: "live", forks: false, showAll: false };
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".gh-tab"));
    var forksBox = document.getElementById("gh-show-forks");
    var moreBtn = document.getElementById("gh-more");
    var countLive = document.getElementById("gh-count-live");
    var countAll = document.getElementById("gh-count-all");

    // the grid sits inside a scroll-reveal container: make sure it is never left hidden
    grid.classList.add("is-visible");

    function prettyName(name) {
      return name
        .replace(/[-_]+/g, " ")
        .replace(/\.py$/, "")
        .trim()
        .replace(/\b([a-z])/g, function (m) { return m.toUpperCase(); });
    }

    function normalize(r) {
      var live = "";
      if (r.has_pages) {
        live = PAGES_BASE + encodeURIComponent(r.name) + "/";
      } else if (!r.fork && r.homepage && /^https:\/\//.test(r.homepage)) {
        live = r.homepage;
      }
      return {
        name: r.name,
        title: prettyName(r.name),
        description: (r.description || "").trim(),
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

    function card(r) {
      var article = el("article", "project-card gh-card");
      article.appendChild(el("p", "status-tag " + (r.live ? "status-pub" : "status-project"),
        r.fork ? "Fork" : (r.live ? "Live demo" : "Repository")));
      article.appendChild(el("h3", "", r.title));

      var desc = el("p", "project-field" + (r.description ? "" : " is-empty"),
        r.description || "No description yet.");
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
      if (r.live) actions.appendChild(link(r.live, "btn btn-primary btn-small", "View live ↗"));
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
        shown.forEach(function (r) { grid.appendChild(card(r)); });
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

    function load(raw) {
      state.repos = raw
        .filter(function (r) { return !r.private && !r.archived; })
        .filter(function (r) { return HIDDEN.indexOf(String(r.name).toLowerCase()) === -1; })
        .map(normalize)
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
    fetchJson(API_URL)
      .catch(function () { return fetchJson(FALLBACK_URL); })
      .then(load)
      .catch(function () {
        grid.textContent = "";
        var p = el("p", "gh-status", "Couldn't load the project list right now. ");
        p.appendChild(link("https://github.com/" + USER + "?tab=repositories", "", "Browse my repositories on GitHub ↗"));
        grid.appendChild(p);
      });
  }
})();
