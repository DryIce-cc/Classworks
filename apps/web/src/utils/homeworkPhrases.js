// 作业面板的词表，以及「这一行现在该给哪一层、该给哪几个键」。
//
// 面板分三层，一次只显示当前这一层，哪一层完全由光标所在这一行的内容推出来，
// 不另记状态——空行、只有标点的行就是起手层，所以光标落到空行上自动回到起点，
// 换行也不用手动重置，永远不会和正文对不上：
//
//   起手层  订正 / 卷（卷子、练习卷、周末卷）/ 本（小白、作业册、练习册、课本）
//   自动建议的最后一层  只要这一行有汉字或字母就来，且不区分是卷是本还是默写：
//           第一行正反面，第二行怎么收尾，第三行预定。固定四行，高度不变，
//           写字时编辑框不会被顶得上下跳
//   小标题层  光标停在 # 开头那一行上，只有「作为…的作业」那一栏，
//           点一下改的是这个标题的目标日期
//
// 预定那一行点一下会写出一个标题行「#明天的作业」，它下面几行
// 在完成编辑或者翻日期的时候一起搬到那天去。
//
// 数字和量词介词不在面板上，放在小键盘底下。面板只往正文里加字：
// 不加空格，也不改字。要空格按小键盘的空格，点错了按小键盘的删除往回删。

import { formatDayName, parseDateString, shiftDateString } from './date'

// 任务、载体、量词三组词表。任务单独一行是因为点完它还有的下一步；
// 「完成」不在这里：写完了这一条，面板自己认（见 onlyDone）
const TASKS = ['订正']

// 订正按下后、还没说是哪本之前，第一行换成这一堆
const RECITE = ['默写', '早读默写', '课前默写']

// 卷和本：卷补正反面，本补页码或范围。面板已经不再区分了，这两个数组
// 只在「订正刚落下、还没说是哪种」那一阵用来分辨，所以摆在一行
const PAPERS = ['卷子', '练习卷', '周末卷']
const BOOKS = ['小白', '作业册', '练习册', '课本']

// 小键盘底下那排量词。刚敲完一个数字才需要它们，平时收起来（见 hints）
export const BOTTOM_KEYS = ['页', '张', '题', '课', '章']

// 自动建议最后一页的第一行
const CONTENT_ROW = ['正面', '反面']

// 收尾建议。词上不带逗号：逗号由这一行的 comma 标记来补（见 panelRows 与 insertWord）
const SUGGEST_WORDS = ['自行完成', '明天上课对答案', '核对群里或板报的答案']

// 这一行剩下的中英文字：数字、标点、空格、前后缀全摘掉。
// 中文标点不算内容，「订正，默写」和「订正默写」要一样看待；
// 「1. 完成」摘完是「完成」，面板看来它和光打一个「完成」是同一件事；
// 「小蓝p30~35」摘完是「小蓝p」
function lettersOnly(line) {
  return line.replace(/[^\p{Script=Han}a-zA-Z]/gu, '')
}

// 除了「完成」这两个字，这一行没有别的中英文字了。
// 这时面板回起手那一页：这一条齐了，接着写下一条（订正 / 卷 / 本）
function onlyDone(line) {
  return lettersOnly(line) === '完成'
}

// 小键盘上那两个格子，按光标前面停在哪动态换内容。空串表示这一次不给东西，
// 那一个格子就空着（渲染层用 visibility 留着位置）：
//   小白               → P  第   该起头了，两个前缀都能用
//   p / 第 / 13~ / 13- → 空  空   前缀或者连接符刚敲出来，接下来该敲数字，别再催
//   29                 → ~  .    光秃秃一个数字，多半是接着补范围
//   p29                → ~  第   页码到头了，补范围或者改成第几题
//   p13 15 / p13 15 17 → ~  第   多页接着往下写，收尾或者改成第几题
//   第29               → ~  .    题号到头了，补范围或者改写成第几页
//   p13~15 / p13-15    → 空  第   区间写完了，该说它是第几题
// 末尾的空格先忽略掉，「p13-15 」和「p13-15」要给出同一组
export function contextKeys(before) {
  const text = before.replace(/[ 　]+$/, '')
  // 前缀或者区间的连接符刚敲出来，后面该敲数字：这两个格子让开
  if (/[第pP~-]$/.test(text)) return ['', '']
  const digits = /(\d+)$/.exec(text)
  if (!digits) return ['P', '第']
  const head = text.slice(0, text.length - digits[1].length)
  if (/第$/.test(head)) return ['~', '.']
  if (/[pP]$/.test(head)) return ['~', '第']
  // p13~15、p13-15：区间已经写完了
  if (/[~-]$/.test(head)) return ['', '第']
  // p13 15、p13 15 17：数字前面是空格、而空格前面也是数字，多页接着写
  if (/\d$/.test(head.replace(/[ 　]+$/, ''))) return ['~', '第']
  return ['~', '.']
}

// 小键盘底下那排量词该不该出现，只看紧挨着光标的那一个字：是个阿拉伯数字就该出现。
// 「13」「13~25」「第13」「p29」都算——页码后面也跟量词（页、题），
// 所以不再往前捋着排除 p/P。全角数字不算
export function hints(before) {
  return /\d$/.test(before)
}

const has = (line, words) => words.some((word) => line.includes(word))

// 词按「行末」认，不是按整行——前面已经打过序号、掺了别的字，都不该认不出来。
// 「订正」和「1. 订正」要一样。行末的空格不算词的一部分
const lineTail = (line) => line.replace(/[ 　]+$/, '')

// 这一行末尾是哪个任务词
function taskOf(line) {
  const text = lineTail(line)
  return TASKS.find((task) => text.endsWith(task)) || ''
}

