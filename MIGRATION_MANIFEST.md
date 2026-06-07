# Migration Manifest — RakhRakhaav → Hardware + Electronics ERP
**Branch:** `feature/hw-electronics-erp`  
**Date:** 2026-06-08  
**Phase:** 0 (Recon — no functional changes yet)

---

## Summary

| Metric | Count |
|--------|-------|
| Total grep hits (vertical references) | ~1,235 lines |
| Files containing references | 774 |
| Business types in current BUSINESS_TYPES | 26 |
| Business types in final system | 2 (`hardware`, `electronics`) + `general` as internal fallback |
| Frontend page directories to delete | 6 |
| Backend route files to delete | 4 |
| Backend model files to delete | 4 (+ 1 repurpose decision) |
| Frontend business-config files to delete | 24 |

---

## Three Sources of Truth (must stay in sync after Phase 1)

| Layer | File | Status |
|-------|------|--------|
| Backend enum | `server/models/shopModel.js → BUSINESS_TYPES` | **EDIT** — reduce to `['hardware', 'electronics']` |
| Backend config | `server/config/industries/index.js → INDUSTRIES` | **EDIT** — keep only `general`, `hardware`, `electronics` |
| Frontend registry | `client/src/lib/business-configs/index.js → OVERRIDES` | **EDIT** — keep only `general`, `hardware`, `electronics` |

---

## A. Files to DELETE (complete removal)

### A1. Frontend App Pages (entire directories)

| Directory | Vertical | Reason |
|-----------|----------|--------|
| `client/src/app/appointments/` | salon | Salon-only feature |
| `client/src/app/stylists/` | salon | Salon-only feature |
| `client/src/app/memberships/` | salon | Salon-only feature (see B3 for AMC decision) |
| `client/src/app/narcotics/` | pharmacy | Pharmacy-only feature |
| `client/src/app/pets/` | pet_shop | Pet-shop-only feature |
| `client/src/app/tables/` | restaurant | Restaurant-only feature |

### A2. Backend Route Files

| File | Vertical | Route prefix |
|------|----------|-------------|
| `server/routes/narcoticsRoutes.js` | pharmacy | `/api/narcotics` |
| `server/routes/stylistRoutes.js` | salon | `/api/stylists` |
| `server/routes/membershipRoutes.js` | salon | `/api/memberships` |
| `server/routes/petRoutes.js` | pet_shop | `/api/pets` |

### A3. Backend Controller Files

| File | Vertical |
|------|----------|
| `server/controllers/stylistController.js` | salon |
| `server/controllers/membershipController.js` | salon (unless repurposed for AMC — see B3) |
| `server/controllers/petController.js` | pet_shop |

> **Note:** `narcoticsRoutes.js` has its handler likely embedded or in a controller that may be shared — verify before deleting.

### A4. Backend Model Files

| File | Vertical | Action |
|------|----------|--------|
| `server/models/stylistModel.js` | salon | DELETE |
| `server/models/narcoticsRegisterModel.js` | pharmacy | DELETE |
| `server/models/petProfileModel.js` | pet_shop | DELETE |
| `server/models/membershipModel.js` | salon | **DECISION REQUIRED** — see B3 |

### A5. Frontend Business-Config Files (client/src/lib/business-configs/)

All of these are pure-config files with no other callers. Safe to delete once removed from `index.js`.

| File | Vertical |
|------|----------|
| `salon.js` | salon |
| `service_center.js` | service_center (not in our two verticals) |
| `restaurant.js` | restaurant |
| `bakery.js` | bakery |
| `sweet_shop.js` | sweet_shop |
| `pharmacy.js` | pharmacy |
| `pet_shop.js` | pet_shop |
| `mobile_shop.js` | mobile_shop (fold into electronics.js first — see B1) |
| `clothing.js` | clothing |
| `automobile.js` | automobile |
| `bookstall.js` | bookstall |
| `kirana.js` | kirana |
| `stationery.js` | stationery |
| `grocery.js` | grocery |
| `cosmetics.js` | cosmetics |
| `footwear.js` | footwear |
| `furniture.js` | furniture |
| `gift_shop.js` | gift_shop |
| `toy_store.js` | toy_store |
| `sports.js` | sports |
| `jewellery.js` | jewellery |
| `retail.js` | retail |
| `repair_shop.js` | repair_shop (not in our two verticals) |
| `general.js` | Keep as internal fallback only |

