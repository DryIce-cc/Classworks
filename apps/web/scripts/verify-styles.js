/**
 * scripts/verify-styles.js
 *
 * 构建产物自检：Vuetify 的通用样式必须真的进了 CSS。
 *
 * 遇到过一次构建偶发地只吐出各组件自己的 CSS、把 vuetify/styles 整份丢了：
 * 构建照样报成功、页面也不报错，只是 flex 布局和文字样式全部失效，
 * 得等用户看到版式塌了才发现。这里钉几个模板里真在用的工具类当哨兵，
 * 缺了就在构建阶段直接红掉，别等部署出去。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 脚本位置定位 dist，不依赖 CWD
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.resolve(scriptDir, '..', 'dist', 'assets')

// 都是模板里实际用到的 Vuetify 工具类，少一个就说明通用样式没进来
const SENTINELS = [
  'd-flex',
  'align-center',
  'text-h6',
  'text-body-2',
  'text-caption',
  'text-center',
  'text-truncate',
  'font-weight-medium',
]

if (!fs.existsSync(assetsDir)) {
  console.error(`样式自检失败：找不到 ${assetsDir}`)
  process.exit(1)
}

const css = fs
  .readdirSync(assetsDir)
  .filter((name) => name.endsWith('.css'))
  .map((name) => fs.readFileSync(path.join(assetsDir, name), 'utf8'))
  .join('\n')

const missing = SENTINELS.filter((cls) => !new RegExp(`\\.${cls}(?![\\w-])`).test(css))

if (missing.length > 0) {
  console.error('样式自检失败：产物 CSS 里缺少这些 Vuetify 工具类：')
  for (const cls of missing) console.error(`- .${cls}`)
  console.error('vuetify/styles 很可能没被打进产物，页面布局会塌。')
  process.exit(1)
}

console.log('样式自检通过。')