// 「订正」和「默写」都在才算默写那一档。只有「默写」两个字可能只是
// 别的句子里的一个词，不该当成一条完整的作业
function isRecite(line) {
  return line.includes('订正') && line.includes('默写')
}

// 订正按下之后、还没说是默写还是哪本之前。这期间第一行摆默写那一堆
function recitePending(line) {
  if (taskOf(line) !== '订正') return false
  return !isRecite(line) && !has(line, [...PAPERS, ...BOOKS])
}

// 这一行有没有真内容：有汉字或者字母就算，标点、数字都不算。
// 「小蓝p30~35」「完成小蓝」「mq」都算——词库认不认得先不管，有内容就能给建议
export function hasContent(line) {
  return lettersOnly(line) !== ''
}

// 面板三层，认不出来的时候给回起手那一层：那时候摊一屏用不上的按钮只会干扰他。
//   'pick'    起手那一层（首页）：订正 / 卷 / 本
//   'autoLast' 自动建议的最后一层：正反面、怎么收尾、预定
//   'hash'    小标题那一层：光标停在 # 标题行上，只有日期那一栏
function phaseOf(line) {
  if (isHeadingLine(line)) return 'hash'
  // 空行、只有标点的行：没什么可建议的
  if (!hasContent(line)) return 'pick'
  // 整行就写了「完成」：这一条齐了，回首页去接着写下一条。
  // 只写了完成、没写别的才这么办——「完成小白」「订正默写完成」都还在最后一页，
  // 那边的收尾建议和预定照旧给
  if (onlyDone(line)) return 'pick'
  // 「订正」刚落下、还没说是默写还是哪本，得留在起手那一层，
  // 不然默写那几个按钮就没处摆了
  if (recitePending(line)) return 'pick'
  return 'autoLast'
}

// 位置 pos 所在的那一行，正被哪个小标题管着，返回那个标题行的起始位置。
// 空行断开归属，所以一个标题只管到它下面第一个空行为止；上面没有就返回 -1。
// 要改这个标题的时候得知道它在哪儿，所以这里给位置，headingAbove 拿它取文字
export function headingAboveStart(content, pos) {
  const { lines, starts } = splitLines(content)
  // pos 正好落在行首时不算这一行（那是「上面」的位置），所以先退一格
  let index = lineIndexAt(starts, pos)
  if (starts[index] >= pos) index--
  for (; index >= 0; index--) {
    if (lines[index].trim() === '') return -1
    if (isHeadingLine(lines[index])) return starts[index]
  }
  return -1
}

// 位置 pos 所在的那一行，正被哪个小标题管着。空行断开归属，
// 所以一个标题只管到它下面第一个空行为止；没有就返回空串
export function headingAbove(content, pos) {
  const start = headingAboveStart(content, pos)
  if (start < 0) return ''
  const end = content.indexOf('\n', start)
  return content.slice(start, end < 0 ? content.length : end)
}

// 这一片正文归哪个小标题管着。落点正好在小标题那一行上时就是它自己——
// headingAbove 只管严格往上找，落在标题上会当成「上面没有」
export function ownerAt(content, pos) {
  const end = content.indexOf('\n', pos)
  const line = content.slice(pos, end < 0 ? content.length : end)
  return isHeadingLine(line) ? line : headingAbove(content, pos)
}

// 标题名（「# 明天的通知」里的「通知」）从第几个字开始。
// 改完标题要把光标放回名字原来的相对位置，靠这个对齐——
// 用户在名字前面就还留在前面，接着写名字不用再手动挪回去
export function headingTitleStart(line) {
  const matched = new RegExp(
    '^[ \\t]*#[ \\t]?(?:' + DAY_PATTERN + DAY_TAIL + ')?',
  ).exec(line)
  return matched ? matched[0].length : line.length
}

// 每一行的起始位置
function lineStarts(lines) {
  const starts = []
  let at = 0
  for (const line of lines) {
    starts.push(at)
    at += line.length + 1
  }
  return starts
}

// 把正文切成行，同时记下每一行的起始位置。行号 ↔ 字符位置 的换算全都走这个结构——
// 别再让每个函数各自累加一遍偏移，那样同一个含义会有三四种写法，改一处漏两处
function splitLines(content) {
  const lines = content.split('\n')
  return { lines, starts: lineStarts(lines) }
}

// 位置 pos 落在第几行（0 起）。行尾那个换行算它自己那一行，所以「甲」占 0-1、
// 位置 2 既是甲的行尾也是乙的行首，取「最后一个起点不超过 pos 的那行」两者不会打架。
// pos 落在正文之前（调用方拿「最后一个被选中的字符」算，选区为空时就是 -1）时取最后一行
function lineIndexAt(starts, pos) {
  if (pos < 0) return starts.length - 1
  let index = 0
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] > pos) break
    index = i
  }
  return index
}

// 位置 pos 所在的那一行：行首、行尾（不含换行）、行号。
// 光标停在行尾那个换行上时，算它自己那一行
export function lineAt(content, pos) {
  const { lines, starts } = splitLines(content)
  const index = lineIndexAt(starts, pos)
  const start = starts[index]
  return { text: lines[index], start, end: start + lines[index].length, index }
}

// 归属范围里的「正文行」：既不是空行也不是标题行。空行断开归属、标题行属于另一节，
// 这两种都是边界，其余的都归它上面最近的那个小标题。全文件的归属判断都走这一个定义
function isBodyLine(line) {
  return line.trim() !== '' && !isHeadingLine(line)
}

