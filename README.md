# Herbal Deep CRM – Orders, Courier Shipping, Invoice & HR Management

Next.js (frontend) + Node.js/Express (backend) + MongoDB.

## Folder structure
```
herbaldeep-crm/
├── backend/
│   └── src/
│       ├── config/        env, db, constants (roles, statuses)
│       ├── models/        User, Customer, Product, StockMovement, Order, Invoice, Employee, Attendance, Counter
│       ├── middleware/    auth (JWT + role guard), error handler
│       ├── services/      orderService (OMS), inventoryService (IMS), invoiceService
│       ├── controllers/   request handlers (+ crudFactory for simple modules)
│       ├── routes/        REST routes with role-based access
│       ├── seeds/         demo data
│       └── app.js / server.js
└── frontend/
    └── src/
        ├── app/           Next.js App Router pages  ((app) = authenticated area)
        ├── components/
        │   ├── ui/        Button, Card, Modal, DataTable, Tabs, Badge, FormField ...
        │   ├── layout/    Sidebar, Topbar, AppShell, RoleGuard
        │   ├── common/    ResourcePage (config-driven CRUD), FilterBar, StatusBadge
        │   ├── orders/ inventory/ invoice/ attendance/ dashboard/   feature components
        ├── config/resources/   column + form definitions for CRUD pages
        ├── hooks/ context/ lib/
        └── app/globals.css     ALL colours live here as design tokens
```

## Run locally
Prerequisites: Node 18+, MongoDB running locally (or an Atlas URI).

```bash
# 1. Backend
cd backend
cp .env.example .env        # edit MONGO_URI / JWT_SECRET
npm install
npm run seed                # creates demo users and products
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

### Demo logins (password for all: `Admin@123`)
| Role | Email |
|---|---|
| Super Admin | admin@herbaldeep.in |
| Admin | ops@herbaldeep.in |
| HR | hr@herbaldeep.in |
| Agent | agent@herbaldeep.in |

## Courier integration: Xpressbees + Shipmozo + Ekart + Delhivery + Shiprocket
Five courier platforms are connected. On every order you choose which one books the shipment, and "Compare courier rates" shows all of them side by side.

**1. Keys in `backend/.env`** (never commit real keys; restart the backend after editing). Configure any one, two or all three:
```
XPRESSBEES_BASE_URL=https://shipment.xpressbees.com/api
XPRESSBEES_EMAIL=...
XPRESSBEES_PASSWORD=...

SHIPMOZO_BASE_URL=https://shipping-api.com/app/api/v1
SHIPMOZO_PUBLIC_KEY=...
SHIPMOZO_PRIVATE_KEY=...

EKART_BASE_URL=https://app.elite.ekartlogistics.in
EKART_CLIENT_ID=...            # from your Ekart onboarding
EKART_USERNAME=...
EKART_PASSWORD=...
EKART_SELLER_NAME=...          # mandatory for Ekart bookings
EKART_SELLER_ADDRESS=...
EKART_SELLER_GST_TIN=...
EKART_GST_PERCENT=0            # used when the order has no invoice (an invoice's tax % wins)
```
SHIPROCKET_EMAIL=...           # an API user: Shiprocket > Settings > API > Create API User (not your main login)
SHIPROCKET_PASSWORD=...
```
Check all of them under **Courier API status**.

**2. Warehouses:** add pickup locations once under **Warehouses** in the sidebar. They are shared by all couriers. Xpressbees gets the address with each booking. Shipmozo (warehouse) and Ekart (pickup address alias) need the location registered on their side, so the CRM does that automatically on the first booking and remembers it.

**3. Customers** need **state** and **pincode**.

**4. Book:** open an order, use the **Ship now** panel: pick warehouse, courier platform, payment and parcel size. Optionally press **Compare courier rates**, then choose a row (or "Auto") and press **Book shipment**. The AWB, courier name and status are saved on the order and in its status history.

| Step | Xpressbees | Shipmozo | Ekart | Delhivery |
|---|---|---|---|---|
| Rates | serviceability | rate-calculator | serviceability v3 for SURFACE and EXPRESS | pincode check + shipping cost for Surface and Express, with delivery days |
| Book | one call (AWB + label + manifest) | push-order, rate-calculator, assign-courier, schedule-pickup if needed. "Auto" = cheapest courier | package/create (tracking id = AWB). "Auto" = Surface | cmu/create (waybill = AWB). "Auto" = Surface |
| Label | URL from booking | get-order-label (image) | label API (PDF) | packing_slip (PDF link) |
| Manifest | yes | not in their API | yes | "Request pickup" (pickup request) |
| Track | track | track-order | track | packages (status words translated, see below) |
| Cancel | cancel | cancel-order (rebook gets `ORD-000001-B1`) | cancel (rebook gets `ORD-000001-B1`) | cancel before pickup (rebook gets `ORD-000001-B1`) |
| Return pickup | reverse booking | push-return-order (+ reasons) | package/create with payment_mode Pickup | not enabled yet (use the Delhivery panel) |
| NDR | **Shipping > NDR / Exceptions** | not in their API | NDR action button on the order after Track shows an exception | Re-Attempt (optionally on a date) from the order |

