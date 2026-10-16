/** Render the co-pilot's lightweight markup: **bold** and lines starting with a bullet. */
export function rich(text) {
  const lines = String(text).split('\n'),
    out = [];
  let list = null;
  const inl = (s, k) =>
    s.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
      p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
        <strong key={k + i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      ) : (
        p
      )
    );
  lines.forEach((ln, i) => {
    if (ln.startsWith('• ')) {
      if (!list) {
        list = [];
        out.push({ ul: list });
      }
      list.push(inl(ln.slice(2), 'l' + i));
    } else {
      list = null;
      if (ln.trim()) out.push({ p: inl(ln, 'p' + i) });
    }
  });
  return out.map((b, i) =>
    b.ul ? (
      <ul key={i} className="flex flex-col gap-1">
        {b.ul.map((li, j) => (
          <li key={j} className="grid grid-cols-[12px_1fr] gap-1.5">
            <span className="mt-[9px] h-[5px] w-[5px] rounded-full bg-fg3" />
            <span>{li}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p key={i}>{b.p}</p>
    )
  );
}
