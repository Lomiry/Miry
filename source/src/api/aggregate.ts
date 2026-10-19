import { EmbyClient } from "./client";
import { pageInfo } from "./pagination";
import type { Connection } from "../stores/connections";
import type { Item } from "../types/emby";
import { favoriteScope } from "./favorites";
import { normalizePageSize } from "../stores/browsePreferences";
export interface SearchGroup {
  connection: Connection;
  items: Item[];
  total: number;
  totalKnown: boolean;
  hasMore: boolean;
  error: string;
}
export async function aggregateSearch(
  connections: Connection[],
  query: string,
  page: number,
  signal: AbortSignal,
  options: Record<string, string | number | boolean | undefined> = {},
): Promise<SearchGroup[]> {
  const pageSize = normalizePageSize(options.Limit);
  return Promise.all(
    connections.map(async (connection) => {
      try {
        const result = await new EmbyClient(connection.account).items(
          {
            ...options,
            SearchTerm: query,
            Recursive: true,
            IncludeItemTypes:
              options.IncludeItemTypes || "Movie,Series,Episode",
            StartIndex: page * pageSize,
            Limit: pageSize,
          },
          signal,
        );
        return {
          connection,
          items: result.Items,
          ...pageInfo(result, page * pageSize, pageSize),
          error: "",
        };
      } catch (e) {
        if (signal.aborted) throw e;
        return {
          connection,
          items: [],
          total: 0,
          totalKnown: true,
          hasMore: false,
          error: e instanceof Error ? e.message : "连接失败",
        };
      }
    }),
  );
}
export async function aggregateFavorites(
  connections: Connection[],
  page: number,
  signal: AbortSignal,
): Promise<SearchGroup[]> {
  const unique = [
    ...new Map(connections.map((c) => [favoriteScope(c.account), c])).values(),
  ];
  return Promise.all(
    unique.map(async (connection) => {
      try {
        const result = await new EmbyClient(connection.account).favorites(
          page,
          signal,
        );
        return {
          connection,
          items: [
            ...new Map(result.Items.map((item) => [item.Id, item])).values(),
          ],
          ...pageInfo(result, page * 30, 30),
          error: "",
        };
      } catch (e) {
        if (signal.aborted) throw e;
        return {
          connection,
          items: [],
          total: 0,
          totalKnown: true,
          hasMore: false,
          error: e instanceof Error ? e.message : "连接失败",
        };
      }
    }),
  );
}
