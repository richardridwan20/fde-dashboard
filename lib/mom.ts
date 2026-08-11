// Minutes-of-meeting generator.
//
// Turns the markdown you write in the meeting notes editor into the Slack post
// you send afterwards. No model involved, and deliberately so: the bullets are
// already your sentences, so this is templating rather than summarisation, and
// a paraphrase in a message going to a client is a liability.
//
// What it CANNOT do, by construction: invent attribution that is not in the
// notes, decide an action item is already done and drop it, or sharpen wording.
// A model handed the same notes would not know those either — it would guess.
//
// Structure: parse -> a small block tree -> two renderers. The tree matters.
// An earlier version rendered mrkdwn text and then patched HTML on top, which
// produced a hybrid carrying "* " bullets and ``` fences as literal characters
// into the rich clipboard flavour. Slack would have shown those verbatim.

export type Person = {
  key: string;
  display_name: string;
  slack_user_id: string | null;
  honorific: string | null;
  aliases: string[];
};

export type MomInput = {
  title: string;
  notesMd: string;
  attendees?: string[];
  ccKeys?: string[];
  people: Person[];
  workspace?: string;
};

/* ------------------------------------------------------------------ people */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9. ]/g, '').trim();

function findPerson(people: Person[], raw: string): Person | null {
  const n = norm(raw);
  if (!n) return null;
  let best: Person | null = null;
  let bestLen = -1;
  for (const p of people) {
    for (const a of [p.display_name, ...(p.aliases || [])]) {
      const an = norm(a);
      if (an && n === an && an.length > bestLen) {
        best = p;
        bestLen = an.length;
      }
    }
  }
  return best;
}

/** Longest alias the line STARTS with — for "Nursandy will take a look". */
function leadingPerson(people: Person[], line: string): { person: Person; rest: string } | null {
  // Unwrap a leading **Bold** / *Italic* name so the marker does not survive.
  const unwrapped = line.replace(/^(\*{1,3})([^*]+)\1/, '$2');
  const n = norm(unwrapped);
  let hit: { person: Person; len: number } | null = null;
  for (const p of people) {
    for (const a of [p.display_name, ...(p.aliases || [])]) {
      const an = norm(a);
      if (!an) continue;
      // norm() strips the hyphen, so the honorific has to go through it too —
      // otherwise "ikegami-san" never matches normalised "ikegamisan".
      const withHonorific = p.honorific ? norm(`${a}${p.honorific}`) : an;
      for (const cand of [withHonorific, an]) {
        if (n === cand || n.startsWith(cand + ' ')) {
          if (!hit || cand.length > hit.len) hit = { person: p, len: cand.length };
        }
      }
    }
  }
  if (!hit) return null;
  let consumed = 0;
  let i = 0;
  for (; i < unwrapped.length && consumed < hit.len; i++) {
    if (/[a-zA-Z0-9. ]/.test(unwrapped[i])) consumed++;
  }
  let rest = unwrapped.slice(i);
  if (hit.person.honorific && rest.startsWith(hit.person.honorific)) {
    rest = rest.slice(hit.person.honorific.length);
  }
  return { person: hit.person, rest: rest.replace(/^[\s,:*-]+/, '').trim() };
}

/* ------------------------------------------------------------------ tokens */

type Token = { k: 't'; v: string } | { k: 'm'; p: Person } | { k: 'raw'; v: string };
type Line = Token[];

type Block =
  | { t: 'para'; line: Line; strong?: boolean }
  | { t: 'bullets'; items: { line: Line; depth: number }[] }
  | { t: 'code'; lines: string[] };

const txt = (v: string): Line => [{ k: 't', v }];

/* ---------------------------------------------------------------- escaping */

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Allows one level of balanced parens inside the URL, so Wikipedia-style links
// survive: [wiki](https://en.wikipedia.org/wiki/Foo_(bar))
const LINK = /\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\)/g;

const toMrkdwn = (s: string) =>
  s.replace(LINK, '<$2|$1>').replace(/\*\*([^*]+)\*\*/g, '*$1*');

const toHtml = (s: string) =>
  escapeHtml(s)
    // Run against the escaped string, so the anchors inserted here are not
    // themselves escaped afterwards.
    .replace(
      /\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\)/g,
      (_m, label, url) => `<a href="${url}">${label}</a>`
    )
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

/** Slack renders <@Uxxxx> as a mention only for messages SENT through the API;
 *  pasted text does not convert, so the html flavour carries a real link. */
function mention(p: Person, html: boolean, workspace: string) {
  const suffix = p.honorific || '';
  if (!p.slack_user_id) {
    return html ? `@${escapeHtml(p.display_name + suffix)}` : `@${p.display_name}${suffix}`;
  }
  return html
    ? `<a href="https://${escapeHtml(workspace)}/team/${escapeHtml(p.slack_user_id)}">@${escapeHtml(
        p.display_name
      )}</a>${escapeHtml(suffix)}`
    : `<@${p.slack_user_id}>${suffix}`;
}

