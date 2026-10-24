import type { Source } from "../../data/schema";
import { getSource } from "../../data/sources";

/** 来源列表：按 id 查登记表，有 URL 的给出链接。 */
export function Sources({ ids }: { ids: string[] }) {
  return (
    <ul className="detail-sources">
      {ids.map((id) => {
        const s: Source | undefined = getSource(id);
        if (!s) return <li key={id}>{id}（来源未登记）</li>;
        return (
          <li key={id}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            ) : (
              s.title
            )}
            {s.license && <span className="detail-license"> · {s.license}</span>}
          </li>
        );
      })}
    </ul>
  );
}
