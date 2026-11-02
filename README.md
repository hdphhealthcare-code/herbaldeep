# Fusse CRM – Healthcare Order, Courier, Invoice & HR Management

Next.js (frontend) + Node.js/Express (backend) + MongoDB. Built from the Fusse Market SRS.

## Folder structure
```
fusse-crm/
├── backend/
│   └── src/
│       ├── config/        env, db, constants (roles, statuses)
│       ├── models/        User, Zone, Customer, Product, StockMovement, Order, Invoice, Employee, Attendance, Counter
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
npm run seed                # creates demo users, zones, products
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
| Super Admin | admin@fusemarket.in |
| Admin | ops@fusemarket.in |
| HR | hr@fusemarket.in |
| Agent | agent@fusemarket.in |

## Courier integration: Xpressbees + Shipmozo + Ekart
Three courier platforms are connected. On every order you choose which one books the shipment, and "Compare courier rates" shows all of them side by side.

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
Check all of them under **Shipping > API status**.

**2. Warehouses:** add pickup locations once under **Shipping > Warehouses**. They are shared by all couriers. Xpressbees gets the address with each booking. Shipmozo (warehouse) and Ekart (pickup address alias) need the location registered on their side, so the CRM does that automatically on the first booking and remembers it.

**3. Customers** need **state** and **pincode**.

**4. Book:** open an order, use the **Shipping** panel: pick warehouse, courier platform, payment and parcel size. Optionally press **Compare courier rates**, then choose a row (or "Auto") and press **Book shipment**. The AWB, courier name and status are saved on the order and in its status history.

| Step | Xpressbees | Shipmozo | Ekart |
|---|---|---|---|
| Rates | serviceability | rate-calculator | serviceability v3 for SURFACE and EXPRESS |
| Book | one call (AWB + label + manifest) | push-order, rate-calculator, assign-courier, schedule-pickup if needed. "Auto" = cheapest courier | package/create (tracking id = AWB). "Auto" = Surface |
| Label | URL from booking | get-order-label (image) | label API (PDF) |
| Manifest | yes | not in their API | yes |
| Track | track | track-order | track |
| Cancel | cancel | cancel-order (rebook gets `ORD-000001-B1`) | cancel (rebook gets `ORD-000001-B1`) |
| Return pickup | reverse booking | push-return-order (+ reasons) | package/create with payment_mode Pickup |
| NDR | **Shipping > NDR / Exceptions** | not in their API | NDR action button on the order after Track shows an exception |

Track shipment also moves the order to Dispatched / Delivered automatically. Ekart notes: COD up to Rs 49,999, and the shipment needs your seller GST details (see the env keys above).

**Test without spending money:** `cd backend && npm run mock:shipping` starts a fake Xpressbees + Shipmozo + Ekart server on port 5055. Point `.env` at it (the env lines are at the top of `backend/tests/mockShippingServer.js`), restart the backend, and every button works with fake AWBs. Automated test: `npm run test:shipping`.

**Add another courier later:** create a file in `backend/src/services/shipping/` with the same methods as `ekart.js` / `shipmozo.js` / `xpressbees.js` and register it in `index.js`.
## Theming (no hardcoded colours)
Every colour is a CSS variable in `frontend/src/app/globals.css` and mapped in `tailwind.config.js`.
Components only use semantic classes such as `bg-primary`, `text-muted`, `bg-success-soft`.
To re-brand, edit the variables in `:root` – nothing else.

## Workflow implemented (SRS §5, §11)
New Order → Zone Identified → Agent Assigned → Ready for Dispatch → Dispatched → Delivered → Invoice Generated (+ Cancelled).
Every change is stored in the order's status history.

* **OMS** – order creation (existing/new customer), automatic zone match from customer city/area, agent assign/reassign, courier + AWB tracking, status tabs, history timeline.
* **IMS** – stock lives on each product; creating an order reserves stock atomically (blocks over-selling), cancelling returns it, manual in/out adjustments, full stock ledger, low-stock alerts.
* **Invoices** – auto-numbered (INV-000001), created from an order, discount + GST %, Draft/Generated/Pending/Paid, print / save as PDF.
* **HR** – employees, daily attendance (present/absent/leave/half day), monthly summary.
* **RBAC** – Super Admin (all), Admin (operations + invoices), HR (employees + attendance), Agent (only own orders; can set Dispatched/Delivered). Enforced in the API and mirrored in the UI.

## API overview (`/api`)
`/auth` · `/users` · `/zones` · `/customers` · `/products` (+ `/low-stock`, `/movements`, `/:id/adjust-stock`) ·
`/orders` (+ `/:id/assign-agent`, `/:id/zone`, `/:id/courier`, `/:id/status`) · `/invoices` · `/employees` · `/attendance` (+ `/mark`, `/monthly`) · `/dashboard`

## Notes
* OMS/IMS are built in-house inside this CRM (Shiprocket-style workflow and UI). Courier booking runs through Xpressbees (see above). The manual courier panel is still there for orders shipped outside Xpressbees.
* The PDF does not show the Rate-Calculator response format, so the courier list reads common field names (courier_id/id, name, total_charges/rate ...). If your account returns different names, adjust `frontend/src/lib/shipping.js` (`normalizeCouriers`).
* Add `npm run build` + a process manager (PM2) and a reverse proxy for production; set a strong `JWT_SECRET`.
