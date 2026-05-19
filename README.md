# Teslyar Amazon Dashboard

Локальний dashboard для аналізу Amazon P&L за березень і квітень 2026 року. Основний фокус: швидко показати, як змінився портфель, у яких країнах просів прибуток і які SKU потребують уваги.

## Стек

- **Next.js + TypeScript** — щоб зробити не прототипну таблицю, а зручний локальний web dashboard.
- **Recharts** — інтерактивні графіки без зайвої складності.
- **Python + pandas** — для CSV ingestion, нормалізації чисел і розрахунку агрегатів. Це природний вибір для дата-аналітики й добре масштабується на інші Amazon-звіти.

## Що реалізовано

- Portfolio overview: Sales, Net profit, Margin, Units із порівнянням April vs March.
- Country breakdown: топ країн за Sales, Net profit, Margin, Units або PPC spend.
- Product view: пошук за SKU/ASIN/назвою, сортування за Sales, Net profit, Margin change або Profit change.
- AI-фіча: Groq business summary + 3-5 SKU на увагу. pandas спочатку знаходить факти й ризики в даних, а модель інтерпретує вже пораховані агрегати й сама обирає attention SKU з підготовлених кандидатів.
- Ask about data: Q&A по всіх підготовлених pandas-агрегатах через Groq. Модель не отримує сирі CSV, а відповідає на основі portfolio/country/product даних після обробки.

## Обробка даних

Python-скрипт `scripts/prepare_data.py` читає файли з `data/raw`, підтримує `;` у P&L файлах, CSV у лапках, NBSP у числах, європейську нотацію `1 234,56`, різний регістр і непослідовні назви PPC-файлів. P&L агрегати беруться з marketplace-level рядків, щоб не подвоювати totals через продуктові рядки.

Скрипт генерує два однакові JSON-файли:

```text
data/processed/dashboard.json
public/data/dashboard.json
```

Next.js читає `public/data/dashboard.json`, щоб деплой на Vercel не залежав від локального Python-кроку під час build.

## Запуск

```bash
npm install
npm run prepare:data
npm run dev
```

Після запуску відкрити:

```bash
http://localhost:3000
```

## Groq AI

Для локального AI summary створити `.env.local`:

```bash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

`GROQ_MODEL` опційний. За замовчуванням використовується `llama-3.3-70b-versatile`.
`GROQ_FALLBACK_MODEL` опційний. Якщо primary-модель недоступна, API автоматично пробує fallback-модель, за замовчуванням `openai/gpt-oss-120b`.
`GROQ_SECONDARY_FALLBACK_MODEL` опційний. Якщо перші дві моделі недоступні або вперлись у ліміти, API пробує `meta-llama/llama-4-scout-17b-16e-instruct`.

Без `GROQ_API_KEY` AI-блок і Q&A покажуть помилку інтеграції. Deterministic fallback навмисно не використовується, бо фіча має демонструвати реальну AI-інтеграцію.

## Деплой на Vercel

1. Локально оновити JSON:

```bash
npm run prepare:data
```

2. Закомітити `public/data/dashboard.json` разом із кодом.
3. Імпортувати репозиторій у Vercel як Next.js project.
4. Build Command:

```bash
npm run build
```

5. У Vercel Environment Variables додати:

```bash
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=openai/gpt-oss-120b
GROQ_SECONDARY_FALLBACK_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

Python/pandas потрібні тільки для локальної підготовки нового JSON. Сам Vercel-деплой працює з готовим `public/data/dashboard.json`.

## Що б додав далі

- OpenAI API поверх уже підготовленого structured context, щоб summary був природнішим, але без ризику галюцинацій у цифрах.
- Імпорт нових місяців через upload або папку `data/raw`.
- Зведення PPC з P&L на рівні SKU, якщо є стабільний ключ і підтверджена бізнес-логіка атрибуції.
- Експорт executive summary у PDF/Google Sheets для щомісячного звіту.
