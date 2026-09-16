/**
 * 블로그 본문(markdown)을 모바일 가독성에 맞게 재구성한다.
 * - 길게 이어진 문단을 2~3문장(약 100자) 단위 문단으로 나눈다. (플랫폼 규칙: 2~3문장마다 줄바꿈, 한 문단 4줄 이내)
 * - 제목·목록·표·인용·구분선·코드 블록은 건드리지 않는다.
 * 결정적(deterministic) 처리이므로 모델 출력이 길게 뭉쳐 나와도 항상 같은 결과를 낸다.
 */
const MAX_SENTENCES = 3;
const MAX_CHARS = 100;

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  const t = text.trim();
  for (let i = 0; i < t.length; i++) {
    cur += t[i];
    if (!/[.!?…]/.test(t[i])) continue;
    // 연속 구두점과 닫는 따옴표·괄호는 같은 문장에 붙인다
    let j = i + 1;
    while (j < t.length && /[.!?…"'”’)\]]/.test(t[j])) cur += t[j++];
    // 뒤에 공백이 오거나 끝이면 문장 경계. 숫자 소수점(4.5)처럼 바로 글자가 이어지면 경계가 아니다
    if (j >= t.length || /\s/.test(t[j])) {
      out.push(cur.trim());
      cur = "";
    }
    i = j - 1;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [t];
}

function isBlockLine(line: string): boolean {
  return /^\s*(#{1,6}\s|[-*]\s|\d+\.\s|>|\||---+\s*$|```)/.test(line);
}

export function formatForMobile(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let inCode = false;
  const flush = () => {
    if (!para.length) return;
    const text = para.join(" ").replace(/\s+/g, " ").trim();
    const sentences = splitSentences(text);
    const groups: string[][] = [];
    let cur: string[] = [];
    let curLen = 0;
    for (const s of sentences) {
      if (cur.length && (cur.length >= MAX_SENTENCES || curLen + s.length > MAX_CHARS)) {
        groups.push(cur);
        cur = [];
        curLen = 0;
      }
      cur.push(s);
      curLen += s.length;
    }
    if (cur.length) groups.push(cur);
    groups.forEach((g, i) => {
      out.push(g.join(" "));
      if (i < groups.length - 1) out.push("");
    });
    para = [];
  };
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flush();
      inCode = !inCode;
      out.push(line);
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }
    if (/^\s*$/.test(line)) {
      flush();
      out.push("");
      continue;
    }
    if (isBlockLine(line)) {
      flush();
      out.push(line);
      continue;
    }
    para.push(line);
  }
  flush();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