Also delete:
- `client/src/lib/industries/index.js` — frontend-side copy of industries (only mobile_shop is there additionally — replace with server-authoritative data)

> **Check:** Confirm `client/src/lib/industries/index.js` is not imported anywhere critical before deleting.

### A6. Backend Config Entries to Remove (in `server/config/industries/index.js`)

Remove these entries from the `INDUSTRIES` object: `pharmacy`, `clothing`, `restaurant`, `automobile`, `retail`, `bookstall`, `kirana`, `sweet_shop`, `bakery`, `salon`, `stationery`, `mobile_shop`, `grocery`, `cosmetics`, `footwear`, `furniture`, `gift_shop`, `toy_store`, `sports`, `pet_shop`, `service_center`, `repair_shop`, `jewellery`.

Keep: `general` (fallback), `hardware`, `electronics`.

---

## B. Files to FOLD / REPURPOSE (not delete whole, but transform)

### B1. mobile_shop → fold into electronics

`mobile_shop` is a standalone business type today that duplicates electronics. Per the brief, it becomes the **"Mobiles & Gadgets"** sub-category of electronics. Actions:

1. **Merge** useful content from `client/src/lib/business-configs/mobile_shop.js` into `electronics.js`:
   - The detailed `productAttributeSections` (Device Details, Specifications, Warranty & Condition) are richer than electronics — adopt them.
   - The IMEI `invoiceLineFields` — already in electronics.
   - The `warrantyEnabled: true` and `warrantyPanels` — already in electronics.
   - The `inventoryBehavior.trackSerials: true` — already in electronics.
   - The mobile `expenseCategories` — merge into electronics categories.
   - The `kpiConfig` for devices — fold in.

2. **Remove** all `mobile_shop` branches in code after merge:
   - `server/models/shopModel.js` (remove from BUSINESS_TYPES)
   - `server/config/industries/index.js` (remove INDUSTRIES.mobile_shop)
   - `client/src/lib/business-configs/index.js` (remove import + OVERRIDES entry)
   - `client/src/components/Layout.js:344` — remove `mobile_shop: ['product', 'purchases']` from typeMap
   - `client/src/components/Layout.js:390` — change `businessType === 'electronics' || businessType === 'mobile_shop'` → `businessType === 'electronics'`
   - `client/src/app/warranty/page.js:71` — remove `businessType !== 'mobile_shop'` guard
   - `server/controllers/dashboardController.js:175` — remove `mobile_shop` branch
   - `server/controllers/inventoryController.js:8` — update comment
   - `server/services/businessRules.js:395` — remove `mobile_shop: []` entry
   - `server/services/tierInference.js:83` — remove `'mobile_shop'` from proBusinessTypes
   - `client/src/app/onboarding/page.js` — remove all 3 `mobile_shop` references

### B2. repair_shop + service_center — REMOVE (not in our two verticals)

These are currently in `BUSINESS_TYPES` and `INDUSTRIES`. They are not pharmacy/salon/restaurant/pet but they are also not hardware/electronics. Remove them:

- `server/models/shopModel.js` — remove from BUSINESS_TYPES
- `server/config/industries/index.js` — remove both entries
- `client/src/lib/business-configs/index.js` — remove imports and OVERRIDES entries
- `client/src/lib/tierConfig.js` (frontend) — remove `service_center` and `repair_shop` from INDUSTRY_OVERRIDES
- `server/lib/tierConfig.js` — remove `service_center` and `repair_shop` from INDUSTRY_OVERRIDES
- `client/src/components/Layout.js:337,339` — remove from typeMap
- `client/src/app/onboarding/page.js` — remove `service_center` and `repair_shop` from all branches
- `client/src/app/sales/components/SaleCard.jsx:235` — remove `repair_shop` branch
- `client/src/app/sales/hooks/useSaleForm.js:399` — remove `repair_shop` branch
- `server/controllers/dashboardController.js:159` — remove `repair_shop` branch
- `server/services/businessRules.js:282,310` — remove `repair_shop` and `service_center` entries
- `server/services/tierInference.js:84` — remove from `nanoBusinessTypes`

