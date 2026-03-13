/**
 * Velora Embeddable Widgets - Self-contained Web Components
 * <script src="https://velora.com/embed/velora-widgets.js"></script>
 */
(function () {
  'use strict';
  var WEB = 'https://velora.com';
  var API = 'https://api.velora.com';
  var S = ':host{display:block;font-family:system-ui,sans-serif;color:#1f2937;line-height:1.5}.vc{border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}.vt{font-size:14px;font-weight:600;color:#374151;margin:0 0 12px}.vl{color:#2563eb;text-decoration:none;font-size:12px}.vf{margin-top:12px;padding-top:8px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center}.vp{font-size:10px;color:#9ca3af}';

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // <velora-crash-map location="Denver, CO" radius="5">
  function CM() { var e = Reflect.construct(HTMLElement, [], CM); e.attachShadow({ mode: 'open' }); return e; }
  CM.prototype = Object.create(HTMLElement.prototype);
  CM.prototype.constructor = CM;
  CM.prototype.connectedCallback = function () {
    var loc = this.getAttribute('location') || 'United States';
    var radius = this.getAttribute('radius') || '10';
    this.shadowRoot.innerHTML = '<style>' + S +
      '.mc{width:100%;height:300px;border-radius:8px;overflow:hidden;background:#f3f4f6}.mc iframe{width:100%;height:100%;border:0}' +
      '.sr{display:flex;gap:12px;margin-top:12px}.sb{flex:1;text-align:center;padding:8px;background:#f9fafb;border-radius:8px}' +
      '.sv{font-size:20px;font-weight:700;color:#111827}.sl{font-size:11px;color:#6b7280;margin-top:2px}' +
      '</style><div class=vc><h3 class=vt>Crash Map: ' + esc(loc) + '</h3>' +
      '<div class=mc><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-105.1,39.6,-104.8,39.85&layer=mapnik" loading=lazy></iframe></div>' +
      '<div class=sr><div class=sb><div class=sv>--</div><div class=sl>Crashes (' + esc(radius) + 'mi)</div></div>' +
      '<div class=sb><div class=sv>--</div><div class=sl>Fatal</div></div>' +
      '<div class=sb><div class=sv>--</div><div class=sl>This Month</div></div></div>' +
      '<div class=vf><span class=vp>Powered by Velora</span>' +
      '<a class=vl href="' + WEB + '/search?q=crashes+in+' + encodeURIComponent(loc) + '" target=_blank rel=noopener>View full data &rarr;</a></div></div>';
  };

  // <velora-intersection lat="39.7392" lng="-104.9903" name="Colfax & Broadway">
  function IN() { var e = Reflect.construct(HTMLElement, [], IN); e.attachShadow({ mode: 'open' }); return e; }
  IN.prototype = Object.create(HTMLElement.prototype);
  IN.prototype.constructor = IN;
  IN.prototype.connectedCallback = function () {
    var lat = this.getAttribute('lat') || '0';
    var lng = this.getAttribute('lng') || '0';
    var name = this.getAttribute('name') || (lat + ', ' + lng);
    this.shadowRoot.innerHTML = '<style>' + S +
      '.ds{display:flex;align-items:center;gap:12px;margin-bottom:12px}' +
      '.sc{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;background:#f59e0b;flex-shrink:0}' +
      '.si h4{margin:0;font-size:14px;color:#111827}.si p{margin:4px 0 0;font-size:12px;color:#6b7280}' +
      '.fl{list-style:none;padding:0;margin:0}.fl li{padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px;display:flex;justify-content:space-between}.fl li:last-child{border-bottom:0}' +
      '</style><div class=vc><h3 class=vt>Intersection Safety: ' + esc(name) + '</h3>' +
      '<div class=ds><div class=sc>--</div><div class=si><h4>Danger Score</h4><p>Data loading...</p></div></div>' +
      '<ul class=fl><li><span>Total Crashes</span><span>--</span></li><li><span>Fatal</span><span>--</span></li><li><span>Pedestrian</span><span>--</span></li></ul>' +
      '<div class=vf><span class=vp>Powered by Velora</span>' +
      '<a class=vl href="' + WEB + '/search?q=intersection+' + lat + '+' + lng + '" target=_blank rel=noopener>Full analysis &rarr;</a></div></div>';
  };

  // <velora-attorney-badge slug="john-smith" layout="horizontal|vertical">
  function AB() { var e = Reflect.construct(HTMLElement, [], AB); e.attachShadow({ mode: 'open' }); return e; }
  AB.prototype = Object.create(HTMLElement.prototype);
  AB.prototype.constructor = AB;
  AB.prototype.connectedCallback = function () {
    var slug = this.getAttribute('slug') || '';
    var v = this.getAttribute('layout') === 'vertical';
    this.shadowRoot.innerHTML = '<style>' + S +
      '.bc{display:' + (v ? 'block' : 'flex') + ';align-items:center;gap:12px}' +
      '.bs{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0' + (v ? ';margin:0 auto' : '') + '}' +
      '.bi{flex:1' + (v ? ';text-align:center;margin-top:8px' : '') + '}.bn{font-size:14px;font-weight:600;color:#111827;margin:0}.bt{font-size:12px;color:#6b7280;margin:2px 0 0}' +
      '.bl{display:inline-block;margin-top:4px;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:#dbeafe;color:#1d4ed8}' +
      '</style><a href="' + WEB + '/attorneys/' + esc(slug) + '" target=_blank rel=noopener style="text-decoration:none;color:inherit">' +
      '<div class=vc><div class=bc><div class=bs>--</div><div class=bi><p class=bn>Loading...</p><p class=bt>Attorney Index Score</p><span class=bl>Velora Verified</span></div></div></div></a>';
    if (slug) this.loadData(slug);
  };
  AB.prototype.loadData = function (slug) {
    var sh = this.shadowRoot;
    fetch(API + '/api/attorneys/' + slug).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      var s = sh.querySelector('.bs'), n = sh.querySelector('.bn');
      if (s && d.indexScore != null) s.textContent = Math.round(d.indexScore);
      if (n && d.name) n.textContent = d.name;
    }).catch(function () {});
  };

  if (!customElements.get('velora-crash-map')) customElements.define('velora-crash-map', CM);
  if (!customElements.get('velora-intersection')) customElements.define('velora-intersection', IN);
  if (!customElements.get('velora-attorney-badge')) customElements.define('velora-attorney-badge', AB);
})();
