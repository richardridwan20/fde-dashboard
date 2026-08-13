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

import { DOING_KINDS } from '@/lib/enums';

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
  /** Activity kind. Work kinds get "summary of", not "minutes of meeting for". */
  kind?: string;
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
  // Unwrap a leading wrapper around the name so its closing half cannot survive
  // into the output: **Nursandy**, [Colin Fukai], (Nursandy). Transcription
  // tools emit the bracketed form constantly.
  const unwrapped = line
    .replace(/^(\*{1,3})([^*]+)\1/, '$2')
    .replace(/^\[([^\]]+)\]/, '$1')
    .replace(/^\(([^)]+)\)/, '$1');
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
  // Deliberately excludes '*': stripping the opening half of a following bold
  // run ("Tom **to verify**") orphans the closing half, which Slack shows raw.
  return { person: hit.person, rest: rest.replace(/^[\s,:;.\]\)-]+/, '').trim() };
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

// Note: &, < and > are deliberately NOT escaped for the plain flavour. Slack
// only parses <…> as link syntax for messages sent through the API; text pasted
// into the composer is literal, and Slack escapes it on send. Escaping here
// would make "a < b" paste as "a &lt; b".
const toMrkdwn = (s: string) =>
  s.replace(new RegExp(LINK.source, 'g'), '<$2|$1>').replace(/\*\*([^*]+)\*\*/g, '*$1*');

/** Only schemes that make sense in minutes. Keeps javascript:/data: out of an
 *  href that ends up on the clipboard and then in someone else's editor. */
const SAFE_URL = /^(https?:|mailto:|\/|#)/i;

const toHtml = (s: string) =>
  // Escape first, so the anchors inserted below are not escaped afterwards.
  escapeHtml(s)
    .replace(new RegExp(LINK.source, 'g'), (m, label, url) =>
      SAFE_URL.test(url) ? `<a href="${url}">${label}</a>` : m
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

/** One line of section content. Bullets and prose share a list so document
 *  order survives — keeping them apart rendered every prose line above every
 *  bullet, regardless of where it was written. */
type Chunk = { text: string; depth: number; prose?: boolean };
export type Section = {
  heading: string;
  presenter: string | null;
  chunks: Chunk[];
  raw: string[];
};

const IMAGE_LINE = /^!\[[^\]]*\]\([^)]*\)\s*$/;
// Ordered lists count. Dropping "1. first" silently is the worst failure mode
// available to a tool whose premise is "these are already your sentences".
const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

export function parseNotes(md: string): Section[] {
  const lines = (md || '').split(/\r?\n/);
  const out: Section[] = [];
  let cur: Section | null = null;
  let fence: string | null = null;
  // Indent widths seen so far in this section. Depth is position in this
  // stack, not width/unit — a global "unit" heuristic meant one stray
  // single-space indent anywhere multiplied every real depth in the document.
  let indents: number[] = [];

  for (const line of lines) {
    const f = line.match(FENCE);
    if (f) {
      // A heading inside a fenced block is content, not a heading.
      fence = fence && line.trim().startsWith(fence) ? null : fence || f[1];
      if (cur) cur.raw.push(line);
      continue;
    }
    const h = !fence && line.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      const full = h[1].trim();
      indents = [];
      // Only a heading that IS Topics carries a presenter, so "## Risks (draft)"
      // and "## Topics for discussion (draft)" both keep their parenthetical.
      const isTopics = /^topics?\s*(\(|$)/i.test(full);
      const pres = isTopics ? full.match(/\(\s*@?([^)]+?)\s*\)\s*$/) : null;
      cur = {
        heading: (pres ? full.slice(0, pres.index).trim() : full).trim(),
        presenter: pres ? pres[1].trim() : null,
        chunks: [],
        raw: []
      };
      out.push(cur);
      continue;
    }
    if (IMAGE_LINE.test(line.trim())) continue; // images cannot survive a paste
    if (!cur) {
      // Content above the first heading is still content. Dropping it was the
      // same silent loss as the prose bug, just at the top of the document.
      if (!line.trim()) continue;
      cur = { heading: '', presenter: null, chunks: [], raw: [] };
      out.push(cur);
    }
    cur.raw.push(line);

    const b = !fence && line.match(BULLET);
    if (b) {
      const w = b[1].replace(/\t/g, '  ').length;
      while (indents.length && w < indents[indents.length - 1]) indents.pop();
      if (!indents.length || w > indents[indents.length - 1]) indents.push(w);
      const text = b[2].replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
      if (text) cur.chunks.push({ text, depth: indents.length - 1 });
    } else if (line.trim()) {
      cur.chunks.push({ text: line.trim(), depth: 0, prose: true });
    }
  }
  return out;
}