Track shipment / the live sync move the order through In Transit, Out for Delivery, NDR, Delivered and RTO automatically. Ekart notes: COD up to Rs 49,999, and the shipment needs your seller GST details (see the env keys above).

**Delhivery setup.** In Delhivery One open *Settings > API Setup*, copy the API token and put it in `backend/.env`:
```
DELHIVERY_BASE_URL=https://track.delhivery.com        # production token
# DELHIVERY_BASE_URL=https://staging-express.delhivery.com   # staging (test) token
DELHIVERY_API_TOKEN=your_token
```
A token works only with its own server, so set the matching `DELHIVERY_BASE_URL`. Check **Courier API status** in the sidebar: it shows whether the token is accepted and whether you are on staging.
* The pickup warehouse is registered in Delhivery by its **title** the first time you ship from it (if the same name already exists in your Delhivery panel it is simply reused). Keep the title exactly the same afterwards.
* Surface and Express are the two services (Express shows under **Air**). Delhivery sends no courier rating, so none is shown for it.
* Weight is sent in **grams**. Delhivery's "Pending" / "Dispatched" statuses are translated to our wording (consignee unavailable = NDR, Dispatched = Out for delivery); other texts are matched by the normal status mapper.
* Live status works by the background sync. For instant updates give Delhivery the webhook `POST /api/webhooks/delhivery?token=<WEBHOOK_SECRET>`.
* **Request pickup** sends a pickup request (about 2 hours from now, or the next morning after 6 pm IST). A repeated request for the same day is accepted without an error.
* Return pickup is intentionally not enabled: it needs a different request shape that cannot be verified without a live account.

**Test without spending money:** `cd backend && npm run mock:shipping` starts a fake Xpressbees + Shipmozo + Ekart + Delhivery server on port 5055. Point `.env` at it (the env lines are at the top of `backend/tests/mockShippingServer.js`), restart the backend, and every button works with fake AWBs. Automated test: `npm run test:shipping`.

**Add another courier later:** create a file in `backend/src/services/shipping/` with the same methods as `ekart.js` / `shipmozo.js` / `xpressbees.js` and register it in `index.js`.
## Theming (no hardcoded colours)
Every colour is a CSS variable in `frontend/src/app/globals.css` and mapped in `tailwind.config.js`.
Components only use semantic classes such as `bg-primary`, `text-muted`, `bg-success-soft`.
To re-brand, edit the variables in `:root` – nothing else.

## Workflow implemented (SRS §5, §11)
New Order → Agent Assigned → Ready for Dispatch → In Transit → Out for Delivery → Delivered → Invoice Generated
(+ NDR, RTO, RTO Delivered, Cancelled). Every change is stored in the order's status history.

**Live status (nobody edits it by hand).** Once an order is booked with a courier, its status follows the courier:
* a background job asks Xpressbees / Shipmozo / Ekart / Delhivery about every open shipment every `TRACKING_SYNC_INTERVAL_SEC` seconds (default 120) and updates the order;
* optional courier webhooks make it instant: point the courier at `POST /api/webhooks/<xpressbees|shipmozo|ekart>?token=<WEBHOOK_SECRET>`;
* the Orders list refreshes itself every 20 s, the order page every 30 s (it asks the courier directly), the dashboard every 30 s. **Sync courier status** on the Orders page forces a check now;
* the courier's scans are shown on the order; finished orders (delivered, RTO delivered, cancelled) stop updating.

**Agent rule.** An agent can be assigned, and changed **once**. After that the assignment is locked (server and UI). Change `MAX_AGENT_CHANGES` in `backend/src/config/constants.js` (and `frontend/src/lib/constants.js`) to allow more.

**Order list & Ship now (Xpressbees style).** Orders are created first and appear in the list (tabs: Pending, Ready to Ship, Ready to Pickup, In Transit, NDR, Delivered, RTO, Cancelled, All). **Ship now** opens a full page with the route, order value, payment, applicable weight and every courier service from Xpressbees, Shipmozo, Ekart and Delhivery (Surface / Air tabs, sort, rating, Recommended / Cheapest / Fastest tags, and *Auto Allocate*). Ratings and delivery days are shown only when the courier's API sends them; "Recommended" is the best mix of price and rating (cheapest when there are no ratings). Each order can be **edited** (until it is shipped) and **cloned** from the row menu.