### B3. membershipModel — REPURPOSE AS AMC (recommended decision)

**Recommendation: Repurpose, do NOT delete.**

The `membershipModel` is structurally a time-bound service package (sell → coverage window → reminder). This maps directly onto Electronics AMC (Annual Maintenance Contracts). Renaming and extending it for AMC is far cheaper than building from scratch. The `membershipController` also contains redemption logic worth keeping.

**Action for Phase 4:** Before starting Phase 2 deletion, annotate `membershipModel.js` and `membershipController.js` with `// REPURPOSE: AMC (Annual Maintenance Contracts)` comments and ensure neither is referenced by routes that get deleted. The `/api/memberships` route will be deleted but the model+controller files are renamed/repurposed in Phase 4, not deleted.

For Phase 2: Remove `/api/memberships` from `server/app.js`, remove `client/src/app/memberships/` page, and remove nav entry in `Layout.js` — but **do not delete the model or controller files** yet.

### B4. RecipeModel / RecipePanel — KEEP DORMANT (for Kit/Bundle repurpose)

`server/models/recipeModel.js` and `client/src/components/RecipePanel.js` are candidates for Kit/Bundle repurposing (CCTV kit, laptop set, plumbing combo). Neither hardware nor electronics currently has `supportRecipes: true`, so these panels never render. Leave them dormant for now — Phase 4 will evaluate Kit/Bundle feature.

---

## C. Files to EDIT (business-type references to remove/update)

### C1. server/models/shopModel.js
- **Change:** Reduce `BUSINESS_TYPES` to `['hardware', 'electronics']`
- **Note:** `general` is NOT added here — it remains as internal config fallback only, not selectable in onboarding

### C2. server/config/industries/index.js
- **Change:** Remove all entries except `general`, `hardware`, `electronics`
- `general` stays as the fallback in `getIndustryConfig()`
- `listIndustries()` should return only hardware + electronics (not general) for onboarding display

### C3. client/src/lib/business-configs/index.js
- **Change:** Remove all imports and OVERRIDES entries except `general`, `hardware`, `electronics`
- `general` is kept as `OVERRIDES.general` for the fallback in `getBusinessConfig()`

### C4. server/app.js
- **Unmount these routes:**
  ```js
  // REMOVE:
  app.use('/api/narcotics', narcoticsRoutes);
  app.use('/api/stylists', stylistRoutes);
  app.use('/api/memberships', membershipRoutes);
  app.use('/api/pets', petRoutes);
  // also remove their require() statements at the top
  ```
- **Keep:** `/api/contractors`, `/api/warranty`

### C5. client/src/components/Layout.js
- **Remove from `typeMap`** (bottomNavItems): `restaurant`, `salon`, `repair_shop`, `automobile`, `service_center`, `pharmacy`, `jewellery`, `kirana`, `grocery`, `mobile_shop`, `sweet_shop`, `bakery`, `clothing`, `footwear`
- **Remove from `filteredDrawerItems`**:
  - Narcotics block (pharmacy — lines ~372-374)
  - Salon block (appointments, stylists, memberships — lines ~376-380)
  - Restaurant block (tables — lines ~382-384)
  - Pet shop block (pets — lines ~393-396)
  - Change `electronics || mobile_shop` → `electronics` (warranty block, line 390)
- **Keep:** hardware contractors block, electronics warranty block

### C6. server/controllers/dashboardController.js
- **Remove industry-specific stat builder branches:** `pharmacy`, `repair_shop`, `mobile_shop`, `clothing`, `footwear`
- **Remove `tableStatus` function and its export** (restaurant-only)
- **Keep:** `hardware` and `electronics` branches (if they exist), general/fallback logic

### C7. server/lib/tierConfig.js + client/src/lib/tierConfig.js
- **Remove from `INDUSTRY_OVERRIDES`:** `restaurant`, `salon`, `service_center`, `repair_shop`, `bakery`, `sweet_shop`
- **Keep:** any hardware/electronics overrides (add if needed)

