const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const defaultInputDir = path.join(projectRoot, "dist", "fluxo-demandas", "browser");
const defaultOutputFile = path.join(projectRoot, "static", "index.html");

function readBuildFile(inputDir, fileName) {
  if (fileName.startsWith("http://") || fileName.startsWith("https://")) {
    throw new Error(`Recursos externos não podem ser incorporados: ${fileName}`);
  }

  const filePath = path.join(inputDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de build não encontrado: ${fileName}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function createStaticBundle({ inputDir = defaultInputDir, outputFile = defaultOutputFile } = {}) {
  const indexFile = path.join(inputDir, "index.html");
  if (!fs.existsSync(indexFile)) {
    throw new Error("Execute o build Angular antes de gerar o arquivo estático.");
  }

  let html = fs.readFileSync(indexFile, "utf8");
  html = html.replace(/<base href="[^"]*">/i, '<base href="./">');
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, "");
  html = html.replace(/<link rel="stylesheet" href="([^"]+)"[^>]*>/gi, (_match, fileName) => {
    const css = readBuildFile(inputDir, fileName).replace(/<\/style/gi, "<\\/style");
    return `<style>${css}</style>`;
  });
  html = html.replace(/<script src="([^"]+)" type="module"><\/script>/gi, (_match, fileName) => {
    const script = readBuildFile(inputDir, fileName).replace(/<\/script/gi, "<\\/script");
    return `<script type="module">${script}</script>`;
  });

  if (/(?:src|href)="(?:main-|styles-)/i.test(html)) {
    throw new Error("Ainda há recursos do build externo no HTML estático.");
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, html, "utf8");
  return outputFile;
}

if (require.main === module) {
  const outputFile = createStaticBundle();
  console.log(`Arquivo estático gerado em ${outputFile}`);
}

module.exports = { createStaticBundle };
