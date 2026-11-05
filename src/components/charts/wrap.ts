/**
 * Split a chart label into lines of about `width` characters, on word
 * boundaries, so SVG labels wrap instead of being cut off. Two lines is the
 * usual most; a longer label gets a third rather than losing words. A single
 * word longer than the width stays whole.
 */
export function wrapLines(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : [""]
}

/** The line height for chart labels at 12px. */
export const LINE_H = 15
