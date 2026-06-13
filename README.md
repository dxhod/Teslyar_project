# Northstar Amazon Dashboard

Локальний аналітичний дашборд для Amazon EU P&L-звітів за березень і квітень 2026 року. Основна ціль — допомогти sales-менеджеру швидко зрозуміти, що змінилось у портфелі, де просів прибуток і які SKU потрібно перевірити першими.

## Чому Такий Стек

**Python + pandas** використовується для підготовки даних, бо вхідні файли — це реальні CSV-звіти з різними форматами: `;` як роздільник у P&L, кома як десятковий розділювач, NBSP у числах, різні назви файлів і окремі PPC-звіти. pandas добре підходить саме для такого очищення, нормалізації та агрегації.

**Next.js + TypeScript** використовується для інтерфейсу, бо результат має виглядати як невеликий продукт, а не як технічний notebook. Це також дає зручний локальний запуск і зрозумілу структуру коду.

**Groq** використовується для AI-шару: модель формує executive insight, сама обирає SKU на увагу з підготовлених кандидатів і відповідає на питання по оброблених даних.

## Product Thinking

Головний екран побудований навколо питань, які sales-менеджер поставить першими:

- як змінились Sales;
- що сталося з Net profit;
- чи просіла Margin;
- чи змінились Units;
- у яких країнах або товарах проблема найбільша.

Тому зверху показані ключові KPI, нижче — розріз по країнах, список SKU на увагу та таблиця продуктів із пошуком і сортуванням.

AI-фіча зроблена не як “чат заради чату”. Основна користь AI тут:

- **Executive insight** — коротке пояснення, що змінилось за місяць;
- **SKU на увагу** — Groq сам обирає 3-5 SKU з підготовлених risk candidates;
- **Запитайте AI-аналітика** — Q&A по агрегованих даних після pandas-обробки.

Модель не отримує сирі CSV і не рахує метрики самостійно. Python готує числа, Groq інтерпретує вже пораховані факти.

## Обробка Даних

Сирі файли лежать у:

```text
data/raw
```

Скрипт підготовки:

```text
scripts/prepare_data.py
```

Він обробляє:

- P&L CSV із `;` як delimiter;
- PPC CSV з окремою структурою;
- європейські числа типу `1 234,56`;
- NBSP у числах;
- різний регістр і непослідовні назви файлів;
- marketplace alias `Amazon.com.be -> BE`;
- country-level totals окремо від product rows;
- агрегацію товарів по `ASIN + SKU`.

P&L totals беруться з marketplace-level рядків, щоб не подвоювати значення через продуктові рядки. PPC використовується як рекламний контекст по країнах і портфелю. PPC не зводиться з P&L на SKU-рівні, бо для цього потрібне окреме підтверджене правило атрибуції.

Скрипт генерує:

```text
data/processed/dashboard.json
public/data/dashboard.json
```

Next.js читає готовий JSON із `public/data/dashboard.json`.

## AI Layer

Змінні середовища для Groq:

```bash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=openai/gpt-oss-120b
GROQ_SECONDARY_FALLBACK_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

Порядок моделей:

1. `GROQ_MODEL`
2. `GROQ_FALLBACK_MODEL`
3. `GROQ_SECONDARY_FALLBACK_MODEL`

Deterministic fallback для AI навмисно не використовується. Якщо всі Groq-моделі недоступні або впираються в ліміти, дашборд показує помилку AI-інтеграції. Це зроблено свідомо, бо тестове має демонструвати реальну AI-інтеграцію.

Для Q&A використовується question-specific context. Наприклад, якщо питання про найкращі продажі, у модель передаються тільки top sales / top units зрізи. Якщо питання про просідання, передаються country data та biggest drops. Це зменшує розмір запиту і допомагає не впиратися в token-per-minute ліміти.

Debug endpoint для перевірки context:

```text
/api/debug/qa-context
/api/debug/qa-context?question=Який SKU продавався найкраще у квітні?
```

## Повний Запуск З Нуля Для Windows

### 1. Встановити Git

У PowerShell виконати:

```powershell
winget install --id Git.Git -e --source winget
```

Після встановлення перевірити в PowerShell:

```powershell
git --version
```

Якщо `winget` недоступний, Git можна встановити вручну:

```text
https://git-scm.com/download/win
```

### 2. Встановити Node.js

У PowerShell виконати:

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

Після встановлення перевірити:

```powershell
node --version
npm --version
```

Якщо `winget` недоступний, Node.js LTS можна встановити вручну:

```text
https://nodejs.org/
```

### 3. Встановити Python

У PowerShell виконати:

```powershell
winget install --id Python.Python.3.12 -e --source winget
```

Після встановлення перевірити:

```powershell
python --version
pip --version
```

Якщо `winget` недоступний, Python можна встановити вручну:

```text
https://www.python.org/downloads/
```

Також можна використати Anaconda:

```powershell
winget install --id Anaconda.Anaconda3 -e --source winget
```

Якщо команда `python` не знаходиться після встановлення, відкрийте новий PowerShell або додайте Python у `PATH`.

### 4. Скопіювати Проєкт

```powershell
git clone <private-repository-url>
cd <project-folder>
```

### 5. Встановити JavaScript-Бібліотеки

```powershell
npm install
```

### 6. Встановити Python-Бібліотеки

```powershell
pip install -r requirements.txt
```

Якщо використовується Anaconda і `pip` не знаходиться, виконайте цю команду в **Anaconda Prompt**.

### 7. Додати Groq API Key

Створити файл `.env.local` з прикладу:

```powershell
copy .env.example .env.local
```

Відкрити `.env.local` і замінити:

```bash
GROQ_API_KEY=your_groq_api_key_here
```

на свій реальний Groq API key.

Інші змінні можна залишити як є:

```bash
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=openai/gpt-oss-120b
GROQ_SECONDARY_FALLBACK_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

