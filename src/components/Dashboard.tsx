"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  CircleDollarSign,
  PackageSearch,
  Search,
  TrendingUp
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { AiInsight, CountryRow, DashboardData, MetricKey, ProductRow } from "@/lib/types";

const metricOptions: Array<{ key: MetricKey; label: string }> = [
  { key: "sales", label: "Sales" },
  { key: "netProfit", label: "Net profit" },
  { key: "margin", label: "Margin" },
  { key: "units", label: "Units" },
  { key: "adSpend", label: "PPC spend" }
];

const productMetricOptions = [
  { key: "salesApril", label: "Sales Apr" },
  { key: "netProfitApril", label: "Net profit Apr" },
  { key: "netProfitDelta", label: "Profit Δ" },
  { key: "marginDelta", label: "Margin Δ" },
  { key: "unitsDelta", label: "Units Δ" }
] as const;

const suggestedQuestions = [
  "Які SKU варто перевірити першими?",
  "Де найбільше просів Net profit?",
  "Які товари продавались найкраще у квітні?",
  "Що змінилось у маржі?"
];

type ProductMetric = (typeof productMetricOptions)[number]["key"];
type SortDirection = "asc" | "desc";
type AiStatus = "loading" | "groq" | "error";
type AskStatus = "idle" | "loading" | "done" | "error";

function money(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function number(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits }).format(value);
}

function pct(value: number) {
  return `${number(value, 1)}%`;
}

function deltaPct(value: number | null) {
  if (value === null) return "new";
  return `${value >= 0 ? "+" : ""}${pct(value)}`;
}

function metricValue(metric: MetricKey, value: number) {
  if (metric === "sales" || metric === "netProfit" || metric === "adSpend") return money(value);
  if (metric === "margin" || metric === "roi") return pct(value);
  return number(value);
}

function countryMetric(row: CountryRow, metric: MetricKey) {
  switch (metric) {
    case "sales":
      return row.salesApril;
    case "netProfit":
      return row.netProfitApril;
    case "margin":
      return row.marginApril;
    case "units":
      return row.unitsApril;
    case "adSpend":
      return row.adSpendApril;
    case "roi":
      return 0;
  }
}

function countryDelta(row: CountryRow, metric: MetricKey) {
  switch (metric) {
    case "sales":
      return row.salesDelta;
    case "netProfit":
      return row.netProfitDelta;
    case "margin":
      return row.marginDelta;
    case "units":
      return row.unitsDelta;
    case "adSpend":
      return row.adSpendDelta;
    case "roi":
      return 0;
  }
}

function productMetric(row: ProductRow, metric: ProductMetric) {
  return row[metric];
}

