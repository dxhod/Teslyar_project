export type MonthKey = "march" | "april";

export type MetricKey = "sales" | "netProfit" | "margin" | "units" | "roi" | "adSpend";

export type MetricSnapshot = {
  march: number;
  april: number;
  delta: number;
  deltaPct: number | null;
};

export type PortfolioSummary = {
  sales: MetricSnapshot;
  netProfit: MetricSnapshot;
  margin: MetricSnapshot;
  units: MetricSnapshot;
  roi: MetricSnapshot;
  adSpend: MetricSnapshot;
};

export type CountryRow = {
  country: string;
  marketplace: string;
  salesMarch: number;
  salesApril: number;
  salesDelta: number;
  netProfitMarch: number;
  netProfitApril: number;
  netProfitDelta: number;
  marginMarch: number;
  marginApril: number;
  marginDelta: number;
  unitsMarch: number;
  unitsApril: number;
  unitsDelta: number;
  adSpendMarch: number;
  adSpendApril: number;
  adSpendDelta: number;
};

export type ProductRow = {
  key: string;
  product: string;
  asin: string;
  sku: string;
  country: string;
  marketplace: string;
  salesMarch: number;
  salesApril: number;
  salesDelta: number;
  netProfitMarch: number;
  netProfitApril: number;
  netProfitDelta: number;
  marginMarch: number;
  marginApril: number;
  marginDelta: number;
  unitsMarch: number;
  unitsApril: number;
  unitsDelta: number;
  sessionsMarch: number;
  sessionsApril: number;
  sessionsDelta: number;
  bsrMarch: number;
  bsrApril: number;
  bsrDelta: number;
};

export type AttentionItem = {
  title: string;
  subtitle: string;
  reason: string;
  severity: "high" | "medium" | "low";
  impact: number;
};

export type AiInsight = {
  headline: string;
  bullets: string[];
  attention: AttentionItem[];
  actions?: string[];
  evidence: string[];
};

export type DashboardData = {
  portfolio: PortfolioSummary;
  countries: CountryRow[];
  products: ProductRow[];
  insight: AiInsight;
  source: {
    dataDir: string;
    plFiles: string[];
    ppcFiles: string[];
    generatedAt: string;
  };
};
