<template>
  <div>
    <!-- 作业卡片：按实测高度分列，三列各自独立纵向堆叠（无网格行、无行对齐） -->
    <div ref="gridContainer" class="grid-masonry">
      <TransitionGroup
        v-for="(col, ci) in columnItems"
        :key="ci"
        name="grid"
        tag="div"
        class="grid-column"
      >
        <div v-for="item in col" :key="item.key" class="grid-item" :data-key="item.key">
          <v-card
            border
            class="hw-card cursor-pointer"
            height="100%"
            rounded="md"
            @click="$emit('open-dialog', item.key)"
          >
            <!-- 科目名独占一行，小标题按段落正常单独显示 -->
            <v-card-title class="hw-card-title" :style="contentStyle">
              {{ item.name }}
            </v-card-title>
            <v-card-text :style="contentStyle" class="hw-card-text">
              <template v-for="(block, bi) in buildBlocks(item)" :key="bi">
                <v-divider v-if="bi > 0" class="hw-divider" />
                <div v-if="hasLabel(block)" class="segment-label">
                  <span class="label-date">{{ block.date }}</span>
                  <span class="label-de">{{ block.date ? '的' : '' }}</span>
                  <span class="label-name">{{ block.name }}</span>
                </div>
                <div class="hw-paragraph">
                  <div v-for="(text, ti) in block.lines" :key="ti" class="hw-line">
                    {{ text }}
                  </div>
                </div>
              </template>
            </v-card-text>
          </v-card>
        </div>
      </TransitionGroup>
    </div>

    <!-- 尚无作业的科目：点一下开始填写 -->
    <div ref="emptySubjects" class="empty-subjects mt-4">
      <div class="empty-subjects-grid">
        <TransitionGroup name="v-list">
          <v-card
            v-for="subject in unusedSubjects"
            :key="subject.name"
            border
            rounded="md"
            class="empty-subject-card"
            @click="$emit('open-dialog', subject.name)"
          >
            <v-card-title class="text-subtitle-1">
              {{ subject.name }}
            </v-card-title>
            <v-card-text class="text-center">
              <v-icon color="grey" size="small"> mdi-plus </v-icon>
              <div class="text-caption text-grey">点击添加作业</div>
            </v-card-text>
          </v-card>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script>
// 窗口常年最大化，列数固定，不再按宽度分档
const MAX_COLUMNS = 3
// 「点击添加作业」卡片露在视野里又没人理，3s 后就把它上滑出去
const IDLE_SCROLL_DELAY = 3000

