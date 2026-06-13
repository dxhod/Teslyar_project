from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
PUBLIC_DATA_DIR = ROOT / "public" / "data"

MARKETPLACE_COUNTRIES = {
    "Amazon.be": "BE",
    "Amazon.com.be": "BE",
    "Amazon.de": "DE",
    "Amazon.es": "ES",
    "Amazon.fr": "FR",
    "Amazon.it": "IT",
    "Amazon.nl": "NL",
    "Amazon.pl": "PL",
}


def detect_month(file_name: str) -> str | None:
    normalized = file_name.lower()
    if "april" in normalized:
        return "april"
    if "march" in normalized:
        return "march"
    return None


def detect_country(file_name: str) -> str:
    match = re.match(r"^([a-z]{2})_", file_name, flags=re.IGNORECASE)
    return match.group(1).upper() if match else "OTHER"


def parse_number(value: Any) -> float:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return 0.0

    text = str(value).strip()
    if not text or text == "-":
        return 0.0

    text = (
        text.replace("\u00a0", "")
        .replace(" ", "")
        .replace("%", "")
        .replace("(", "-")
        .replace(")", "")
    )

    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")

    try:
        return float(text)
    except ValueError:
        return 0.0


def clean_product_name(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"\s*COG:\s*.*$", "", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def safe_sum(series: pd.Series) -> float:
    return float(series.sum()) if len(series) else 0.0


def snapshot(march: float, april: float) -> dict[str, float | None]:
    delta = april - march
    return {
        "march": march,
        "april": april,
        "delta": delta,
        "deltaPct": None if march == 0 else (delta / abs(march)) * 100,
    }


def fmt_amount(value: float) -> str:
    return f"{value:,.0f}".replace(",", " ")


def fmt_pct(value: float) -> str:
    return f"{value:.1f}"


def read_pl_files() -> tuple[pd.DataFrame, list[str]]:
    rows: list[pd.DataFrame] = []
    files: list[str] = []

    for file_path in sorted(RAW_DIR.glob("*.csv")):
        if file_path.name.lower() not in {"march 2026.csv", "april 2026.csv"}:
            continue

        month = detect_month(file_path.name)
        if not month:
            continue

        df = pd.read_csv(file_path, sep=";", dtype=str, keep_default_na=False)
        df["month"] = month
        df["source_file"] = file_path.name
        rows.append(df)
        files.append(file_path.name)

    if not rows:
        raise FileNotFoundError(f"No P&L files found in {RAW_DIR}")

    df = pd.concat(rows, ignore_index=True)
    df = df.rename(columns={"Marketplace / Product": "marketplace_product"})

    for column in [
        "Units",
        "Refunds",
        "Sales",
        "Ads",
        "Amazon fees",
        "Cost of Goods",
        "Gross profit",
        "Net profit",
        "Margin",
        "ROI",
        "BSR",
        "Sessions",
    ]:
        df[column] = df[column].map(parse_number)

    df["ASIN"] = df["ASIN"].astype(str).str.strip()
    df["SKU"] = df["SKU"].astype(str).str.strip()
    df["isMarketplaceTotal"] = df["marketplace_product"].str.startswith("Amazon.") & (df["ASIN"] == "") & (df["SKU"] == "")
    df["marketplace"] = df["marketplace_product"].where(df["isMarketplaceTotal"], "")
    df["country"] = df["marketplace"].map(MARKETPLACE_COUNTRIES).fillna("PRODUCT")
    df["product"] = df["marketplace_product"].map(clean_product_name)
    df["adsAbs"] = df["Ads"].abs()
    df["cogsAbs"] = df["Cost of Goods"].abs()

    return df, files


def read_ppc_files() -> tuple[pd.DataFrame, list[str]]:
    rows: list[pd.DataFrame] = []
    files: list[str] = []

    for file_path in sorted(RAW_DIR.glob("*.csv")):
        if file_path.name.lower() in {"march 2026.csv", "april 2026.csv"}:
            continue

        month = detect_month(file_path.name)
        if not month:
            continue

        df = pd.read_csv(file_path, sep=",", dtype=str, keep_default_na=False)
        df["month"] = month
        df["country"] = detect_country(file_path.name)
        df["source_file"] = file_path.name
        rows.append(df)
        files.append(file_path.name)

    if not rows:
        return pd.DataFrame(columns=["month", "country", "spend", "sales", "acos", "orders"]), []

    df = pd.concat(rows, ignore_index=True)
    df["spend"] = df["Spend(EUR)"].map(parse_number)
    df["sales"] = df["Sales(EUR)"].map(parse_number)
    df["acos"] = df["ACOS"].map(parse_number) * 100
    df["orders"] = df["Orders"].map(parse_number)
    return df, files


def build_portfolio(pl: pd.DataFrame, ppc: pd.DataFrame) -> dict[str, Any]:
    totals = pl[pl["isMarketplaceTotal"]]
    march = totals[totals["month"] == "march"]
    april = totals[totals["month"] == "april"]
    march_ppc = safe_sum(ppc.loc[ppc["month"] == "march", "spend"]) if len(ppc) else 0.0
    april_ppc = safe_sum(ppc.loc[ppc["month"] == "april", "spend"]) if len(ppc) else 0.0

    sales_march = safe_sum(march["Sales"])
    sales_april = safe_sum(april["Sales"])
    profit_march = safe_sum(march["Net profit"])
    profit_april = safe_sum(april["Net profit"])
    cogs_march = safe_sum(march["cogsAbs"])
    cogs_april = safe_sum(april["cogsAbs"])

    return {
        "sales": snapshot(sales_march, sales_april),
        "netProfit": snapshot(profit_march, profit_april),
        "margin": snapshot((profit_march / sales_march) * 100 if sales_march else 0, (profit_april / sales_april) * 100 if sales_april else 0),
        "units": snapshot(safe_sum(march["Units"]), safe_sum(april["Units"])),
        "roi": snapshot((profit_march / cogs_march) * 100 if cogs_march else 0, (profit_april / cogs_april) * 100 if cogs_april else 0),
        "adSpend": snapshot(march_ppc or safe_sum(march["adsAbs"]), april_ppc or safe_sum(april["adsAbs"])),
    }


def build_countries(pl: pd.DataFrame, ppc: pd.DataFrame) -> list[dict[str, Any]]:
    totals = pl[pl["isMarketplaceTotal"] & (pl["country"] != "PRODUCT")]
    ppc_pivot = (
        ppc.pivot_table(index="country", columns="month", values="spend", aggfunc="sum")
        if len(ppc)
        else pd.DataFrame()
    )
    countries: list[dict[str, Any]] = []

    for country in sorted(totals["country"].dropna().unique()):
        rows = totals[totals["country"] == country]
        march = rows[rows["month"] == "march"]
        april = rows[rows["month"] == "april"]

        def one_number(df: pd.DataFrame, column: str) -> float:
            return float(df[column].iloc[0]) if len(df) else 0.0

        def one_text(df: pd.DataFrame, column: str) -> str:
            return str(df[column].iloc[0]) if len(df) else ""

        ad_march = float(ppc_pivot.loc[country, "march"]) if country in ppc_pivot.index and "march" in ppc_pivot else 0.0
        ad_april = float(ppc_pivot.loc[country, "april"]) if country in ppc_pivot.index and "april" in ppc_pivot else 0.0

        countries.append(
            {
                "country": country,
                "marketplace": one_text(april, "marketplace") or one_text(march, "marketplace") or country,
                "salesMarch": one_number(march, "Sales"),
                "salesApril": one_number(april, "Sales"),
                "salesDelta": one_number(april, "Sales") - one_number(march, "Sales"),
                "netProfitMarch": one_number(march, "Net profit"),
                "netProfitApril": one_number(april, "Net profit"),
                "netProfitDelta": one_number(april, "Net profit") - one_number(march, "Net profit"),
                "marginMarch": one_number(march, "Margin"),
                "marginApril": one_number(april, "Margin"),
                "marginDelta": one_number(april, "Margin") - one_number(march, "Margin"),
                "unitsMarch": one_number(march, "Units"),
                "unitsApril": one_number(april, "Units"),
                "unitsDelta": one_number(april, "Units") - one_number(march, "Units"),
                "adSpendMarch": ad_march,
                "adSpendApril": ad_april,
                "adSpendDelta": ad_april - ad_march,
            }
        )

    return sorted(countries, key=lambda row: row["salesApril"], reverse=True)


def build_products(pl: pd.DataFrame) -> list[dict[str, Any]]:
    products = pl[(~pl["isMarketplaceTotal"]) & (pl["ASIN"] != "") & (pl["SKU"] != "")].copy()
    products["key"] = products["ASIN"] + "--" + products["SKU"]
    result: list[dict[str, Any]] = []

    for key, rows in products.groupby("key"):
        march = rows[rows["month"] == "march"]
        april = rows[rows["month"] == "april"]
        representative = april.iloc[0] if len(april) else march.iloc[0]

        sales_march = safe_sum(march["Sales"])
        sales_april = safe_sum(april["Sales"])
        profit_march = safe_sum(march["Net profit"])
        profit_april = safe_sum(april["Net profit"])
        units_march = safe_sum(march["Units"])
        units_april = safe_sum(april["Units"])
        sessions_march = safe_sum(march["Sessions"])
        sessions_april = safe_sum(april["Sessions"])
        bsr_march = float(march["BSR"].mean()) if len(march) else 0.0
        bsr_april = float(april["BSR"].mean()) if len(april) else 0.0
        margin_march = (profit_march / sales_march) * 100 if sales_march else 0.0
        margin_april = (profit_april / sales_april) * 100 if sales_april else 0.0

        result.append(
            {
                "key": key,
                "product": representative["product"],
                "asin": representative["ASIN"],
                "sku": representative["SKU"],
                "country": "All",
                "marketplace": "All marketplaces",
                "salesMarch": sales_march,
                "salesApril": sales_april,
                "salesDelta": sales_april - sales_march,
                "netProfitMarch": profit_march,
                "netProfitApril": profit_april,
                "netProfitDelta": profit_april - profit_march,
                "marginMarch": margin_march,
                "marginApril": margin_april,
                "marginDelta": margin_april - margin_march,
                "unitsMarch": units_march,
                "unitsApril": units_april,
                "unitsDelta": units_april - units_march,
                "sessionsMarch": sessions_march,
                "sessionsApril": sessions_april,
                "sessionsDelta": sessions_april - sessions_march,
                "bsrMarch": bsr_march,
                "bsrApril": bsr_april,
                "bsrDelta": bsr_april - bsr_march,
            }
        )

    return sorted(result, key=lambda row: row["salesApril"], reverse=True)


def build_insight(portfolio: dict[str, Any], countries: list[dict[str, Any]], products: list[dict[str, Any]]) -> dict[str, Any]:
    profit_drops = sorted([row for row in countries if row["netProfitDelta"] < 0], key=lambda row: row["netProfitDelta"])
    sales_direction = "increased" if portfolio["sales"]["delta"] >= 0 else "decreased"
    profit_direction = "increased" if portfolio["netProfit"]["delta"] >= 0 else "decreased"

    attention: list[dict[str, Any]] = []
    for product in products:
        if product["salesApril"] <= 250 and product["salesMarch"] <= 250:
            continue

        reasons: list[str] = []
        severity = "low"
        impact = abs(product["netProfitDelta"])

        if product["netProfitDelta"] < -100:
            reasons.append(f"Net profit fell by EUR {fmt_amount(abs(product['netProfitDelta']))}")
            severity = "high"

        if product["salesDelta"] > 100 and product["netProfitDelta"] < 0:
            reasons.append("sales grew, but profit deteriorated")
            severity = "high"
            impact += abs(product["salesDelta"]) * 0.2

        if product["marginDelta"] < -8:
            reasons.append(f"margin dropped by {fmt_pct(abs(product['marginDelta']))} pp")
            severity = "high" if severity == "high" else "medium"

        if product["unitsDelta"] < -10:
            reasons.append(f"sold {abs(int(product['unitsDelta']))} fewer units")
            severity = "high" if severity == "high" else "medium"

        if reasons:
            attention.append(
                {
                    "title": product["sku"],
                    "subtitle": f"{product['asin']} · {product['product']}",
                    "reason": "; ".join(reasons),
                    "severity": severity,
                    "impact": impact,
                }
            )

    attention = sorted(attention, key=lambda row: row["impact"], reverse=True)[:5]
    drop_text = (
        "The largest profit drops: "
        + ", ".join([f"{row['country']} EUR {fmt_amount(row['netProfitDelta'])}" for row in profit_drops[:3]])
        + "."
        if profit_drops
        else "No country shows a Net profit decline versus March."
    )

    return {
        "headline": f"In April, Sales {sales_direction} by {fmt_pct(abs(portfolio['sales']['deltaPct'] or 0))}%, and Net profit {profit_direction} by {fmt_pct(abs(portfolio['netProfit']['deltaPct'] or 0))}%.",
        "bullets": [
            f"Sales: EUR {fmt_amount(portfolio['sales']['march'])} -> EUR {fmt_amount(portfolio['sales']['april'])}.",
            f"Net profit: EUR {fmt_amount(portfolio['netProfit']['march'])} -> EUR {fmt_amount(portfolio['netProfit']['april'])}; margin {fmt_pct(portfolio['margin']['march'])}% -> {fmt_pct(portfolio['margin']['april'])}%.",
            drop_text,
            f"PPC spend from country reports: EUR {fmt_amount(portfolio['adSpend']['march'])} -> EUR {fmt_amount(portfolio['adSpend']['april'])}.",
        ],
        "attention": attention,
        "actions": [
            "Review SKUs with the largest Net profit decline and separate demand issues from margin issues.",
            "For countries with profit declines, compare Sales, Units, Margin, and PPC spend changes.",
            "For SKUs where sales grow but profit falls, review fees, COGS, refunds, promotions, and ads.",
        ],
        "evidence": [
            "The AI block does not invent numbers: pandas first identifies changes, drops, and Sales vs Profit conflicts, then forms business commentary.",
            "For a production version, this structured context can be sent to an LLM API for more natural text without changing the analytics logic.",
        ],
    }


def clean_json(value: Any) -> Any:
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return 0
        return round(value, 6)
    if isinstance(value, dict):
        return {key: clean_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [clean_json(item) for item in value]
    return value


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    pl, pl_files = read_pl_files()
    ppc, ppc_files = read_ppc_files()
    portfolio = build_portfolio(pl, ppc)
    countries = build_countries(pl, ppc)
    products = build_products(pl)
    dashboard = {
        "portfolio": portfolio,
        "countries": countries,
        "products": products,
        "insight": build_insight(portfolio, countries, products),
        "source": {
            "dataDir": str(RAW_DIR.relative_to(ROOT)),
            "plFiles": pl_files,
            "ppcFiles": ppc_files,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        },
    }

    output = clean_json(dashboard)
    for output_path in [PROCESSED_DIR / "dashboard.json", PUBLIC_DATA_DIR / "dashboard.json"]:
        output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Prepared dashboard data: {len(countries)} countries, {len(products)} products")
    print(f"Wrote {PROCESSED_DIR / 'dashboard.json'} and {PUBLIC_DATA_DIR / 'dashboard.json'}")


if __name__ == "__main__":
    main()
