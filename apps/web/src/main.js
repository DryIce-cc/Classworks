/**
 * main.js
 *
 * 应用入口：注册 Vuetify / Router / 全局消息，挂载后交给 App.vue
 */

// 核心插件（Vuetify / Router）
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'
import GlobalMessage from '@/components/GlobalMessage.vue'

// Directives
import repeatClick from '@/directives/repeatClick'

// Composables
import { createApp } from 'vue'

import messageService from './utils/message'

const app = createApp(App)

registerPlugins(app)
app.use(messageService)

// 全局消息组件在 App.vue 里用到；这里注册一次，别处直接写 <global-message />
app.component('GlobalMessage', GlobalMessage)

// 按住连发：用在数字小键盘的删除键上
app.directive('repeat-click', repeatClick)

app.mount('#app')
