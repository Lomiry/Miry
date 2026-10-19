import { EmbyClient } from "./client";
import type { Item } from "../types/emby";
import type { Connection } from "../stores/connections";
export interface Recommendation {
  item: Item;
  connection: Connection;
  api: EmbyClient;
  category: string;
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
      const key = `${entry.connection.account.serverId || entry.connection.account.homeServer || entry.connection.account.server}:${entry.item.Id}`;
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
    { name: "电影", type: "Movie" },
    { name: "剧集", type: "Series" },
    ...views
      .filter((v) => /动画|动漫|anime/i.test(v.Name))
      .slice(0, 2)
      .map((v) => ({ name: v.Name, type: "Movie,Series", parent: v.Id })),
  ];
  const byCategory: Recommendation[][][] = categories.map(() => []);
  // At most two servers in flight and eight distinct server identities per visit.
  const identities = new Set<string>();
  const unique = connections
    .filter((c) => {
      const id = c.account.serverId || c.account.homeServer || c.account.server;
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
