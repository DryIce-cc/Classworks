// 科目清单的默认取值与规整。
// 默认清单原先在 pages/index.vue 与 SubjectManagementCard.vue 各抄了一份，
// 科目带上附加属性后两份很容易走偏，统一放这里。

// 附加属性：
// - multiHomework：启用多份作业。展示板底部常驻一张「继续添加作业」卡片，
//   从它进来时正文末尾留两个空行，好和已有内容隔开另起一份。
// - extraSubjects：附加科目名称。可以把作业记到本卡片下的附加科目里，
//   写法就是正文里的一行「# 附加科目名的作业」。
export const DEFAULT_SUBJECTS = [
  { name: '语文', order: 0 },
  { name: '数学', order: 1 },
  { name: '英语', order: 2 },
  { name: '物理', order: 3 },
  { name: '化学', order: 4 },
  { name: '生物', order: 5 },
  { name: '政治', order: 6, extraSubjects: ['历史合格作业'] },
  { name: '历史', order: 7, extraSubjects: ['政治合格作业'] },
  { name: '地理', order: 8 },
  { name: '其他', order: 9, extraSubjects: ['通知'], multiHomework: true },
]

// 规整单个科目：补齐附加属性，附加科目名去空白、去空串、去重。
// 存档里的科目可能来自旧版本配置，字段缺失一律按默认值补上
export function normalizeSubject(subject, index = 0) {
  const extra = Array.isArray(subject?.extraSubjects) ? subject.extraSubjects : []
  return {
    name: subject?.name ?? '',
    order: subject?.order ?? index,
    multiHomework: !!subject?.multiHomework,
    extraSubjects: [...new Set(extra.map((n) => String(n).trim()).filter(Boolean))],
  }
}

// 规整整份科目配置并按 order 排序。返回全新对象，调用方改哪都不会污染这份默认值
export function normalizeSubjects(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((subject, index) => normalizeSubject(subject, index))
    .sort((a, b) => a.order - b.order)
}

// 一份互不影响的默认科目清单
export function cloneDefaultSubjects() {
  return normalizeSubjects(DEFAULT_SUBJECTS)
}