export default {
  name: 'HomeworkGrid',
  props: {
    sortedItems: { type: Array, required: true },
    unusedSubjects: { type: Array, required: true },
    contentStyle: { type: Object, default: () => ({}) },
    // 作业编辑面板开着时页面不能动，自动上滑也一并停掉
    paused: { type: Boolean, default: false },
  },
  emits: ['open-dialog'],
  data() {
    return {
      // 布局版本号：分列结果变化时才 +1，避免量高度触发无限重渲染
      layoutVersion: 0,
    }
  },
  created() {
    // 实测的卡片高度（非响应式，靠 layoutVersion 触发重算）
    this._heights = {}
    this._gap = 0
    this._signature = ''
    // 待执行的自动上滑的定时器
    this._scrollTimer = 0
  },
  computed: {
    // 卡片少时收缩列数，让卡片铺满可用宽度
    effectiveColumns() {
      const count = this.sortedItems ? this.sortedItems.length : 0
      if (count <= 0) return 1
      return Math.max(1, Math.min(count, MAX_COLUMNS))
    },
    // 渲染用的分列结果（透传方法，保证每次拿到的都是现算的）
    columnItems() {
      // 显式依赖版本号，有新测量结果时才重算
      void this.layoutVersion
      return this.assignColumns()
    },
  },
  mounted() {
    // 首屏同步量一次（此时 DOM 已就绪、通常还未绘制），避免先闪一下再重排
    this.updateLayout()
    // 字体后加载会改变卡片高度，加载完再平衡一次
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => this.updateLayout())
    }
    window.addEventListener('scroll', this.handleViewportChange, { passive: true })
    window.addEventListener('resize', this.handleViewportChange, { passive: true })
    // 捕获阶段，用户碰一下就撤销待执行的上滑
    document.addEventListener('pointerdown', this.cancelIdleScroll, true)
    this.armIdleScroll()
  },
  updated() {
    this.$nextTick(() => {
      this.updateLayout()
      // 卡片增减会改变视野里的那一段，重新判断要不要计时
      this.armIdleScroll()
    })
  },
  beforeUnmount() {
    this.cancelIdleScroll()
    window.removeEventListener('scroll', this.handleViewportChange)
    window.removeEventListener('resize', this.handleViewportChange)
    document.removeEventListener('pointerdown', this.cancelIdleScroll, true)
  },
  watch: {
    paused(value) {
      if (value) {
        this.cancelIdleScroll()
        return
      }
      // 面板关掉了，卡片区还露着就接着算
      this.$nextTick(() => this.armIdleScroll())
    },
  },
  methods: {
    // 页面滚了或窗口变了：先撤销待执行的上滑（人已经自己在动了），
    // 再按当前位置重新判断，所以计时总是从「最后一次动静」算起
    handleViewportChange() {
      this.cancelIdleScroll()
      this.armIdleScroll()
    },

    // 已经在计时就别重置，否则每次重排都会把上滑往后顺延一次
    armIdleScroll() {
      if (this._scrollTimer || this.paused || !this.shouldHideEmptySubjects()) return
      this._scrollTimer = window.setTimeout(() => {
        this._scrollTimer = 0
        this.hideEmptySubjects()
      }, IDLE_SCROLL_DELAY)
    },

    cancelIdleScroll() {
      if (this._scrollTimer) window.clearTimeout(this._scrollTimer)
      this._scrollTimer = 0
    },

    // 「点击添加作业」卡片还露在视野里、且页面没滑到顶，就该把它上滑出去
    shouldHideEmptySubjects() {
      const el = this.$refs.emptySubjects
      if (!el || !this.unusedSubjects?.length) return false
      if (window.scrollY <= 0) return false
      const rect = el.getBoundingClientRect()
      // 上下都出了视野都不算「显示在可视区域」；
      // 只露一条边就当已经出去了，免得正好停在边界上反复触发
      return rect.bottom > 1 && rect.top < window.innerHeight - 1
    },

    // 往页首方向滚时，内容整体是往下移的，所以是把整块卡片区推出视口下沿。
    // 要滚的距离超过剩下的高度，就只能到页首为止。
    hideEmptySubjects() {
      const el = this.$refs.emptySubjects
      // 这 3s 里情况可能已经变了（卡片被填掉、页面被滚回顶），到点再确认一次
      if (!el || !this.shouldHideEmptySubjects()) return
      const distance = Math.min(window.scrollY, window.innerHeight - el.getBoundingClientRect().top)
      if (distance <= 0) return
      // 交给原生的平滑滚动：时长和曲线由浏览器定，但各环境表现一致，
      // 自己用 rAF 一步步挪反而容易碰上 behavior: 'instant' 不被支持而整段失效
      window.scrollTo({ top: window.scrollY - distance, behavior: 'smooth' })
    },

    // 按实测高度把每张卡放进当前最矮的列（贪心）。
    // 各列等宽，卡片高度与分列结果无关，所以量一次就能收敛，不会循环。
    // 还没量到高度时（首屏第一帧）按序号取余，保证有内容可量。
    // 注意：必须是普通方法（每次现算），不能是 computed——
    // 高度存在非响应式的 _heights 里，computed 缓存会让 updateLayout 永远读到旧分配。
    assignColumns() {
      const cols = Array.from({ length: this.effectiveColumns }, () => [])
      if (!this.sortedItems) return cols
      const heights = this._heights || {}
      const gap = this._gap || 0
      const colHeights = new Array(this.effectiveColumns).fill(0)
      const colCounts = new Array(this.effectiveColumns).fill(0)
      this.sortedItems.forEach((item, idx) => {
        let target
        if (heights[item.key] == null) {
          target = idx % this.effectiveColumns
        } else {
          target = 0
          let best = Infinity
          for (let c = 0; c < this.effectiveColumns; c++) {
            const h = colHeights[c] + (colCounts[c] > 0 ? gap : 0) + heights[item.key]
            if (h < best) {
              best = h
              target = c
            }
          }
        }
        cols[target].push(item)
        colHeights[target] += (heights[item.key] || 0) + (colCounts[target] > 0 ? gap : 0)
        colCounts[target]++
      })
      return cols
    },
    // 实测每张卡片高度，按签名变化才触发重排，保证收敛不循环
    updateLayout() {
      const container = this.$refs.gridContainer
      if (!container) return
      const colEl = container.querySelector('.grid-column')
      this._gap = colEl ? parseFloat(window.getComputedStyle(colEl).rowGap) || 0 : 0
      const heights = {}
      container.querySelectorAll('.grid-item').forEach((el) => {
        if (el.dataset.key) heights[el.dataset.key] = el.offsetHeight
      })
      this._heights = heights
      const sig = this.assignColumns()
        .map((col) => col.map((i) => i.key).join(','))
        .join('|')
      if (sig !== this._signature) {
        this._signature = sig
        this.layoutVersion++
      }
    },
    // 自定义小标题和日期只要有一个就有小标题；都没有时只留分割线
    hasLabel(block) {
      return !!(block && (block.custom || block.date))
    },
    // 一张卡片的全部内容块：每天的正文按空行拆段，每段配一个小标题。
    // 有自定义小标题就是「日期的 + 自定义小标题」，没有则是「日期的作业」，
    // 当天又没有自定义小标题时不出小标题，只留分割线。
    buildBlocks(item) {
      const blocks = []
      for (const segment of item.segments || []) {
        const date = segment.label || ''
        for (const para of this.parseParagraphs(segment.content)) {
          // 只有小标题、没有正文时，小标题降级成普通正文，这里不会出现空块
          if (!para.lines.length) continue
          blocks.push({
            date,
            custom: para.heading,
            name: para.heading || '作业',
            lines: para.lines,
          })
        }
      }
      return blocks
    },
    // 正文按空行分段：一行空行即分割线，连续空行按一段处理；
    // 段落首行形如「# 标题」时，剥掉前缀当作该段的小标题
    parseParagraphs(content) {
      if (content == null) return []
      const blocks = []
      let block = null
      for (const raw of String(content).replace(/\r\n?/g, '\n').split('\n')) {
        if (raw.trim() === '') {
          if (block) {
            blocks.push(block)
            block = null
          }
          continue
        }
        if (!block) block = []
        block.push(raw)
      }
      if (block) blocks.push(block)

      return blocks.map((lines) => {
        const isHeading = lines[0].startsWith('#')
        if (!isHeading) return { heading: '', lines }

        const rest = lines.slice(1)
        // 没有正文就整行当普通正文渲染，连「#」原文一起保留
        if (!rest.length) return { heading: '', lines: [lines[0]] }

        // 核心修改：
        // 1. lines[0].slice(1) 先去掉开头的 '#'
        // 2. .replace(/^ /, '') 再去掉紧接着的第一个空格（如果存在的话）
        const headingText = lines[0].slice(1).replace(/^ /, '')

        return { heading: headingText, lines: rest }
      })
    },
  },
}
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

