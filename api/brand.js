/* /brand.js        -> window.BRAND untuk halaman
   /manifest.webmanifest -> manifest PWA dengan nama dari lib/brand.js */
const brand = require("../lib/brand");

module.exports = function (req, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  if ((req.query || {}).f === "manifest") {
    res.setHeader("Content-Type", "application/manifest+json");
    res.end(JSON.stringify({
      name: brand.name, short_name: brand.name,
      description: "Catat dana perjalanan, bukti struk, rundown, dan diari foto.",
      start_url: "/app", display: "standalone", background_color: "#0A1630", theme_color: "#0A1630",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
      ]
    }));
    return;
  }
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.end("window.BRAND=" + JSON.stringify(brand) + ";" +
    "document.querySelectorAll('[data-brand]').forEach(function(e){e.textContent=window.BRAND.name});" +
    "if(document.title.indexOf('{B}')>=0)document.title=document.title.replace('{B}',window.BRAND.name);");
};
