import type { DashboardData } from "./types";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildQaContext(data: DashboardData) {
  const compactProducts = data.products.map((product) => ({
    sku: product.sku,
    asin: product.asin,
    product: product.product.slice(0, 80),
    salesMarch: round(product.salesMarch),
    salesApril: round(product.salesApril),
    salesDelta: round(product.salesDelta),
    unitsMarch: round(product.unitsMarch),
    unitsApril: round(product.unitsApril),
    unitsDelta: round(product.unitsDelta),
    netProfitMarch: round(product.netProfitMarch),
    netProfitApril: round(product.netProfitApril),
    netProfitDelta: round(product.netProfitDelta),
    marginMarch: round(product.marginMarch),
    marginApril: round(product.marginApril),
    marginDelta: round(product.marginDelta)
  }));

  const top = (field: keyof (typeof compactProducts)[number], direction: "asc" | "desc" = "desc") =>
    [...compactProducts]
      .sort((a, b) => {
        const left = Number(a[field]);
        const right = Number(b[field]);
        return direction === "desc" ? right - left : left - right;
      })
      .slice(0, 8);

  return {
    period: "April 2026 vs March 2026",
    portfolio: data.portfolio,
    note:
      "This context contains compact post-pandas aggregated data: portfolio, all countries, all products with essential business metrics, plus precomputed top and drop lists.",
    countries: data.countries.map((country) => ({
      country: country.country,
      salesMarch: round(country.salesMarch),
      salesApril: round(country.salesApril),
      salesDelta: round(country.salesDelta),
      netProfitMarch: round(country.netProfitMarch),
      netProfitApril: round(country.netProfitApril),
      netProfitDelta: round(country.netProfitDelta),
      marginMarch: round(country.marginMarch),
      marginApril: round(country.marginApril),
      marginDelta: round(country.marginDelta),
      unitsMarch: round(country.unitsMarch),
      unitsApril: round(country.unitsApril),
      unitsDelta: round(country.unitsDelta),
      ppcSpendMarch: round(country.adSpendMarch),
      ppcSpendApril: round(country.adSpendApril),
      ppcSpendDelta: round(country.adSpendDelta)
    })),
    products: compactProducts,
    helpers: {
      topSalesMarch: top("salesMarch"),
      topSalesApril: top("salesApril"),
      topUnitsMarch: top("unitsMarch"),
      topUnitsApril: top("unitsApril"),
      biggestProfitDrops: top("netProfitDelta", "asc"),
      biggestMarginDrops: top("marginDelta", "asc"),
      biggestSalesDrops: top("salesDelta", "asc")
    }
  };
}

export function buildQuestionContext(data: DashboardData, question: string) {
  const full = buildQaContext(data);
  const normalized = question.toLowerCase();
  const wantsTopSales =
    /найбільш|найбільше|топ|top|best|продавав|продаж|sales|revenue|вируч/.test(normalized) &&
    !/просів|падін|drop|decline|зниз/.test(normalized);
  const wantsUnits = /units|unit|шт|штук|одиниц|кільк/.test(normalized);
  const wantsCountry = /країн|country|marketplace|ринок|ринк/.test(normalized);
  const wantsDrops = /просів|просідан|падін|drop|decline|зниз|гірш|мінус|втратив/.test(normalized);
  const wantsMargin = /margin|марж/.test(normalized);
  const wantsProfit = /profit|прибут|net/.test(normalized);

  const base = {
    period: full.period,
    portfolio: full.portfolio,
    note:
      "This is a question-specific slice of the post-pandas aggregated data. Use only this context and the precomputed helper lists."
  };

  if (wantsTopSales || wantsUnits) {
    return {
      ...base,
      products: wantsUnits
        ? {
            topUnitsMarch: full.helpers.topUnitsMarch,
            topUnitsApril: full.helpers.topUnitsApril,
            topSalesMarch: full.helpers.topSalesMarch,
            topSalesApril: full.helpers.topSalesApril
          }
        : {
            topSalesMarch: full.helpers.topSalesMarch,
            topSalesApril: full.helpers.topSalesApril,
            topUnitsMarch: full.helpers.topUnitsMarch,
            topUnitsApril: full.helpers.topUnitsApril
          }
    };
  }

  if (wantsDrops || wantsMargin || wantsProfit) {
    return {
      ...base,
      countries: full.countries,
      products: {
        biggestProfitDrops: full.helpers.biggestProfitDrops,
        biggestMarginDrops: full.helpers.biggestMarginDrops,
        biggestSalesDrops: full.helpers.biggestSalesDrops,
        topSalesApril: full.helpers.topSalesApril
      }
    };
  }

  if (wantsCountry) {
    return {
      ...base,
      countries: full.countries,
      products: {
        topSalesMarch: full.helpers.topSalesMarch,
        topSalesApril: full.helpers.topSalesApril,
        biggestProfitDrops: full.helpers.biggestProfitDrops
      }
    };
  }

  return {
    ...base,
    countries: full.countries,
    products: {
      topSalesMarch: full.helpers.topSalesMarch,
      topSalesApril: full.helpers.topSalesApril,
      topUnitsMarch: full.helpers.topUnitsMarch,
      topUnitsApril: full.helpers.topUnitsApril,
      biggestProfitDrops: full.helpers.biggestProfitDrops,
      biggestMarginDrops: full.helpers.biggestMarginDrops,
      biggestSalesDrops: full.helpers.biggestSalesDrops
    }
  };
}