/* 科目名、小标题、正文三处之间的间距统一取这一个值 */
.hw-card {
  --hw-gap: 6px;
}

/* 标题字号由 contentStyle 绑定，与正文一致 */
.hw-card-title {
  padding: 12px 12px 0;
  line-height: 1.4;
}

/* 上内边距即科目名到首个小标题（或正文）的间距 */
.hw-card-text {
  padding: var(--hw-gap) 12px 12px;
}

/* 小标题：日期 + 自定义小标题（或「的作业」），各处外观一致 */
.segment-label {
  display: flex;
  align-items: baseline;
  min-width: 0;
  font-size: 0.8em;
  line-height: 1.5;
  opacity: 0.6;
  /* 小标题到正文的间距，与科目名到小标题一致 */
  margin-bottom: var(--hw-gap);
}

/* 日期和「的」不压缩，自定义小标题过长时单行省略 */
.label-date,
.label-de {
  flex: 0 0 auto;
  white-space: nowrap;
}

.label-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  /* pre 才能保住小标题里多写的空格，同时保持单行 */
  white-space: pre;
}

/* 内容块之间的分割线：v-divider 靠 opacity: var(--v-border-opacity)（0.12）压暗，
   深色主题下这里调到 0.35，白色更醒目又不过分 */
.hw-divider {
  margin: var(--hw-gap) 0;
  opacity: 0.35;
}

.hw-paragraph {
  display: flex;
  flex-direction: column;
  gap: var(--hw-gap);
}

.hw-line {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  padding: 0;
  margin: 0;
}
</style>
