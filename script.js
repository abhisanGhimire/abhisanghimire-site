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
      if (window.innerWidth > 720) closeNav();
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
})();
