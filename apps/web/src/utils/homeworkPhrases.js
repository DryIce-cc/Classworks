// 作业面板的词表，以及「这一行现在该给哪一层、该给哪几个键」。
//
// 面板分三层，一次只显示当前这一层：
//
//   起手层  订正 / 卷（卷子、练习卷、周末卷）/ 本（小白、作业册、练习册、课本）。
//           按下「订正」不换层，只把第一行换成默写那一堆，下面两行原样不动。
//           这一行只剩「完成」「完成好」这类收尾的话也停在这一层：这条齐了，
//           接着写下一条（见 onlyDone）。
//   自动建议的最后一层  只要这一行有汉字或字母就来，而且不区分是卷是本还是默写：
//           第一行正反面，第二行怎么收尾，第三行预定。固定四行，
//           高度不变，写字的时候编辑框不会被顶得上下跳。
//   小标题层  光标停在 # 开头那一行上，只有「作为…的作业」那一栏，
//           点一下改的是这个标题的目标日期。
//
// 预定那一行点一下会写出一个标题行「#明天的作业」，它下面几行
// 在完成编辑或者翻日期的时候一起搬到那天去。
//
// 停在哪一层完全由光标所在这一行的内容推出来，不另记状态：空行、只有标点的行
// 就是起手层，所以光标落到空行上自动回到起点，换行也不用手动重置，
// 永远不会和正文对不上。
//
// 数字和量词介词不在面板上，放在小键盘底下。面板只管往正文里加字：
// 不加空格，也不改字。要空格按小键盘的空格，点错了按小键盘的删除往回删。

import { formatDayName, parseDateString, shiftDateString } from './date'

// 任务：点完还有的下一步，所以和载体分开摆一行。
// 「完成」不在这里：写完了这一条，面板自己认（见 onlyDone），不用再给一个按钮
export const TASKS = ['订正']

// 订正按下后第一行换成这一堆
export const RECITE = ['默写', '早读默写', '课前默写']

// 卷：内容里有正反面
export const PAPERS = ['卷子', '练习卷', '周末卷']

// 本：内容里写页码或者范围
export const BOOKS = ['小白', '作业册', '练习册', '课本']

// 小键盘底下那排量词。刚敲完一个数字才需要它们，平时收起来
export const BOTTOM_KEYS = ['页', '张', '题', '课', '章']

// 自动建议最后一页的第一行。卷和本各自能补的东西不一样，但既然不区分了，
// 就一次全摆出来，省得先认一遍是哪种再决定按哪个
const CONTENT_ROW = ['正面', '反面']

// 收尾建议：这一行已经写了正经内容，就可以建议怎么结尾了。
// 词上不带逗号：逗号由这一行的 comma 标记来补（见 panelRows 与 insertWord）
export const SUGGEST_WORDS = ['自行完成', '明天上课对答案', '核对群里或板报的答案']

// 这一行剩下的中英文字：数字、标点、空格、前后缀全摘掉。
// 中文标点不算内容，「订正，默写」和「订正默写」要一样看待；
// 「1. 完成」摘完是「完成」，面板看来它和光打一个「完成」是同一件事；
// 「小蓝p30~35」摘完是「小蓝p」
function lettersOnly(line) {
  return line.replace(/[^\p{Script=Han}a-zA-Z]/gu, '')
}

