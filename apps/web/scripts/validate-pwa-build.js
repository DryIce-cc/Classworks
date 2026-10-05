import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 基于脚本位置定位 dist，不依赖 CWD（根目录跑 pwa:validate 也能找到）
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(scriptDir, '..', 'dist')
const manifestPath = path.join(distDir, 'manifest.webmanifest')
const indexPath = path.join(distDir, 'index.html')
const serviceWorkerPath = path.join(distDir, 'sw.js')

const errors = []

function fail(message) {
  errors.push(message)
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`无法读取或解析 ${path.relative(process.cwd(), filePath)}: ${error.message}`)
    return null
  }
}

function fileExistsFromManifest(src) {
  const normalized = src.replace(/^\.?\//, '').split('?')[0]
  return fs.existsSync(path.join(distDir, normalized))
}

if (!fs.existsSync(distDir)) {
  fail('dist 目录不存在，请先运行构建。')
}

const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null
if (!manifest) {
  fail('dist/manifest.webmanifest 不存在。')
} else {
  for (const field of [
    'id',
    'name',
    'short_name',
    'description',
    'start_url',
    'scope',
    'display',
    'theme_color',
    'background_color',
  ]) {
    if (!manifest[field]) {
      fail(`manifest 缺少 ${field}。`)
    }
  }

  if (manifest.id !== '7C24F2B3.ClassworksPWA') {
    fail('manifest.id 必须是 7C24F2B3.ClassworksPWA。')
  }

  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) {
    fail('manifest.display 应为 standalone、fullscreen 或 minimal-ui。')
  }

  const icons = Array.isArray(manifest.icons) ? manifest.icons : []
  const has192 = icons.some(
    (icon) => icon.sizes?.includes('192x192') && fileExistsFromManifest(icon.src),
  )
  const has512 = icons.some(
    (icon) => icon.sizes?.includes('512x512') && fileExistsFromManifest(icon.src),
  )
  const hasMaskable = icons.some(
    (icon) =>
      icon.sizes?.includes('512x512') &&
      icon.purpose?.includes('maskable') &&
      fileExistsFromManifest(icon.src),
  )

  if (!has192) fail('manifest 缺少可访问的 192x192 图标。')
  if (!has512) fail('manifest 缺少可访问的 512x512 图标。')
  if (!hasMaskable) fail('manifest 缺少可访问的 512x512 maskable 图标。')

  if (!Array.isArray(manifest.categories) || manifest.categories.length === 0) {
    fail('manifest 缺少 categories，Microsoft Store/PWABuilder 会降低质量评分。')
  }

  // file_handlers / protocol_handlers 为可选：声明了才校验，不声明不报错
  const fileHandlers = Array.isArray(manifest.file_handlers) ? manifest.file_handlers : []
  if (fileHandlers.length > 0) {
    const fileExtensions = new Set(
      fileHandlers.flatMap((handler) => Object.values(handler.accept || {}).flat()),
    )
    if (!fileExtensions.has('.csb') || !fileExtensions.has('.csi')) {
      fail('manifest.file_handlers 既然声明了，就必须允许 .csb 和 .csi。')
    }
  }

  const protocolHandlers = Array.isArray(manifest.protocol_handlers)
    ? manifest.protocol_handlers
    : []
  if (protocolHandlers.length > 0) {
    if (
      !protocolHandlers.some((handler) => handler.url?.includes('%s'))
    ) {
      fail('manifest.protocol_handlers 既然声明了，url 必须包含 %s。')
    }
  }

  if (manifest.edge_side_panel) {
    fail('manifest 不应声明 edge_side_panel。')
  }
}

if (!fs.existsSync(indexPath)) {
  fail('dist/index.html 不存在。')
} else {
  const html = fs.readFileSync(indexPath, 'utf8')
  if (!html.includes('rel="manifest"')) {
    fail('index.html 缺少 manifest 链接。')
  }
  if (!html.includes('apple-touch-icon')) {
    fail('index.html 缺少 apple-touch-icon。')
  }
  if (!html.includes('msapplication-TileImage')) {
    fail('index.html 缺少 Windows tile 图标声明。')
  }
}

if (!fs.existsSync(serviceWorkerPath)) {
  fail('dist/sw.js 不存在，PWA 离线能力未生成。')
} else {
  const sw = fs.readFileSync(serviceWorkerPath, 'utf8')
  if (!sw.includes('sw-cache-manager.js')) {
    fail('sw.js 未导入 sw-cache-manager.js。')
  }
  if (!sw.includes('index.html')) {
    fail('sw.js 未包含导航回退，离线打开应用可能失败。')
  }
}

if (!fs.existsSync(path.join(distDir, 'sw-cache-manager.js'))) {
  fail('dist/sw-cache-manager.js 不存在。')
}

if (errors.length > 0) {
  console.error('PWA 构建校验失败:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log('PWA 构建校验通过。')