const renderLine = (line: Line, html: boolean, ws: string) =>
  line
    .map((t) =>
      t.k === 'm' ? mention(t.p, html, ws) : t.k === 'raw' ? (html ? escapeHtml(t.v) : t.v) : html ? toHtml(t.v) : toMrkdwn(t.v)
    )
    .join('')
    .trimEnd();

/* ----------------------------------------------------------------- parsing */

type Chunk = { text: string; depth: number };
export type Section = {
  heading: string;
  presenter: string | null;
  bullets: Chunk[];
  prose: string[];
  raw: string[];
};

const IMAGE_LINE = /^!\[[^\]]*\]\([^)]*\)\s*$/;
// Ordered lists count. Dropping "1. first" silently is the worst failure mode
// available to a tool whose premise is "these are already your sentences".
const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

export function parseNotes(md: string): Section[] {
  const lines = (md || '').split(/\r?\n/);

  // Indent unit, so 4-space notes do not render at double depth.
  let unit = 0;
  for (const l of lines) {
    const m = l.match(BULLET);
    if (m) {
      const w = m[1].replace(/\t/g, '  ').length;
      if (w > 0 && (unit === 0 || w < unit)) unit = w;
    }
  }
  if (unit === 0) unit = 2;

  const out: Section[] = [];
  let cur: Section | null = null;
  let fence: string | null = null;

  for (const line of lines) {
    const f = line.match(FENCE);
    if (f) {
      // A heading inside a fenced block is content, not a heading.
      fence = fence && line.trim().startsWith(fence) ? null : fence || f[1];
      if (cur) cur.raw.push(line);
      continue;
    }
    const h = !fence && line.match(/^#{1,3}\s+(.*)$/);
    if (h) {
      const full = h[1].trim();
      // Only Topics carries a presenter, so "## Risks (draft)" keeps its
      // parenthetical instead of having it silently eaten.
      const isTopics = /^topics?\b/i.test(full);
      const pres = isTopics ? full.match(/\(\s*@?([^)]+?)\s*\)\s*$/) : null;
      cur = {
        heading: (pres ? full.slice(0, pres.index).trim() : full).trim(),
        presenter: pres ? pres[1].trim() : null,
        bullets: [],
        prose: [],
        raw: []
      };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (IMAGE_LINE.test(line.trim())) continue; // images cannot survive a paste
    cur.raw.push(line);

    const b = !fence && line.match(BULLET);
    if (b) {
      const depth = Math.floor(b[1].replace(/\t/g, '  ').length / unit);
      const text = b[2].replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
      if (text) cur.bullets.push({ text, depth });
    } else if (line.trim()) {
      cur.prose.push(line.trim());
    }
  }
  return out;
}

const kind = (heading: string) => {
  const h = heading.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (/^topics?$/.test(h)) return 'topics';
  if (/^feedbacks?$/.test(h) || h === 'requirement gathering') return 'feedback';
  if (/^(action items?|actions|follow ?ups?|next steps?)$/.test(h)) return 'actions';
  // Only "photos" is dropped, and only because images cannot paste. "Evidence"
  // often carries written text, so it is carried through instead.
  if (/^photos?$/.test(h)) return 'photos';
  return 'other';
};

/** Fence long enough to survive backticks inside the content. */
function fenceFor(lines: string[]) {
  let longest = 2;
  for (const l of lines) {
    for (const m of l.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  }
  return '`'.repeat(longest + 1);
}

/* ----------------------------------------------------------------- builder */

export type MomResult = { blocks: Block[]; unknownAttendees: string[]; empty: boolean };

export function buildBlocks(input: MomInput): MomResult {
  const { title, notesMd, attendees = [], ccKeys = [], people } = input;
  const sections = parseNotes(notesMd);
  const blocks: Block[] = [];
  const unknownAttendees: string[] = [];

  blocks.push({ t: 'para', line: txt(`Sharing here the minutes of meeting for the ${title} and some action items:`) });

  if (attendees.length) {
    const line: Line = [{ k: 't', v: 'Thankyou for your time to attend the meeting as always ' }];
    attendees.forEach((a, i) => {
      const p = findPerson(people, a);
      if (i) line.push({ k: 't', v: ' ' });
      if (p) line.push({ k: 'm', p });
      else {
        // Thanking four of the five people who turned up is exactly the small
        // wrongness this feature exists to avoid. Keep the name, flag it.
        unknownAttendees.push(a);
        line.push({ k: 'raw', v: `@${a}` });
      }
    });
    blocks.push({ t: 'para', line });
  }

  const topics = sections.filter((s) => kind(s.heading) === 'topics');
  const feedback = sections.filter((s) => kind(s.heading) === 'feedback');
  const actions = sections.filter((s) => kind(s.heading) === 'actions');
  const other = sections.filter(
    (s) => kind(s.heading) === 'other' && (s.bullets.length || s.prose.length)
  );

  let body = 0;

  if (topics.length || other.length) {
    const items: { line: Line; depth: number }[] = [];
    for (const s of topics) {
      const p = s.presenter ? findPerson(people, s.presenter) : null;
      const lead: Line = p
        ? [{ k: 'm', p }, { k: 't', v: ` shares topic for ${title}` }]
        : s.presenter
          // Attribution you wrote but we could not resolve stays visible.
          ? [{ k: 'raw', v: `@${s.presenter}` }, { k: 't', v: ` shares topic for ${title}` }]
          : txt(`Topics covered in ${title}`);
      items.push({ line: lead, depth: 0 });
      for (const b of s.bullets) items.push({ line: txt(b.text), depth: b.depth + 1 });
    }
    for (const s of other) {
      items.push({ line: txt(s.heading), depth: 0 });
      for (const l of s.prose) items.push({ line: txt(l), depth: 1 });
      for (const b of s.bullets) items.push({ line: txt(b.text), depth: b.depth + 1 });
    }
    if (items.length) {
      blocks.push({ t: 'para', line: txt('MoM:'), strong: true });
      blocks.push({ t: 'bullets', items });
      body++;
    }
  }

  for (const s of feedback) {
    const lines = s.raw.map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    blocks.push({ t: 'para', line: txt(`${s.heading} from my notes:`), strong: true });
    blocks.push({ t: 'code', lines });
    body++;
  }

  const actionItems: { line: Line; depth: number }[] = [];
  for (const s of actions) {
    for (const b of s.bullets) {
      // Resolve at every depth — a nested "Tom to verify" is still Tom's.
      const owner = leadingPerson(people, b.text);
      actionItems.push({
        line: owner
          ? owner.rest
            ? [{ k: 'm', p: owner.person }, { k: 't', v: ` ${owner.rest}` }]
            : [{ k: 'm', p: owner.person }]
          : txt(b.text),
        depth: b.depth
      });
    }
    for (const l of s.prose) actionItems.push({ line: txt(l), depth: 0 });
  }
  if (actionItems.length) {
    blocks.push({ t: 'para', line: txt('Action Items:'), strong: true });
    blocks.push({ t: 'bullets', items: actionItems });
    body++;
  }

  blocks.push({ t: 'para', line: txt('Thanks!') });

  const cc = ccKeys.map((k) => people.find((p) => p.key === k)).filter((p): p is Person => !!p);
  if (cc.length) {
    const line: Line = [{ k: 't', v: 'cc: ' }];
    cc.forEach((p, i) => {
      if (i) line.push({ k: 't', v: ' ' });
      line.push({ k: 'm', p });
    });
    blocks.push({ t: 'para', line });
  }

  return { blocks, unknownAttendees, empty: body === 0 };
}

/* --------------------------------------------------------------- renderers */

export function renderMrkdwn(blocks: Block[], ws: string): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (out.length) out.push('');
    if (b.t === 'para') {
      const s = renderLine(b.line, false, ws);
      // No trailing blank here — the next block already prepends one.
      out.push(b.strong ? `*${s}*` : s);
    } else if (b.t === 'bullets') {
      for (const it of b.items) out.push(`${'   '.repeat(it.depth)}* ${renderLine(it.line, false, ws)}`);
    } else {
      const f = fenceFor(b.lines);
      out.push(f, ...b.lines, f);
    }
  }
  return out.join('\n');
}

export function renderHtml(blocks: Block[], ws: string): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.t === 'para') {
      const s = renderLine(b.line, true, ws);
      out.push(`<p>${b.strong ? `<b>${s}</b>` : s}</p>`);
    } else if (b.t === 'code') {
      out.push(`<pre>${b.lines.map(escapeHtml).join('\n')}</pre>`);
    } else {
      // Real nested lists, so Slack paste yields a real list rather than
      // literal asterisks.
      let depth = 0;
      out.push('<ul>');
      for (const it of b.items) {
        while (depth < it.depth) {
          out.push('<ul>');
          depth++;
        }
        while (depth > it.depth) {
          out.push('</ul>');
          depth--;
        }
        out.push(`<li>${renderLine(it.line, true, ws)}</li>`);
      }
      while (depth-- > 0) out.push('</ul>');
      out.push('</ul>');
    }
  }
  return out.join('');
}

export function buildMom(input: MomInput): string {
  return renderMrkdwn(buildBlocks(input).blocks, input.workspace || 'washimo.slack.com');
}

export function buildMomHtml(input: MomInput): string {
  return renderHtml(buildBlocks(input).blocks, input.workspace || 'washimo.slack.com');
}