### C8. client/src/app/onboarding/page.js (1,289 lines)
- **`getInventoryMode()`** (line 41): remove `salon`/`service_center`/`repair_shop`/`restaurant` branches — keep only `'product'` mode for hardware+electronics
- **`UNITS_BY_TYPE`** (line 89): reduce to only `hardware` and `electronics` (and `general` fallback). Remove all other type entries.
- **`PRODUCT_NAME_PLACEHOLDER`** (line 115): reduce to hardware+electronics only
- **`ALL_INDUSTRIES`** (the industry picker array): remove all except hardware, electronics
- **`getProfileQuestions()`** (line 360): remove `isServiceBusiness` check and `canManufacture` list — simplify for two verticals
- Remove `mobile_shop`, `service_center`, `repair_shop` from all other branches

### C9. server/services/businessRules.js
- Remove all entries except `hardware` and `electronics` (and general fallback)
- Entries to remove: `pharmacy`, `restaurant`, `salon`, `automobile`, `repair_shop`, `service_center`, `bakery`, `sweet_shop`, `clothing`, `kirana`, `grocery`, `retail`, `mobile_shop`

### C10. server/services/tierInference.js
- Remove `mobile_shop` from `proBusinessTypes` (line 83)
- Remove `salon`, `sweet_shop`, `bakery`, `restaurant`, `repair_shop`, `service_center`, `gift_shop`, `toy_store`, `pet_shop`, `bookstall` from `nanoBusinessTypes` (line 84)
- Simplify inference to hardware+electronics

### C11. client/src/app/warranty/page.js
- Remove `businessType !== 'mobile_shop'` from the guard on line 71 (becomes `electronics` only)

### C12. client/src/app/sales/components/SaleCard.jsx
- Remove `repair_shop` branch (line 235)

### C13. client/src/app/sales/hooks/useSaleForm.js
- Remove `repair_shop` branch (line 399)

### C14. client/src/app/dashboard/BothDashboard.js + dashboard/page.js
- Remove any industry-specific branches for removed verticals
- Keep hardware/electronics branches

### C15. Other files with scattered references (lower-priority cleanup in Phase 2)
These have references but are primarily data/logic files where the cleanup is removing array entries or if-branches:
- `client/src/app/expenses/page.js` — expense category references
- `client/src/app/gst/page.js` + GST components — composition_category 'restaurant' in shopModel
- `client/src/app/login/page.js`, `register/page.js` — likely just business type display
- `client/src/app/reports/page.js` — vertical-specific report sections
- `client/src/app/product/page.js` — vertical-specific product form branches
- `client/src/app/profile/page.js` — business type display/edit
- `client/src/app/team/page.js` — role labels per vertical
- `client/src/components/DynamicFormField.js` — form schema driven, likely just passes through
- `client/src/components/VariantInventoryPanel.js` — references salon/clothing (will stay dormant)
- `client/src/contexts/IndustryContext.js` — may reference old types
- `client/src/hooks/useTerminology.js` — wraps terminology engine
- `client/src/components/AppLocale.js` — locale strings
- `client/src/components/KeyboardShortcutsTooltip.jsx` — keyboard shortcuts referencing vertical pages

---

## D. Files to KEEP (zero changes or minor cleanup only)

| File/Directory | Why |
|----------------|-----|
| `client/src/app/warranty/` | Electronics — keep, enhance |
| `client/src/app/contractors/` | Hardware — keep, enhance |
| `client/src/lib/business-configs/base.js` | Shared base — keep as-is |
| `client/src/lib/business-configs/hardware.js` | Keep, extend for sub-categories |
| `client/src/lib/business-configs/electronics.js` | Keep, extend with mobile_shop merge |
| `server/controllers/warrantyController.js` | Electronics — keep |
| `server/controllers/contractorController.js` | Hardware — keep |
| `server/routes/warrantyRoutes.js` | Electronics — keep |
| `server/routes/contractorRoutes.js` | Hardware — keep |
| `server/models/warrantyClaimModel.js` | Electronics — keep |
| `server/models/contractorModel.js` | Hardware — keep |
| `server/models/serialInventoryModel.js` | Electronics backbone — keep |
| `server/models/membershipModel.js` | **Repurpose as AMC** — do not delete |
| `server/models/recipeModel.js` | Dormant — Kit/Bundle repurpose candidate |
| `client/src/components/RecipePanel.js` | Dormant — Kit/Bundle repurpose candidate |
| `client/src/components/SerialInventoryPanel.js` | Electronics — keep and extend |
| All GST files | Keep 100% intact |
| All offline/sync files | Keep 100% intact |
| All RBAC files | Keep 100% intact |
| All subscription/billing files | Keep 100% intact |
| All audit trail files | Keep 100% intact |

