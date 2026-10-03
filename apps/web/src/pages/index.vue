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
        rounded="pill"
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
        <v-card border rounded="md">
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
        :paused="state.dialogVisible"
        @open-dialog="openDialog"
      />
    </v-container>
  </div>

  <homework-edit-dialog
    v-model="state.dialogVisible"
    :title="currentEditSubject"
    :initial-date="state.dateString"
    @save="handleHomeworkSave"
  />
</template>

<script>
import { defineAsyncComponent } from 'vue'

// 首屏核心组件（同步加载）
import HomeworkGrid from '@/components/home/HomeworkGrid.vue'

const HomeworkEditDialog = defineAsyncComponent({
  loader: () => import('@/components/HomeworkEditDialog.vue'),
  delay: 0,
})
import dataProvider from '@/utils/dataProvider'
import { formatDayName } from '@/utils/date'
import { getSetting, watchSettings, setSetting } from '@/utils/settings'

// 不在科目列表里的科目统一排在这个位置，即所有列表科目之后
const LAST_ORDER = 9998

export default {
  name: 'Classworks 作业板',
  components: {
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
      { name: '其他', order: 9 },
    ]
    return {
      currentEditSubject: null,
      state: {
        boardData: { homework: {} },
        dialogVisible: false,
        dateString: '',
        fontSize: getSetting('font.size'),
        contentStyle: { 'font-size': `${getSetting('font.size')}px` },
        selectedDateObj: new Date(),
        availableSubjects: defaultSubjects,
        // 展示板所看的这一天以外的每一天（后续日期预加载 + 面板里翻到过去的日子），
        // 按日期升序
        otherDays: [],
      },
    }
  },

  created() {
    // 正在写盘的日期，避免同一天并发写
    this.pendingSaves = new Set()
  },

  computed: {
    titleText() {
      return this.dayName(this.state.dateString)
    },
    sortedItems() {
      const items = []
      for (const subject of this.state.availableSubjects) {
        const segments = this.buildSegments(subject.name)
        if (segments.length) {
          items.push({
            key: subject.name,
            name: subject.name,
            order: subject.order,
            segments,
          })
        }
      }
      // 存档里有、科目列表里没有的科目也要显示，排在列表科目之后
      const known = new Set(this.state.availableSubjects.map((s) => s.name))
      for (const name of this.storedSubjectNames()) {
        if (known.has(name)) continue
        const segments = this.buildSegments(name)
        if (segments.length) {
          items.push({ key: name, name, order: LAST_ORDER, segments })
        }
      }
      items.sort((a, b) => a.order - b.order)
      return items
    },

    unusedSubjects() {
      const used = this.storedSubjectNames()
      return this.state.availableSubjects
        .filter((subject) => !used.has(subject.name))
        .sort((a, b) => a.order - b.order)
    },
    // 展示板只呈现「所看的这一天 + 更晚的日子」。
    // 更早的日子只可能是编辑面板里翻回去改的：存了档，但不该在这块板上冒出来。
    laterDays() {
      return this.state.otherDays.filter((day) => day.dateString > this.state.dateString)
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

    // 相对日期名
    dayName(dateString) {
      return formatDayName(dateString)
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
      this.state.selectedDateObj = currentDate
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
      await this.loadOtherDays()
    },

    // 仅当日视图把后面各天的作业一并读出来；查看历史/未来日期时不启用
    async loadOtherDays() {
      const todayStr = this.formatDate(this.getToday())
      if (this.state.dateString !== todayStr) {
        this.state.otherDays = []
        return
      }
      try {
        const res = await dataProvider.loadKeys({ limit: 1000 })
        if (!res || res.success === false || !Array.isArray(res.keys)) {
          this.state.otherDays = []
          return
        }
        const dates = res.keys
          .map((key) => /^classworks-data-(\d{8})$/.exec(key)?.[1])
          .filter((ds) => ds && ds > todayStr)
          .sort()
        const days = []
        for (const ds of dates) {
          const data = await dataProvider.loadData(`classworks-data-${ds}`)
          if (!data || data.success === false) continue
          days.push({ dateString: ds, homework: data.homework || {} })
        }
        this.state.otherDays = days
      } catch (error) {
        console.warn('加载后续日期作业失败:', error)
        this.state.otherDays = []
      }
    },

    // 取某一天的作业表；展示板没读进内存的那天（多半是过去的日子）先从存档读出来，
    // 直接往空对象上写会把那天其他科目的作业抹掉
    async ensureDayHomework(dateString) {
      if (!dateString) return null
      if (dateString === this.state.dateString) return this.state.boardData.homework
      let day = this.state.otherDays.find((d) => d.dateString === dateString)
      if (!day) {
        day = { dateString, homework: {}, pendingCreate: true }
        this.state.otherDays.push(day)
        this.state.otherDays.sort((a, b) => a.dateString.localeCompare(b.dateString))
        await this.loadOtherDay(day)
      }
      return day.homework
    },

    // 把某一天的存档读进缓存；这天本来就没有作业就留空，等于 pendingCreate
    async loadOtherDay(day) {
      try {
        const data = await dataProvider.loadData('classworks-data-' + day.dateString)
        if (!data || data.success === false || Array.isArray(data)) return
        const homework = data.homework || data
        if (homework && typeof homework === 'object') day.homework = homework
      } catch (error) {
        console.warn('读取作业失败:', error)
      }
    },

    // 存档里出现过、且确实有内容的科目（含后续日期）
    storedSubjectNames() {
      const names = new Set()
      const collect = (homework) => {
        for (const [key, data] of Object.entries(homework || {})) {
          if (data?.content?.trim()) names.add(key)
        }
      }
      collect(this.state.boardData.homework)
      for (const day of this.laterDays) collect(day.homework)
      return names
    },

    // 同一科目的作业分块：当日在前，后续日期按日期升序，分隔线由渲染层处理
    // 正文内部用空行分段、用「# 标题」分段，详见 HomeworkGrid 的解析
    buildSegments(subjectName) {
      const segments = []
      const todayData = this.state.boardData.homework[subjectName]
      if (todayData && todayData.content) {
        segments.push({ label: null, content: todayData.content })
      }
      for (const day of this.laterDays) {
        const data = day.homework?.[subjectName]
        if (data && data.content) {
          segments.push({ label: this.dayName(day.dateString), content: data.content })
        }
      }
      return segments
    },

    async saveDayData(dateString = this.state.dateString) {
      // 同一份数据不并发写，重复的保存直接跳过
      if (this.pendingSaves.has(dateString)) return
      let payload = null
      let day = null
      if (dateString === this.state.dateString) {
        payload = this.state.boardData
      } else {
        day = this.state.otherDays.find((d) => d.dateString === dateString)
        // 新建的日期若最终没有任何内容就不落盘
        if (!day || (day.pendingCreate && !Object.keys(day.homework).length)) return
        payload = { homework: day.homework }
      }
      this.pendingSaves.add(dateString)
      try {
        const response = await dataProvider.saveData('classworks-data-' + dateString, payload)
        if (response && response.success === false) throw new Error(response.error.message)
        if (day) day.pendingCreate = false
        // 保存成功不提示，静默保存
      } catch (error) {
        this.$message.error('保存失败', error.message || '请重试')
      } finally {
        this.pendingSaves.delete(dateString)
      }
    },

    async loadSubjects() {
      try {
        const subjectsResponse = await dataProvider.loadData('classworks-config-subject')
        if (subjectsResponse && Array.isArray(subjectsResponse)) {
          this.state.availableSubjects = subjectsResponse
        }
      } catch (error) {
        console.warn('加载科目配置失败:', error)
      }
    },

    // 编辑入口，key 就是科目名；对话框初始停在展示板正在看的那天，可自行前后翻日期
    openDialog(key) {
      this.currentEditSubject = key
      this.state.dialogVisible = true
    },

    // 一次编辑可能改到多天，按各自的日期写回各自的存档
    async handleHomeworkSave(entries) {
      const key = this.currentEditSubject
      if (!key || !Array.isArray(entries)) return
      const touched = []
      for (const { dateString, content } of entries) {
        const homework = await this.ensureDayHomework(dateString)
        if (!homework) continue
        homework[key] = { ...homework[key], content }
        touched.push(dateString)
      }
      for (const dateString of touched) {
        await this.saveDayData(dateString)
      }
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
        this.state.selectedDateObj = selectedDate
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
