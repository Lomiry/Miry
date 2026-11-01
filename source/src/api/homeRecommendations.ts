import { t } from "../i18n/core";
import type { MessageKey } from "../i18n/zh-CN";
import { EmbyClient } from "./client";
import type { Item } from "../types/emby";
import type { Connection } from "../stores/connections";
import { favoriteScope } from "./favorites";
export interface Recommendation {
  item: Item;
  connection: Connection;
  api: EmbyClient;
  category: string;
  categoryKey?: MessageKey;
}
export function balanceRecommendations(
  groups: Recommendation[][],
  limit = 12,
): Recommendation[] {
  const result: Recommendation[] = [],
    seen = new Set<string>();
  for (let row = 0; row < 12 && result.length < limit; row++)
    for (const group of groups) {
      const entry = group[row];
      if (!entry) continue;
      const key = JSON.stringify([
        favoriteScope(entry.connection.account),
        entry.item.Id,
      ]);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
      if (result.length === limit) break;
    }
  return result;
}
export async function homeRecommendations(
  connections: Connection[],
  views: Item[],
  signal: AbortSignal,
): Promise<Recommendation[]> {
  const categories = [
    {
      name: t("library.movies"),
      type: "Movie",
      key: "library.movies" as const,
    },
    {
      name: t("library.tv_shows"),
      type: "Series",
      key: "library.tv_shows" as const,
    },
    ...views
      .filter((v) => /动画|动漫|anime/i.test(v.Name))
      .slice(0, 2)
      .map((v) => ({ name: v.Name, type: "Movie,Series", parent: v.Id })),
  ];
  const byCategory: Recommendation[][][] = categories.map(() => []);
  // At most two accounts in flight and eight distinct server/user scopes per visit.
  const identities = new Set<string>();
  const unique = connections
    .filter((c) => {
      const id = favoriteScope(c.account);
      if (identities.has(id)) return false;
      identities.add(id);
      return true;
    })
    .slice(0, 8);
  for (let start = 0; start < unique.length; start += 2)
    await Promise.all(
      unique.slice(start, start + 2).map(async (connection, index) => {
        const api = new EmbyClient(connection.account);
        for (let n = 0; n < categories.length; n++) {
          const category = categories[n];
          if ("parent" in category && connection !== connections[0]) continue;
          try {
            const data = await api.items(
              {
                ParentId: "parent" in category ? category.parent : undefined,
                Recursive: true,
                IncludeItemTypes: category.type,
                SortBy: "Random",
                Limit: 12,
              },
              signal,
            );
            byCategory[n][start + index] = data.Items.filter((item) =>
              category.type.split(",").includes(item.Type),
            ).map((item) => ({
              item,
              connection,
              api,
              category: category.name,
              categoryKey: "key" in category ? category.key : undefined,
            }));
          } catch (e) {
            if (signal.aborted) throw e;
          }
        }
      }),
    );
  return byCategory.flatMap((groups) =>
    balanceRecommendations(groups.filter(Boolean)),
  );
}