---

## E. shopModel composition_category 'restaurant' enum value

`shopModel.js` has `composition_category: { enum: ['trader', 'restaurant', 'service', null] }`. The `'restaurant'` value here is a GST scheme concept (composition dealers in the restaurant sector), not the business type. **Do not remove** — it is a GST regulatory classification, not a business-type reference.

---

## F. AMC Decision (Formal)

**Recommendation: REPURPOSE membershipModel → AMC.**

membershipModel has: title, customer, plan (duration, coverage, price), purchase_date, expiry_date, status, usages/redemptions. This maps directly onto an AMC (Annual Maintenance Contract) for electronics customers — sell AMC → track coverage window → alert before expiry → log service visits against it.

**Action:** In Phase 2, delete `/api/memberships` routes and `client/src/app/memberships/` page. In Phase 4, rename `membershipModel` → `amcModel` (with field aliases), add product/serial coverage fields, and build the AMC module under `client/src/app/amc/` gated to `electronics` only.

---

## G. Phased Checklist

### Phase 0 (current) ✅
- [x] Branch `feature/hw-electronics-erp` created
- [x] Reference sweep completed (1,235 hits across 774 files)
- [x] Every hit classified: delete / edit / fold / keep
- [x] MIGRATION_MANIFEST.md written
- [ ] Baseline build check (next: run `cd client && next build` and `node server/app.js`)

### Phase 1 — Collapse type system (awaiting go-ahead)
Files to change: `shopModel.js`, `server/config/industries/index.js`, `client/src/lib/business-configs/index.js`, fold `mobile_shop` into `electronics.js`, remove `mobile_shop.js`, update all 11 mobile_shop references, update onboarding ALL_INDUSTRIES.
**Checkpoint:** Build green; getBusinessConfig never returns undefined; both verticals work in onboarding.

### Phase 2 — Remove dedicated vertical features (awaiting go-ahead)
Delete 6 page directories, 4 route files, 3 controller files, 3 model files, 24 config files. Edit 15 files to remove branches. Unmount routes in app.js. Remove nav entries in Layout.js.
**Checkpoint:** Build green; backend boots; smoke every remaining page; grep returns zero hits for removed verticals.

### Phase 3 — Sub-category architecture (awaiting go-ahead)
Add `category` / `sub_category` to product model; wire into product form, list, dashboard, reports.

### Phase 4 — Domain feature build (awaiting go-ahead)
Quotation→Invoice → Hardware Multi-UOM → Electronics Service/Repair → Warranty auto-link → Serial lookup → EMI billing → AMC repurpose → Reorder/valuation → Stock valuation → Bulk import/export.

### Phase 5 — Hardening (awaiting go-ahead)
Fix audit issues; dead-code sweep; final regression.

---

## H. Open Questions (resolve before Phase 2)

1. **narcoticsRoutes.js** — does the controller live in a separate `narcoticsController.js` file not visible in the listing? (Only `narcoticsRoutes.js` shows in routes; no `narcoticsController.js` seen in controllers listing.) Confirm before deleting route.

2. **client/src/lib/industries/index.js** — this appears to be a frontend-side duplicate of the industry config (the grep hit shows `mobile_shop: { id: 'mobile_shop'... }` at line 331). Who imports it? If nothing production-critical imports it, delete it. If something does, convert to the two-vertical version.

3. **BatchInventoryPanel + VariantInventoryPanel** — both `trackBatches` and `trackVariants` are already `false` in hardware and electronics configs. The panels never render for our two verticals. Leave dormant (zero-risk) unless the build shows they create dead-import errors.

4. **`composition_category: 'restaurant'`** in shopModel — confirmed as GST regulatory value, NOT a business-type reference. Leave as-is. (Documented in §E above.)