function KpiCard({
  title,
  value,
  previous,
  change,
  positiveIsGood = true,
  icon: Icon
}: {
  title: string;
  value: string;
  previous: string;
  change: string;
  positiveIsGood?: boolean;
  icon: typeof CircleDollarSign;
}) {
  const numericChange = change.startsWith("+") || change === "new";
  const good = positiveIsGood ? numericChange : !numericChange;

  return (
    <section className="kpi-card">
      <div className="kpi-icon" aria-hidden="true">
        <Icon size={21} />
      </div>
      <div>
        <p className="eyebrow">{title}</p>
        <strong>{value}</strong>
        <span className="muted">Березень: {previous}</span>
      </div>
      <div className={`change ${good ? "positive" : "negative"}`}>
        {numericChange ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        {change}
      </div>
    </section>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const [countryMetricKey, setCountryMetricKey] = useState<MetricKey>("netProfit");
  const [topN, setTopN] = useState(7);
  const [productSort, setProductSort] = useState<{ key: ProductMetric; direction: SortDirection }>({
    key: "netProfitDelta",
    direction: "desc"
  });
  const [query, setQuery] = useState("");
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>("loading");
  const [aiError, setAiError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [askStatus, setAskStatus] = useState<AskStatus>("idle");

  useEffect(() => {
    let cancelled = false;

    async function loadAiInsight() {
      try {
        const response = await fetch("/api/ai-insight", { cache: "no-store" });
        const payload = (await response.json()) as { insight?: AiInsight; provider?: string; message?: string };

        if (cancelled) return;

        if (response.ok && payload.insight && payload.provider === "groq") {
          setInsight(payload.insight);
          setAiStatus("groq");
          return;
        }

        setAiError(payload.message || "Groq AI did not return a valid insight.");
        setAiStatus("error");
      } catch {
        if (!cancelled) {
          setAiError("Не вдалося звернутися до Groq AI endpoint. Перевірте dev server і env-змінні.");
          setAiStatus("error");
        }
      }
    }

    loadAiInsight();

    return () => {
      cancelled = true;
    };
  }, []);

  const countries = useMemo(() => {
    return [...data.countries]
      .sort((a, b) => countryMetric(b, countryMetricKey) - countryMetric(a, countryMetricKey))
      .slice(0, topN);
  }, [countryMetricKey, data.countries, topN]);

  const products = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.products
      .filter((row) => {
        if (!normalized) return true;
        return `${row.product} ${row.asin} ${row.sku}`.toLowerCase().includes(normalized);
      })
      .sort((a, b) => {
        const diff = productMetric(a, productSort.key) - productMetric(b, productSort.key);
        return productSort.direction === "asc" ? diff : -diff;
      })
      .slice(0, 12);
  }, [data.products, productSort, query]);

  const biggestDrops = [...data.countries].sort((a, b) => a.netProfitDelta - b.netProfitDelta).slice(0, 4);

  function handleProductSort(key: ProductMetric) {
    setProductSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  function sortLabel(key: ProductMetric) {
    if (productSort.key !== key) return "↕";
    return productSort.direction === "asc" ? "↑" : "↓";
  }

  async function handleAskSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = question.trim();
    if (!normalized) return;

    setAskStatus("loading");
    setAnswer("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: normalized })
      });
      const raw = await response.text();
      let payload: { answer?: string; provider?: string; message?: string } = {};

      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { message: raw || `AI endpoint повернув HTTP ${response.status} без JSON-відповіді.` };
      }

      setAnswer(response.ok ? payload.answer || "Не вдалося отримати відповідь." : payload.message || "Groq AI повернув помилку.");
      setAskStatus(response.ok ? "done" : "error");
    } catch (error) {
      setAnswer(
        `Не вдалося звернутися до AI endpoint: ${
          error instanceof Error ? error.message : "unknown error"
        }. Перевірте, що сторінка відкрита на актуальному порту з npm run dev.`
      );
      setAskStatus("error");
    }
  }

  const aiStatusText =
    aiStatus === "groq" ? "AI" : aiStatus === "loading" ? "Loading AI" : "AI error";

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Northstar portfolio · March vs April 2026</p>
          <h1>Amazon EU Performance Dashboard</h1>
        </div>
      </header>

      <section className="kpi-grid" aria-label="Portfolio overview">
        <KpiCard
          title="Sales"
          value={money(data.portfolio.sales.april)}
          previous={money(data.portfolio.sales.march)}
          change={deltaPct(data.portfolio.sales.deltaPct)}
          icon={CircleDollarSign}
        />
        <KpiCard
          title="Net profit"
          value={money(data.portfolio.netProfit.april)}
          previous={money(data.portfolio.netProfit.march)}
          change={deltaPct(data.portfolio.netProfit.deltaPct)}
          icon={TrendingUp}
        />
        <KpiCard
          title="Margin"
          value={pct(data.portfolio.margin.april)}
          previous={pct(data.portfolio.margin.march)}
          change={`${data.portfolio.margin.delta >= 0 ? "+" : ""}${number(data.portfolio.margin.delta, 1)} п.п.`}
          icon={BarChart3}
        />
        <KpiCard
          title="Units"
          value={number(data.portfolio.units.april)}
          previous={number(data.portfolio.units.march)}
          change={deltaPct(data.portfolio.units.deltaPct)}
          icon={PackageSearch}
        />
      </section>

      <section className="insight-band">
        <div className="insight-main">
          <div className="section-title">
            <div className="title-left">
              <Brain size={22} />
              <h2>Executive insight</h2>
            </div>
            <span className={`ai-badge ${aiStatus}`}>{aiStatusText}</span>
          </div>
          {aiStatus === "loading" ? (
            <div className="ai-state">Groq аналізує підготовлені pandas-агрегати...</div>
          ) : aiStatus === "error" ? (
            <div className="ai-state error">{aiError}</div>
          ) : insight ? (
            <>
              <p className="headline">{insight.headline}</p>
              <ul className="insight-list">
                {insight.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <div className="actions-box">
                <h3>Recommended next actions</h3>
                <ol>
                  {(insight.actions || []).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              </div>
            </>
          ) : null}
        </div>
        <div className="attention-list">
          <h3>SKU на увагу {aiStatus === "groq" ? <span>selected by AI</span> : null}</h3>
          {aiStatus === "loading" ? <div className="ai-state compact">Очікуємо відповідь Groq...</div> : null}
          {aiStatus === "error" ? <div className="ai-state compact error">Attention недоступний без Groq.</div> : null}
          {insight?.attention.map((item) => (
              <article className={`attention-card ${item.severity}`} key={`${item.title}-${item.reason}`}>
                <AlertTriangle size={17} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.reason}</p>
                  <small>{item.subtitle}</small>
                </div>
              </article>
            ))}
        </div>
      </section>

      <section className="panel ask-panel">
        <div className="panel-header product-header">
          <div>
            <p className="eyebrow">AI Q&A</p>
            <h2>Запитайте AI-аналітика</h2>
          </div>
        </div>
        <form className="ask-form" onSubmit={handleAskSubmit}>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Наприклад: який SKU мав найбільші Sales у квітні та березні?"
          />
          <button type="submit" disabled={askStatus === "loading" || !question.trim()}>
            {askStatus === "loading" ? "Thinking..." : "Ask AI"}
          </button>
        </form>
        <div className="question-chips" aria-label="Suggested questions">
          {suggestedQuestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
        {answer ? <div className={`answer-box ${askStatus === "error" ? "error" : ""}`}>{answer}</div> : null}
      </section>

      <section className="dashboard-grid">
        <div className="panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Country breakdown</p>
              <h2>Топ країн за метрикою</h2>
            </div>
            <div className="toolbar">
              <select value={countryMetricKey} onChange={(event) => setCountryMetricKey(event.target.value as MetricKey)}>
                {metricOptions.map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.label}
                  </option>
                ))}
              </select>
              <select value={topN} onChange={(event) => setTopN(Number(event.target.value))}>
                {[3, 5, 7].map((value) => (
                  <option key={value} value={value}>
                    Top {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={countries} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d7dee8" />
                <XAxis dataKey="country" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => metricValue(countryMetricKey, Number(value))} />
                <Tooltip
                  cursor={{ fill: "rgba(30, 64, 175, 0.08)" }}
                  formatter={(value) => metricValue(countryMetricKey, Number(value))}
                  labelFormatter={(label) => `Country: ${label}`}
                />
                <Bar dataKey={(row) => countryMetric(row as CountryRow, countryMetricKey)} radius={[5, 5, 0, 0]}>
                  {countries.map((row) => (
                    <Cell key={row.country} fill={countryDelta(row, countryMetricKey) >= 0 ? "#0f766e" : "#c2410c"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <aside className="panel">
          <p className="eyebrow">Where we dropped</p>
          <h2>Просідання Net profit</h2>
          <div className="drop-list">
            {biggestDrops.map((row) => (
              <div className="drop-row" key={row.country}>
                <div>
                  <strong>{row.country}</strong>
                  <span>
                    {money(row.netProfitMarch)} {"->"} {money(row.netProfitApril)}
                  </span>
                </div>
                <b className={row.netProfitDelta >= 0 ? "positive-text" : "negative-text"}>{money(row.netProfitDelta)}</b>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-header product-header">
          <div>
            <p className="eyebrow">Product view</p>
            <h2>SKU / ASIN performance</h2>
          </div>
          <div className="toolbar product-toolbar">
            <label className="search-box">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Пошук SKU, ASIN або назви"
              />
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                {productMetricOptions.map((column) => (
                  <th
                    key={column.key}
                    aria-sort={
                      productSort.key === column.key
                        ? productSort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      className="sort-header"
                      type="button"
                      onClick={() => handleProductSort(column.key)}
                    >
                      {column.label}
                      <span aria-hidden="true">{sortLabel(column.key)}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((row) => (
                <tr key={row.key}>
                  <td>
                    <strong>{row.sku}</strong>
                    <span>{row.asin}</span>
                  </td>
                  <td className="product-cell">{row.product}</td>
                  <td>{money(row.salesApril)}</td>
                  <td>{money(row.netProfitApril)}</td>
                  <td className={row.netProfitDelta >= 0 ? "positive-text" : "negative-text"}>{money(row.netProfitDelta)}</td>
                  <td className={row.marginDelta >= 0 ? "positive-text" : "negative-text"}>
                    {row.marginDelta >= 0 ? "+" : ""}
                    {number(row.marginDelta, 1)} п.п.
                  </td>
                  <td className={row.unitsDelta >= 0 ? "positive-text" : "negative-text"}>
                    {row.unitsDelta >= 0 ? "+" : ""}
                    {number(row.unitsDelta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
