// Plugins
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Layouts from 'vite-plugin-vue-layouts'
import Vue from '@vitejs/plugin-vue'
import VueRouter from 'unplugin-vue-router/vite'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { VitePWA } from 'vite-plugin-pwa'

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// 站点挂在 GitHub Pages 的子路径下（仓库名即路径），base 必须带上这一段，
// 否则产物里的 /assets/... 会指到域名根，整站资源 404。
// 下面 runtimeCaching 的匹配和 manifest 的 start_url/scope 都得跟着它走
const BASE = '/Classworks/'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: BASE,
  plugins: [
    VueRouter(),
    Layouts(),
    Vue({
      template: { transformAssetUrls },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        navigateFallback: 'index.html',
        enabled: false,
        suppressWarnings: true,
      },

      lang: 'zh-CN',
      injectRegister: 'auto',
      strategies: 'generateSW',
      // manifest.webmanifest 和 manifest.icons 里的图标，插件已经按
      // includeManifestIcons 自动追加进预缓存，这里补的是 icons 之外的两个
      // （mask-icon、apple-touch-icon）；插件会去重，manifest 文件本身不用列
      includeAssets: ['pwa/**'],
      // sw.js 本身不要走 HTTP 缓存。默认的 'imports' 会让浏览器最长 24 小时
      // 直接拿缓存里的 sw.js 比对，新构建出来的改动半天都推不到浏览器上
      updateViaCache: 'none',

      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // 不 glob png/svg/webmanifest：这几个已经由上面的 includeAssets 和
        // manifest 追加过，再 glob 一遍会在 sw.js 里留下重复条目
        globPatterns: ['**/*.{js,css,html,ico,txt,json,woff2,ttf}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // 注意：这里的函数体会被 workbox 原样抄进 sw.js，闭包里的 BASE
            // 在那边不存在，${BASE} 会留成字面量、这条规则永远匹配不上。
            // 所以只能写死字面量，改 BASE 时记得连这里一起改
            urlPattern: ({ url, sameOrigin }) => {
              // 站点在子路径下，资源实际在 /Classworks/assets/... 而不是 /assets/...
              return sameOrigin && url.pathname.startsWith('/Classworks/assets/')
            },
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 天
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => {
              return sameOrigin && url.pathname.startsWith('/Classworks/pwa/')
            },
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pwa-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 天
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // 匹配当前域名下除了上述规则外的所有请求
            urlPattern: ({ url, sameOrigin }) => {
              if (!sameOrigin) return false
              const path = url.pathname
              // 排除已经由其他规则处理的路径
              return !(
                path.includes('/Classworks/assets/') ||
                path.includes('/Classworks/pwa/')
              )
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'other-resources',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 1 天
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        id: '7C24F2B3.ClassworksPWA',
        name: 'Classworks PWA',
        short_name: 'Classworks PWA',
        description: '适用于班级大屏的作业板小工具，支持记录、查看作业（本地存储）。',
        theme_color: '#212121',
        background_color: '#212121',
        lang: 'zh-CN',
        dir: 'ltr',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui', 'fullscreen'],
        // 都在子路径下，填 '/' 的话装成应用后启动和作用域会落到域名根上（那边是空白页）
        start_url: BASE,
        scope: BASE,
        orientation: 'any',
        categories: ['education', 'productivity', 'utilities'],
        prefer_related_applications: false,
        launch_handler: {
          client_mode: 'navigate-existing',
        },
        // file_handlers / protocol_handlers 已删：声明了但代码零实现（无 launchQueue），先不挂
        icons: [
          {
            src: './pwa/image/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: './pwa/image/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: './pwa/image/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: './pwa/image/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: '设置',
            short_name: '设置',
            url: `${BASE}settings`,
            icons: [
              {
                src: './pwa/image/pwa-64x64.png',
                sizes: '64x64',
                type: 'image/png',
              },
            ],
          },
        ],
      },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    Vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
    Components({
      directoryAsNamespace: false,
      globs: ['src/components/**/[A-Z]*.vue'],
    }),
    AutoImport({
      imports: ['vue', 'vue-router'],
      vueTemplate: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    extensions: ['.js', '.mjs', '.json', '.vue'],
  },
  build: {
    // ===== Chunk 分割优化 =====
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // 核心框架（极少变动，长缓存）
          'vendor-vue': ['vue', 'vue-router'],
          // UI 框架
          'vendor-vuetify': ['vuetify'],
        },
      },
    },
  },
  // legalComments: 'none' 会连 /*! … */ 和 /* @license … */ 这类法律声明一起删掉。
  // esbuild 默认保留它们，产物里因此留着 Vue 和 ress.css 的版权头，浏览器
  // DevTools 的 Sources 面板里能直接读到。注释本身不是秘密，但上线产物
  // 带着别人的版权声明既不准确也显脏。
  esbuild: {
    legalComments: 'none',
  },
  server: {
    port: 3031,
  },
  css: {
    preprocessorOptions: {
      sass: {
        api: 'modern-compiler',
      },
    },
  },
}))
