<template>
  <v-toolbar class="no-select" color="surface" elevation="4">
    <v-toolbar-title class="text-h6">
      {{ titleText }}的作业
    </v-toolbar-title>

    <v-spacer />

    <template #append>
      <v-btn
        v-if="!isToday"
        prepend-icon="mdi-calendar-today"
        variant="tonal"
        @click="goToday"
      >
        回到今天
      </v-btn>
      <v-btn icon="mdi-chevron-left" variant="text" title="查看昨天" @click="navigateDay(-1)" />
      <v-btn
        icon="mdi-format-font-size-decrease"
        variant="text"
        title="缩小字体"
        @click="zoom('out')"
      />
      <v-btn
        icon="mdi-format-font-size-increase"
        variant="text"
        title="放大字体"
        @click="zoom('up')"
      />
      <v-menu :close-on-content-click="false" location="bottom">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon="mdi-calendar" variant="text" title="选择日期" />
        </template>
        <v-card border rounded="xl">
          <v-date-picker
            :model-value="state.selectedDateObj"
            color="primary"
            @update:model-value="handleDateSelect"
          />
        </v-card>
      </v-menu>
      <v-btn icon="mdi-chevron-right" variant="text" title="查看明天" @click="navigateDay(1)" />
      <v-btn icon="mdi-cog" variant="text" @click="$router.push('/settings')" />
    </template>
  </v-toolbar>

  <div class="d-flex">
    <v-container class="main-window flex-grow-1 no-select bloom-container" fluid>
      <homework-grid
        :sorted-items="sortedItems"
        :unused-subjects="unusedSubjects"
        :content-style="state.contentStyle"
        @open-dialog="openDialog"
      />
    </v-container>
  </div>

  <homework-edit-dialog
    v-model="state.dialogVisible"
    :initial-content="state.textarea"
    :title="state.dialogTitle"
    :current-date-string="state.dateString"
    @save="handleHomeworkSave"
  />

  <v-snackbar v-model="state.snackbar" :timeout="2000">
    {{ state.snackbarText }}
  </v-snackbar>

  <FloatingICP />
  <br /><br /><br />
</template>

<script>
import { defineAsyncComponent } from 'vue'

// 首屏核心组件（同步加载）
import HomeworkGrid from '@/components/home/HomeworkGrid.vue'
import FloatingICP from '@/components/FloatingICP.vue'

const HomeworkEditDialog = defineAsyncComponent({
  loader: () => import('@/components/HomeworkEditDialog.vue'),
  delay: 0,
})
import dataProvider from '@/utils/dataProvider'
import { getSetting, watchSettings, setSetting } from '@/utils/settings'