// 从 from 往后扫到空行或下一个标题行为止，返回那一行的行号（扫到底就是数组长度）。
// 「这一节管到哪儿」全靠它
function sectionEnd(lines, from) {
  let end = from
  while (end < lines.length && isBodyLine(lines[end])) end++
  return end
}

// 那天已有正文里，最后一个同名小标题那一节的末尾（行号）。
// 比的是节名而不是预定解析的结果：那边写「#通知」、这边搬过来的是
// 「#明天的通知」，节名都是「通知」，得接进同一节去。
// 没有同名的小标题返回 -1
function endOfNamedSection(day, heading) {
  for (let index = day.length - 1; index >= 0; index--) {
    if (!isHeadingLine(day[index]) || scopeTitle(day[index]) !== heading) continue
    return sectionEnd(day, index + 1)
  }
  return -1
}

// 那天已有正文里，最后一个「不受小标题管着」的段落末尾（行号）。
// 段落是一串连续的非空行；紧跟在标题行后面那一段算标题的，不算。
// 整篇都被小标题管着就返回 -1
function endOfFreeParagraph(day) {
  let end = -1
  let start = 0
  for (let index = 0; index <= day.length; index++) {
    const atEnd = index === day.length
    if (!atEnd && isBodyLine(day[index])) continue
    if (index > start && !isHeadingLine(day[start - 1])) end = index
    start = index + 1
  }
  return end
}

// 把一段正文插进那天已有的正文里，插在哪：
//   有小标题 → 接在最后一个同名小标题那一节的最后。同名的一个都没有才新起一节。
//   没小标题 → 接在最后一个不受小标题管着的段落最后。这种段落一个都没有才接全文最后。
// 空行统一交给 tidyBlankLines 理，这里只管插在哪。返回新数组，不改动接进去的那个
function spliceIntoDay(day, heading, lines) {
  const at = heading ? endOfNamedSection(day, heading) : endOfFreeParagraph(day)
  if (at < 0) {
    return [...day, '', ...(heading ? [`#${heading}`] : []), ...lines]
  }
  return [...day.slice(0, at), ...lines, ...day.slice(at)]
}

// 把若干块预定内容接到那天已有正文后面，返回新正文。
// 落进草稿（settleReservations）和拼进预览（buildPreviewPayload）用的是同一个函数，
// 两边算出来的必须一致，否则展示板上看到的和最后存下来的不是一回事。
// spliceIntoDay 返回的是新数组（不改动它接进去的那个），所以这里必须接住返回值
export function assembleDayContent(existing, blocks) {
  let lines = existing.trim().split('\n')
  for (const block of blocks) lines = spliceIntoDay(lines, block.heading, block.lines)
  return lines.join('\n')
}

