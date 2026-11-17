export interface TodayBreadth {
  upN: number;
  dnN: number;
  hiN: number;
  loN: number;
  h1m: number;
  l1m: number;
  h3m: number;
  l3m: number;
  h6m: number;
  l6m: number;
  g25: number;
  l25: number;
  g50: number;
  l50: number;
  u4?: number;
  d4?: number;
  n: number;
  m50: number;
  m5: number;
}

export interface NiftyStats {
  chg: number;
  vs50: number;
  fromHigh: number;
}

export interface IndexChanges {
  nifty?: number;
  midcap?: number;
  smallcap?: number;
  vix?: number;
}

export interface ClusterItem {
  industry: string;
  n: number;
  h1: number;
  h3: number;
  h6: number;
  names: string[];
  all: [string, number][];
}

export interface MomoGroup {
  industry: string;
  stocks: [string, string, (number | null)[]][];
}

export interface MomoData {
  lb: number[];
  th: number[];
  groups: MomoGroup[];
}

export interface SeriesPoint {
  d: string;
  n: number;
  m50: number;
  h1m: number;
  l1m: number;
  h3m: number;
  l3m: number;
  h6m: number;
  l6m: number;
  g25: number;
  l25: number;
}

export interface RsData {
  asOf: string;
  n: number;
  tot: Record<string, number>;
  rows: [string, number, string][];
}

export interface RootData {
  asOf: string;
  final: boolean;
  shut: boolean;
  delayed?: boolean;
  lastStored: string;
  universe: number;
  today: TodayBreadth;
  nifty: NiftyStats;
  indexChg: IndexChanges;
  recentDays: Array<TodayBreadth & { date: string }>;
  series: SeriesPoint[];
  momo: MomoData;
  near: [string, number, number, string][];
  clusters: ClusterItem[];
  rs?: RsData;
}
