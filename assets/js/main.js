/* Northfield: renders products, announcements and links from /data. No tracking. */
(function () {
  'use strict';

  var DATA = {
    site: 'data/site.json',
    products: 'data/products.json',
    announcements: 'data/announcements.json'
  };
  var DEFAULT_SHOP = 'https://www.etsy.com/shop/NorthfieldServices';

  // Empty strings and unfilled {PLACEHOLDERS} count as "not set".
  function isSet(value) {
    if (typeof value !== 'string') return false;
    var v = value.trim();
    return v !== '' && !/^\{[^}]*\}$/.test(v) && v.indexOf('{') === -1;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val === null || val === undefined || val === false) return;
        if (key === 'text') node.textContent = val;
        else if (key === 'html') node.innerHTML = val;
        else node.setAttribute(key, val);
      });
    }
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' ' + res.status);
      return res.json();
    });
  }

  /* ---------- Site settings ---------- */
  function applySite(site) {
    var shop = isSet(site.etsyShopUrl) ? site.etsyShopUrl : DEFAULT_SHOP;
    document.querySelectorAll('[data-etsy-shop]').forEach(function (a) { a.href = shop; });

    var contact = document.querySelector('[data-contact]');
    if (contact && isSet(site.contactEmail)) {
      var subject = site.contactSubject ? '?subject=' + encodeURIComponent(site.contactSubject) : '';
      contact.href = 'mailto:' + site.contactEmail.trim() + subject;
    }

    var pricing = document.querySelector('[data-pricing]');
    if (pricing && site.showWebsitePricing === true && isSet(site.websitePricingText)) {
      pricing.textContent = site.websitePricingText;
      pricing.hidden = false;
    }

    var list = document.querySelector('[data-links]');
    var links = (site.links || []).filter(function (l) { return isSet(l.url); });
    if (list && links.length) {
      list.textContent = '';
      links.forEach(function (l) {
        list.appendChild(el('li', null, [
          el('a', { class: 'find__link', href: l.url, rel: 'noopener' }, [
            el('span', { class: 'find__name', text: l.name }),
            l.note ? el('span', { class: 'find__note', text: l.note }) : null,
            el('span', { class: 'find__arrow', 'aria-hidden': 'true', html: '&#8599;' })
          ])
        ]));
      });
    }
    return shop;
  }

  /* ---------- Products ---------- */
  function productCard(p, shop, index) {
    var available = p.status === 'available';
    var href = available ? (isSet(p.link) ? p.link : shop) : null;
    var base = p.image || '';

    var img = el('img', {
      src: base + '-720.webp',
      srcset: base + '-720.webp 720w, ' + base + '-1200.webp 1200w',
      sizes: '(min-width: 1240px) 580px, (min-width: 760px) 46vw, 100vw',
      width: '1200', height: '900',
      alt: p.imageAlt || p.title,
      loading: index < 2 ? 'eager' : 'lazy',
      decoding: 'async'
    });
    var chip = el('span', { class: 'chip' + (available ? ' chip--live' : ''), text: available ? 'Available now' : 'Coming soon' });
    var media = el('div', { class: 'product__media' }, [img]);

    var titleInner = available
      ? el('a', { href: href, rel: 'noopener', text: p.title })
      : document.createTextNode(p.title);
    var title = el('h3', { class: 'product__title' }, [titleInner]);

    var foot;
    if (available) {
      var price = isSet(p.price) ? el('span', { class: 'price', html: 'from <b></b>' }) : el('span');
      if (isSet(p.price)) price.querySelector('b').textContent = '$' + p.price.trim();
      foot = el('div', { class: 'product__foot' }, [
        price,
        el('span', { class: 'link-arrow', 'aria-hidden': 'true', html: 'View on Etsy <span>&rarr;</span>' })
      ]);
    } else {
      foot = el('div', { class: 'product__foot' }, [
        el('span', { class: 'soon-note', text: 'Coming soon to the shop' })
      ]);
    }

    var body = el('div', { class: 'product__body' }, [
      el('div', { class: 'product__meta' }, [
        p.category ? el('p', { class: 'product__cat', text: p.category }) : el('span'),
        chip
      ]),
      title,
      el('p', { class: 'product__desc', text: p.description || '' }),
      foot
    ]);

    var card = el('article', {
      class: 'product ' + (available ? 'is-available' : 'is-soon'),
      id: p.id ? 'product-' + p.id : null,
      'data-reveal': ''
    }, [media, body]);
    card.style.setProperty('--delay', (index % 2) * 120 + 'ms');
    return card;
  }

  function renderProducts(data, shop) {
    var grid = document.querySelector('[data-products]');
    var items = (data && data.products) || [];
    if (!grid || !items.length) return;
    // Available products first, keeping the JSON order within each group.
    var sorted = items.filter(function (p) { return p.status === 'available'; })
      .concat(items.filter(function (p) { return p.status !== 'available'; }));
    grid.textContent = '';
    sorted.forEach(function (p, i) { grid.appendChild(productCard(p, shop, i)); });
  }

  /* ---------- Announcements ---------- */
  function formatDate(iso) {
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso || '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function renderAnnouncements(data) {
    var section = document.getElementById('news');
    var list = document.querySelector('[data-news-list]');
    var items = ((data && data.announcements) || []).filter(function (a) { return a && (a.title || a.text); });
    if (!section || !list || !items.length) { if (section) section.hidden = true; return; }
    list.textContent = '';
    items.forEach(function (a) {
      var link = null;
      if (isSet(a.link)) {
        link = el('a', { class: 'link-arrow', href: a.link, rel: 'noopener' }, [
          document.createTextNode((a.linkLabel || 'Read more') + ' '),
          el('span', { 'aria-hidden': 'true', html: '&rarr;' })
        ]);
      }
      list.appendChild(el('li', { class: 'news__item' }, [
        a.date ? el('time', { class: 'news__date', datetime: a.date, text: formatDate(a.date) }) : null,
        a.title ? el('h3', { text: a.title }) : null,
        a.text ? el('p', { text: a.text }) : null,
        link
      ]));
    });
    section.hidden = false;
  }

  /* ---------- Motion ---------- */
  var observer = null;
  function setupReveal() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var targets = document.querySelectorAll('[data-reveal]:not(.is-visible)');
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('is-visible'); });
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    targets.forEach(function (t) { observer.observe(t); });
  }

  function setupHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function setupMark() {
    document.querySelectorAll('.hero__mark .tile').forEach(function (tile, i) {
      tile.style.setProperty('--i', (i % 4) + Math.floor(i / 4));
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    setupHeader();
    setupMark();
    var year = document.querySelector('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());

    var safe = function (p) { return p.catch(function () { return null; }); };
    Promise.all([safe(getJSON(DATA.site)), safe(getJSON(DATA.products)), safe(getJSON(DATA.announcements))])
      .then(function (res) {
        var shop = applySite(res[0] || {});
        renderProducts(res[1], shop);
        renderAnnouncements(res[2]);
        setupReveal();
      });
    setupReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