**Pricing.** Products have a **flat discount** (rupees off that row) and a fixed **GST of 5%** added after the discount. The order total is always shown *with GST* and is what COD collects and what the courier receives. Change the rate in `GST_RATE` (backend `config/constants.js` and frontend `lib/constants.js`).

**Brand.** The name and logo are in `frontend/src/lib/brand.js` and `frontend/public/logo.svg` (replace the file with your own logo). The CRM label and invoices carry it. Courier-made labels print the *pickup warehouse title*, so name your warehouse "Herbal Deep"; for Ekart set `EKART_SELLER_NAME`.

**Create order** is two steps like Shipmozo: (1) order + customer (pincode fills state and city), (2) products + package + payment. Then **Ship now** on the order picks the courier, generates the AWB and the label.

**Pincode autofill.** Typing a 6-digit pincode (customers, new-order form, warehouses) fills state, city and area suggestions from India Post's directory (`PINCODE_API_URL` to change). If it is unreachable the state is still derived from the pincode prefix.

**Sidebar.** Shipping tools have their own pages: Rate calculator, Pincode serviceability, Warehouses, Pickups & manifest, NDR / Exceptions, Courier API status.

**Labels.** The courier's own label opens inside the CRM (print / download); a 4x6 CRM-generated label with barcode is always available as well.

**Login not working / empty database?** Collections only appear in MongoDB Compass after data exists. Start the backend once (an empty database now gets a super admin automatically), or run `cd backend && npm run seed` for demo users and products. Default login: `admin@herbaldeep.in` / `Admin@123` (from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env`). `npm run create-admin` creates that admin or resets its password. The backend prints `MongoDB connected: database "..."` so you can confirm it is using `herbaldeep_crm`.

**Upgrading an old database:** `cd backend && npm run migrate:v2` (removes zones, renames `dispatched` to `in_transit`, `zone_identified` to `new_order`).

Zones were removed from the whole project.

* **OMS** – order creation (existing/new customer), agent assign + one-time change, courier + AWB, live status tabs with counts, history timeline.
* **IMS** – stock lives on each product; creating an order reserves stock atomically (blocks over-selling), cancelling returns it, manual in/out adjustments, full stock ledger, low-stock alerts.
* **Invoices** – auto-numbered (INV-000001), created from an order, discount + GST %, Draft/Generated/Pending/Paid, print / save as PDF.
* **HR** – employees, daily attendance (present/absent/leave/half day), monthly summary.
* **RBAC** – Super Admin (all), Admin (operations + invoices), HR (employees + attendance), Agent (sees only own orders). Enforced in the API and mirrored in the UI.

## API overview (`/api`)
`/auth` · `/users` · `/customers` · `/products` (+ `/low-stock`, `/movements`, `/:id/adjust-stock`) ·
`/orders` (+ `/counts`, `/:id/assign-agent`, `/:id/cancel`) · `/pincode/:pin` · `/webhooks/:courier` · `/invoices` · `/employees` · `/attendance` (+ `/mark`, `/monthly`) · `/dashboard`

## Notes
* OMS/IMS are built in-house inside this CRM (Shiprocket-style workflow and UI). Courier booking runs through Xpressbees (see above). 
* The PDF does not show the Rate-Calculator response format, so the courier list reads common field names (courier_id/id, name, total_charges/rate ...). If your account returns different names, adjust `frontend/src/lib/shipping.js` (`normalizeCouriers`).
* Add `npm run build` + a process manager (PM2) and a reverse proxy for production; set a strong `JWT_SECRET`.


## What changed in v3.4
- **Shiprocket** added next to Xpressbees / Shipmozo / Ekart / Delhivery (rates, booking, label, manifest + pickup, tracking, cancel, NDR re-attempt / RTO, webhook). Set `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD`.
- **Ship page**: one button per platform (Shipmozo, Ekart, Delhivery, Shiprocket, Xpressbees), always cheapest first, each platform shows as soon as it answers.
- **GST**: product price includes 5% GST. The order shows "Includes GST 5%" and never adds it on top. Optional **GST number** on the order (agents too), printed on the label.
- **Order numbers** are `HBD-00001`, `HBD-00002`... (older `ORD-` orders keep their number).
- **NDR / exceptions** for every courier. Agents act on their own orders only. (Shipmozo has no NDR API, so the CRM cannot send those.)
- **Customers**: each agent adds and sees only their own customers. Run `npm run migrate:v34` once in `backend/` to hand existing agent-created customers to their agents.
- **Label**: new 4x6 design with QR code of the order number, items table, GST, order note. The customer's phone number is not printed.
- **Fixes**: "All time" / "More filters" dropdowns (lost their `ref` in React 18), header search, debounced filters, faster list / counts / gzip.
