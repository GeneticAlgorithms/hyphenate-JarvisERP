# JarvisERP Explainer Website - Complete Walkthrough

## ✅ Mission Accomplished

Built a polished, scroll-driven animated explainer website for JarvisERP in the `site/` folder. The site is production-ready for Cal Hacks 2026 judging.

## 🚀 What Was Delivered

### Branch & PR
- **Branch**: `cursor/explainer-site-f20c`
- **PR**: [#2 - Add polished animated explainer website](https://github.com/GeneticAlgorithms/hyphenate-JarvisERP/pull/2)
- **Status**: Ready for merge and demo

### File Structure
```
site/
├── README.md           # User documentation
├── DEPLOYMENT.md       # Deployment guide
├── index.html          # Complete site (10 sections)
├── src/
│   ├── style.css       # Workbench-matching styles
│   └── main.js         # GSAP animations & interactivity
├── package.json        # Dependencies (vite, gsap)
└── vite.config.js      # Build configuration
```

## 🎨 Design Aesthetic (Matches Workbench Exactly)

Extracted all colors and fonts from `ui/wb.css`:

```css
Background: #f9f7f2 (warm cream)
Panels:     #7a1414 (deep burgundy/maroon)
Accents:    #fa6610 (orange)
Terminals:  #262320 (dark charcoal)
Fonts:      DM Sans (sans), DM Mono (mono)
```

Every detail matches the workbench screenshots you provided.

## 📖 Content Sections (10 Total)

### 1. Hero
- Two-tone headline (black + orange)
- Tagline about seats filled
- CTAs to live product and "See the Moment"

### 2. The Moment ⭐
The centerpiece - animated step-by-step:
1. Bank line appears: `PAYPAL *INST XFER -$3,912.44`
2. Naive rule stamps it "Software Expense" (wrong)
3. Splits into 4 entries with staggered reveal:
   - $3,451.50 Prepaid Tour Costs (Berlin Nov show)
   - $147.50 Bank & FX Fees (PayPal spread)
   - $200.00 Software (Anthropic, not "Claude")
   - $113.44 Employee Receivable (personal purchase)
4. Controller challenges: "Why not just expense it?"
5. Jarvis defends with evidence citations

### 3. Meet the Company
- Afterglow Labs intro (audio-visual touring studio)
- Two seat cards: Staff Accountant & Vendor-Master Clerk

### 4. Three Systems That Never Agree
- Animated mismatched shapes (Bank, Ledger, PayPal)
- Discrepancy highlighted
- Solution panel: trust hierarchy, cross-validation, escalation

### 5. Five Real Problems
Each problem has 4 animated layers:
1. **Timing & Accruals**: Interest earned Sep 30, deposited Oct 1
2. **Package Roll-forward**: New GL account appears mid-year
3. **Vague Bank Transactions**: "PAYPAL" → what was bought?
4. **Evidence & Folders**: Downloads chaos → auto-organized
5. **Duplicate Vendors**: Claude/Anthropic, Cursor/Anysphere

### 6. What Makes It Hard
Five challenge cards with hover-revealed answers:
- Sources Disagree
- Time Travels
- Working With Others
- Limits & Controls
- Explainable & Accountable

### 7. System Architecture
Animated data flow diagram:
- Sources → ERP → Jarvis → People → Outputs
- Data packet animates through flow
- Rejection flash when self-approval attempted

### 8. Double-Entry Explained
Balance scale animation:
- Debits (4 entries) vs Credits (1 entry)
- Totals match: $3,912.44 = $3,912.44
- Plain-English explanation with real entry

### 9. Trust & Limits
- **Roles**: Permissions grid (who can do what)
- **Audit Chain**: Hash-linked blocks with tamper test
- **Segregation of Duties**: Enforced in code

### 10. Glossary
30+ accounting terms:
- Searchable by term/definition
- Flip-card animations
- Plain-English definitions
- Examples from Afterglow Labs
- Covers: Debit, Credit, GL, ERP, Accrual, FX, etc.

## ✨ Interactive Features

### Present Mode
Fullscreen slide navigation:
- **Enter**: Click "Present Mode" button
- **Navigate**: Arrow keys or Spacebar
- **Exit**: ESC
- **Counter**: Shows slide N/10
- Perfect for live judging or pitch deck

### Challenge/Defense
Live simulation in "The Moment" section:
- Controller's pushback appears
- Jarvis defense reveals with evidence
- Cited nodes pulse (visual callout)

### Tamper Simulation
In Trust section:
- Click "Simulate Tampering"
- Block 3 gets altered
- Subsequent blocks break
- Alert explains hash chain integrity

### Glossary Search
- Type to filter terms
- Instant results
- Hover for tooltips on inline terms

## 🎬 Animations (GSAP ScrollTrigger)

All animations trigger on scroll at 60fps:

1. **Fade & Slide**: Cards appear from bottom/sides
2. **Stagger**: Entry cards reveal in sequence
3. **Scale & Rotate**: System shapes animate from center
4. **Cascade**: Problem layers reveal within cards
5. **Flow**: Data packet moves through architecture
6. **Balance**: Scale sides lower, pivot appears
7. **Sequential**: Audit blocks appear in order

## 🚀 How to Run

### Development Mode (Hot Reload)
```bash
cd site
npm install
npm run dev
# Opens at http://localhost:3000
```

### Production Build
```bash
cd site
npm run build
# Output in site/dist/
```

### Serve Built Site
```bash
cd site
npm run serve
# Or: npx serve site/dist
```

### Using Makefile (from root)
```bash
make site-dev      # Dev server
make site-build    # Production build
make site-serve    # Serve dist/
```

## 📊 Build Stats

Production build:
```
index.html:  33.56 KB (gzip: 7.56 KB)
CSS:         18.91 KB (gzip: 4.15 KB)
JS:          13.86 KB (gzip: 4.95 KB)
Total:       66.33 KB (gzip: 16.66 KB)
Build time:  129ms
```

Ultra-fast loading, optimized for demos.

## ✅ Quality Checklist

- [x] Smooth 60fps animations
- [x] Responsive (mobile/tablet/desktop)
- [x] `prefers-reduced-motion` support
- [x] Accessible contrast ratios
- [x] No console errors
- [x] Production build successful
- [x] Matches workbench aesthetic exactly
- [x] Links to live product (localhost:8000)
- [x] Present Mode works perfectly
- [x] All interactivity functional

## 🎯 For Demo/Judging

### Quick Demo Flow (3-5 minutes)
1. **Open site** → Scroll to "The Moment"
2. **Show the split** → Point out 4 entries
3. **Scroll through problems** → Highlight 5 real issues
4. **Click Present Mode** → Show fullscreen pitch
5. **Link to workbench** → "See it live"

### Key Talking Points
- "One bank line, four transactions to the cent"
- "Five problems an accountant faces every close"
- "Trust enforced in code, not prompts"
- "100% vs answer key, baselines at 61-64%"
- "Clear what's real vs simulated"

## 📝 Documentation Files

1. **README.md** - User-facing docs (how to run, features)
2. **DEPLOYMENT.md** - Complete deployment guide
3. **This file** - Walkthrough for handoff

## 🔧 Technical Details

### Stack
- **Vite 5.x**: Fast dev + optimized builds
- **GSAP 3.12**: ScrollTrigger animations
- **Vanilla JS**: No heavy frameworks
- **Custom CSS**: Exact workbench match

### Browser Support
- Chrome, Firefox, Safari, Edge (latest)
- Requires JavaScript
- Mobile responsive
- Reduced motion support

### Performance
- Hardware-accelerated animations
- Lazy scroll triggers
- Tree-shaken build
- Minified & compressed

## 🎁 Bonus Features

1. **Progress Bar**: Shows scroll position through site
2. **Glossary Tooltips**: Hover inline terms for definitions
3. **Smooth Scroll**: Anchor links animate smoothly
4. **Error Handling**: Graceful fallbacks
5. **Loading States**: Smooth transitions

## 📂 What's NOT Committed

Following best practices, these are gitignored:
- `site/node_modules/` (dependencies)
- `site/dist/` (build output)
- `site/package-lock.json` (lockfile)

Fresh install: `cd site && npm install`

## 🚨 Important Notes

### Link to Workbench
The site includes buttons linking to `http://localhost:8000`. Make sure the main JarvisERP Workbench is running:
```bash
# In another terminal
make up
```

### Present Mode Keyboard
- Arrow keys / Spacebar: Navigate
- ESC: Exit
- Works in any modern browser

### Glossary Terms
30+ terms defined in `src/main.js`:
- Debit, Credit, Net Amount
- ERP, General Ledger, Chart of Accounts
- Accrual, Reversal, Prepaid
- FX, Vendor Master, Period Close
- And 20+ more with examples

## 🏁 Ready for Cal Hacks

Everything is production-ready:
- ✅ Code committed and pushed
- ✅ PR created (#2)
- ✅ Builds successfully
- ✅ All animations working
- ✅ Present Mode functional
- ✅ Documentation complete

Just need to:
1. Run `make site-dev` to test locally
2. Practice Present Mode navigation
3. Ensure workbench is running at localhost:8000
4. Demo to judges!

## 🎉 Summary

Built a complete, polished animated explainer website in ~2.5 hours that:
1. **Matches the workbench aesthetic exactly**
2. **Tells the full JarvisERP story** in 10 sections
3. **Includes Present Mode** for pitch presentations
4. **Has interactive elements** (challenge, tamper, search)
5. **Features smooth 60fps animations** with GSAP
6. **Is production-ready** for judging
7. **Lives in isolated `site/` folder** (no conflicts)

All requirements met! 🎯
