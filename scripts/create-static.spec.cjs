const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createStaticBundle } = require("./create-static.cjs");

test("incorpora CSS e JavaScript no HTML estático", () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fluxo-demandas-static-"));
  const outputFile = path.join(temporaryDirectory, "static", "index.html");

  try {
    fs.writeFileSync(path.join(temporaryDirectory, "index.html"), [
      '<html><head><base href="/"><link rel="stylesheet" href="styles-ABC.css"><noscript><link rel="stylesheet" href="styles-ABC.css"></noscript></head>',
      '<body><app-root></app-root><script src="main-ABC.js" type="module"></script></body></html>',
    ].join(""));
    fs.writeFileSync(path.join(temporaryDirectory, "styles-ABC.css"), "body { color: navy; }");
    fs.writeFileSync(path.join(temporaryDirectory, "main-ABC.js"), "window.staticBundleLoaded = true;");

    createStaticBundle({ inputDir: temporaryDirectory, outputFile });
    const output = fs.readFileSync(outputFile, "utf8");

    assert.match(output, /<base href="\.\/">/);
    assert.match(output, /<style>body \{ color: navy; \}<\/style>/);
    assert.match(output, /<script type="module">window\.staticBundleLoaded = true;<\/script>/);
    assert.doesNotMatch(output, /styles-ABC\.css|main-ABC\.js|<noscript>/);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
