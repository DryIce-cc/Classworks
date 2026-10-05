// 构建后把 index.html 复制一份成 404.html。
// GitHub Pages 这个“房东”最死板：只会按文件名找文件，不支持“所有地址都给首页”
// 这种配置。所以直接放一个 404.html 顶上：用户刷新 /settings 时，
// GitHub 找不到这个文件就会拿 404.html 出来，内容和首页一模一样，
// 应用启动后路由会自己认出这是 /settings，页面正常显示。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(scriptDir, '..', 'dist')

fs.copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'))
console.log('已生成 dist/404.html（GitHub Pages 单页应用回退）。')
