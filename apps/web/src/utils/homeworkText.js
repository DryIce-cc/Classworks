// 作业正文的行模型：分行、行号换算、小标题归属、空行整理。
// 纯文本层，不懂日期和面板——上面三层（预定 / 改日期 / 面板）都从这里拿行
// （原 homeworkPhrases.js 拆分出来，函数体原样搬运）

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

// 每一行的起始位置
export function lineStarts(lines) {
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
export function splitLines(content) {
  const lines = content.split('\n')
  return { lines, starts: lineStarts(lines) }
}

// 位置 pos 落在第几行（0 起）。行尾那个换行算它自己那一行，所以「甲」占 0-1、
// 位置 2 既是甲的行尾也是乙的行首，取「最后一个起点不超过 pos 的那行」两者不会打架。
// pos 落在正文之前（调用方拿「最后一个被选中的字符」算，选区为空时就是 -1）时取最后一行
export function lineIndexAt(starts, pos) {
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
export function isBodyLine(line) {
  return line.trim() !== '' && !isHeadingLine(line)
}

// 从 from 往后扫到空行或下一个标题行为止，返回那一行的行号（扫到底就是数组长度）。
// 「这一节管到哪儿」全靠它
export function sectionEnd(lines, from) {
  let end = from
  while (end < lines.length && isBodyLine(lines[end])) end++
  return end
}

// 行首是不是标题行（# 开头）。空行和标题行都是作用范围的边界，
// 所以归属判断只看这个，不看能不能解析成预定
export function isHeadingLine(line) {
  return /^[ \t]*[#]/.test(line)
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
