/* Dhiyasri Apparels — dark concept. Plain script, no dependencies. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = mq.matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ——— Nav: solid after leaving the top ——— */
  var nav = $('.nav');
  function onScroll() { nav.classList.toggle('is-solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ——— Hero: video (when supplied) or placeholder drift, with pause control ——— */
  var hero = $('#hero'), video = $('#heroVideo'), pauseBtn = $('#heroPause');
  var hasVideo = !!(video && video.querySelector('source'));
  if (hasVideo) {
    video.hidden = false;
    $('.hero-placeholder').hidden = true;
    var tag = $('.hero-tag'); if (tag) tag.hidden = true;
  }
  function setPaused(p) {
    pauseBtn.setAttribute('aria-pressed', String(p));
    $('.pause-txt', pauseBtn).textContent = p ? 'Play motion' : 'Pause motion';
    hero.classList.toggle('is-paused', p);
    if (hasVideo) {
      if (p) video.pause();
      else { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
    }
  }
  // Reduced motion: start paused (no autoplay); visitor can still press play.
  setPaused(reduce);
  pauseBtn.addEventListener('click', function () { setPaused(pauseBtn.getAttribute('aria-pressed') !== 'true'); });

  /* ——— Knit tiles: flip on hover (CSS), tap/click or keyboard (button) ——— */
  $$('.tile').forEach(function (tile) {
    var btn = $('.flip', tile), txt = $('.flip-txt', btn);
    function set(on) {
      tile.classList.toggle('is-flipped', on);
      btn.setAttribute('aria-pressed', String(on));
      txt.textContent = on ? 'Show face' : 'Turn over';
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!tile.classList.contains('is-flipped')); });
    tile.addEventListener('click', function () { set(!tile.classList.contains('is-flipped')); });
  });

  /* ——— GSM finder ——— */
  var MIN = 110, MAX = 440;
  var range = $('#gsm'), out = $('#gsmOut'), result = $('#gsmResult');
  var knitTiles = $$('.tile[data-gsm-min]');
  var pct = function (v) { return ((v - MIN) / (MAX - MIN)) * 100; };
  knitTiles.forEach(function (t) {
    var a = +t.dataset.gsmMin, b = +t.dataset.gsmMax;
    var bar = $('.gbar', t);
    bar.style.setProperty('--a', pct(a) + '%');
    bar.style.setProperty('--b', (100 - pct(b)) + '%');
  });
  var touched = false;
  function updateGsm() {
    var v = +range.value;
    out.textContent = v;
    range.style.setProperty('--p', pct(v) + '%');
    range.setAttribute('aria-valuetext', v + ' GSM');
    var names = [];
    knitTiles.forEach(function (t) {
      var ok = v >= +t.dataset.gsmMin && v <= +t.dataset.gsmMax;
      $('.gbar', t).style.setProperty('--v', pct(v) + '%');
      t.classList.toggle('is-match', touched && ok);
      t.classList.toggle('no-match', touched && !ok);
      $('.match', t).textContent = ok ? 'Made at ' + v + ' GSM' : 'Not at ' + v + ' GSM';
      if (ok) names.push(t.dataset.knit);
    });
    result.textContent = names.length
      ? names.length + ' of ' + knitTiles.length + ' knits at ' + v + ' GSM: ' + names.join(', ') + '.'
      : 'No knit listed at ' + v + ' GSM.';
  }
  range.addEventListener('input', function () { touched = true; updateGsm(); });
  updateGsm();

  /* ——— Process: sticky stage + IntersectionObserver (normal scrolling, no hijack) ——— */
  var steps = $$('.pstep'), views = $$('.pv'), rail = $$('.proc-rail li');
  function setStep(i) {
    steps.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
    views.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
    rail.forEach(function (s, k) {
      s.classList.toggle('is-on', k === i); s.classList.toggle('is-done', k < i);
      if (k === i) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
    });
  }
  if ('IntersectionObserver' in window) {
    var pio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setStep(+e.target.dataset.step); });
    }, { rootMargin: '-48% 0px -48% 0px' });
    steps.forEach(function (s) { pio.observe(s); });
  }
  setStep(0);

  /* ——— Reveals ——— */
  var rv = $$('.sec .label, .sec .h2, .sec .lead, .facts, .years, .photos, .gsm-finder, .tile, .brand-list, .stat, .form');
  if (!reduce && 'IntersectionObserver' in window) {
    rv.forEach(function (el) { el.classList.add('rv'); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, sib = el.parentElement ? $$(':scope > .rv', el.parentElement) : [];
        var i = Math.max(0, sib.indexOf(el));
        el.style.transitionDelay = Math.min(i, 5) * 70 + 'ms';
        el.classList.add('in'); io.unobserve(el);
        setTimeout(function () { el.style.transitionDelay = ''; }, 1400);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  }

  /* ——— Sticky "Request samples": shows after the hero, hides at the form ——— */
  var fab = $('#fab'), quote = $('#quote');
  var pastHero = false, atQuote = false;
  function fabState() { fab.classList.toggle('is-on', pastHero && !atQuote); fab.setAttribute('tabindex', pastHero && !atQuote ? '0' : '-1'); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { pastHero = !es[0].isIntersecting; fabState(); }, { threshold: 0.35 }).observe(hero);
    new IntersectionObserver(function (es) { atQuote = es[0].isIntersecting; fabState(); }, { threshold: 0.2 }).observe(quote);
  }
  fabState();
  fab.addEventListener('click', function () {
    var cb = $('#f-samples'); if (cb) cb.checked = true;
    setTimeout(function () { $('#f-name').focus({ preventScroll: true }); }, reduce ? 0 : 700);
  });

  /* ——— Quote form (preview — not connected yet) ——— */
  var form = $('#quoteForm'), status = $('#formStatus');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nameEl = form.elements.name, name = nameEl.value.trim();
    if (!name) {
      nameEl.setAttribute('aria-invalid', 'true'); nameEl.focus();
      status.textContent = 'Please add your name. (This form is a preview and is not connected yet.)';
      return;
    }
    nameEl.removeAttribute('aria-invalid');
    status.textContent = 'Thank you, ' + name + '. This form is a preview and is not connected yet — please reach us at [email / WhatsApp to confirm].';
  });
})();
