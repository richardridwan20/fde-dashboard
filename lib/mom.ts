// Minutes-of-meeting generator.
//
// Turns the markdown you write in the meeting notes editor into the Slack post
// you send afterwards. No model involved, and deliberately so: the bullets are
// already your sentences, so this is templating rather than summarisation, and
// a paraphrase in a message going to a client is a liability rather than a
// feature.
//
// What it CANNOT do, by construction: invent attribution that is not in the
// notes, decide an action item is already done and drop it, or sharpen wording.
// Those need judgement, and an LLM handed the same notes would not know them
// either — it would guess. So the generator produces a faithful draft and
// leaves the editing to you.

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
  for (const p of people) {
    for (const a of [p.display_name, ...(p.aliases || [])]) {
      const an = norm(a);
      // Longest alias wins, so "colin fukai" beats "colin".
      if (an && n === an && (!best || an.length > norm(best.display_name).length)) best = p;
    }
  }
  return best;
}

/** Longest alias that the string STARTS with — for "Nursandy will take a look". */
function leadingPerson(people: Person[], line: string): { person: Person; rest: string } | null {
  const n = norm(line);
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
  // Walk the original string by the same number of significant characters.
  let consumed = 0;
  let i = 0;
  for (; i < line.length && consumed < hit.len; i++) {
    if (/[a-zA-Z0-9. ]/.test(line[i])) consumed++;
  }
  let rest = line.slice(i);
  if (hit.person.honorific && rest.startsWith(hit.person.honorific)) {
    rest = rest.slice(hit.person.honorific.length);
  }
  return { person: hit.person, rest: rest.replace(/^[\s,:-]+/, '') };
}

/** Slack renders <@Uxxxx> as a mention when SENT; pasted text does not convert,
 *  so the html flavour carries a real link and the plain one carries the id. */
function mention(p: Person, html: boolean, workspace: string) {
  const suffix = p.honorific || '';
  if (!p.slack_user_id) return `@${p.display_name}${suffix}`;
  return html
    ? `<a href="https://${workspace}/team/${p.slack_user_id}">@${p.display_name}</a>${suffix}`
    : `<@${p.slack_user_id}>${suffix}`;
}

/* ---------------------------------------------------------------- markdown */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Markdown emphasis and links to Slack mrkdwn. Slack uses *single* asterisks. */
function toMrkdwn(s: string) {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    .replace(/\*\*([^*]+)\*\*/g, '*$1*');
}

function toHtml(s: string) {
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

/* ----------------------------------------------------------------- parsing */

type Bullet = { text: string; depth: number };
export type Section = { heading: string; presenter: string | null; bullets: Bullet[]; raw: string[] };

const IMAGE_LINE = /^!\[[^\]]*\]\([^)]*\)\s*$/;

/** Splits on "## Heading", pulling an optional "(@Name)" presenter off it. */
export function parseNotes(md: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;

  for (const line of (md || '').split(/\r?\n/)) {
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h) {
      const full = h[1].trim();
      const pres = full.match(/\(\s*@?([^)]+?)\s*\)\s*$/);
      cur = {
        heading: (pres ? full.slice(0, pres.index).trim() : full).trim(),
        presenter: pres ? pres[1].trim() : null,
        bullets: [],
        raw: []
      };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (IMAGE_LINE.test(line.trim())) continue; // images cannot survive a paste
    cur.raw.push(line);
    const b = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (b) {
      const depth = Math.floor(b[1].replace(/\t/g, '  ').length / 2);
      const text = b[2].replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
      if (text) cur.bullets.push({ text, depth });
    }
  }
  return out;
}

const kind = (heading: string) => {
  const h = heading.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (/^topics?$/.test(h)) return 'topics';
  if (/^feedbacks?$/.test(h) || h === 'requirement gathering') return 'feedback';
  if (/^(action items?|actions|follow ?ups?|next steps?)$/.test(h)) return 'actions';
  if (/^photos?$/.test(h) || h === 'evidence') return 'photos';
  return 'other';
};

/* --------------------------------------------------------------- rendering */

export function buildMom(input: MomInput, html = false): string {
  const { title, notesMd, attendees = [], ccKeys = [], people } = input;
  const workspace = input.workspace || 'washimo.slack.com';
  const sections = parseNotes(notesMd);
  const M = (p: Person) => mention(p, html, workspace);
  const T = (s: string) => (html ? toHtml(s) : toMrkdwn(s));
  const bold = (s: string) => (html ? `<b>${escapeHtml(s)}</b>` : `*${s}*`);

  const out: string[] = [];
  out.push(`Sharing here the minutes of meeting for the ${T(title)} and some action items:`);

  const guests = attendees
    .map((a) => findPerson(people, a))
    .filter((p): p is Person => !!p);
  if (guests.length) {
    out.push('');
    out.push(
      `Thankyou for your time to attend the meeting as always ${guests.map(M).join(' ')}`
    );
  }

  const topics = sections.filter((s) => kind(s.heading) === 'topics');
  const feedback = sections.filter((s) => kind(s.heading) === 'feedback');
  const actions = sections.filter((s) => kind(s.heading) === 'actions');
  // Anything unrecognised is carried through rather than silently dropped —
  // losing a section you wrote is worse than having to delete one.
  const other = sections.filter((s) => kind(s.heading) === 'other' && s.bullets.length);

  if (topics.length || other.length) {
    out.push('');
    out.push(`${bold('MoM:')}`);
    out.push('');
    for (const s of topics) {
      const p = s.presenter ? findPerson(people, s.presenter) : null;
      const lead = p ? `${M(p)} shares topic for ${T(title)}` : `Topics covered in ${T(title)}`;
      out.push(`* ${lead}`);
      for (const b of s.bullets) out.push(`${'   '.repeat(b.depth + 1)}* ${T(b.text)}`);
    }
    for (const s of other) {
      out.push(`* ${T(s.heading)}`);
      for (const b of s.bullets) out.push(`${'   '.repeat(b.depth + 1)}* ${T(b.text)}`);
    }
  }

  for (const s of feedback) {
    const lines = s.raw.map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    out.push('');
    out.push(`${bold(`${s.heading} from my notes:`)}`);
    out.push('');
    // Fenced, so it stays verbatim — no mrkdwn conversion, bold markers intact.
    out.push('```');
    out.push(...(html ? lines.map(escapeHtml) : lines));
    out.push('```');
  }

  if (actions.some((s) => s.bullets.length)) {
    out.push('');
    out.push(`${bold('Action Items:')}`);
    out.push('');
    for (const s of actions) {
      for (const b of s.bullets) {
        const owner = b.depth === 0 ? leadingPerson(people, b.text) : null;
        const body = owner ? `${M(owner.person)} ${T(owner.rest)}` : T(b.text);
        out.push(`${'   '.repeat(b.depth)}* ${body}`);
      }
    }
  }

  out.push('');
  out.push('Thanks!');

  const cc = ccKeys
    .map((k) => people.find((p) => p.key === k))
    .filter((p): p is Person => !!p);
  if (cc.length) {
    out.push('');
    out.push(`cc: ${cc.map(M).join(' ')}`);
  }

  return out.join('\n');
}

/** Same content, as HTML — Slack keeps links when you paste rich text. */
export const buildMomHtml = (input: MomInput) =>
  `<div>${buildMom(input, true)
    .split('\n')
    .map((l) => (l.trim() === '' ? '<br>' : `${l}<br>`))
    .join('')}</div>`;
