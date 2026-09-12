// @bun
// src/world-manifest.ts
import { realpath, stat } from "fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "path";
var WORLD_COMPONENT_TYPES = [
  "card",
  "motion",
  "shader",
  "graphic",
  "scene-template",
  "other"
];
var WORLD_STYLES = [
  "minimal",
  "corporate",
  "editorial",
  "cinematic",
  "futuristic",
  "playful",
  "brutalist",
  "elegant",
  "social",
  "hand-drawn"
];
var WORLD_MOODS = [
  "restrained",
  "serious",
  "energetic",
  "warm",
  "playful",
  "tense",
  "futuristic"
];
var WORLD_LANGUAGES = ["en", "zh-CN", "zh-TW", "ja", "ko"];

class WorldManifestError extends TypeError {
  issues;
  constructor(packagePath, issues) {
    super(`\u65E0\u6548\u7684 Fourier World package.json (${packagePath}):
- ${issues.join(`
- `)}`);
    this.name = "WorldManifestError";
    this.issues = Object.freeze([...issues]);
  }
}
function parseWorldPackageName(value) {
  const match = /^(@[a-z][a-z0-9_-]{1,30})\/([A-Za-z][A-Za-z0-9_-]*)$/.exec(value);
  if (match === null) {
    throw new TypeError("\u5305\u540D\u5FC5\u987B\u662F @namespace/ComponentName");
  }
  return Object.freeze({ namespace: match[1], componentName: match[2] });
}
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
function requiredString(source, key, issues, label = key) {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${label} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    return "";
  }
  return value.trim();
}
function optionalString(source, key, issues, label) {
  const value = source[key];
  if (value === undefined)
    return;
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${label} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    return;
  }
  return value.trim();
}
function stringArray(value, label, issues, required) {
  if (value === undefined && !required)
    return;
  if (!Array.isArray(value) || required && value.length === 0) {
    issues.push(`${label} \u5FC5\u987B\u662F${required ? "\u975E\u7A7A" : ""}\u5B57\u7B26\u4E32\u6570\u7EC4`);
    return;
  }
  const entries = [];
  for (let index = 0;index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== "string" || item.trim().length === 0) {
      issues.push(`${label}[${index}] \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    } else {
      entries.push(item.trim());
    }
  }
  return entries;
}
function enumValue(value, options, label, issues) {
  if (typeof value !== "string" || !options.includes(value)) {
    issues.push(`${label} \u5FC5\u987B\u662F ${options.join("\u3001")} \u4E4B\u4E00`);
    return options[0];
  }
  return value;
}
function enumArray(value, options, label, issues, required) {
  const entries = stringArray(value, label, issues, required);
  if (entries === undefined)
    return;
  for (const entry of entries) {
    if (!options.includes(entry)) {
      issues.push(`${label} \u5305\u542B\u65E0\u6548\u503C ${JSON.stringify(entry)}\uFF1B\u53EF\u9009\u503C: ${options.join("\u3001")}`);
    }
  }
  return entries.filter((entry) => options.includes(entry));
}
function packageJsonPath(inputPath) {
  const absolute = resolve(inputPath);
  return basename(absolute) === "package.json" ? absolute : resolve(absolute, "package.json");
}
function isInside(parent, child) {
  const path = relative(parent, child);
  return path.length === 0 || !path.startsWith("..") && !isAbsolute(path);
}
async function loadWorldPackage(inputPath = process.cwd()) {
  const packagePath = packageJsonPath(inputPath);
  let parsed;
  try {
    parsed = JSON.parse(await Bun.file(packagePath).text());
  } catch (error) {
    if (!await Bun.file(packagePath).exists()) {
      throw new WorldManifestError(packagePath, ["publish \u76EE\u5F55\u5FC5\u987B\u5305\u542B package.json"]);
    }
    throw new WorldManifestError(packagePath, [
      `JSON \u89E3\u6790\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`
    ]);
  }
  const issues = [];
  const root = record(parsed);
  if (root === undefined) {
    throw new WorldManifestError(packagePath, ["\u6839\u503C\u5FC5\u987B\u662F JSON \u5BF9\u8C61"]);
  }
  const name = requiredString(root, "name", issues);
  let packageIdentity;
  if (name) {
    try {
      packageIdentity = parseWorldPackageName(name);
    } catch {
      issues.push("name \u5FC5\u987B\u662F @namespace/ComponentName\uFF1Bnamespace \u4F7F\u7528\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001_ \u6216 -\uFF0C\u7EC4\u4EF6\u540D\u5FC5\u987B\u4EE5\u82F1\u6587\u5B57\u6BCD\u5F00\u5934");
    }
  }
  const version = requiredString(root, "version", issues);
  if (version && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    issues.push("version \u5FC5\u987B\u662F semver\uFF0C\u4F8B\u5982 1.0.0 \u6216 1.0.0-beta.1");
  }
  const description = requiredString(root, "description", issues);
  const license = requiredString(root, "license", issues);
  if (license && license !== "MIT")
    issues.push("license \u5F53\u524D\u53EA\u652F\u6301 MIT");
  const files = stringArray(root.files, "files", issues, true) ?? [];
  for (const [index, path] of files.entries()) {
    const segments = path.replaceAll("\\", "/").split("/");
    if (isAbsolute(path) || path.includes("\\") || segments.includes("..") || segments.includes("") || /[*?{}\[\]!]/.test(path)) {
      issues.push(`files[${index}] \u5FC5\u987B\u662F package \u76EE\u5F55\u5185\u4E0D\u542B glob \u7684\u76F8\u5BF9\u6587\u4EF6\u6216\u76EE\u5F55\u8DEF\u5F84`);
    }
    if (segments.some((segment) => segment === ".git" || segment === "node_modules")) {
      issues.push(`files[${index}] \u4E0D\u80FD\u5305\u542B .git \u6216 node_modules`);
    }
  }
  const fourier = record(root.fourier);
  if (fourier === undefined)
    issues.push("fourier \u5FC5\u987B\u662F\u5BF9\u8C61");
  const metadata = fourier ?? {};
  const entry = requiredString(metadata, "entry", issues, "fourier.entry");
  if (entry && isAbsolute(entry))
    issues.push("fourier.entry \u5FC5\u987B\u662F\u76F8\u5BF9 package.json \u7684\u8DEF\u5F84");
  const type = enumValue(metadata.type, WORLD_COMPONENT_TYPES, "fourier.type", issues);
  const subtype = optionalString(metadata, "subtype", issues, "fourier.subtype");
  if (subtype !== undefined && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(subtype)) {
    issues.push("fourier.subtype \u53EA\u80FD\u5305\u542B\u82F1\u6587\u5B57\u6BCD\u3001\u6570\u5B57\u3001_ \u548C -\uFF0C\u4E14\u5FC5\u987B\u4EE5\u82F1\u6587\u5B57\u6BCD\u5F00\u5934");
  }
  const summary = requiredString(metadata, "summary", issues, "fourier.summary");
  if (summary.length > 180)
    issues.push("fourier.summary \u4E0D\u80FD\u8D85\u8FC7 180 \u4E2A\u5B57\u7B26");
  const instruction = requiredString(metadata, "instruction", issues, "fourier.instruction");
  const useCases = stringArray(metadata.useCases, "fourier.useCases", issues, true) ?? [];
  const negativeUseCases = stringArray(metadata.negativeUseCases, "fourier.negativeUseCases", issues, false);
  const aliases = stringArray(metadata.aliases, "fourier.aliases", issues, false);
  const tags = stringArray(metadata.tags, "fourier.tags", issues, true) ?? [];
  const style = enumArray(metadata.style, WORLD_STYLES, "fourier.style", issues, true) ?? [];
  if (style.length > 3)
    issues.push("fourier.style \u5FC5\u987B\u5305\u542B 1\u20143 \u9879");
  const contentDomains = stringArray(metadata.contentDomains, "fourier.contentDomains", issues, false);
  const mood = enumArray(metadata.mood, WORLD_MOODS, "fourier.mood", issues, false);
  const languages = enumArray(metadata.languages, WORLD_LANGUAGES, "fourier.languages", issues, false);
  const rootDirectory = dirname(packagePath);
  const entryPath = resolve(rootDirectory, entry);
  if (entry && !isInside(rootDirectory, entryPath)) {
    issues.push("fourier.entry \u4E0D\u80FD\u6307\u5411 package.json \u76EE\u5F55\u4E4B\u5916");
  } else if (entry) {
    try {
      const [rootRealPath, entryRealPath, entryStat] = await Promise.all([
        realpath(rootDirectory),
        realpath(entryPath),
        stat(entryPath)
      ]);
      if (!isInside(rootRealPath, entryRealPath))
        issues.push("fourier.entry \u4E0D\u80FD\u901A\u8FC7\u7B26\u53F7\u94FE\u63A5\u6307\u5411 package.json \u76EE\u5F55\u4E4B\u5916");
      if (!entryStat.isFile())
        issues.push("fourier.entry \u5FC5\u987B\u6307\u5411\u6587\u4EF6");
    } catch {
      issues.push(`fourier.entry \u6587\u4EF6\u4E0D\u5B58\u5728: ${entry}`);
    }
  }
  if (issues.length > 0 || packageIdentity === undefined) {
    throw new WorldManifestError(packagePath, issues);
  }
  const worldManifest = Object.freeze({
    entry,
    type,
    ...subtype === undefined ? {} : { subtype },
    summary,
    instruction,
    useCases: Object.freeze(useCases),
    ...negativeUseCases === undefined ? {} : { negativeUseCases: Object.freeze(negativeUseCases) },
    ...aliases === undefined ? {} : { aliases: Object.freeze(aliases) },
    tags: Object.freeze(tags),
    style: Object.freeze(style),
    ...contentDomains === undefined ? {} : { contentDomains: Object.freeze(contentDomains) },
    ...mood === undefined ? {} : { mood: Object.freeze(mood) },
    ...languages === undefined ? {} : { languages: Object.freeze(languages) }
  });
  const manifest = Object.freeze({
    name,
    version,
    description,
    license: "MIT",
    files: Object.freeze(files),
    fourier: worldManifest
  });
  return Object.freeze({
    packagePath,
    rootDirectory,
    entryPath,
    namespace: packageIdentity.namespace,
    componentName: packageIdentity.componentName,
    manifest
  });
}

// src/npm-package.ts
import { createHash } from "crypto";
import { mkdir, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { dirname as dirname2, isAbsolute as isAbsolute2, join, posix } from "path";
var MAX_NPM_PACKAGE_BYTES = 10 * 1024 * 1024;
var MAX_NPM_UNPACKED_BYTES = 20 * 1024 * 1024;
var MAX_NPM_PACKAGE_FILES = 500;
var MAX_NPM_COMPONENTS = 50;
function record2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
function exactVersion(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}
function parseNpmPackageReference(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("npm \u5F15\u7528\u5FC5\u987B\u662F\u7CBE\u786E\u7248\u672C https://www.npmjs.com/package/@scope/name/v/1.2.3 URL");
  }
  if (url.protocol !== "https:" || url.hostname !== "www.npmjs.com" || url.port || url.username || url.password || url.search) {
    throw new TypeError("npm \u5F15\u7528\u53EA\u63A5\u53D7\u65E0\u8BA4\u8BC1\u3001\u7AEF\u53E3\u548C\u67E5\u8BE2\u53C2\u6570\u7684 https://www.npmjs.com \u7CBE\u786E\u7248\u672C URL");
  }
  const segments = url.pathname.split("/");
  if (segments.length !== 6 || segments[0] !== "" || segments[1] !== "package" || !/^@[a-z0-9][a-z0-9._-]*$/.test(segments[2] ?? "") || !/^[a-z0-9][a-z0-9._-]*$/.test(segments[3] ?? "") || segments[4] !== "v" || !exactVersion(segments[5] ?? "")) {
    throw new TypeError("npm \u5F15\u7528\u5FC5\u987B\u662F\u7CBE\u786E\u7248\u672C https://www.npmjs.com/package/@scope/name/v/1.2.3 URL");
  }
  const componentName = url.hash ? url.hash.slice(1) : undefined;
  if (componentName !== undefined && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(componentName)) {
    throw new TypeError("npm \u7EC4\u4EF6 fragment \u5FC5\u987B\u662F ComponentName");
  }
  const namespace = segments[2];
  const packageName = `${namespace}/${segments[3]}`;
  const version = segments[5];
  const packageUrl = `https://www.npmjs.com/package/${packageName}/v/${version}`;
  return Object.freeze({
    packageUrl,
    ...componentName === undefined ? {} : { componentUrl: `${packageUrl}#${componentName}` },
    packageName,
    namespace,
    version,
    ...componentName === undefined ? {} : { componentName }
  });
}
function safeArchivePath(value) {
  if (!value.startsWith("package/") || value.includes("\\") || isAbsolute2(value))
    return;
  const relative2 = value.slice("package/".length);
  if (!relative2 || posix.normalize(relative2) !== relative2 || relative2.split("/").includes(".."))
    return;
  return relative2;
}
function manifestPaths(value) {
  const root = record2(value);
  const fourier = record2(root?.fourier);
  const components = fourier?.components;
  if (fourier?.schemaVersion !== 1 || !Array.isArray(components)) {
    throw new TypeError("npm package.json \u5FC5\u987B\u5305\u542B fourier.schemaVersion: 1 \u548C fourier.components \u6570\u7EC4");
  }
  if (components.length < 1 || components.length > MAX_NPM_COMPONENTS) {
    throw new TypeError(`fourier.components \u5FC5\u987B\u5305\u542B 1\u2014${MAX_NPM_COMPONENTS} \u4E2A\u7EC4\u4EF6 manifest`);
  }
  const paths = components.map((entry, index) => {
    if (typeof entry !== "string" || !entry.endsWith("/package.json") || entry.includes("\\") || isAbsolute2(entry) || posix.normalize(entry) !== entry || entry.split("/").includes("..")) {
      throw new TypeError(`fourier.components[${index}] \u5FC5\u987B\u662F package \u5185\u7EC4\u4EF6 package.json \u7684\u89C4\u8303\u76F8\u5BF9\u8DEF\u5F84`);
    }
    return entry;
  });
  if (new Set(paths).size !== paths.length)
    throw new TypeError("fourier.components \u4E0D\u80FD\u5305\u542B\u91CD\u590D\u8DEF\u5F84");
  return Object.freeze(paths);
}
async function responseBody(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
async function resolveNpmPackage(input, fetcher = globalThis.fetch) {
  const reference = parseNpmPackageReference(input);
  const metadataUrl = `https://registry.npmjs.org/${encodeURIComponent(reference.packageName)}/${reference.version}`;
  const metadataResponse = await fetcher(metadataUrl, { headers: { accept: "application/json" }, redirect: "error" });
  const metadata = record2(await responseBody(metadataResponse));
  if (!metadataResponse.ok)
    throw new TypeError(`npm registry \u65E0\u6CD5\u89E3\u6790 ${reference.packageName}@${reference.version}`);
  const dist = record2(metadata?.dist);
  if (metadata?.name !== reference.packageName || metadata.version !== reference.version || typeof dist?.tarball !== "string" || typeof dist.integrity !== "string" || !dist.integrity.startsWith("sha512-")) {
    throw new TypeError("npm registry \u7CBE\u786E\u7248\u672C\u5143\u6570\u636E\u683C\u5F0F\u65E0\u6548");
  }
  const tarballUrl = new URL(dist.tarball);
  if (tarballUrl.protocol !== "https:" || tarballUrl.hostname !== "registry.npmjs.org" || tarballUrl.port) {
    throw new TypeError("npm dist.tarball \u5FC5\u987B\u4F4D\u4E8E\u5B98\u65B9 HTTPS registry");
  }
  if (typeof dist.fileCount === "number" && (!Number.isInteger(dist.fileCount) || dist.fileCount < 1 || dist.fileCount > MAX_NPM_PACKAGE_FILES)) {
    throw new TypeError(`npm package \u6587\u4EF6\u6570\u4E0D\u80FD\u8D85\u8FC7 ${MAX_NPM_PACKAGE_FILES}`);
  }
  if (typeof dist.unpackedSize === "number" && (!Number.isInteger(dist.unpackedSize) || dist.unpackedSize < 1 || dist.unpackedSize > MAX_NPM_UNPACKED_BYTES)) {
    throw new TypeError(`npm package \u89E3\u538B\u5C3A\u5BF8\u4E0D\u80FD\u8D85\u8FC7 ${MAX_NPM_UNPACKED_BYTES} bytes`);
  }
  const tarballResponse = await fetcher(tarballUrl, { redirect: "error" });
  if (!tarballResponse.ok)
    throw new TypeError("npm tarball \u4E0B\u8F7D\u5931\u8D25");
  const declaredLength = Number(tarballResponse.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_NPM_PACKAGE_BYTES) {
    throw new TypeError(`npm tarball \u4E0D\u80FD\u8D85\u8FC7 ${MAX_NPM_PACKAGE_BYTES} bytes`);
  }
  const bytes = new Uint8Array(await tarballResponse.arrayBuffer());
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_NPM_PACKAGE_BYTES) {
    throw new TypeError(`npm tarball \u5FC5\u987B\u4E3A 1\u2014${MAX_NPM_PACKAGE_BYTES} bytes`);
  }
  const actualIntegrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  if (actualIntegrity !== dist.integrity)
    throw new TypeError("npm tarball integrity \u4E0E registry \u5143\u6570\u636E\u4E0D\u4E00\u81F4");
  let files;
  try {
    files = await new Bun.Archive(bytes).files();
  } catch {
    throw new TypeError("npm tarball \u65E0\u6CD5\u89E3\u6790");
  }
  if (files.size < 1 || files.size > MAX_NPM_PACKAGE_FILES) {
    throw new TypeError(`npm package \u5FC5\u987B\u5305\u542B 1\u2014${MAX_NPM_PACKAGE_FILES} \u4E2A\u6587\u4EF6`);
  }
  const unpackedSize = [...files.values()].reduce((total, file) => total + file.size, 0);
  if (unpackedSize < 1 || unpackedSize > MAX_NPM_UNPACKED_BYTES) {
    throw new TypeError(`npm package \u89E3\u538B\u5C3A\u5BF8\u4E0D\u80FD\u8D85\u8FC7 ${MAX_NPM_UNPACKED_BYTES} bytes`);
  }
  const rootDirectory = await mkdtemp(join(tmpdir(), "fourier-npm-package-"));
  try {
    for (const [archivePath, file] of files) {
      const path = safeArchivePath(archivePath);
      if (path === undefined)
        throw new TypeError(`npm tarball \u5305\u542B\u65E0\u6548\u8DEF\u5F84: ${archivePath}`);
      const destination = join(rootDirectory, path);
      await mkdir(dirname2(destination), { recursive: true });
      await Bun.write(destination, file);
    }
    const rootPackagePath = join(rootDirectory, "package.json");
    let rootPackage;
    try {
      rootPackage = JSON.parse(await Bun.file(rootPackagePath).text());
    } catch {
      throw new TypeError("npm tarball \u6839\u76EE\u5F55\u7F3A\u5C11\u6709\u6548 package.json");
    }
    const root = record2(rootPackage);
    if (root?.name !== reference.packageName || root.version !== reference.version || root.license !== "MIT") {
      throw new TypeError("npm package.json \u7684 name\u3001version \u6216 MIT license \u4E0E\u5F15\u7528\u4E0D\u4E00\u81F4");
    }
    const components = await Promise.all(manifestPaths(rootPackage).map((path) => loadWorldPackage(join(rootDirectory, path))));
    const names = new Set;
    for (const component of components) {
      if (component.namespace !== reference.namespace || component.manifest.version !== reference.version) {
        throw new TypeError(`\u7EC4\u4EF6 ${component.manifest.name} \u7684 scope \u6216 version \u4E0E npm package \u4E0D\u4E00\u81F4`);
      }
      if (names.has(component.componentName))
        throw new TypeError(`npm package \u5305\u542B\u91CD\u590D\u7EC4\u4EF6 ${component.componentName}`);
      names.add(component.componentName);
    }
    if (reference.componentName !== undefined && !names.has(reference.componentName)) {
      throw new TypeError(`npm package \u4E0D\u5305\u542B\u7EC4\u4EF6 ${reference.componentName}`);
    }
    return Object.freeze({
      reference,
      integrity: dist.integrity,
      tarballUrl: tarballUrl.href,
      fileCount: files.size,
      unpackedSize,
      rootDirectory,
      components: Object.freeze(components),
      cleanup: () => rm(rootDirectory, { recursive: true, force: true })
    });
  } catch (error) {
    await rm(rootDirectory, { recursive: true, force: true });
    throw error;
  }
}

// src/world-preview.ts
import { mkdtemp as mkdtemp2, readFile, rm as rm2 } from "fs/promises";
import { tmpdir as tmpdir2 } from "os";
import { join as join2 } from "path";

// src/artifact-host.ts
import { createArtifactHost } from "@fourier-video/core";
var sdkArtifactHost = createArtifactHost({
  resolveAuthorImport: (specifier) => Bun.resolveSync(specifier, import.meta.dir)
});

// src/errors.ts
class SdkError extends Error {
  code;
  details;
  constructor(code, message, details) {
    super(message);
    this.name = "SdkError";
    this.code = code;
    if (details !== undefined)
      this.details = details;
  }
}
function sdkFail(code, message, details) {
  throw new SdkError(code, message, details);
}

// src/world-preview.ts
var { renderVisualArtifactVideo } = sdkArtifactHost;
var MAX_WORLD_PREVIEW_BYTES = 32 * 1024 * 1024;
var WORLD_PREVIEW_DOM_PAGES = 3;
async function renderWorldPreviewVideo(artifact, options = {}) {
  const directory = await mkdtemp2(join2(tmpdir2(), "fourier-world-preview-"));
  const output = join2(directory, "preview.mp4");
  try {
    const result = await renderVisualArtifactVideo(artifact, {
      output,
      overwrite: true,
      crf: 26,
      preset: "medium",
      domPages: WORLD_PREVIEW_DOM_PAGES,
      ...options.ffmpegPath === undefined ? {} : { ffmpegPath: options.ffmpegPath }
    });
    if (result.byteLength > MAX_WORLD_PREVIEW_BYTES) {
      sdkFail("WORLD_PREVIEW_TOO_LARGE", `\u672C\u5730\u6E32\u67D3\u7684\u9884\u89C8 MP4 \u4E0D\u80FD\u8D85\u8FC7 ${MAX_WORLD_PREVIEW_BYTES} bytes`, { byteLength: result.byteLength, maximum: MAX_WORLD_PREVIEW_BYTES });
    }
    return Object.freeze({
      bytes: new Uint8Array(await readFile(output)),
      mimeType: "video/mp4",
      sha256: result.sha256,
      width: result.width,
      height: result.height,
      fps: result.fps,
      totalFrames: result.totalFrames,
      durationSeconds: result.durationSeconds
    });
  } finally {
    await rm2(directory, { recursive: true, force: true });
  }
}

// src/world-client.ts
var DEFAULT_FOURIER_WORLD_URL = "https://www.fourier.video";

class FourierWorldApiError extends Error {
  status;
  details;
  constructor(status, message, details) {
    super(message);
    this.name = "FourierWorldApiError";
    this.status = status;
    this.details = details;
  }
}
function object(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
function normalizeToken(token) {
  return token.replace(/^(?:JWT|Bearer)\s+/i, "").trim();
}
function normalizeWorldUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`\u65E0\u6548\u7684 Fourier World URL: ${value}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Fourier World URL \u53EA\u652F\u6301 http \u6216 https");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("Fourier World URL \u4E0D\u80FD\u5305\u542B\u8D26\u53F7\u3001\u67E5\u8BE2\u53C2\u6570\u6216 fragment");
  }
  return url.href.replace(/\/$/, "");
}
function errorMessage(status, body) {
  const data = object(body);
  if (typeof data?.message === "string")
    return data.message;
  const nestedError = object(data?.error);
  if (typeof nestedError?.message === "string")
    return nestedError.message;
  if (Array.isArray(data?.errors)) {
    const messages = data.errors.map((entry) => object(entry)?.message).filter((entry) => typeof entry === "string");
    if (messages.length > 0)
      return messages.join("\uFF1B");
  }
  if (status === 401)
    return "\u767B\u5F55\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u8FD0\u884C fourier-sdk login";
  if (status === 403)
    return "\u5F53\u524D Fourier World \u8D26\u53F7\u6CA1\u6709\u53D1\u5E03\u6743\u9650";
  return `Fourier World \u8BF7\u6C42\u5931\u8D25 (HTTP ${status})`;
}
async function responseBody2(response) {
  const text = await response.text();
  if (text.length === 0)
    return;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function loginResult(value) {
  const data = object(value);
  const user = object(data?.user);
  if (typeof data?.token !== "string" || typeof user?.id !== "string" && typeof user?.id !== "number" || typeof user.email !== "string" || typeof user.name !== "string" || user.role !== "admin" && user.role !== "reviewer" && user.role !== "user") {
    throw new FourierWorldApiError(502, "Fourier World \u767B\u5F55\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", value);
  }
  return Object.freeze({
    token: normalizeToken(data.token),
    ...typeof data.exp === "number" ? { exp: data.exp } : {},
    user: Object.freeze({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    })
  });
}
function componentRecord(value) {
  const wrapper = object(value);
  const data = object(wrapper?.doc) ?? wrapper;
  if (data === undefined || typeof data.id !== "string" && typeof data.id !== "number" || typeof data.namespace !== "string" || typeof data.name !== "string" || typeof data.version !== "string" || !["draft", "review", "published", "unlisted"].includes(String(data.status))) {
    throw new FourierWorldApiError(502, "Fourier World \u7EC4\u4EF6\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", value);
  }
  return Object.freeze({
    id: data.id,
    namespace: data.namespace,
    name: data.name,
    version: data.version,
    status: data.status
  });
}
function requiredString2(source, key) {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
  }
  return value;
}
function finiteNumber(source, key) {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u6709\u9650\u6570\u5B57`);
  }
  return value;
}
function nonNegativeInteger(source, key) {
  const value = finiteNumber(source, key);
  if (!Number.isInteger(value) || value < 0)
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u975E\u8D1F\u6574\u6570`);
  return value;
}
function positiveIntegerField(source, key) {
  const value = finiteNumber(source, key);
  if (!Number.isInteger(value) || value < 1)
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u6B63\u6574\u6570`);
  return value;
}
function stringList(source, key) {
  const value = source[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
  }
  return Object.freeze([...value]);
}
function worldEnumList(source, key, allowed) {
  const values = stringList(source, key);
  if (!values.every((value) => allowed.includes(value))) {
    throw new TypeError(`\u5B57\u6BB5 ${key} \u5305\u542B\u672A\u77E5\u503C`);
  }
  return values;
}
function optionalNullableString(source, key) {
  const value = source[key];
  if (value === undefined || value === null || typeof value === "string")
    return value;
  throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u5B57\u7B26\u4E32\u6216 null`);
}
function absoluteWorldUrl(value, worldUrl, field) {
  try {
    const url = new URL(value, `${worldUrl}/`);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new TypeError("unsupported protocol");
    return url.href;
  } catch {
    throw new TypeError(`\u5B57\u6BB5 ${field} \u4E0D\u662F\u6709\u6548\u7684 http/https URL`);
  }
}
function searchMedia(value, worldUrl, field) {
  if (value === null)
    return null;
  const data = object(value);
  if (data === undefined)
    throw new TypeError(`\u5B57\u6BB5 ${field} \u4E0D\u662F\u5A92\u4F53\u5BF9\u8C61\u6216 null`);
  const mimeType = optionalNullableString(data, "mimeType");
  return Object.freeze({
    url: absoluteWorldUrl(requiredString2(data, "url"), worldUrl, `${field}.url`),
    alt: requiredString2(data, "alt"),
    ...mimeType === undefined ? {} : { mimeType }
  });
}
function searchAuthor(value, worldUrl) {
  if (value === null)
    return null;
  const data = object(value);
  if (data === undefined)
    throw new TypeError("\u5B57\u6BB5 author \u4E0D\u662F\u4F5C\u8005\u5BF9\u8C61\u6216 null");
  if (typeof data.id !== "string" && typeof data.id !== "number" || typeof data.id === "string" && data.id.length === 0 || typeof data.id === "number" && !Number.isFinite(data.id)) {
    throw new TypeError("\u5B57\u6BB5 author.id \u4E0D\u662F\u5B57\u7B26\u4E32\u6216\u6570\u5B57");
  }
  const bio = optionalNullableString(data, "bio");
  const avatarUrl = optionalNullableString(data, "avatarUrl");
  if (data.verified !== undefined && data.verified !== null && typeof data.verified !== "boolean") {
    throw new TypeError("\u5B57\u6BB5 author.verified \u4E0D\u662F\u5E03\u5C14\u503C\u6216 null");
  }
  return Object.freeze({
    id: data.id,
    name: requiredString2(data, "name"),
    namespace: requiredString2(data, "namespace"),
    ...bio === undefined ? {} : { bio },
    ...data.verified === undefined ? {} : { verified: data.verified },
    ...avatarUrl === undefined ? {} : { avatarUrl: avatarUrl === null ? null : absoluteWorldUrl(avatarUrl, worldUrl, "author.avatarUrl") }
  });
}
function searchMetrics(value) {
  const data = object(value);
  if (data === undefined)
    throw new TypeError("\u5B57\u6BB5 metrics \u4E0D\u662F\u5BF9\u8C61");
  const qualityScore = finiteNumber(data, "qualityScore");
  if (qualityScore < 0 || qualityScore > 1)
    throw new TypeError("\u5B57\u6BB5 metrics.qualityScore \u5FC5\u987B\u4F4D\u4E8E 0\u20141");
  return Object.freeze({
    viewCount: nonNegativeInteger(data, "viewCount"),
    clickCount: nonNegativeInteger(data, "clickCount"),
    favoriteCount: nonNegativeInteger(data, "favoriteCount"),
    adoptionCount: nonNegativeInteger(data, "adoptionCount"),
    qualityScore
  });
}
function searchMatch(value) {
  const data = object(value);
  if (data === undefined)
    throw new TypeError("\u5B57\u6BB5 match \u4E0D\u662F\u5BF9\u8C61");
  const score = finiteNumber(data, "score");
  if (score < 0 || score > 1)
    throw new TypeError("\u5B57\u6BB5 match.score \u5FC5\u987B\u4F4D\u4E8E 0\u20141");
  const semanticScore = finiteNumber(data, "semanticScore");
  if (semanticScore < 0 || semanticScore > 1) {
    throw new TypeError("\u5B57\u6BB5 match.semanticScore \u5FC5\u987B\u4F4D\u4E8E 0\u20141");
  }
  return Object.freeze({
    score,
    reasons: stringList(data, "reasons"),
    keywordScore: finiteNumber(data, "keywordScore"),
    semanticScore
  });
}
function searchResult(value, worldUrl) {
  const data = object(value);
  if (data === undefined)
    throw new TypeError("\u68C0\u7D22\u7ED3\u679C\u4E0D\u662F\u5BF9\u8C61");
  if (typeof data.id !== "string" && typeof data.id !== "number" || typeof data.id === "string" && data.id.length === 0 || typeof data.id === "number" && !Number.isFinite(data.id)) {
    throw new TypeError("\u5B57\u6BB5 id \u4E0D\u662F\u5B57\u7B26\u4E32\u6216\u6570\u5B57");
  }
  if (data.downloadable !== true && data.downloadable !== false) {
    throw new TypeError("\u5B57\u6BB5 downloadable \u4E0D\u662F\u5E03\u5C14\u503C");
  }
  if (!WORLD_COMPONENT_TYPES.includes(data.type)) {
    throw new TypeError("\u5B57\u6BB5 type \u4E0D\u662F\u5DF2\u77E5\u7684 Fourier World \u7EC4\u4EF6\u7C7B\u578B");
  }
  if (data.license !== "MIT")
    throw new TypeError("\u5B57\u6BB5 license \u4E0D\u662F MIT");
  const subtype = optionalNullableString(data, "subtype");
  const styles = worldEnumList(data, "style", WORLD_STYLES);
  const name = requiredString2(data, "name");
  const namespace = requiredString2(data, "namespace");
  const packageName = requiredString2(data, "packageName");
  if (packageName !== `${namespace}/${name}`) {
    throw new TypeError("\u5B57\u6BB5 packageName \u4E0E namespace/name \u4E0D\u4E00\u81F4");
  }
  const npmPackageUrl = requiredString2(data, "npmPackageUrl");
  const npmComponentUrl = requiredString2(data, "npmComponentUrl");
  const version = requiredString2(data, "version");
  const parsedNpmPackage = parseNpmPackageReference(npmPackageUrl);
  const parsedNpmComponent = parseNpmPackageReference(npmComponentUrl);
  if (parsedNpmPackage.componentName !== undefined || parsedNpmComponent.packageUrl !== parsedNpmPackage.packageUrl || parsedNpmComponent.componentName !== name || parsedNpmPackage.namespace !== namespace || parsedNpmPackage.version !== version) {
    throw new TypeError("npmPackageUrl/npmComponentUrl \u4E0E\u7EC4\u4EF6\u8EAB\u4EFD\u4E0D\u4E00\u81F4");
  }
  return Object.freeze({
    id: data.id,
    name,
    namespace,
    packageName,
    npmPackageUrl,
    npmComponentUrl,
    downloadable: data.downloadable,
    version,
    type: data.type,
    ...subtype === undefined ? {} : { subtype },
    summary: requiredString2(data, "summary"),
    description: requiredString2(data, "description"),
    instruction: requiredString2(data, "instruction"),
    styles,
    useCases: stringList(data, "useCases"),
    negativeUseCases: stringList(data, "negativeUseCases"),
    aliases: stringList(data, "aliases"),
    tags: stringList(data, "tags"),
    contentDomains: stringList(data, "contentDomains"),
    moods: worldEnumList(data, "mood", WORLD_MOODS),
    languages: worldEnumList(data, "languages", WORLD_LANGUAGES),
    license: "MIT",
    author: searchAuthor(data.author, worldUrl),
    cover: searchMedia(data.cover, worldUrl, "cover"),
    preview: searchMedia(data.preview, worldUrl, "preview"),
    metrics: searchMetrics(data.metrics),
    createdAt: requiredString2(data, "createdAt"),
    updatedAt: requiredString2(data, "updatedAt"),
    match: searchMatch(data.match)
  });
}
function searchResponse(value, worldUrl) {
  const data = object(value);
  if (data === undefined || !Array.isArray(data.docs)) {
    throw new TypeError("\u68C0\u7D22\u54CD\u5E94\u7F3A\u5C11 docs \u6570\u7EC4");
  }
  if (data.mode !== "hybrid")
    throw new TypeError("\u68C0\u7D22\u54CD\u5E94 mode \u4E0D\u662F hybrid");
  if (data.queryId !== undefined && typeof data.queryId !== "string" && typeof data.queryId !== "number") {
    throw new TypeError("\u68C0\u7D22\u54CD\u5E94 queryId \u4E0D\u662F\u5B57\u7B26\u4E32\u6216\u6570\u5B57");
  }
  return Object.freeze({
    results: Object.freeze(data.docs.map((item) => searchResult(item, worldUrl))),
    total: nonNegativeInteger(data, "total"),
    page: positiveIntegerField(data, "page"),
    limit: positiveIntegerField(data, "limit"),
    ...data.queryId === undefined ? {} : { queryId: data.queryId },
    latencyMs: nonNegativeInteger(data, "latencyMs"),
    mode: "hybrid"
  });
}
function positiveInteger(value, fallback, label, maximum) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1 || maximum !== undefined && resolved > maximum) {
    throw new TypeError(`${label} \u5FC5\u987B\u662F 1\u2014${maximum ?? "\u221E"} \u7684\u6574\u6570`);
  }
  return resolved;
}
function trimmedList(values, label) {
  if (values === undefined)
    return [];
  const result = values.map((value) => value.trim());
  if (result.some((value) => value.length === 0))
    throw new TypeError(`${label} \u4E0D\u80FD\u5305\u542B\u7A7A\u5B57\u7B26\u4E32`);
  return [...new Set(result)];
}
function enumList(values, allowed, label) {
  if (values === undefined)
    return [];
  if (values.some((value) => !allowed.includes(value)))
    throw new TypeError(`${label} \u5305\u542B\u4E0D\u652F\u6301\u7684\u503C`);
  return [...new Set(values)];
}

class FourierWorldClient {
  worldUrl;
  token;
  fetcher;
  constructor(options = {}) {
    this.worldUrl = normalizeWorldUrl(options.worldUrl ?? DEFAULT_FOURIER_WORLD_URL);
    const token = options.token === undefined ? undefined : normalizeToken(options.token);
    this.token = token && token.length > 0 ? token : undefined;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }
  async fetchResponse(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (this.token !== undefined)
      headers.set("authorization", `JWT ${this.token}`);
    return this.fetcher(new URL(path, `${this.worldUrl}/`), {
      ...init,
      headers,
      redirect: "error"
    });
  }
  async request(path, init = {}) {
    const response = await this.fetchResponse(path, init);
    const body = await responseBody2(response);
    if (!response.ok) {
      throw new FourierWorldApiError(response.status, errorMessage(response.status, body), body);
    }
    return body;
  }
  async login(email, password) {
    const body = await this.request("api/users/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return loginResult(body);
  }
  async currentUser() {
    if (this.token === undefined)
      throw new TypeError("Fourier World token \u7F3A\u5931");
    const body = object(await this.request("api/users/me"));
    const user = object(body?.user);
    if (typeof user?.id !== "string" && typeof user?.id !== "number" || typeof user.email !== "string" || typeof user.name !== "string" || user.role !== "admin" && user.role !== "reviewer" && user.role !== "user") {
      throw new FourierWorldApiError(502, "Fourier World \u5F53\u524D\u7528\u6237\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", body);
    }
    return Object.freeze({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  }
  async search(query, options = {}) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0 || normalizedQuery.length > 500) {
      throw new TypeError("Search query \u5FC5\u987B\u662F 1\u2014500 \u4E2A\u5B57\u7B26");
    }
    if (options.type !== undefined && !WORLD_COMPONENT_TYPES.includes(options.type)) {
      throw new TypeError("type \u4E0D\u662F\u5DF2\u77E5\u7684 Fourier World \u7EC4\u4EF6\u7C7B\u578B");
    }
    if (options.license !== undefined && options.license !== "MIT") {
      throw new TypeError("license \u53EA\u652F\u6301 MIT");
    }
    const author = options.author?.trim();
    if (options.author !== undefined && author?.length === 0)
      throw new TypeError("author \u4E0D\u80FD\u4E3A\u7A7A");
    const sessionId = options.sessionId?.trim();
    if (options.sessionId !== undefined && (sessionId === undefined || sessionId.length === 0 || sessionId.length > 100)) {
      throw new TypeError("sessionId \u5FC5\u987B\u662F 1\u2014100 \u4E2A\u5B57\u7B26");
    }
    const queryParams = new URLSearchParams({
      q: normalizedQuery,
      page: String(positiveInteger(options.page, 1, "page")),
      limit: String(positiveInteger(options.limit, 12, "limit", 48))
    });
    if (options.type !== undefined)
      queryParams.set("type", options.type);
    for (const style of enumList(options.styles, WORLD_STYLES, "styles"))
      queryParams.append("style", style);
    for (const domain of trimmedList(options.contentDomains, "contentDomains")) {
      queryParams.append("domain", domain);
    }
    for (const mood of enumList(options.moods, WORLD_MOODS, "moods"))
      queryParams.append("mood", mood);
    for (const language of enumList(options.languages, WORLD_LANGUAGES, "languages")) {
      queryParams.append("language", language);
    }
    if (options.license !== undefined)
      queryParams.set("license", options.license);
    if (author !== undefined)
      queryParams.set("author", author);
    if (sessionId !== undefined)
      queryParams.set("sessionId", sessionId);
    const body = await this.request(`api/search?${queryParams}`, options.signal === undefined ? {} : { signal: options.signal });
    try {
      return searchResponse(body, this.worldUrl);
    } catch (error) {
      throw new FourierWorldApiError(502, `Fourier World \u68C0\u7D22\u54CD\u5E94\u683C\u5F0F\u65E0\u6548: ${error instanceof Error ? error.message : String(error)}`, body);
    }
  }
  async publish(prepared) {
    if (this.token === undefined)
      throw new TypeError("Fourier World token \u7F3A\u5931");
    const user = await this.currentUser();
    if (user.role !== "user" || user.name !== prepared.npmPackage.reference.namespace) {
      throw new FourierWorldApiError(403, `npm scope \u5FC5\u987B\u7B49\u4E8E\u5F53\u524D\u666E\u901A\u7528\u6237 namespace ${user.name}`);
    }
    const uploadedMedia = [];
    const cleanup = async () => {
      await Promise.all(uploadedMedia.map((id) => this.request(`api/media/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {
        return;
      })));
    };
    try {
      const previews = [];
      for (const component of prepared.components) {
        const preview = component.preview;
        if (preview.bytes.byteLength < 1 || preview.bytes.byteLength > MAX_WORLD_PREVIEW_BYTES) {
          throw new TypeError(`Fourier World \u9884\u89C8 MP4 \u5FC5\u987B\u4E3A 1\u2014${MAX_WORLD_PREVIEW_BYTES} bytes`);
        }
        const form = new FormData;
        form.append("_payload", JSON.stringify({ alt: `${component.artifact.name} \xB7 Fourier preview` }));
        form.append("file", new File([Uint8Array.from(preview.bytes).buffer], `${component.artifact.name}-${prepared.npmPackage.reference.version}-preview.mp4`, { type: preview.mimeType }));
        const uploaded = object(await this.request("api/media", { method: "POST", body: form }));
        const doc = object(uploaded?.doc) ?? uploaded;
        if (typeof doc?.id !== "string" && typeof doc?.id !== "number") {
          throw new FourierWorldApiError(502, "Fourier World \u9884\u89C8\u4E0A\u4F20\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", uploaded);
        }
        uploadedMedia.push(doc.id);
        previews.push({ name: component.artifact.name, mediaId: doc.id });
      }
      const body = object(await this.request("api/npm-packages/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          npmPackageUrl: prepared.npmPackage.reference.packageUrl,
          integrity: prepared.npmPackage.integrity,
          fileCount: prepared.npmPackage.fileCount,
          unpackedSize: prepared.npmPackage.unpackedSize,
          previews
        })
      }));
      if (body === undefined || typeof body.created !== "boolean" || typeof body.packageId !== "string" && typeof body.packageId !== "number" || !Array.isArray(body.components)) {
        throw new FourierWorldApiError(502, "Fourier World npm \u53D1\u5E03\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", body);
      }
      return Object.freeze({
        created: body.created,
        packageId: body.packageId,
        components: Object.freeze(body.components.map(componentRecord))
      });
    } catch (error) {
      await cleanup();
      throw error;
    }
  }
  async approvedNpmPackage(npmUrl) {
    const reference = parseNpmPackageReference(npmUrl);
    const query = new URLSearchParams({ url: reference.componentUrl ?? reference.packageUrl });
    const body = object(await this.request(`api/npm-packages/resolve?${query}`));
    if (body === undefined || body.npmPackageUrl !== reference.packageUrl || typeof body.integrity !== "string" || !body.integrity.startsWith("sha512-") || !Array.isArray(body.components)) {
      throw new FourierWorldApiError(502, "Fourier World npm release \u54CD\u5E94\u683C\u5F0F\u65E0\u6548", body);
    }
    const components = body.components.map((value) => {
      const item = object(value);
      if (typeof item?.name !== "string" || typeof item.npmComponentUrl !== "string") {
        throw new FourierWorldApiError(502, "Fourier World npm component \u54CD\u5E94\u683C\u5F0F\u65E0\u6548", value);
      }
      const parsed = parseNpmPackageReference(item.npmComponentUrl);
      if (parsed.packageUrl !== reference.packageUrl || parsed.componentName !== item.name) {
        throw new FourierWorldApiError(502, "Fourier World npm component \u8EAB\u4EFD\u4E0D\u4E00\u81F4", value);
      }
      return Object.freeze({ name: item.name, npmComponentUrl: item.npmComponentUrl });
    });
    if (components.length < 1 || components.length > 50 || new Set(components.map((item) => item.name)).size !== components.length) {
      throw new FourierWorldApiError(502, "Fourier World npm release \u7EC4\u4EF6\u5217\u8868\u65E0\u6548", body);
    }
    if (reference.componentName !== undefined && (components.length !== 1 || components[0]?.name !== reference.componentName)) {
      throw new FourierWorldApiError(404, `Fourier World \u672A\u53D1\u5E03\u7EC4\u4EF6 ${reference.componentName}`, body);
    }
    return Object.freeze({
      npmPackageUrl: reference.packageUrl,
      integrity: body.integrity,
      components: Object.freeze(components)
    });
  }
}

// src/search.ts
async function searchFourierWorld(query, options = {}) {
  const client = new FourierWorldClient({
    worldUrl: options.worldUrl ?? DEFAULT_FOURIER_WORLD_URL,
    ...options.fetch === undefined ? {} : { fetch: options.fetch }
  });
  return client.search(query, options);
}
export {
  searchFourierWorld,
  normalizeWorldUrl,
  FourierWorldApiError,
  DEFAULT_FOURIER_WORLD_URL
};

//# debugId=CE4C6CCBE2A7704D64756E2164756E21
