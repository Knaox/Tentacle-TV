export interface VttCue {
  start: number;
  end: number;
  text: string;
}

/** Parse HH:MM:SS.mmm or MM:SS.mmm timestamp to seconds */
function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(":");
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return Number(parts[0]) * 60 + parseFloat(parts[1]);
}

/** Strip HTML tags and positioning metadata from cue text */
function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]+\}/g, "")
    .trim();
}

/** Parse a WebVTT file into an array of cues */
export function parseVtt(vttContent: string): VttCue[] {
  const cues: VttCue[] = [];
  const blocks = vttContent.replace(/\r\n/g, "\n").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const arrowIdx = lines.findIndex((l) => l.includes("-->"));
    if (arrowIdx < 0) continue;

    // Parse timestamps — strip positioning metadata after the end timestamp
    const timeLine = lines[arrowIdx];
    const [startStr, rest] = timeLine.split("-->");
    const endStr = rest.trim().split(/\s/)[0];

    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);
    const text = cleanText(lines.slice(arrowIdx + 1).join("\n"));
    if (text) cues.push({ start, end, text });
  }

  return cues;
}
