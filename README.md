# Budget Flow MVP

Simple local-first PWA for personal/business expense tracking.

## What it does
- Parse a quick expense line such as `Publix 54 продукты`.
- Auto-suggest a category from merchant/keyword rules.
- Let the user confirm/edit the category before saving.
- Track monthly category limits and remaining amounts.
- Separate Family and Business expenses.
- Store all data locally in the browser via localStorage.
- Works offline after first load.

## Run locally
From this folder:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080

## iPhone
Host the folder on Vercel, Netlify, GitHub Pages, or any HTTPS static host. Open it in Safari and use Share → Add to Home Screen.

## Current personal limits (+10% cushion)
- Rent: $2,178
- Electricity: $184.80
- Phone: $173.80
- Internet: $55
- Home Gas: $39.60
- Groceries: $770
- Eating Out: $286
- Gas / Fuel: $231
- Insurance: $234.70
- Subscriptions: $110
- Debt / Affirm: $74.80
- Other: $330

Business categories currently have no hard caps in the MVP.
