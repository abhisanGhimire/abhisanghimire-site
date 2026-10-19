'use strict';
/*
  Static site build (no dependencies).
    node build.js          builds the site into ./dist
  Sources:
    src/layout.html        shared <head>, header, footer
    src/pages/*.html       one file per page, with a small front-matter block
  Static files (styles.css, script.js, assets/, data/, icons...) are copied as they are.
  The menu lives in NAV below, the single place to change it.
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const SITE = 'https://abhisan.info';
const VERSION = (process.env.GITHUB_SHA || '').slice(0, 8) || Date.now().toString(36);
const TODAY = new Date().toISOString().slice(0, 10);
const CV_PDF = '/assets/Abhisan_Ghimire_Resume.pdf';

// ---- menu: top-level items, with submenus where there is more than one page ----
const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Research', children: [
    { label: 'Interests', href: '/research/' },
    { label: 'Publications', href: '/publications/' }
  ] },
  { label: 'Journey', children: [
    { label: 'About', href: '/about/' },
    { label: 'Experience', href: '/experience/' },
    { label: 'CV & Education', href: '/cv/' }
  ] },
  { label: 'Work', children: [
    { label: 'Projects', href: '/projects/' },
    { label: 'GitHub', href: '/github/' },
    { label: 'Toolkit', href: '/toolkit/' }
  ] },
  { label: 'Contact', href: '/contact/' }
];

const STATIC_FILES = [
  'styles.css', 'script.js', 'favicon.ico', 'favicon.svg',
  'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'logo.svg',
  'site.webmanifest', 'robots.txt', 'CNAME', '0a421855f1b0934c703567e8aa9223dd.txt'
];
const STATIC_DIRS = ['assets', 'data'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderNav(currentPath) {
  const chev = '<svg class="chev" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const link = (item, cls) => {
    const current = item.href === currentPath;
    return '<a href="' + item.href + '"' + (cls ? ' class="' + cls + '"' : '') + ' data-nav' + (current ? ' aria-current="page"' : '') + '>' + esc(item.label) + '</a>';
  };
  const items = NAV.map((item, i) => {
    if (!item.children) {
      return '        <li' + (item.href === currentPath ? ' class="is-current"' : '') + '>' + link(item, 'nav-link') + '</li>';
    }
    const active = item.children.some((c) => c.href === currentPath);
    const id = 'sub-' + item.label.toLowerCase();
    return [
      '        <li class="has-sub' + (active ? ' is-current' : '') + '">',
      '          <button type="button" class="nav-parent" aria-expanded="false" aria-haspopup="true" aria-controls="' + id + '">' + esc(item.label) + ' ' + chev + '</button>',
      '          <ul class="subnav" id="' + id + '">',
      item.children.map((c) => '            <li>' + link(c, '') + '</li>').join('\n'),
      '          </ul>',
      '        </li>'
    ].join('\n');
  });
  return [
    '    <nav class="main-nav" id="main-nav" aria-label="Primary">',
    '      <ul class="nav-list">',
    items.join('\n'),
    '      </ul>',
    '      <a href="' + CV_PDF + '" class="btn btn-outline btn-small nav-cv">CV</a>',
    '    </nav>'
  ].join('\n');
}

function parsePage(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error('missing front matter: ' + file);
  const meta = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return { meta, body: m[2] };
}

const PERSON_ID = SITE + '/#person';
const SITE_ID = SITE + '/#website';
const PERSON = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Abhisan Ghimire',
  givenName: 'Abhisan',
  familyName: 'Ghimire',
  alternateName: ['Abhisan', 'A. Ghimire', 'Ghimire Abhisan'],
  url: SITE + '/',
  image: { '@type': 'ImageObject', url: SITE + '/assets/abhisan-ghimire.jpg', width: 400, height: 400 },
  jobTitle: 'Computer Scientist / Software Engineer',
  description: 'Abhisan Ghimire is a software engineer, educator and computer science researcher (M.S., Clark University) working on human-computer interaction, learning environment design and computational social science.',
  knowsAbout: ['Human-computer interaction', 'Learning environment design', 'Educational technology', 'Computational social science', 'Software engineering', 'Machine learning', 'GIS systems', 'STEM education', 'Python'],
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'Clark University' },
    { '@type': 'CollegeOrUniversity', name: 'Dr. Ambedkar Institute of Technology' }
  ],
  sameAs: [
    'https://github.com/abhisanGhimire',
    'https://www.linkedin.com/in/abhisanghimire',
    'https://scholar.google.com/citations?user=QN9KC3G-c8gC&hl=en',
    'https://pypi.org/user/Invictus/'
  ]
};
const WEBSITE = {
  '@type': 'WebSite',
  '@id': SITE_ID,
  url: SITE + '/',
  name: 'Abhisan Ghimire',
  alternateName: ['Abhisan Ghimire portfolio', 'abhisan.info'],
  inLanguage: 'en',
  publisher: { '@id': PERSON_ID }
};
const ARTICLES = [
  { name: 'Social Determinants of Health and Fentanyl Overdose Mortality Across US Counties: An XGBoost and SHAP Analysis', url: 'https://arxiv.org/abs/2605.08230', date: '2026', authors: ['Kabi Raj Tiruwa', 'Abhisan Ghimire', 'Anuj Kumar Shah'] },
  { name: 'Wearable-Grade Lead Reduction Disproportionately Degrades ECG AI Performance in Elderly Patients: Evidence from PTB-XL and MIT-BIH', url: 'https://doi.org/10.64898/2026.06.12.26355537', date: '2026-06', authors: ['Kabi Raj Tiruwa', 'Abhisan Ghimire'] },
  { name: 'Understanding Hate Group Videos on YouTube', url: 'https://doi.org/10.1145/3500868.3559465', date: '2022-11', authors: null }
];

function buildJsonLd(meta, pagePath, fullTitle) {
  if (pagePath === '/404.html') return '';
  const graph = [];
  const isHome = pagePath === '/';
  const pageUrl = SITE + pagePath;
  if (isHome) {
    graph.push(WEBSITE, PERSON);
    graph.push({ '@type': 'ProfilePage', '@id': pageUrl + '#profile', url: pageUrl, name: fullTitle, isPartOf: { '@id': SITE_ID }, mainEntity: { '@id': PERSON_ID }, inLanguage: 'en' });
  } else {
    graph.push({ '@type': pagePath === '/about/' ? 'AboutPage' : 'WebPage', '@id': pageUrl + '#page', url: pageUrl, name: fullTitle, description: meta.description || '', isPartOf: { '@id': SITE_ID }, about: { '@id': PERSON_ID }, inLanguage: 'en' });
    graph.push({ '@id': PERSON_ID, '@type': 'Person', name: 'Abhisan Ghimire', url: SITE + '/' });
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: meta.title, item: pageUrl }
      ]
    });
    if (pagePath === '/publications/') {
      graph.push({
        '@type': 'ItemList',
        name: 'Publications and preprints by Abhisan Ghimire',
        itemListElement: ARTICLES.map((a, i) => ({
          '@type': 'ListItem', position: i + 1,
          item: Object.assign({ '@type': 'ScholarlyArticle', headline: a.name, url: a.url, datePublished: a.date, author: { '@id': PERSON_ID } },
            a.authors ? { author: a.authors.map((n) => (n === 'Abhisan Ghimire' ? { '@id': PERSON_ID } : { '@type': 'Person', name: n })) } : {})
        }))
      });
    }
  }
  return '<script type="application/ld+json">\n' + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2) + '\n</script>';
}

function fill(template, values) {
  return template
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => (k in values ? values[k] : ''))
    .replace(/\{\{(\w+)\}\}/g, (_, k) => (k in values ? esc(values[k]) : ''));
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const layout = fs.readFileSync(path.join(SRC, 'layout.html'), 'utf8');
  const pagesDir = path.join(SRC, 'pages');
  const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.html') && !f.startsWith('_'));
  const sitemap = [];

  for (const f of files) {
    const { meta, body } = parsePage(path.join(pagesDir, f));
    const pagePath = meta.path || '/';
    const isHome = pagePath === '/';
    const is404 = pagePath === '/404.html';
    const slug = isHome ? 'home' : pagePath.replace(/^\/|\/$|\.html$/g, '').replace(/\//g, '-');
    const fullTitle = meta.fullTitle || (isHome ? meta.title : meta.title + ' · Abhisan Ghimire');
    const wantsHero = meta.hero === 'true';

    const scripts = '<script src="/script.js?v=' + VERSION + '"></script>';

    const html = fill(layout, {
      fullTitle,
      description: meta.description || '',
      robots: is404 ? 'noindex, follow' : 'index, follow, max-image-preview:large',
      canonical: SITE + (is404 ? '/' : pagePath),
      version: VERSION,
      bodyClass: 'page-' + slug,
      jsonld: buildJsonLd(meta, pagePath, fullTitle),
      nav: renderNav(pagePath),
      content: body,
      scripts
    });

    const outFile = is404 ? path.join(OUT, '404.html')
      : isHome ? path.join(OUT, 'index.html')
      : path.join(OUT, pagePath.replace(/^\//, ''), 'index.html');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, 'utf8');
    if (!is404) sitemap.push(pagePath);
  }

  for (const f of STATIC_FILES) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
    else console.warn('warning: static file missing: ' + f);
  }
  for (const d of STATIC_DIRS) {
    const src = path.join(ROOT, d);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(OUT, d), { recursive: true });
  }

  const order = NAV.flatMap((n) => (n.children ? n.children.map((c) => c.href) : [n.href]));
  sitemap.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const urls = sitemap.map((p) => '  <url>\n    <loc>' + SITE + p + '</loc>\n    <lastmod>' + TODAY + '</lastmod>\n  </url>').join('\n');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n', 'utf8');

  return files.length;
}

// ---- safety net: every internal link and asset must resolve, no template leftovers ----
function verify() {
  const problems = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const htmlFiles = walk(OUT).filter((f) => f.endsWith('.html'));
  const exists = (urlPath) => {
    const clean = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
    const target = path.join(OUT, clean);
    if (clean.endsWith('/')) return fs.existsSync(path.join(target, 'index.html'));
    return fs.existsSync(target) || fs.existsSync(path.join(target, 'index.html'));
  };
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    const rel = path.relative(OUT, f);
    if (/\{\{/.test(html)) problems.push(rel + ': unreplaced template placeholder');
    for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      if (m[1].startsWith('//')) continue;
      if (!exists(m[1])) problems.push(rel + ': broken link ' + m[1]);
    }
    if (!/<h1[ >]/.test(html)) problems.push(rel + ': no <h1>');
  }
  return { problems, pages: htmlFiles.length };
}

const n = build();
const { problems, pages } = verify();
console.log('built ' + n + ' source pages -> ' + pages + ' html files in dist/ (version ' + VERSION + ')');
if (problems.length) {
  console.error('\nBUILD CHECK FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('link check passed');