export default {
  name: 'Classworks 作业板',
  components: {
    FloatingICP,
    HomeworkEditDialog,
    HomeworkGrid,
  },
  data() {
    const defaultSubjects = [
      { name: '语文', order: 0 },
      { name: '数学', order: 1 },
      { name: '英语', order: 2 },
      { name: '物理', order: 3 },
      { name: '化学', order: 4 },
      { name: '生物', order: 5 },
      { name: '政治', order: 6 },
      { name: '历史', order: 7 },
      { name: '地理', order: 8 },
    ]
    return {
      currentEditSubject: null,
      state: {
        boardData: { homework: {} },
        dialogVisible: false,
        dialogTitle: '',
        textarea: '',
        dateString: '',
        snackbar: false,
        snackbarText: '',
        fontSize: getSetting('font.size'),
        contentStyle: { 'font-size': `${getSetting('font.size')}px` },
        selectedDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
        selectedDateObj: new Date(),
        isToday: true,
        availableSubjects: defaultSubjects,
      },
      loading: { saving: false },
      dataReady: false,
    }
  },

  computed: {
    titleText() {
      return this.formatTitleText(this.state.dateString)
    },
    sortedItems() {
      const items = []
      for (const subject of this.state.availableSubjects) {
        const subjectKey = subject.name
        const subjectData = this.state.boardData.homework[subjectKey]
        if (subjectData && subjectData.content) {
          items.push({
            key: subjectKey,
            name: subjectKey,
            type: 'homework',
            content: subjectData.content,
            tags: Array.isArray(subjectData.tags) ? subjectData.tags : [],
            order: subject.order,
          })
        }
      }
      // 其它卡片：可无限添加，一律排在科目作业之下
      for (const key in this.state.boardData.homework) {
        if (key.startsWith('extra-')) {
          const card = this.state.boardData.homework[key]
          if (!card || !card.content) continue
          items.push({
            key,
            name: '其它',
            type: 'homework',
            content: card.content,
            tags: Array.isArray(card.tags) ? card.tags : [],
            order: 9999,
          })
        }
      }
      items.sort((a, b) => a.order - b.order)
      return items
    },
    unusedSubjects() {
      const usedKeys = Object.keys(this.state.boardData.homework).filter((key) =>
        this.state.boardData.homework[key].content?.trim(),
      )
      return this.state.availableSubjects
        .filter((subject) => !usedKeys.includes(subject.name))
        .sort((a, b) => a.order - b.order)
    },
    isToday() {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      return this.state.dateString === `${yyyy}${mm}${dd}`
    },
  },

  async mounted() {
    try {
      await this.initializeData()
      this.dataReady = true
      this.unwatchSettings = watchSettings(() => {
        this.state.fontSize = getSetting('font.size')
        this.state.contentStyle = { 'font-size': `${this.state.fontSize}px` }
      })
    } catch (err) {
      console.error('初始化失败:', err)
      this.showError('初始化失败，请刷新页面重试')
    }
  },

  beforeUnmount() {
    if (this.unwatchSettings) this.unwatchSettings()
  },

  methods: {
    ensureDate(dateInput) {
      if (dateInput instanceof Date) return dateInput
      if (typeof dateInput === 'string') {
        const date = new Date(dateInput)
        if (!isNaN(date.getTime())) return date
      }
      return new Date()
    },
    formatDate(dateInput) {
      const date = this.ensureDate(dateInput)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    },
    getToday() {
      return new Date()
    },

    // 标题日期格式化：今天 / 昨天 / 明天 / 前天 / 后天 /
    // 本周X / 上周X / 下周X / M月D日（星期X）
    formatTitleText(dateString) {
      const weekdaysShort = ['日', '一', '二', '三', '四', '五', '六']
      const weekdaysLong = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
      const target = new Date(
        Number(dateString.slice(0, 4)),
        Number(dateString.slice(4, 6)) - 1,
        Number(dateString.slice(6, 8)),
      )
      if (isNaN(target.getTime())) return ''
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const dayMs = 86400000
      const diff = Math.round((target - today) / dayMs)
      if (diff === 0) return '今天'
      if (diff === -1) return '昨天'
      if (diff === 1) return '明天'
      if (diff === -2) return '前天'
      if (diff === 2) return '后天'

      // 按周一为周首计算所在周偏移
      const mondayStart = (dt) => {
        const t = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
        t.setDate(t.getDate() - ((t.getDay() + 6) % 7))
        return t
      }
      const weekOffset = Math.round((mondayStart(target) - mondayStart(today)) / (7 * dayMs))
      const short = weekdaysShort[target.getDay()]
      if (weekOffset === 0) return `本周${short}`
      if (weekOffset === 1) return `下周${short}`
      if (weekOffset === -1) return `上周${short}`

      const long = weekdaysLong[target.getDay()]
      return `${target.getMonth() + 1}月${target.getDate()}日（${long}）`
    },

    async initializeData() {
      const urlParams = new URLSearchParams(window.location.search)
      const dateFromUrl = urlParams.get('date')
      const today = this.getToday()
      let currentDate = today
      if (dateFromUrl) {
        if (/^\d{8}$/.test(dateFromUrl)) {
          const year = dateFromUrl.substring(0, 4)
          const month = dateFromUrl.substring(4, 6)
          const day = dateFromUrl.substring(6, 8)
          currentDate = new Date(`${year}-${month}-${day}`)
        } else {
          currentDate = new Date(dateFromUrl)
        }
        if (isNaN(currentDate.getTime())) currentDate = today
      }
      this.state.dateString = this.formatDate(currentDate)
      this.state.selectedDate = this.state.dateString
      this.state.selectedDateObj = currentDate
      this.state.isToday = this.formatDate(currentDate) === this.formatDate(today)
      await Promise.all([this.loadDayData(), this.loadSubjects()])
    },

    async loadDayData() {
      const response = await dataProvider.loadData('classworks-data-' + this.state.dateString)
      if (response && response.success === false) {
        this.state.boardData = { homework: {} }
      } else {
        this.state.boardData = {
          homework: response.homework || response || {},
        }
        if (Array.isArray(response)) {
          this.state.boardData = { homework: {} }
        }
      }
    },

    async saveDayData() {
      if (this.loading.saving) return
      try {
        this.loading.saving = true
        const response = await dataProvider.saveData(
          'classworks-data-' + this.state.dateString,
          this.state.boardData,
        )
        if (response && response.success === false) throw new Error(response.error.message)
        // 保存成功不提示，静默保存
      } catch (error) {
        this.$message.error('保存失败', error.message || '请重试')
      } finally {
        this.loading.saving = false
      }
    },

    async loadSubjects() {
      try {
        const subjectsResponse = await dataProvider.loadData('classworks-config-subject')
        if (subjectsResponse && Array.isArray(subjectsResponse)) {
          // 其它/其他不是科目，过滤掉（作为可无限添加的附加卡片）
          this.state.availableSubjects = subjectsResponse.filter(
            (s) => s.name !== '其它' && s.name !== '其他',
          )
        }
      } catch (error) {
        console.warn('加载科目配置失败:', error)
      }
    },

    async openDialog(key) {
      // 其它：每次新建一张独立卡片
      if (key === '其它') {
        this.currentEditSubject = `extra-${Date.now()}`
        this.state.dialogTitle = '其它'
        this.state.textarea = ''
        this.state.dialogVisible = true
        return
      }
      // 编辑已有的其它卡片
      if (key.startsWith('extra-') && this.state.boardData.homework[key]) {
        this.currentEditSubject = key
        this.state.dialogTitle = '其它'
        this.state.textarea = this.state.boardData.homework[key].content || ''
        this.state.dialogVisible = true
        return
      }
      this.currentEditSubject = key
      if (!this.state.boardData.homework[key]) {
        this.state.boardData.homework[key] = { content: '' }
      }
      this.state.dialogTitle =
        this.state.availableSubjects.find((s) => s.name === key)?.name || key
      this.state.textarea = this.state.boardData.homework[key].content || ''
      this.state.dialogVisible = true
    },

    async handleHomeworkSave(content) {
      if (!this.currentEditSubject) return
      // 其它卡片内容为空则直接删除该卡片
      if (!content && this.currentEditSubject.startsWith('extra-')) {
        delete this.state.boardData.homework[this.currentEditSubject]
      } else {
        this.state.boardData.homework[this.currentEditSubject] = {
          ...this.state.boardData.homework[this.currentEditSubject],
          content,
        }
      }
      // 一律自动保存
      await this.saveDayData()
    },

    showMessage(title, content = '', type = 'success') {
      this.$message[type](title, content)
    },
    showError(title, content = '') {
      this.$message.error(title, content)
    },

    zoom(direction) {
      const step = 2
      if (direction === 'up' && this.state.fontSize < 100) this.state.fontSize += step
      else if (direction === 'out' && this.state.fontSize > 16) this.state.fontSize -= step
      this.state.contentStyle = { 'font-size': `${this.state.fontSize}px` }
      setSetting('font.size', this.state.fontSize)
    },

    async handleDateSelect(newDate) {
      if (!newDate) return
      try {
        const selectedDate = this.ensureDate(newDate)
        const dateStr = this.formatDate(selectedDate)
        if (dateStr === this.state.dateString) return
        this.state.dateString = dateStr
        this.state.selectedDate = dateStr
        this.state.selectedDateObj = selectedDate
        this.state.isToday = dateStr === this.formatDate(this.getToday())
        await Promise.all([this.loadDayData(), this.loadSubjects()])
      } catch (error) {
        console.error('日期处理错误:', error)
        this.$message.error('日期处理错误', '请重新选择日期')
      }
    },

    navigateDay(offset) {
      const currentDate = new Date(this.state.selectedDateObj)
      currentDate.setDate(currentDate.getDate() + offset)
      this.handleDateSelect(currentDate)
    },

    goToday() {
      this.handleDateSelect(this.getToday())
    },
  },
}
</script>