// 那一节的名字，也就是「作为…的 xx」里那个 xx：
//   # 明天的通知 → 通知     #明天的作业 → 作业     #通知 → 通知
// 挑不出名字就退回「作业」——「#明天的」这种只有日期没名字的，
// 「#明天的作业」解析出来 heading 是空的（它就是普通预定），
// 但当作用域看它就是「作业」这一节
function scopeTitle(scope) {
  const parsed = parseReserveLine(scope)
  if (parsed) return parsed.heading || '作业'
  return scope.replace(/^[ \t]*#[ \t]?/, '').trim()
}

// 「作为…的 xx」那一栏。两个页面共用这一个栏：按钮的意思都是「挪到哪天」，
// 所以按钮和样式完全一样；只有「的 xx」跟着光标所在的那一节走。
// lit 传了就用它（选区那一页自己算），没传就按这一节的目标日期算
function reserveRow(today, currentDate, scope, lit) {
  const title = scope ? scopeTitle(scope) : ''
  const chips = headingDayEntries(today)
  // 点亮的是这一节的目标日期；这一节没写日期就点当前正在编辑的那天——
  // 正在编辑 10 月 10 号，就亮 10 月 10 号那个按钮，不是「今天」。
  // 按日期比不按字比：「#周三的通知」该亮的是写着「下周二」那个。
  // 那天不在这五个按钮里就一个都不亮
  const target = resolveReserveDay(scope ? parseReserveLine(scope)?.word : '', today) || currentDate
  return {
    prefix: '作为',
    groups: [chips],
    suffix: title ? `的${title}` : '的作业',
    reserve: true,
    lit: lit ?? (chips.some((chip) => chip.date === target) ? [target] : []),
  }
}

// 面板固定四行，哪一层都正好四行，空着的位置也留着，高度才不会变来变去。
// 起手层是 订正 / 卷 / 本 / 空；最后一层是 内容 / 收尾建议 / 预定 / 空；
// 小标题层和选区层都只有 预定 / 空（点下去的后果不一样，但控件是同一个）
export function panelRows(line, today, scope, currentDate, selection) {
  if (selection) {
    // 点亮选区里那些标题解出来的那天——不是同一天就退回正在编辑的那天，
    // 跟小标题那一层同一条规则，不是一个都不点
    return [
      { groups: [] },
      { groups: [] },
      reserveRow(today, currentDate, '', [selection.day || currentDate]),
      { groups: [] },
    ]
  }
  const phase = phaseOf(line)
  if (phase === 'hash') {
    return [
      { groups: [] },
      { groups: [] },
      reserveRow(today, currentDate, scope || line),
      { groups: [] },
    ]
  }
  if (phase !== 'autoLast') {
    return [
      { groups: [recitePending(line) ? RECITE : TASKS] },
      { groups: [PAPERS] },
      { groups: [BOOKS] },
      { groups: [] },
    ]
  }
  // 最后一页不再分书/卷/默写——认得出是哪种反而让同一件事在不同行上长得不一样，
  // 按之前还得先想一遍这是哪一类
  return [
    // 第一行永远是正反面：不管这一行是订正、默写还是写着「完成」，都还能接着补内容
    { groups: [CONTENT_ROW] },
    // 收尾建议要接在已有内容后面，所以带 comma 标记：按下时先补一个逗号再写词。
    // 用户自己已经打了逗号、或者已经在接着写这个词，就只补剩下的（见 insertWord）
    hasContent(line) ? { groups: [SUGGEST_WORDS], comma: true } : { groups: [] },
    reserveRow(today, currentDate, scope),
    { groups: [] },
  ]
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 日期字符串取周几
function weekdayOf(dateString) {
  const day = parseDateString(dateString)?.getDay()
  return Number.isInteger(day) ? WEEKDAYS[day] : ''
}

const DAY_PATTERN = '(今天|明天|后天|下?周[日一二三四五六])'

// 日子词后面可以跟的那一串，两个都可有可无，所以下面几种算同一天：
//   #明天  #明天的  #明天：  #明天的：  #明天的通知
// 解析标记和点编辑日去掉日期都用这一段。
// 「的」在这里是「这天的那份xx」的语气助词，摘的时候要跟着走
const DAY_TAIL = '[ 　]?的?[ 　]?[：:]?[ 　]?'

// 复制一个小标题时用的：只摘日子词和「：」，「的」留着——
// 「#明天的通知」复制出来是「#后天的通知」，把「的」也摘了就成了「#后天通知」
const DAY_ONLY = DAY_PATTERN + '[ 　]?[：:]?[ 　]?'

// 预定标记行：#明天的作业。写法和小标题一样，所以标出来的那行在当天看着
// 就是个标题，直到完成编辑/翻日期那一刻才连着下面几行一起搬走。
// 自己插进去的一律不带空格——用户手敲的带空格照样认
export function reserveLine(day) {
  return `#${day}的作业`
}

// 复制一个小标题并把日子换成目标那天（# 通知 → # 明天的通知）。
// 复制的是用户写的标题，他 # 后面留的那个空格原样带着走
export function retargetHeading(line, word) {
  const matched = /^([ \t]*#[ \t]?)(.*)$/.exec(line)
  if (!matched) return ''
  const prefix = matched[1]
  const rest = matched[2]
  const title = rest.replace(new RegExp('^' + DAY_ONLY), '')
  return title === rest ? prefix + word + '的' + rest : prefix + word + title
}

// 改一个小标题自己的目标日期（光标就停在这个标题行上，或者它下面只有一行正文）。
// 「#明天」「#下周一：」这种没有标题的也得认，不然改完会变成「#后天的明天」。
// strip 为真——点的是正在编辑的那天——就把日期信息摘掉，不是来回切：
// 已经写着日期的摘掉，本来就没有的什么都不发生；否则加上/换成 word 那一天。
// 永远不补「：」——用户没写过的标点不替他加
export function retargetDayHeading(line, word, strip) {
  const matched = /^([ \t]*#[ \t]?)(.*)$/.exec(line)
  if (!matched) return line
  if (!strip) return retargetHeading(line, word)
  const title = matched[2].replace(new RegExp('^' + DAY_PATTERN + DAY_TAIL), '')
  return title === matched[2] ? line : matched[1] + title
}

// 光标在「#今天的作业」这种行上、点了正在编辑的那天：这一节本来就不是真标题，
// 没有目标日期就该整行删掉，正文并到上面那一节。
// 只是没写名字的（#明天的、#今天的）不算——那只是把日期摘掉，
// # 得留着，不能连带标题一起没了
const PLAIN_RESERVE = new RegExp(
  '^[ \\t]*#[ 　]?' + DAY_PATTERN + '[ 　]?的?[ 　]?[：:]?[ 　]*作业[：:]?[ \\t]*$',
)

// 小标题下面只有一行正文时，选了日期不去新开一节，直接改这个标题。
// 返回空串表示这一行整个删掉
export function retargetScopeHeading(line, word, strip) {
  if (strip && PLAIN_RESERVE.test(line)) return ''
  return retargetDayHeading(line, word, strip)
}

// 落在 [start, end) 这个范围里的那些 # 行，起始位置各是多少。
// 只认整行都在范围里的 # 行——正文行不管，它自己不变，
// 它上面那个标题哪怕不在选区里也不动（用户只选了正文，就别去改标题）
export function selectionHeadings(content, start, end) {
  const { lines, starts } = splitLines(content)
  const found = []
  for (let index = 0; index < lines.length; index++) {
    if (isHeadingLine(lines[index]) && starts[index] >= start && starts[index] + lines[index].length <= end) {
      found.push(starts[index])
    }
  }
  return found
}

// 选区那些行归的是不是同一天，是同一天就返回那天，不是就返回空串。
// 看两处：选区里的 # 行自己解出来的日子，和选区里那些正文行各自归着的
// 小标题解出来的日子——「选中 #明天的作业 下面的 e、r」虽然一个 # 行都没选中，
// 该亮的仍是明天。两处合起来都只有同一天才算；一个都没有就返回空串，
// 交给上层退回「正在编辑的那天」
export function commonDayInSelection(content, start, end, today) {
  const { lines, starts } = splitLines(content)
  const days = new Set()
  const dayOf = (from) => {
    const nl = content.indexOf('\n', from)
    const parsed = parseReserveLine(content.slice(from, nl < 0 ? content.length : nl))
    const date = resolveReserveDay(parsed?.word, today)
    if (date) days.add(date)
  }

  for (const at of selectionHeadings(content, start, end)) dayOf(at)
  // 正文行各自归着哪个标题，从选区第一行往上问一次就够，然后在选区里顺着往下带，
  // 不用每行都回头重找一遍
  const first = lineIndexAt(starts, start)
  const last = lineIndexAt(starts, end - 1)
  let owner = headingAboveStart(content, starts[first])
  for (let index = first; index <= last; index++) {
    // 标题行自己不当正文算，它只成为下面那些行的归属
    if (isHeadingLine(lines[index])) {
      owner = starts[index]
      continue
    }
    if (owner >= 0) dayOf(owner)
    // 空行只断开它下面那些行的归属，它自己仍归上面那一节
    if (lines[index].trim() === '') owner = -1
  }
  return days.size === 1 ? [...days][0] : ''
}

// 点的是正在编辑的那天：光标这一行本来就是当天的作业，不用挂任何标记，
// 只要把它从「归别人那天的那一节」里摘出来——上下补空行，
// 别被上面那个小标题顺手收走。行本身留在原地不删。
// 返回新正文，和这一行改完之后的位置（放光标用）
export function detachLineFromScope(content, lineStart) {
  const { lines, starts } = splitLines(content)
  const index = lineIndexAt(starts, lineStart)
  const above = lines[index - 1] ?? ''
  const below = lines[index + 1] ?? ''
  const needAbove = isBodyLine(above)
  const needBelow = isBodyLine(below)
  const out = [
    ...lines.slice(0, index),
    ...(needAbove ? [''] : []),
    lines[index],
    ...(needBelow ? [''] : []),
    ...lines.slice(index + 1),
  ]
  // 行号没变，但前面可能插了一个空行，位置得重算
  const caretAt = lineStarts(out)[index + (needAbove ? 1 : 0)]
  return { text: tidyBlankLines(out.join('\n')), caretAt }
}

// 选区跨的那几行，按空行和 # 行切成若干段。段与段之间的空行不算进任何一段
function splitIntoBlocks(lines, first, last) {
  const blocks = []
  for (let index = first; index <= last; ) {
    // 段落之间的空行不属于任何一段，跳过（不跳的话 index 不前进，死循环）
    if (lines[index].trim() === '') {
      index++
      continue
    }
    const begin = index
    const headed = isHeadingLine(lines[index])
    if (headed) index++
    while (index <= last && isBodyLine(lines[index])) index++
    blocks.push({ begin, end: index - 1, headed })
  }
  return blocks
}

// 把 [start, end) 按空行和 # 行切成若干段，逐段改。跨空行选中的时候一段
// 一段来：一段以 # 行开头就改那个标题，一段是光秃秃的正文就给它新起一节。
//   点编辑日 + 标题是「的作业」这种没名字的 → 标题是废话，删掉，正文留下
//   点编辑日 + 光秃秃的正文 → 原样留着，这几行本来就是这天的作业
//   点别的天 → 标题换日期，正文前面插一行 #<那天>的作业
// 返回新正文和「这次动过的范围」在哪儿（给调用方重新框选区），没改动返回 null
export function applyDayToSelection(content, start, end, word, strip) {
  const { lines, starts } = splitLines(content)
  const first = lineIndexAt(starts, start)
  const last = lineIndexAt(starts, end - 1)

  const out = []
  // 一个片段是「若干行 + 要不要重新框进选区」。标记是必需的：没改动的块也得框进去，
  // 不然选区会缩到只剩真正动过的那几块，用户明明选了一整片
  const marked = (chunkLines, inSelection) => ({ lines: chunkLines, inSelection })
  let selFrom = -1
  let selTo = -1
  let touched = false
  // 到目前为止输出过非空行没有。选区正好在文首时尾部提不上来，只能留在原地
  let hasContentBefore = false
  let cursor = 0

  const emit = (chunk) => {
    if (chunk.inSelection) {
      if (selFrom < 0) selFrom = out.length
      selTo = out.length + chunk.lines.length
    }
    if (!hasContentBefore) hasContentBefore = chunk.lines.some((line) => line.trim() !== '')
    out.push(...chunk.lines)
  }

  // 这一段改成什么样：按输出顺序给出若干片段。六种情形，取决于段本身有没有标题、
  // 点的是不是正在编辑的那天、以及段前是不是紧贴着一个小标题
  const rewrite = (block) => {
    const tailEnd = sectionEnd(lines, block.end + 1)
    const tail = lines.slice(block.end + 1, tailEnd)
    const body = lines.slice(block.begin, block.end + 1)
    const scopeAbove = headingAbove(content, starts[block.begin])
    // 作用域名：有标题的段用它自己那个标题（headingAbove 只会严格往上找，
    // 段自己的标题得单独取），光秃秃的段才去问上面那一节叫什么
    const title = block.headed ? scopeTitle(body[0]) : scopeTitle(scopeAbove || '')
    // 尾部（同一段里选中之后剩下的那几行）没被选中，不该跟着这一段改。
    // 要给它自己一节的话，标题就用作用域名，不带日期——跟原来那节一个层级
    const ownHead = title ? `#${title}` : ''
    // 段前就是一个小标题（段前不是标题行，或者压根没有段前）
    const skipHead = !block.headed && block.begin > 0 && isHeadingLine(lines[block.begin - 1])
    // 新起一节用的标题。光秃秃的段要点别的天就新起，标题也用作用域名，
    // 别一律叫「作业」
    const sectionHead = ['', `#${word}的${title || '作业'}`]
    const prevHead = skipHead ? lines[block.begin - 1] : ''

    if (block.headed) {
      const head = body[0]
      const parsed = parseReserveLine(head)
      // 点编辑日 + 「的作业」这种没名字的 → 标题成了废话，删掉，正文留下
      const drop = !!(strip && parsed && !parsed.heading)
      const next = drop ? head : retargetDayHeading(head, word, strip)
      // 拆出去的标题不能跟改完那个标题重名，重了等于没拆
      const keepTail = !!tail.length && !!ownHead && ownHead !== next.trim()
      const chunks = [
        marked(drop ? body.slice(1) : next === head ? body : [next, ...body.slice(1)], true),
      ]
      if (tail.length) chunks.push(marked(keepTail ? ['', ownHead, ...tail] : tail, false))
      return { chunks, touched: drop || next !== head }
    }

    // 点编辑日：这几行本来就是这天的正文，不用挂标记。上面没有小标题管着
    // 就什么都不用做；有小标题管着就得脱出来，不然「点今天」按下去没反应
    if (strip) {
      if (!scopeAbove) return { chunks: [marked([...body, ...tail], true)], touched: false }
      // 后面那几行还归原来那节管，提到前面去；脱出来的就是光秃秃的正文
      return { chunks: [marked(tail, false), marked(['', ...body], true)], touched: true }
    }

    // 光秃秃的段正好是紧贴在上面那个标题底下的（段前就是那个标题），后面又没有
    // 别的行了 → 整节一起搬走，直接改那个标题就行，不必新起一节
    if (!tail.length && skipHead && scopeAbove) {
      const next = retargetDayHeading(prevHead, word, false)
      return {
        chunks: [marked(next === prevHead ? body : [next, ...body], next !== prevHead)],
        touched: next !== prevHead,
      }
    }

    // 原来那个标题留着——它还管着后面那几行，用户没选它就不动它。
    // 新起的这一节插在它前面，尾部那几行跟着原标题走
    if (skipHead) {
      return {
        chunks: [
          marked(sectionHead, false),
          marked(body, true),
          ...(tail.length ? [marked(['', prevHead, ...tail], false)] : []),
        ],
        touched: true,
      }
    }

    // 段前面还有别的内容：尾部提上来，它归原来那节管，新标题落在尾部后面
    if (hasContentBefore) {
      return {
        chunks: [marked(tail, false), marked(sectionHead, false), marked(body, true)],
        touched: true,
      }
    }

    // 提不动（选区就在文首），留在原处、用空行隔开，
    // 不然新标题插在中间会把尾部一起收进来
    return {
      chunks: [
        marked(sectionHead, false),
        marked(body, true),
        ...(tail.length ? [marked(['', ...tail], false)] : []),
      ],
      touched: true,
    }
  }

  for (const block of splitIntoBlocks(lines, first, last)) {
    // 这个段没吃掉的行原样输出。段前那个小标题不输出：整节一起搬走的时候上面
    // 会重新输出一个改过日期的，搬走完没人管了的那几种就干脆删掉，
    // 别在展示板上留一个没有内容的小标题
    const gapEnd = block.begin - (!block.headed && block.begin > 0 && isHeadingLine(lines[block.begin - 1]) ? 1 : 0)
    for (let k = cursor; k < gapEnd; k++) emit(marked([lines[k]], false))
    const result = rewrite(block)
    for (const chunk of result.chunks) emit(chunk)
    touched = touched || result.touched
    cursor = sectionEnd(lines, block.end + 1)
  }
  for (let k = cursor; k < lines.length; k++) emit(marked([lines[k]], false))

  if (!touched) return null
  const text = tidyBlankLines(out.join('\n'))
  // tidy 只动空行，用「第几个非空行」把下标映射回整理后的正文。
  // 末尾是开区间，所以最后一行非空行的名次要减一
  const rank = (index) => out.slice(0, index).filter((line) => line.trim() !== '').length
  const wanted = [rank(selFrom), rank(selTo) - 1]
  const tidied = text.split('\n')
  const at = [-1, -1]
  let seen = 0
  for (let i = 0; i < tidied.length; i++) {
    if (tidied[i].trim() === '') continue
    for (let slot = 0; slot < 2; slot++) {
      if (at[slot] < 0 && wanted[slot] === seen) at[slot] = i
    }
    seen++
  }
  // 名次找不到就框全文。会有这种情形：某段一行正文都没输出（选中的正好是一个
  // 只由标记行构成的标题），标记的那次 emit 一个字都没加，selTo 停在 0
  if (at[0] < 0) at[0] = 0
  if (at[1] < 0) at[1] = tidied.length - 1
  return { text, blockStart: lineStarts(tidied)[at[0]], blockLines: at[1] - at[0] + 1 }
}
// 把 [start, end) 这几行并进 content 里已有的某一节，而不是新起一节。
// 只用来处理「选区正好落在某一节里」的场合；跨段落的选择走 applyDayToSelection。
// 摘掉这几行以后，原来那个小标题要是被摘空了（「的作业」标记，没名字的），
// 顺手删掉，不留一个没有内容的小标题。
// 返回新正文和「挪过去的那几行」在哪儿——调用方拿它把光标放回原处；
// 全都没有可并的地方就返回 null，调用方新起一节
export function mergeLinesInto(content, start, end, today, target, allowPlain) {
  const { lines, starts } = splitLines(content)
  const first = lineIndexAt(starts, start)
  const last = lineIndexAt(starts, end - 1)

  // 这一行本来就归那一天了，没什么可并的。不先挡一下的话，它会被并进
  // 自己所在的那一节——位置上就是跟隔壁的行换了个位置，看着像什么都没发生
  const owner = ownerAt(content, start)
  if (owner && resolveReserveDay(parseReserveLine(owner)?.word, today) === target) return null

  // 选区第一行自己就是小标题的话，这一整节都是要挪走的，标题不带过去——
  // 目标就是同名的那一节，再留一个标题就变成两份一样的了
  let picked = lines.slice(first, last + 1)
  if (isHeadingLine(picked[0])) picked = picked.slice(1)
  // 光剩一个标题：没什么可搬的，交给调用方去改那个标题
  if (!picked.length) return null
  let rest = [...lines.slice(0, first), ...lines.slice(last + 1)]

  // 原来那节被摘空了？空标题删掉。留着它展示板上就是一个没有内容的小标题。
  // 选区本来就从标题起头的（整节搬走）不算这一种——它上面那一行是别人家的正文
  if (!isHeadingLine(lines[first])) {
    const above = first > 0 ? rest[first - 1] : ''
    const below = rest[first] ?? ''
    const emptied = isHeadingLine(above) && !isBodyLine(below)
    if (emptied) rest = [...rest.slice(0, first - 1), ...rest.slice(first)]
  }

  // 原来那节的名字。光秃秃的正文没有名字，落到某一天时归那天的「的作业」管，
  // 所以这里给个「作业」，别因为没有名字就谁也匹配不上
  const from = owner ? scopeTitle(owner) : '作业'
  const at = findMergePoint(rest, today, target, allowPlain, from)
  if (at < 0) return null
  const out = [...rest.slice(0, at), ...picked, ...rest.slice(at)]
  return {
    text: tidyBlankLines(out.join('\n')),
    blockStart: lineStarts(out)[at],
    blockLines: picked.length,
  }
}

// 返回该插到哪一行之前；-1 表示没找到可并的地方。找法按优先级：
//   1. 向上，最后一个「日期正好是那天」的同名节
//   2. allowPlain 时，向上最后一个没有小标题的正文块
//   3. 向下，第一个「日期正好是那天」的同名节
// allowPlain 是「点的是正在编辑的那天」那一种：这一行本来就是这天的正文，
// 不用挂标记，并进上面那个没有小标题的正文块就是了。点别的日子时不找这种
// 地方——那天还没有对应的一节，说明该复制标题另起一节，不能把这一行塞进
// 旁边不相干的正文块里
// from 是原来那一节的节名：只并进同名的那一节。#后天的通告跟#明天的2 不是一码事，
// 塞进去等于把这几行挂错了标题，宁可新起一节
function findMergePoint(lines, today, target, allowPlain, from) {
  const isTargetDay = (line) => {
    if (!isHeadingLine(line)) return false
    const parsed = parseReserveLine(line)
    if (!parsed || resolveReserveDay(parsed.word, today) !== target) return false
    return scopeTitle(line) === from
  }
  for (let index = lines.length - 1; index >= 0; index--) {
    if (isTargetDay(lines[index])) return sectionEnd(lines, index + 1)
  }
  // 3 要让着 2，只在没有 2 可找的时候才用
  let downward = -1
  for (let index = 0; index < lines.length; index++) {
    if (isTargetDay(lines[index])) {
      downward = sectionEnd(lines, index + 1)
      break
    }
  }
  if (!allowPlain) return downward
  // 紧跟在标题行后面那一段算标题的，不算——
  // 不然同一节里第二行点「今天」会并回自己头上，看着像什么都没发生
  let plain = -1
  let index = 0
  while (index < lines.length) {
    if (!isBodyLine(lines[index])) {
      index++
      continue
    }
    const next = sectionEnd(lines, index)
    if (!isHeadingLine(lines[index - 1])) plain = next
    index = next
  }
  return plain >= 0 ? plain : downward
}

// 这个小标题管着几行正文
export function headingBlockSize(content, headingStart) {
  return sectionEnd(content.slice(headingStart).split('\n'), 1) - 1
}

// 用完预定按钮之后顺手把空行理一遍，规则就这四条：
//   开头不留空行；结尾留一个；中间不出现连续空行；每个 # 行前面都得空一个。
// 「# 行前面要空一行」排在「开头不留空行」后面，所以全文以 # 开头是允许的
export function tidyBlankLines(text) {
  const kept = []
  for (const line of text.split('\n')) {
    // 连续空行只留一个
    if (line.trim() === '' && kept.length && kept[kept.length - 1].trim() === '') continue
    kept.push(line)
  }
  while (kept.length && kept[0].trim() === '') kept.shift()

  const out = []
  for (const line of kept) {
    // 前面本来就空着就别再补了，不然补出来的正是刚去掉的连续空行
    if (isHeadingLine(line) && out.length && out[out.length - 1].trim() !== '') out.push('')
    out.push(line)
  }
  while (out.length && out[out.length - 1].trim() === '') out.pop()
  if (out.length) out.push('')
  return out.join('\n')
}

// 标记行的格式：# 明天 的 作业
//   「的」后面是「作业」或「作业：」→ 普通预定，搬完把标记行删掉
//   「的」后面是别的（当作小标题）→ 搬过去后在那天写成「#标题」+ 内容
//   「的」和「：」后面什么都没有 → 也是预定，只是不给它起目标标题
// 和渲染层的小标题一个规矩：# 开头，后面最多一个空格（可有可无）。
// 多个空格就不算标记，当普通正文——省得专门去保留空格。
// DAY_PATTERN 自带一组括号，这里不要再套——套了捕获组就错位，
// matched[1] 是日子词、matched[2] 才是「的」后面那段标题
const RESERVE_PATTERN = new RegExp(
  '^[ \\t]*[#][ 　]?' + DAY_PATTERN + DAY_TAIL + '(.*?)[ \\t]*$',
)

// 行首是不是标题行（# 开头）。空行和标题行都是作用范围的边界，
// 所以归属判断只看这个，不看能不能解析成预定
export function isHeadingLine(line) {
  return /^[ \t]*[#]/.test(line)
}

// 这一行是不是「某一天」的小标题：# 开头，剥掉标记和最多一个空格以后
// 后面紧跟着那个日子词。# 周四的作业、# 周四、# 下周四 都算
function isDayHeading(line, word) {
  const matched = /^[ \t]*[#][ 　]?/.exec(line)
  return !!matched && line.slice(matched[0].length).startsWith(word)
}

// 按钮只往「的作业」那一节的末尾追加。「# 明天的通知」是另一节，不碰——
// 那节要么留着，要么由用户另外写一行去
function isPlainDayHeading(line, word) {
  const parsed = parseReserveLine(line)
  return !!parsed && parsed.heading === '' && isDayHeading(line, word)
}

// 摘掉一行以后，如果它原来那一节被摘空了，把那个标题行也删掉——
// 不然展示板上会留一个没有内容的小标题。任何小标题都算，不只是「的作业」那种
export function pruneDayHeading(content, cutAt) {
  const next = content.slice(cutAt).split('\n')[0]
  if (isBodyLine(next)) return content
  const head = content.slice(0, cutAt)
  const prevEnd = head.endsWith('\n') ? head.length - 1 : head.length
  const prevStart = head.lastIndexOf('\n', prevEnd - 1) + 1
  if (!isHeadingLine(content.slice(prevStart, prevEnd))) return content
  return content.slice(0, prevStart) + content.slice(prevEnd + 1)
}

// 正文里那一天的小标题下面那一节，在哪儿结束（也就是它最后一行内容之后）。
// 新来的作业要接在已有内容的后面，所以找的是节的末尾，不是标题下面第一行
export function findDayBlockEnd(content, word) {
  const { lines, starts } = splitLines(content)
  const index = lines.findIndex((line) => isPlainDayHeading(line, word))
  if (index < 0) return -1
  const end = sectionEnd(lines, index + 1)
  // 节的末尾就是最后一行内容之后；它下面不再有内容时，那就是正文末尾
  return end < lines.length ? starts[end] : content.length
}

// 这一行是预定标记就返回 { word, heading }，不是就返回 null
export function parseReserveLine(line) {
  const matched = RESERVE_PATTERN.exec(line)
  if (!matched) return null
  // 「的」后面多了空格就整个不算：正则里那处只容一个空格，多出来的会被
  // 吞进标题。与其把空格留着，不如当它不是标记
  if (/^[ 　]/.test(matched[2])) return null
  const title = matched[2].trim()
  return { word: matched[1], heading: /^作业[：:]?$/.test(title) ? '' : title }
}

// 「明天」「后天」「周X」「下周二」都换成 YYYYMMDD，一律相对「今天」解，
// 不是相对正在编辑的那一天——这样标记不管过多少天再看，都解回原来那天，
// 不会因为编辑的日期变了就搬错方向。UI 上和解析上「今天」都是同一个意思：真正的今天。
// 周X 取严格往后最近的那天：今天就是那个周几时落到下周，带不带「下」都一样。
// 解析不出来返回空串，这一行就当普通正文
export function resolveReserveDay(word, today) {
  if (!word) return ''
  if (word === '今天') return today
  if (word === '明天') return shiftDateString(today, 1)
  if (word === '后天') return shiftDateString(today, 2)
  const name = word.slice(-1)
  if (!WEEKDAYS.includes(name)) return ''
  for (let offset = 1; offset <= 7; offset++) {
    const dateString = shiftDateString(today, offset)
    if (weekdayOf(dateString) === name) return dateString
  }
  return ''
}

// 日期按钮：今天起往后五天，一共五个，连着各自代表的那天一起给。
// 点亮哪个按钮得按「解出来是哪天」来比，不是按按钮上的字——
// 用户写「周三」而按钮上写着「下周二」，也是同一天。
// 「今天」永远指真正的今天，不是正在编辑的那一天：这里收的参数就叫 today，
// 别把 currentDate 递进来
function headingDayEntries(today) {
  const entries = []
  for (let offset = 0; offset <= 4; offset++) {
    const date = shiftDateString(today, offset)
    // 第一格固定写「今天」，往后那几格用应用里现成的格式化日期
    // （明天 / 下周二 …），不另写一套——按钮上显示什么，
    // 写进标记里的就是同一个词，解析时自然解得回来
    entries.push({ word: offset === 0 ? '今天' : formatDayName(date), date })
  }
  return entries
}

// 完成编辑、或者翻日期的时候扫一遍正文，把手工写的预定标记落实到具体日期上。
// 从上往下逐行读：碰到能解析的标记行，它下面的内容归它，一直到空行或者下一个
// 标题行为止。解析不出来的标题行不碰，当普通小标题。
// today 一律传「今天」，不是正在编辑的那天。
// blocks 按正文里的先后返回，同一个日期出现多次时按顺序追加
export function parseReservations(content, today) {
  const lines = content.split('\n')
  const blocks = []
  const rest = []
  let index = 0
  while (index < lines.length) {
    const parsed = parseReserveLine(lines[index])
    const dateString = parsed ? resolveReserveDay(parsed.word, today) : ''
    if (!dateString) {
      rest.push(lines[index])
      index++
      continue
    }
    index++ // 跳过标记行本身，它不搬走
    const end = sectionEnd(lines, index)
    const moved = lines.slice(index, end)
    index = end
    // 搬走的那几行后面紧跟着的空行也吃掉。标记行和内容都没了，这个空行就是
    // 凭空多出来的一节空白——rest 是直接拿去当那天正文的（不再过一遍 tidy），
    // 前后都还有内容的时候尤其明显
    if (index < lines.length && lines[index].trim() === '') index++
    blocks.push({ dateString, lines: moved, heading: parsed.heading })
  }
  return { blocks, rest: rest.join('\n') }
}