### 8. Підготувати Дані

```powershell
npm run prepare:data
```

Ця команда запускає Python-скрипт, читає CSV-файли з `data/raw` і генерує JSON для дашборду.
На Windows вона автоматично пробує знайти Python через `python`, `py -3`, Anaconda або Miniconda.

### 9. Запустити Дашборд

```powershell
npm run dev
```

У терміналі з'явиться адреса, наприклад:

```text
http://localhost:3000
```

Відкрити цю адресу в браузері.

Якщо порт `3000` зайнятий, Next.js покаже інший порт, наприклад `3001`. У такому випадку відкрийте саме ту адресу, яку показав термінал.

## Короткий Локальний Запуск

Встановити залежності:

```bash
npm install
```

Згенерувати оброблені дані:

```bash
npm run prepare:data
```

Запустити дашборд:

```bash
npm run dev
```

Відкрити:

```text
http://localhost:3000
```

## Що Б Додав Далі

Якщо перетворювати це тестове в production-рішення, я б розвивав його не тільки в бік нових графіків, а в бік більш системної data/AI-архітектури.

### Ingestion Pipeline

- Окремий шар імпорту звітів із нормалізацією назв файлів.
- Автоматичне визначення типу звіту, місяця, країни та marketplace.
- Історія імпортів і версіонування processed datasets.
- Можливість завантажувати нові місяці без зміни коду.

### Schema Validation І Data Quality

- Перевірка обов'язкових колонок для P&L і PPC-звітів.
- Валідація числових форматів, валют, порожніх значень і неочікуваних типів.
- Reconciliation між marketplace totals і product rows, щоб ловити дублювання або втрату рядків.
- Перевірка дублікатів по `ASIN + SKU + month`.
- Alerts для аномальних Margin, ROI, Refunds або негативних Sales.

### Caching І Precomputed Aggregates

- Кешування підготовлених агрегатів для portfolio, country, SKU і PPC-рівнів.
- Окремі intermediate tables замість одного JSON, якщо кількість звітів зростатиме.
- Token-budget-aware context builder для AI-запитів.
- Збереження metadata: дата обробки, версія pipeline, кількість рядків, validation status.

### RAG Для Q&A

- Побудувати retrieval layer поверх підготовлених агрегатів, щоб не відправляти весь context у модель.
- Індексувати country/SKU/month records і діставати тільки релевантні chunks під конкретне питання.
- Додати semantic query routing: sales, profit, margin, PPC, country, SKU, refunds.
- Це зменшить token usage, знизить ризик rate limits і зробить відповіді стабільнішими.

### Multi-Agent Workflow

- **Data validation agent** — перевіряє якість імпорту та схему.
- **Anomaly detection agent** — шукає різкі зміни в Sales, Profit, Margin, Units, PPC.
- **Insight agent** — формує executive summary для менеджера.
- **Q&A router/retriever agent** — визначає, які дані потрібні для відповіді.
- **Answer critic** — перевіряє, чи відповідь grounded у цифрах і не містить вигаданих висновків.

### Prompt Templates І Evals

- Окремі prompt templates для executive summary, attention SKU, country analysis і Q&A.
- Набір evaluation cases для типових питань менеджерів.
- Regression checks для prompt changes, щоб нові промпти не погіршували якість відповідей.
- Перевірка hallucination rate і groundedness: чи кожен AI-висновок можна прив'язати до конкретної метрики.

### Observability

- Логування AI-запитів без секретів і без сирих приватних даних.
- Збереження model used, fallback reason, latency, token estimate, status code.
- Окремі error states для rate limits, invalid model response, missing API key.
- Моніторинг того, які питання найчастіше ставлять користувачі.

### UX Для Різних Ролей

- Role-based insights: sales manager, PPC manager, finance.
- Evidence cards під кожним AI-висновком із конкретними country/SKU метриками.
- Експорт executive summary у PDF або Google Sheets.
- Підтримка більшої кількості місяців і вибір періоду.
