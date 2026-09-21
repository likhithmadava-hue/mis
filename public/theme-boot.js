/* Applies the saved theme before the first frame.
   Loaded as a plain blocking script from <head>, so the attributes are on
   <html> before the stylesheet is applied and a saved theme never flashes the
   default. It is a separate file (not inline) because the app's CSP allows only
   script-src 'self'. Keep it in step with core/ui/theme.ts, which owns the same
   key and the same defaults — this is the minimum needed to paint correctly. */
(function () {
  var themes = ['cyberpunk', 'oled', 'obsidian', 'terminal', 'nordic', 'aura'];
  var cfg = {};
  try {
    cfg = JSON.parse(localStorage.getItem('app_theme_config')) || {};
  } catch (e) {
    /* storage blocked or corrupt: fall through to the defaults */
  }
  var r = document.documentElement;
  r.dataset.theme = themes.indexOf(cfg.theme) >= 0 ? cfg.theme : 'cyberpunk';
  r.dataset.mono = cfg.mono === true ? 'on' : 'off';
  r.dataset.contrast = cfg.highContrast === true ? 'high' : 'normal';
  r.dataset.scanlines = cfg.scanlines === false ? 'off' : 'on';
})();