const kind = (heading: string) => {
  // Drop a trailing parenthetical first, or "## Action Items (final)" falls
  // through to `other` — rendering under MoM with no owner resolution.
  const h = heading
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim();
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

export type MomResult = { blocks: Block[]; unlinked: string[]; empty: boolean };

export function buildBlocks(input: MomInput): MomResult {
  // NOT `kind` — that is the module-level section classifier, and shadowing it
  // here silently broke every section lookup below.
  const { title, notesMd, kind: activityKind = '', attendees = [], ccKeys = [], people } = input;
  const doing = DOING_KINDS.has(activityKind);
  const sections = parseNotes(notesMd);
  const blocks: Block[] = [];
  // Every name that will paste as plain text rather than a mention — whether
  // it is missing from the table entirely, or present with no Slack ID.
  const unlinked: string[] = [];
  const flag = (n: string) => {
    if (!unlinked.includes(n)) unlinked.push(n);
  };

  blocks.push({
    t: 'para',
    line: txt(
      doing
        ? `Sharing here the summary of ${title} and some action items:`
        : `Sharing here the minutes of meeting for the ${title} and some action items:`
    )
  });

  const guests = attendees.map((a) => a?.trim()).filter((a, i, arr) => a && arr.indexOf(a) === i);
  if (guests.length) {
    const line: Line = [
      {
        k: 't',
        v: doing
          ? 'Thankyou for your support on this '
          : 'Thankyou for your time to attend the meeting as always '
      }
    ];
    guests.forEach((a, i) => {
      const p = findPerson(people, a);
      if (i) line.push({ k: 't', v: ' ' });
      if (p) {
        if (!p.slack_user_id) flag(p.display_name);
        line.push({ k: 'm', p });
      } else {
        // Thanking four of the five people who turned up is exactly the small
        // wrongness this feature exists to avoid. Keep the name, flag it.
        flag(a);
        line.push({ k: 'raw', v: `@${a}` });
      }
    });
    blocks.push({ t: 'para', line });
  }

  const topics = sections.filter((s) => kind(s.heading) === 'topics');
  const feedback = sections.filter((s) => kind(s.heading) === 'feedback');
  const actions = sections.filter((s) => kind(s.heading) === 'actions');
  const other = sections.filter((s) => kind(s.heading) === 'other' && s.chunks.length);

  let body = 0;

  if (topics.length || other.length) {
    const items: { line: Line; depth: number }[] = [];
    for (const s of topics) {
      // A bare "## Topics" with nothing under it must not manufacture a bullet —
      // that made `empty` report false and the panel offer a draft containing
      // no minutes.
      if (!s.chunks.length) continue;
      const p = s.presenter ? findPerson(people, s.presenter) : null;
      if (p && !p.slack_user_id) flag(p.display_name);
      const shares = doing ? ` ran ${title}` : ` shares topic for ${title}`;
      const lead: Line = p
        ? [{ k: 'm', p }, { k: 't', v: shares }]
        : s.presenter
          // Attribution you wrote but we could not resolve stays visible, and
          // gets flagged like any other name that pastes as plain text.
          ? (flag(s.presenter),
            [{ k: 'raw', v: `@${s.presenter}` }, { k: 't', v: shares }])
          : txt(doing ? `What was done on ${title}` : `Topics covered in ${title}`);
      items.push({ line: lead, depth: 0 });
      // Prose is content too — dropping it was the same silent loss the
      // ordered-list fix was written to stop.
      for (const c of s.chunks) items.push({ line: txt(c.text), depth: c.depth + 1 });
    }
    for (const s of other) {
      // The implicit pre-heading section has no title to lead with.
      const lead = s.heading ? 1 : 0;
      if (lead) items.push({ line: txt(s.heading), depth: 0 });
      for (const c of s.chunks) items.push({ line: txt(c.text), depth: c.depth + lead });
    }
    if (items.length) {
      blocks.push({ t: 'para', line: txt(doing ? 'Summary:' : 'MoM:'), strong: true });
      blocks.push({ t: 'bullets', items });
      body++;
    }
  }

  for (const s of feedback) {
    // Trim the ends only. Interior blank lines are paragraph separation in a
    // block the contract advertises as reproduced word for word.
    const kept = s.raw.map((l) => l.trimEnd());
    while (kept.length && !kept[0].trim()) kept.shift();
    while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
    const lines = kept;
    // Bare fence markers are not content — they would render a Feedbacks
    // heading over an empty code block and make `empty` report false.
    if (!lines.some((l) => l.trim() && !FENCE.test(l))) continue;
    blocks.push({ t: 'para', line: txt(`${s.heading} from my notes:`), strong: true });
    blocks.push({ t: 'code', lines });
    body++;
  }

  const actionItems: { line: Line; depth: number }[] = [];
  for (const s of actions) {
    for (const c of s.chunks) {
      // Resolve at every depth — a nested "Tom to verify" is still Tom's.
      const owner = leadingPerson(people, c.text);
      if (owner && !owner.person.slack_user_id) flag(owner.person.display_name);
      actionItems.push({
        line: owner
          ? owner.rest
            ? [{ k: 'm', p: owner.person }, { k: 't', v: ` ${owner.rest}` }]
            : [{ k: 'm', p: owner.person }]
          : txt(c.text),
        depth: c.depth
      });
    }
  }
  if (actionItems.length) {
    blocks.push({ t: 'para', line: txt('Action Items:'), strong: true });
    blocks.push({ t: 'bullets', items: actionItems });
    body++;
  }

  blocks.push({ t: 'para', line: txt('Thanks!') });

  const cc = ccKeys.map((k) => people.find((p) => p.key === k)).filter((p): p is Person => !!p);
  // A cc key with no matching person is a config error, not a silent no-op.
  for (const k of ccKeys) if (!people.some((p) => p.key === k)) flag(k);
  if (cc.length) {
    const line: Line = [{ k: 't', v: 'cc: ' }];
    cc.forEach((p, i) => {
      if (i) line.push({ k: 't', v: ' ' });
      if (!p.slack_user_id) flag(p.display_name);
      line.push({ k: 'm', p });
    });
    blocks.push({ t: 'para', line });
  }

  return { blocks, unlinked, empty: body === 0 };
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
      // Same clamping as the html flavour, so the two agree on indentation.
      const path: number[] = [];
      for (const it of b.items) {
        const d = Math.min(it.depth, path.length);
        path.length = d;
        path.push(0);
        out.push(`${'   '.repeat(d)}* ${renderLine(it.line, false, ws)}`);
      }
    } else {
      const f = fenceFor(b.lines);
      out.push(f, ...b.lines, f);
    }
  }
  return out.join('\n');
}

type Node = { line: Line; children: Node[] };

/**
 * Flat depth-tagged items to a tree. Depth is clamped to one deeper than the
 * current path, so a jump from 0 to 3 cannot open empty wrapper lists.
 */
function toTree(items: { line: Line; depth: number }[]): Node[] {
  const roots: Node[] = [];
  const path: Node[] = [];
  for (const it of items) {
    const node: Node = { line: it.line, children: [] };
    const d = Math.min(it.depth, path.length);
    if (d === 0) roots.push(node);
    else path[d - 1].children.push(node);
    path.length = d;
    path.push(node);
  }
  return roots;
}

/** <ul> nests INSIDE the <li> it belongs to. A <ul> as a direct child of a
 *  <ul> is non-conforming, and a sanitising paste target may hoist or drop it. */
function renderTree(nodes: Node[], ws: string): string {
  return `<ul>${nodes
    .map(
      (n) =>
        `<li>${renderLine(n.line, true, ws)}${n.children.length ? renderTree(n.children, ws) : ''}</li>`
    )
    .join('')}</ul>`;
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
      out.push(renderTree(toTree(b.items), ws));
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
