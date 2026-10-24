// Static fallback: a 2D drawing of the same jersey loop curve, used when WebGL or the CDN is unavailable.
(function () {
  function svgKnit(cols, rows) {
    var W = 40, H = 68, ch = 38, B = 8, d = '';
    for (var i = 0; i < rows; i++) {
      d += 'M';
      for (var j = 0; j < cols; j++) for (var k = 0; k <= 24; k++) {
        var t = -Math.PI + (k / 24) * Math.PI * 2;
        var x = 20 + j * W + W * (t / (2 * Math.PI)) + B * Math.sin(2 * t);
        var y = 40 + i * ch - (H / 2) * Math.cos(t);
        d += (j || k ? ' L' : '') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
    }
    return '<svg viewBox="0 0 ' + (cols * W + 40) + ' ' + (rows * ch + 80) + '" preserveAspectRatio="xMidYMid slice"><path d="' + d +
      '" fill="none" stroke="#CFC8BA" stroke-width="7" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="#FBF9F4" stroke-width="4.5" stroke-linecap="round"/></svg>';
  }
  window.__knitFallback = function () {
    document.querySelectorAll('.knit-fallback').forEach(function (el) { el.innerHTML = svgKnit(14, 12); });
  };
  setTimeout(function () {
    if (!window.__knitReady) { document.documentElement.classList.add('no-webgl'); window.__knitFallback(); }
  }, 6000);
})();
