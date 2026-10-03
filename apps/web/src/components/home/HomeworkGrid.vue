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
            class="hw-card"
            :class="item.editKey ? 'cursor-pointer' : ''"
            height="100%"
            rounded="md"
            @click="onCardClick(item)"
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

    <!-- 空科目 + 常驻的「其他」入口 -->
    <div class="empty-subjects mt-4">
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
          <v-card
            border
            rounded="md"
            class="empty-subject-card"
            @click="$emit('open-dialog', '其他')"
          >
            <v-card-title class="text-subtitle-1"> 其他 </v-card-title>
            <v-card-text class="text-center">
              <v-icon color="grey" size="small"> mdi-plus </v-icon>
              <div class="text-caption text-grey">点击添加其他</div>
            </v-card-text>
          </v-card>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeworkGrid',
  props: {
    sortedItems: { type: Array, required: true },
    unusedSubjects: { type: Array, required: true },
    contentStyle: { type: Object, default: () => ({}) },
  },
  emits: ['open-dialog'],
  data() {
    return {
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1200,
      // 布局版本号：分列结果变化时才 +1，避免量高度触发无限重渲染
      layoutVersion: 0,
    }
  },
  created() {
    // 实测的卡片高度（非响应式，靠 layoutVersion 触发重算）
    this._heights = {}
    this._gap = 0
    this._signature = ''
  },
  computed: {
    // 宽度档位对应的最大列数
    maxColumnsByWidth() {
      if (this.viewportWidth < 800) return 1
      if (this.viewportWidth < 1200) return 2
      return 3
    },
    // 卡片少时收缩列数，让卡片铺满可用宽度
    effectiveColumns() {
      const count = this.sortedItems ? this.sortedItems.length : 0
      if (count <= 0) return 1
      return Math.max(1, Math.min(count, this.maxColumnsByWidth))
    },
    // 渲染用的分列结果（透传方法，保证每次拿到的都是现算的）
    columnItems() {
      // 显式依赖版本号，有新测量结果时才重算
      void this.layoutVersion
      return this.assignColumns()
    },
  },
  mounted() {
    this.updateViewportWidth()
    window.addEventListener('resize', this.handleResize)
    // 首屏同步量一次（此时 DOM 已就绪、通常还未绘制），避免先闪一下再重排
    this.updateLayout()
    // 字体后加载会改变卡片高度，加载完再平衡一次
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => this.updateLayout())
    }
  },
  updated() {
    this.$nextTick(() => {
      this.updateLayout()
    })
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize)
  },
  methods: {
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
    updateViewportWidth() {
      this.viewportWidth = window.innerWidth
    },
    handleResize() {
      // 宽度变化会改变卡片宽度从而改变高度；断点变化会走 updated，断点内变化走这里
      this.updateViewportWidth()
      this.updateLayout()
    },
    // 实测每张卡片高度，按签名变化才触发重排，保证收敛不循环
    updateLayout() {
      const container = this.$refs.gridContainer
      if (!container) return
      const colEl = container.querySelector('.grid-column')
      const gap = colEl ? parseFloat(window.getComputedStyle(colEl).rowGap) || 0 : 0
      this._gap = gap
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
    onCardClick(item) {
      if (item.editKey) this.$emit('open-dialog', item.editKey)
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
        const isHeading = lines[0].startsWith('# ')
        if (!isHeading) return { heading: '', lines }
        // 「# 」后面多写的空格按原样保留：# 你好 / #  你好 / #   你好 -> 你好 /  你好 /   你好
        const rest = lines.slice(1)
        // 没有正文就整行当普通正文渲染，连「#」原文一起保留
        if (!rest.length) return { heading: '', lines: [lines[0]] }
        return { heading: lines[0].slice(2), lines: rest }
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