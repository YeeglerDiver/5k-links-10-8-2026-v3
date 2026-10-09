const fs = require("fs");
const path = require("path");

const distDir = path.join(process.cwd(), "dist_deploy");
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

const repoName = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split("/")[1]
  : "5k-links-10-8-2026-v3";
const repoPrefix = `/${repoName}/`;

// 1. Copy folders specific to this repo
const assetDirs = [
  "files",
  "images",
  "resources"
];

for (const dir of assetDirs) {
  if (fs.existsSync(dir)) {
    fs.cpSync(dir, path.join(distDir, dir), { recursive: true });
  }
}

// 2. Copy root files like learningresources.json, sw.js, etc.
for (const item of fs.readdirSync(process.cwd())) {
  const full = path.join(process.cwd(), item);
  if (fs.statSync(full).isFile() && !item.startsWith(".") && item !== "build.js") {
    fs.copyFileSync(full, path.join(distDir, item));
  }
}

// 3. Patch JSON and JS files to resolve from repository subpath
function patchFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  const updated = content
    .replace(/(['"])\/files\//g, `$1${repoPrefix}files/`)
    .replace(/(['"])\/images\//g, `$1${repoPrefix}images/`)
    .replace(/(['"])\/resources\//g, `$1${repoPrefix}resources/`)
    .replace(/(['"])\/learningresources\.json/g, `$1${repoPrefix}learningresources.json`);

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, "utf8");
  }
}

function walkAndPatch(dir) {
  for (const item of fs.readdirSync(dir)) {
    if (item === ".git") continue;
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      walkAndPatch(full);
    } else if (/\.(js|json|css|webmanifest|html)$/i.test(item)) {
      patchFile(full);
    }
  }
}
walkAndPatch(distDir);

// 4. Base HTML setup with repository prefix
if (!fs.existsSync("index.html")) {
  console.error("Error: index.html not found!");
  process.exit(1);
}
let appHtml = fs.readFileSync("index.html", "utf8");

// Convert root paths like href="/resources/..."
appHtml = appHtml.replace(/(href|src)=["']\/(?!\/)(.*?)["']/gi, `$1="${repoPrefix}$2"`);

if (!appHtml.includes("<base ")) {
  appHtml = appHtml.replace(/<head([^>]*)>/i, `<head$1>\n    <base href="${repoPrefix}">`);
}

// 5. Generate 5,000 physical nested directories
const TOTAL_PAGES = 5000;
const chars = "abcdefghijklmnopqrstuvwxyz0123456789";

function getRandomSegment(minLen = 4, maxLen = 10) {
  const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
  let seg = "";
  for (let i = 0; i < len; i++) seg += chars.charAt(Math.floor(Math.random() * chars.length));
  return seg;
}

function getNestedPath(minSegments = 2, maxSegments = 4) {
  const depth = Math.floor(Math.random() * (maxSegments - minSegments + 1)) + minSegments;
  const segs = [];
  for (let i = 0; i < depth; i++) segs.push(getRandomSegment(4, 10));
  return segs.join("/");
}

const uniquePaths = new Set();
while (uniquePaths.size < TOTAL_PAGES) {
  uniquePaths.add(getNestedPath(2, 4));
}

let masterLinksHtml = "";

for (const nestedPath of uniquePaths) {
  const folderPath = path.join(distDir, nestedPath);
  fs.mkdirSync(folderPath, { recursive: true });

  fs.writeFileSync(path.join(folderPath, "index.html"), appHtml);
  masterLinksHtml += `<a class="card" href="./${nestedPath}/">${nestedPath}</a>\n`;
}

// 6. Directory Index Dashboard
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Directory Index</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117; color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 40px 20px; display: flex; flex-direction: column; align-items: center;
    }
    header { text-align: center; margin-bottom: 28px; max-width: 650px; width: 100%; }
    h1 { font-size: 28px; font-weight: 700; color: #f0f6fc; margin-bottom: 8px; }
    p { color: #8b949e; font-size: 14px; margin-bottom: 20px; }
    .search-box {
      width: 100%; padding: 12px 18px; border-radius: 8px; border: 1px solid #30363d;
      background: #161b22; color: #f0f6fc; font-size: 15px; outline: none;
    }
    .search-box:focus { border-color: #58a6ff; box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; width: 100%; max-width: 1300px; }
    .card {
      display: flex; align-items: center; justify-content: center; background: #161b22;
      border: 1px solid #30363d; border-radius: 6px; padding: 12px; color: #58a6ff;
      text-decoration: none; font-size: 12px; font-family: monospace; word-break: break-all; text-align: center;
    }
    .card:hover { background: #21262d; border-color: #58a6ff; color: #79c0ff; transform: translateY(-2px); }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header>
    <h1>Directory Index</h1>
    <p>5,000 Nested Endpoints</p>
    <input type="text" id="filter" class="search-box" placeholder="Quick find path..." autocomplete="off" />
  </header>
  <main class="grid" id="link-grid">${masterLinksHtml}</main>
  <script>
    const filter = document.getElementById("filter");
    const links = document.querySelectorAll(".card");
    filter.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase().trim();
      links.forEach(card => card.classList.toggle("hidden", !card.textContent.toLowerCase().includes(term)));
    });
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(distDir, "index.html"), indexHtml);
console.log("Successfully generated all 5,000 directories and site index.");
