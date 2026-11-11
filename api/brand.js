/* /brand.js             -> window.BRAND untuk app.js
   /manifest.webmanifest  -> manifest PWA
   / dan /app             -> HTML dengan nama produk sudah terisi di server
                             ({B} dan <span data-brand></span>), jadi judul tab,
                             meta, dan preview share benar tanpa menunggu JS. */
const fs = require("fs");
const path = require("path");
const brand = require("../lib/brand");

const PAGES = { landing: "landing/index.html", app: "web/index.html" };
const cache = {};
function page(p) {
  if (!cache[p]) {
    const esc = brand.name.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    cache[p] = fs.readFileSync(path.join(process.cwd(), PAGES[p]), "utf8")
      .split("{B}").join(esc)
      .replace(/<(span|div)([^>]*) data-brand><\/\1>/g, "<$1$2 data-brand>" + esc + "</$1>");
  }
  return cache[p];
}

module.exports = function (req, res) {
  const q = req.query || {};
  if (q.f === "page" && PAGES[q.p]) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300");
    res.end(page(q.p));
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=300");
  if ((req.query || {}).f === "manifest") {
    res.setHeader("Content-Type", "application/manifest+json");
    res.end(JSON.stringify({
      name: brand.name, short_name: brand.name,
      description: "Catat dana perjalanan, bukti struk, rundown, dan diari foto.",
      start_url: "/app", display: "standalone", background_color: "#EEF3FA", theme_color: "#EEF3FA",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
      ]
    }));
    return;
  }
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.end("window.BRAND=" + JSON.stringify(brand) + ";");
};