// 除了「完成」这类收尾的话，这一行没有别的中英文字了（「1. 完成」也算）。
// 这时面板回起手那一层：这一条齐了，接着写下一条（订正 / 卷 / 本）
const DONE_ONLY = ['完成', '完成好']
export function onlyDone(line) {
  return DONE_ONLY.includes(lettersOnly(line))
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
  // 前缀刚敲出来，后面还没有数字：这两个格子让开
  if (/[第pP]$/.test(text)) return ['', '']
  // 刚敲下区间的连接符，接下来也是数字：一样让开。「p13-15」结尾是 15，不会走到这里
  if (/[~-]$/.test(text)) return ['', '']
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

// 光标前面那几个字决定该亮什么。全靠正文判断，不记「上次按了什么」——
// 状态机和正文会对不上，粘贴、手敲、改中间的字之后就不准了。
// 量词那一排（suffix）只看紧挨着光标的那一个字：是个阿拉伯数字就该出现。
// 「13」「13~25」「第13」「p29」都算——页码后面也跟量词（页、题），
// 所以不再往前捋着排除 p/P。全角数字不算
export function hints(before) {
  return { suffix: /\d$/.test(before) }
}

const has = (line, words) => words.some((word) => line.includes(word))

// 词按「行末」认，不是按整行——前面已经打过序号、掺了别的字，都不该认不出来。
// 「订正」和「1. 订正」要一样。行末的空格不算词的一部分
const lineTail = (line) => line.replace(/[ 　]+$/, '')

// 这一行末尾是哪个任务词
export function taskOf(line) {
  const text = lineTail(line)
  return TASKS.find((task) => text.endsWith(task)) || ''
}

// 「订正」和「默写」都在才算默写那一档。只有「默写」两个字可能只是
// 别的句子里的一个词，不该当成一条完整的作业
export function isRecite(line) {
  return line.includes('订正') && line.includes('默写')
}

// 订正按下之后、还没说是默写还是哪本之前。这期间第一行摆默写那一堆
export function recitePending(line) {
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
export function phaseOf(line) {
  // 标题行单独一层：面板要改的不是正文，是这个标题的目标日期
  if (isHeadingLine(line)) return 'hash'
  // 空行、只有标点的行：没什么可建议的，回起手那一层
  if (!hasContent(line)) return 'pick'
  // 整行就写了「完成」：这一条齐了，回首页去接着写下一条。
  // 只写了完成、没写别的才这么办——「完成小白」「订正默写完成」都还在最后一页，
  // 那边的正反面、收尾建议和预定照旧给
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
  const lines = content.split('\n')
  let offset = 0
  let current = -1
  for (const line of lines) {
    const start = offset
    offset = Math.min(content.length, start + line.length + 1)
    if (start >= pos) break
    if (line.trim() === '') current = -1
    else if (isHeadingLine(line)) current = start
  }
  return current
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

// 那天已有正文里，最后一个同名小标题那一节的末尾（行号）。
// 比的是节名而不是预定解析的结果：那边写「#通知」、这边搬过来的是
// 「#明天的通知」，节名都是「通知」，得接进同一节去。
// 没有同名的小标题返回 -1
function endOfNamedSection(day, heading) {
  for (let index = day.length - 1; index >= 0; index--) {
    if (!isHeadingLine(day[index]) || scopeTitle(day[index]) !== heading) continue
    let end = index + 1
    while (end < day.length && day[end].trim() !== '' && !isHeadingLine(day[end])) end++
    return end
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
    if (!atEnd && day[index].trim() !== '' && !isHeadingLine(day[index])) continue
    if (index > start && !isHeadingLine(day[start - 1] ?? '')) end = index
    start = index + 1
  }
  return end
}

// 把一段正文插进那天已有的正文里，插在哪：
//   有小标题 → 接在最后一个同名小标题那一节的最后。同名的一个都没有才新起一节。
//   没小标题 → 接在最后一个不受小标题管着的段落最后。这种段落一个都没有才接全文最后。
// 空行统一交给 tidyBlankLines 理，这里只管插在哪
export function spliceIntoDay(day, heading, lines) {
  const at = heading ? endOfNamedSection(day, heading) : endOfFreeParagraph(day)
  if (at < 0) {
    return [...day, '', ...(heading ? [`#${heading}`] : []), ...lines]
  }
  return [...day.slice(0, at), ...lines, ...day.slice(at)]
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
// 起手那一层是 订正 / 卷 / 本 / 空；自动建议的最后一层是
// 内容 / 收尾建议 / 预定 / 空；小标题那一层只有 预定；
// 选区跨了多行时也是只有 预定，只是改的是整块
export function panelRows(line, today, scope, currentDate, selection) {
  // 选中了多行：面板只给日期那一栏，改的是整块选区。
  // 点亮选区里那些标题解出来的那天——不是同一天就一个都不亮
  if (selection) {
    return [
      { groups: [] },
      { groups: [] },
      // 选区里那些标题解出来的是同一天就点那天；不是同一天、或者压根没有标题，
      // 就点正在编辑的那天——跟小标题那一页同一条规则，不是一个都不点
      reserveRow(today, currentDate, '', [selection.day || currentDate]),
      { groups: [] },
    ]
  }
  // 小标题那一层只有日期那一栏：光标停在标题行上，要改的就是这个标题的目标日期。
  // 那一栏跟正文那页的是同一个控件（同样摆老三行、同样 outline），只是点的后果不一样
  if (phaseOf(line) === 'hash') {
    return [
      { groups: [] },
      { groups: [] },
      reserveRow(today, currentDate, scope || line),
      { groups: [] },
    ]
  }
  if (phaseOf(line) !== 'autoLast') {
    return [
      { groups: [recitePending(line) ? RECITE : TASKS] },
      { groups: [PAPERS] },
      { groups: [BOOKS] },
      { groups: [] },
    ]
  }
  // 最后一页统一给这几栏，不再分书/卷/默写——认得出是哪种反而让同一件事
  // 在不同行上长得不一样，按之前还得先想一遍这是哪一类
  return [
    // 最后一页的第一行永远是正反面：不管这一行是订正、默写还是写着「完成」，
    // 都还能接着补内容
    { groups: [CONTENT_ROW] },
    // 有内容才给收尾建议。comma：这一排是接在已有内容后面的话，按下去先补
    // 一个逗号再写词；用户自己已经打了逗号、或者已经在接着写这个词，
    // 就只补剩下的（见 insertWord）
    hasContent(line) ? { groups: [SUGGEST_WORDS], comma: true } : { groups: [] },
    reserveRow(today, currentDate, scope),
    { groups: [] },
  ]
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 日期字符串取周几。格式不对就返回空串
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

// 预定标记行：#明天的作业
// 和渲染层的小标题一个写法，所以标出来的那行在当天看着就是个标题，
// 到了完成编辑/翻日期那一刻才连着下面几行一起搬走。
// 自己插进去的一律不带空格——用户手敲的带空格照样认
export function reserveLine(day) {
  return `#${day}的作业`
}

// 复制一个小标题并把日子换成目标那天：
//   # 明天的通知 → # 后天的通知（换掉那天）
//   # 通知       → # 明天的通知（本来没日期就加上）
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
// 已经写着日期的摘掉，本来就没有的什么都不发生。
// 否则加上/换成 word 那一天。
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
  const starts = []
  let offset = 0
  for (const line of content.split('\n')) {
    const stop = offset + line.length
    if (isHeadingLine(line) && offset >= start && stop <= end) starts.push(offset)
    offset = stop + 1
  }
  return starts
}

// 选区那些行归的是不是同一天，是同一天就返回那天，不是就返回空串。
// 看两处：选区里的 # 行自己解出来的日子，和选区里那些正文行各自归着的
// 小标题解出来的日子——「选中 #明天的作业 下面的 e、r」虽然一个 # 行都没选中，
// 该亮的仍是明天。两处合起来都只有同一天才算；一个都没有就返回空串，
// 交给上层退回「正在编辑的那天」
export function commonDayInSelection(content, start, end, today) {
  const lines = content.split('\n')
  const days = new Set()
  const dayOf = (from) => {
    const nl = content.indexOf('\n', from)
    const parsed = parseReserveLine(content.slice(from, nl < 0 ? content.length : nl))
    const date = resolveReserveDay(parsed?.word, today)
    if (date) days.add(date)
  }

  for (const at of selectionHeadings(content, start, end)) dayOf(at)
  const first = lineIndexAt(lines, start)
  const last = lineIndexAt(lines, end - 1)
  for (let index = first; index <= last; index++) {
    if (isHeadingLine(lines[index])) continue
    const ownerStart = headingAboveStart(content, lineStartOf(lines, index))
    if (ownerStart >= 0) dayOf(ownerStart)
  }
  return days.size === 1 ? [...days][0] : ''
}


// 点的是正在编辑的那天：光标这一行本来就是当天的作业，不用挂任何标记，
// 只要把它从「归别人那天的那一节」里摘出来——上下补空行，
// 别被上面那个小标题顺手收走。行本身留在原地不删。
// 返回新正文，和这一行改完之后的位置（放光标用）
export function detachLineFromScope(content, lineStart) {
  const lines = content.split('\n')
  const index = lineIndexAt(lines, lineStart)
  const above = lines[index - 1] ?? ''
  const below = lines[index + 1] ?? ''
  const needAbove = above.trim() !== '' && !isHeadingLine(above)
  const needBelow = below.trim() !== '' && !isHeadingLine(below)
  const out = [
    ...lines.slice(0, index),
    ...(needAbove ? [''] : []),
    lines[index],
    ...(needBelow ? [''] : []),
    ...lines.slice(index + 1),
  ]
  // 行号没变，但前面可能插了一个空行，位置得重算
  const at = index + (needAbove ? 1 : 0)
  const caretAt = out.slice(0, at).reduce((n, line) => n + line.length + 1, 0)
  return { text: tidyBlankLines(out.join('\n')), caretAt }
}

// 位置 pos 落在第几行（0 起）。pos 是行尾那个换行时算下一行——
// 「甲」占 0-1、位置 2 既是甲的行尾也是乙的行首，而选区起点算乙。
// 要判「只蹭到行尾、没选中该行字符」的话传「最后一个被选中的字符」，
// 别直接传选区终点
function lineIndexAt(lines, pos) {
  let at = 0
  for (let i = 0; i < lines.length; i++) {
    // pos 落在这一行的字符范围里
    if (pos >= at && pos < at + lines[i].length) return i
    // pos 正好是行尾那个换行：算这一行。（行首不会是这种位置——
    // 行首是上一行末尾再加一格，走不到这里，所以两种情况不打架）
    if (pos === at + lines[i].length) return i
    at += lines[i].length + 1
  }
  return lines.length - 1
}

// 把 [start, end) 按空行和 # 行切成若干段落，逐段改。跨空行选中的时候一段
// 一段来：一段以 # 行开头就改那个标题，一段是光秃秃的正文就给它新起一节。
//   点编辑日 + 标题是「的作业」这种没名字的 → 标题是废话，删掉，正文留下
//   点编辑日 + 光秃秃的正文 → 原样留着，这几行本来就是这天的作业
//   点别的天 → 标题换日期，正文前面插一行 #<那天>的作业
// 返回新正文和「这次动过的范围」在哪儿（给调用方重新框选区），没改动返回 null
export function applyDayToSelection(content, start, end, word, strip) {
  const lines = content.split('\n')
  const first = lineIndexAt(lines, start)
  const last = lineIndexAt(lines, end - 1)

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
    while (index <= last && lines[index].trim() !== '' && !isHeadingLine(lines[index])) index++
    blocks.push({ begin, end: index - 1, headed })
  }

  const out = []
  let cursor = 0
  let selFrom = -1
  let selTo = -1
  let touched = false
  // inSelection 标的是「重新框选区的时候要框进去的行」。没改动的块也得标，
  // 不然选区会缩到只剩真正动过的那几块，用户明明选了一整片
  const push = (arr, inSelection) => {
    const from = out.length
    out.push(...arr)
    if (!inSelection) return
    if (selFrom < 0) selFrom = from
    selTo = out.length
  }

  for (const block of blocks) {
    let tailEnd = block.end + 1
    while (
      tailEnd < lines.length &&
      lines[tailEnd].trim() !== '' &&
      !isHeadingLine(lines[tailEnd])
    ) {
      tailEnd++
    }
    const tail = lines.slice(block.end + 1, tailEnd)
    const consumedTail = Math.max(block.end + 1, tailEnd)
    const body = lines.slice(block.begin, block.end + 1)
    const scopeAbove = headingAbove(content, lineStartOf(lines, block.begin))
    // 作用域名：有标题的段落用它自己那个标题（headingAbove 只会严格往上找，
    // 段自己的标题得单独取），光秃秃的段落才去问上面那一节叫什么
    const title = block.headed ? scopeTitle(body[0]) : scopeTitle(scopeAbove || '')
    // 尾部（同一段里选中之后剩下的那几行）没被选中，不该跟着这一段改。
    // 要给它自己一节的话，标题就用作用域名，不带日期——跟原来那节一个层级。
    // 拆出来跟原来那个标题一样等于白拆，不拆
    const ownHead = title ? `#${title}` : ''
    // 段前就是一个小标题（段前不是标题行，或者压根没有段前）
    const skipHead = !block.headed && block.begin > 0 && isHeadingLine(lines[block.begin - 1])
    // 光秃秃的段落要点别的天，新起一节；标题也用作用域名，别一律叫「作业」。
    // 选区只框挪走的那几行，不框新加的那个标题
    const sectionHead = ['', `#${word}的${title || '作业'}`]
    // 光秃秃的段落正好是紧贴在上面那个标题底下的（段前就是那个标题），
    // 后面又没有别的行了 → 整节一起搬走，直接改那个标题就行，不必新起一节
    const wholeSection =
      !block.headed && !strip && !tail.length && skipHead && !!scopeAbove
    // 上面那个标题行不归「补空隙」输出：整节一起搬走的时候由下面那个分支
    // 重新输出一个改过日期的；搬走完没人管了的那几种就干脆删掉，
    // 别在展示板上留一个没有内容的小标题
    for (let k = cursor; k < block.begin - (skipHead ? 1 : 0); k++) out.push(lines[k])
    // 尾部一律不算进选区：用户只选到这儿，剩下的是他没选的那些行
    if (block.headed) {
      const head = body[0]
      const parsed = parseReserveLine(head)
      const drop = !!(strip && parsed && !parsed.heading)
      const next = drop ? head : retargetDayHeading(head, word, strip)
      // 拆出去的标题不能跟改完那个标题重名，重了等于没拆
      const keepTail = !!tail.length && !!ownHead && ownHead !== next.trim()
      // 点编辑日 + 「的作业」这种没名字的 → 标题成了废话，删掉，正文留下
      if (drop) {
        push(body.slice(1), true)
        touched = true
      } else {
        push(next === head ? body : [next, ...body.slice(1)], true)
        if (next !== head) touched = true
      }
      if (tail.length) push(keepTail ? ['', ownHead, ...tail] : tail, false)
    } else if (strip) {
      // 点编辑日：这几行本来就是这天的正文，不用挂标记。上面没有小标题管着
      // 就什么都不用做；有小标题管着就得脱出来，不然「点今天」按下去没反应。
      // 后面那几行还归原来那节管，提到前面去；脱出来的就是光秃秃的正文
      if (!scopeAbove) push([...body, ...tail], true)
      else {
        push(tail, false)
        push(['', ...body], true)
        touched = true
      }
    } else if (wholeSection) {
      const head = lines[block.begin - 1]
      const next = retargetDayHeading(head, word, false)
      if (next !== head) touched = true
      push(next === head ? body : [next, ...body], next !== head)
    } else if (skipHead) {
      // 原来那个标题留着——它还管着后面那几行，用户没选它就不动它。
      // 新起的这一节插在它前面，尾部那几行跟着原标题走
      push(sectionHead, false)
      push(body, true)
      touched = true
      if (tail.length) push(['', lines[block.begin - 1], ...tail], false)
    } else if (out.some((line) => line.trim() !== '')) {
      // 段前面还有别的内容：把尾部提到新标题前面去，它归原来那节管
      push(tail, false)
      push(sectionHead, false)
      push(body, true)
      touched = true
    } else {
      // 提不动（选区就在文首），留在原处、用空行隔开，
      // 不然新标题插在中间会把尾部一起收进来
      push(sectionHead, false)
      push(body, true)
      touched = true
      push(['', ...tail], false)
    }
    cursor = consumedTail
  }
  for (let k = cursor; k < lines.length; k++) out.push(lines[k])

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
  if (at[0] < 0) at[0] = 0
  if (at[1] < 0) at[1] = tidied.length - 1
  return { text, blockStart: lineStartOf(tidied, at[0]), blockLines: at[1] - at[0] + 1 }
}
// 只用来处理「选区正好落在某一节里」的场合；跨段落的选择走 applyDayToSelection。
//   选区正好是它管着的全部行 → 不用另起一节，直接改那个标题（同「#+单行」）
//   只占了它的一部分        → 把选中的这几行摘出来，复制一份那个标题、
//                             改成目标那天，在末尾新起一节；
//                             原标题下面剩下的行留在原地
// 返回 null 表示这次不用改
// 把 lines 并进 content 里已有的某一节，而不是新起一节。
// 找法（按优先级）：
//   1. 向上，最后一个「日期正好是那天」的小标题节
//   2. 向上，最后一个没有小标题的正文块
//   3. 向下，第一个「日期正好是那天」的小标题节
// 全都没有就返回 null，调用方新起一节。
// 摘掉这几行以后，原来那个小标题要是被摘空了（「的作业」标记，没名字的），
// 顺手删掉，不留一个没有内容的小标题。
// 返回新正文和「挪过去的那几行」在哪儿——调用方拿它把光标放回原处
export function mergeLinesInto(content, start, end, today, target, allowPlain) {
  const lines = content.split('\n')
  const first = lineIndexAt(lines, start)
  const last = lineIndexAt(lines, end - 1)

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
    const emptied =
      isHeadingLine(above) &&
      (below.trim() === '' || isHeadingLine(below) || first >= rest.length)
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
    blockStart: out.slice(0, at).reduce((n, line) => n + line.length + 1, 0),
    blockLines: picked.length,
  }
}

// 那一节的末尾（行号）：小标题下面那段非空、非标题的行都归它管
function sectionEndFrom(lines, headingIndex) {
  let end = headingIndex + 1
  while (end < lines.length && lines[end].trim() !== '' && !isHeadingLine(lines[end])) end++
  return end
}

// 见上。返回该插到哪一行之前；-1 表示没找到可并的地方。
// allowPlain 是「点的是正在编辑的那天」那一种：这一行本来就是这天的正文，
// 不用挂标记，并进上面那个没有小标题的正文块就是了。
// 点别的日子时不找这种地方——那天还没有对应的一节，说明该复制标题另起一节，
// 不能把这一行塞进旁边不相干的正文块里
// from 是原来那一节的节名：只并进同名的那一节。#后天的通告跟#明天的2 不是一码事，
// 塞进去等于把这几行挂错了标题，宁可新起一节
function findMergePoint(lines, today, target, allowPlain, from) {
  const isTargetDay = (line) => {
    if (!isHeadingLine(line)) return false
    const parsed = parseReserveLine(line)
    if (!parsed || resolveReserveDay(parsed.word, today) !== target) return false
    return scopeTitle(line) === from
  }
  // 1. 向上最后一个日期正好的
  for (let index = lines.length - 1; index >= 0; index--) {
    if (isTargetDay(lines[index])) return sectionEndFrom(lines, index)
  }
  // 3. 向下第一个（2 要先让着它，只在没有 2 可找的时候才用）
  let downward = -1
  for (let index = 0; index < lines.length; index++) {
    if (isTargetDay(lines[index])) {
      downward = sectionEndFrom(lines, index)
      break
    }
  }
  if (!allowPlain) return downward
  // 2. 向上最后一个没有小标题的正文块。紧跟在标题行后面那一段算标题的，不算——
  //    不然同一节里第二行点「今天」会并回自己头上，看着像什么都没发生
  let plain = -1
  let index = 0
  while (index < lines.length) {
    if (lines[index].trim() === '' || isHeadingLine(lines[index])) {
      index++
      continue
    }
    const begin = index
    let next = index
    while (next < lines.length && lines[next].trim() !== '' && !isHeadingLine(lines[next])) next++
    if (!isHeadingLine(lines[begin - 1] ?? '')) plain = next
    index = next
  }
  return plain >= 0 ? plain : downward
}


// 上一行的起始位置就是它前面那个空行
function lineStartOf(lines, index) {
  return lines.slice(0, index).reduce((n, line) => n + line.length + 1, 0)
}


// 这个小标题管着几行正文。空行和下一个标题都断开归属，所以数到那里为止
export function headingBlockSize(content, headingStart) {
  const lines = content.slice(headingStart).split('\n')
  let size = 0
  for (let index = 1; index < lines.length; index++) {
    if (lines[index].trim() === '' || isHeadingLine(lines[index])) break
    size++
  }
  return size
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
// 「下周二」这种带「下」的也认，解出来跟「周二」一样是往后最近的那个周几。
// DAY_PATTERN 自带一组括号，这里不要再套——套了捕获组就错位，
// matched[1] 是日子词、matched[2] 才是「的」后面那段标题
const RESERVE_PATTERN = new RegExp(
  '^[ \\t]*[#][ 　]?' + DAY_PATTERN + DAY_TAIL + '(.*?)[ \\t]*$',
)

// 行首是不是标题行。不看能不能解析——空行和标题行都是作用范围的边界
function isReserveLine(line) {
  return isHeadingLine(line)
}

// 行首是不是标题行（# 开头）
export function isHeadingLine(line) {
  return /^[ \t]*[#]/.test(line)
}

// 这一行是不是「某一天」的小标题：# 开头，剥掉标记和最多一个空格以后
// 后面紧跟着那个日子词。# 周四的作业、# 周四、# 下周四 都算
export function isDayHeading(line, word) {
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
// 判据：摘走位置后面那一行已经是空行、标题行、或者没有了，
// 而紧挨着前面那一行正是小标题
export function pruneDayHeading(content, cutAt) {
  const next = content.slice(cutAt).split('\n')[0]
  if (next.trim() !== '' && !isHeadingLine(next)) return content
  const head = content.slice(0, cutAt)
  const prevEnd = head.endsWith('\n') ? head.length - 1 : head.length
  const prevStart = head.lastIndexOf('\n', prevEnd - 1) + 1
  if (!isHeadingLine(content.slice(prevStart, prevEnd))) return content
  return content.slice(0, prevStart) + content.slice(prevEnd + 1)
}

// 正文里那一天的小标题下面那一节，在哪儿结束（也就是它最后一行内容之后）。
// 新来的作业要接在已有内容的后面，所以找的是节的末尾，不是标题下面第一行。
// 找不到返回 -1
export function findDayBlockEnd(content, word) {
  const lines = content.split('\n')
  let offset = 0
  let headingEnd = -1
  for (const line of lines) {
    const start = offset
    offset = Math.min(content.length, offset + line.length + 1)
    if (headingEnd < 0) {
      if (isPlainDayHeading(line, word)) headingEnd = offset
      continue
    }
    // 已经在那一节里：空行或者下一个标题行，这一节就到此为止
    if (line.trim() === '' || isHeadingLine(line)) return start
  }
  return headingEnd < 0 ? -1 : content.length
}

// 这一行是预定标记就返回 { word, heading }，不是就返回 null。
// heading 为空串表示普通预定；非空就是那天要挂的小标题
export function parseReserveLine(line) {
  const matched = RESERVE_PATTERN.exec(line)
  if (!matched) return null
  // 「的」后面多了空格就整个不算：正则里那处只容一个空格，多出来的会被
  // 吞进标题。与其把空格留着，不如当它不是标记
  if (/^[ 　]/.test(matched[2])) return null
  const title = matched[2].trim()
  return { word: matched[1], heading: /^作业[：:]?$/.test(title) ? '' : title }
}

// 「明天」「后天」「周X」「下周二」都换成 YYYYMMDD。一律相对「今天」解，
// 不是相对正在编辑的那一天——这样标记不管过多少天再看，都解回原来那天，
// 不会因为编辑的日期变了就搬错方向。UI 上和解析上「今天」都是同一个意思：
// 真正的今天。
// 周X 取严格往后最近的那天：今天就是那个周几时落到下周，带不带「下」都一样。
// 解析不出来返回空串，这一行就当普通正文
export function resolveReserveDay(word, today) {
  if (!today || !word) return ''
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
  if (!today) return []
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
// 从上往下逐行读：碰到能解析的标记行，它下面的内容归它，一直到空行或者
// 下一个标题行为止（下一个标题行解析不出来也算边界，它自己当正文留着）。
// 解析不出来的标题行不碰，当普通小标题。
// today 一律传「今天」，不是正在编辑的那天
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
    const moved = []
    while (index < lines.length) {
      const line = lines[index]
      if (line.trim() === '' || isReserveLine(line)) break
      moved.push(line)
      index++
    }
    // 搬走的那几行后面紧跟着的空行也吃掉。标记行和内容都没了，这个空行就是
    // 凭空多出来的一节空白——rest 是直接拿去当那天正文的（不再过一遍 tidy），
    // 前后都还有内容的时候尤其明显
    if (index < lines.length && lines[index].trim() === '') index++
    blocks.push({ dateString, lines: moved, heading: parsed.heading })
  }
  return { blocks, rest: rest.join('\n') }
}
