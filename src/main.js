/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'
import GlobalMessage from '@/components/GlobalMessage.vue'

// Composables
import { createApp } from 'vue'
import Clarity from '@microsoft/clarity';
const projectId = "rhp8uqoc3l"

Clarity.init(projectId);
import messageService from './utils/message';

const app = createApp(App)

registerPlugins(app)

app.use(messageService);

app.component('GlobalMessage', GlobalMessage)

app.mount('#app')
