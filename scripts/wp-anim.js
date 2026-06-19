/* WeblyPro shared animation helpers — scroll reveal + counters.
   Robust against non-painting/frozen-timeline contexts: if the document
   animation timeline isn't advancing, content is revealed instantly so it
   is never stuck invisible. */
(function () {
  // Pre-hide [data-reveal] elements synchronously, before first paint, so there is
  // no flash of fully-visible content that then snaps to hidden once reveal() runs
  // later (after componentDidMount). This <style> is injected the instant this
  // script executes — and since the script tag sits in <head> without `defer`,
  // that happens before the browser paints the page.
  var pre = document.createElement('style');
  pre.id = 'wp-anim-prehide';
  pre.textContent = '[data-reveal]{opacity:0;transform:translateY(16px);}'
    + 'html{opacity:0;}'
    + 'html.wp-ready{opacity:1;transition:opacity .2s ease;}';
  document.head.appendChild(pre);

  // Simple whole-page fade-in on load/refresh — no spinner, no overlay.
  // The page starts invisible (opacity:0 via the rule above) and fades to
  // opacity:1 as soon as it's ready, instead of popping in abruptly.
  var fadedIn = false;
  function fadeInPage() {
    if (fadedIn) return;
    fadedIn = true;
    document.documentElement.classList.add('wp-ready');
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    fadeInPage();
  } else {
    document.addEventListener('DOMContentLoaded', fadeInPage);
  }
  window.addEventListener('load', fadeInPage);
  setTimeout(fadeInPage, 900); // hard safety: never stuck invisible

  function reveal(root) {
    if (!root) return;
    fadeInPage();
    var els = Array.prototype.slice.call(root.querySelectorAll('[data-reveal]:not([data-wp-revealed])'));
    if (!els.length) return;
    els.forEach(function (el) {
      el.setAttribute('data-wp-revealed', '');
      el.style.transition = 'opacity .4s cubic-bezier(.22,1,.36,1), transform .4s cubic-bezier(.22,1,.36,1)';
      el.style.willChange = 'opacity, transform';
    });
    function show(el, instant) {
      if (instant) el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
    }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (e) { show(e, true); }); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, p = el.parentElement, i = 0;
        if (p) i = Array.prototype.slice.call(p.children).filter(function (c) { return c.hasAttribute('data-reveal'); }).indexOf(el);
        setTimeout(function () { show(el, false); }, Math.max(0, i) * 30);
        io.unobserve(el);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
    // frozen-timeline guard: if the timeline isn't advancing, reveal instantly
    var t0 = document.timeline ? document.timeline.currentTime : null;
    setTimeout(function () {
      var t1 = document.timeline ? document.timeline.currentTime : null;
      if (t0 === t1) els.forEach(function (e) { show(e, true); });
    }, 360);
    // hard safety
    setTimeout(function () { els.forEach(function (e) { show(e, false); }); }, 1800);
  }

  function counters(root) {
    if (!root) return;
    var nums = Array.prototype.slice.call(root.querySelectorAll('[data-count]:not([data-wp-counted])'));
    if (!nums.length) return;
    nums.forEach(function (n) { n.setAttribute('data-wp-counted', ''); });
    function run(el) {
      var target = parseFloat(el.dataset.count), suf = el.dataset.suffix || '', dur = 1400, t0 = performance.now();
      function tick(now) {
        var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * e) + suf;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    function setFinal(el) { el.textContent = parseFloat(el.dataset.count) + (el.dataset.suffix || ''); }
    if (!('IntersectionObserver' in window)) { nums.forEach(setFinal); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { io.observe(n); });
    // frozen guard + safety
    var t0 = document.timeline ? document.timeline.currentTime : null;
    setTimeout(function () {
      var t1 = document.timeline ? document.timeline.currentTime : null;
      if (t0 === t1) nums.forEach(setFinal);
    }, 360);
    setTimeout(function () { nums.forEach(function (n) { if (n.textContent === '0') setFinal(n); }); }, 1800);
  }

  window.WPAnim = { reveal: reveal, counters: counters };

  // Auto-trigger reveal/counters instead of relying solely on each page's
  // component framework calling WPAnim.reveal() from componentDidMount.
  // The actual hero/section content is injected into the DOM by that
  // framework *after* DOMContentLoaded (dc-import/x-dc processing happens
  // asynchronously), so a single reveal(document) call at DOMContentLoaded
  // finds nothing yet and never runs again — leaving content stuck at
  // opacity:0 forever. A MutationObserver re-runs reveal()/counters()
  // (both idempotent via data-wp-revealed/-counted guards) every time new
  // nodes are added, so content is picked up the moment it actually exists.
  function autoRun() { reveal(document); counters(document); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    autoRun();
  } else {
    document.addEventListener('DOMContentLoaded', autoRun);
  }
  window.addEventListener('load', autoRun);

  if ('MutationObserver' in window) {
    var mo = new MutationObserver(function () { autoRun(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Belt-and-suspenders: a few retries on a backoff schedule in case neither
  // the observer nor the load events catch the framework's render timing.
  [50, 150, 400, 800, 1500, 2500].forEach(function (ms) { setTimeout(autoRun, ms); });
})();
