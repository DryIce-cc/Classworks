/**
 * plugins/vuetify.js
 *
 * Framework documentation: https://vuetifyjs.com
 */

// Styles
// 不再引 @mdi/font 的图标字体（约 820KB，7400+ 字形，这里只用 22 个）。
// 改用 SVG：路径见 icons/mdi.js，装机体积和首屏都受益
import 'vuetify/styles'

// Composables
import { h } from 'vue'
import { createVuetify } from 'vuetify'
import { zhHans } from 'vuetify/locale'
// mdi-svg 自带 Vuetify 组件内部用的一批图标别名（$close/$next/$prev/…）的 SVG 路径。
// 换掉图标字体后，v-select 的下拉箭头、v-date-picker 的前后翻页这类
// 组件自带的图标也跟着换成 SVG，不会缺字形
import { aliases, mdi as mdiSvg } from 'vuetify/iconsets/mdi-svg'
import { MDI_ICONS } from '../icons/mdi'

// 把图标名解析成 SVG 路径。v-icon 的 icon 属性、v-btn 的 icon/prepend-icon/
// append-icon、v-text-field 的 append-inner-icon，以及 <v-icon>mdi-xxx</v-icon>
// 这种写在标签里的写法，最后都汇到 Vuetify 的 useIcon，再走到这个组件，
// 所以模板里一个 mdi- 字符串都不用改
const mdiByName = {
  component: (props, { attrs }) => {
    const path = MDI_ICONS[props.icon]
    // 图标没收录时会渲染成空白路径，静默很难查，这里直接点名报出来
    if (!path && import.meta.env.DEV) {
      console.warn(
        `[mdi] 未收录的图标 "${props.icon}"，请到 src/icons/mdi.js 里补上对应的 SVG 路径`,
      )
    }
    return h(mdiSvg.component, { ...attrs, ...props, icon: path })
  },
}

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi: mdiByName,
    },
  },
  theme: {
    defaultTheme: 'dark',
  },
  locale: {
    locale: 'zhHans',
    messages: { zhHans },
  },
})
