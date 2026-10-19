import type { Item } from "./types/emby";
export const demoItems: Item[] = [
  {
    Id: "d1",
    Name: "星际穿越",
    Type: "Movie",
    ProductionYear: 2014,
    CommunityRating: 8.7,
    RunTimeTicks: 101400000000,
    Genres: ["科幻", "冒险"],
    Overview:
      "一群探险家穿越虫洞，踏上一场跨越星系的旅程，寻找人类未来的家园。",
    UserData: { PlaybackPositionTicks: 22500000000, PlayedPercentage: 22 },
    People: [
      { Id: "demo-director", Name: "示例导演", Type: "Director" },
      { Id: "demo-actor", Name: "示例演员", Type: "Actor", Role: "主演" },
    ],
  },
  {
    Id: "d2",
    Name: "沙丘：第二部",
    Type: "Movie",
    ProductionYear: 2024,
    CommunityRating: 8.5,
    Genres: ["科幻", "冒险"],
    Overview: "在厄拉科斯的沙漠中，保罗与弗雷曼人携手，走向未知的命运。",
    People: [{ Id: "demo-actor", Name: "示例演员", Type: "Actor" }],
  },
  {
    Id: "d3",
    Name: "银翼杀手 2049",
    Type: "Movie",
    ProductionYear: 2017,
    CommunityRating: 8.0,
    Genres: ["科幻"],
    Overview: "一位新的银翼杀手发现了一个埋藏多年的秘密。",
  },
  {
    Id: "d4",
    Name: "降临",
    Type: "Movie",
    ProductionYear: 2016,
    Genres: ["科幻"],
    Overview: "语言学家尝试理解来自星空的访客。",
  },
  {
    Id: "d5",
    Name: "流人",
    Type: "Series",
    ProductionYear: 2022,
    Overview: "一群被边缘化的情报人员，仍然试图完成自己的使命。",
  },
  {
    Id: "d6",
    Name: "人生切割术",
    Type: "Series",
    ProductionYear: 2022,
    Overview: "工作与生活的记忆被切开之后，边界背后的秘密渐渐浮现。",
  },
];
export const demoViews: Item[] = [
  {
    Id: "movies",
    Name: "电影",
    Type: "CollectionFolder",
    CollectionType: "movies",
  },
  {
    Id: "series",
    Name: "电视剧",
    Type: "CollectionFolder",
    CollectionType: "tvshows",
  },
];
export const demoPeople: Item[] = [
  {
    Id: "demo-director",
    Name: "示例导演",
    Type: "Person",
    Overview:
      "演示人物资料，用于体验人物简介与作品导航。真实人物资料由所连接的服务器提供。",
  },
  {
    Id: "demo-actor",
    Name: "示例演员",
    Type: "Person",
    Overview:
      "演示人物资料，用于体验人物简介与作品导航。可以在下方按电影、剧集筛选作品，并打开影片详情。",
  },
];
export function demoChildren(item: Item): Item[] {
  if (item.Type === "Series")
    return [
      {
        Id: `${item.Id}-season1`,
        Name: "第 1 季",
        Type: "Season",
        SeriesName: item.Name,
      },
    ];
  if (item.Type === "Season")
    return Array.from({ length: 6 }, (_, index) => ({
      Id: `${item.Id}-ep${index + 1}`,
      Name: `第 ${index + 1} 集`,
      Type: "Episode",
      IndexNumber: index + 1,
      SeriesName: item.SeriesName,
      Overview: "演示剧集：用于预览导航和详情界面。",
    }));
  return [];
}
