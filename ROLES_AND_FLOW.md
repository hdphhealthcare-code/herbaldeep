# Roles and order flow (v3.3)

## Order flow
1. **Create** (agent or admin) -> status *Pending confirmation*
2. **Confirm** (the agent for their own order, or an admin) -> status *Confirmed*
3. **Ship** (admin only, confirmed orders only) -> courier booked, status then follows the courier automatically
4. If delivery fails -> *NDR*; the **NDR team** (or admin) asks the courier for a re-attempt

An agent can edit an order only until it is confirmed. After that only an admin can change it.
If a shipment is cancelled (by admin or by the courier) the order goes back to *Confirmed*, ready to be shipped again.

## Who can do what
| | super admin | admin | agent | NDR team | HR |
|---|---|---|---|---|---|
| See orders | all | all | **own only** | all | - |
| Create / bulk upload orders | yes | yes | yes (own) | - | - |
| Confirm orders (single + bulk) | yes | yes | yes (own) | - | - |
| Ship (book courier), label, manifest | yes | yes | **no** | **no** | - |
| Cancel order, assign agent | yes | yes | no | no | - |
| Pincode serviceability | yes | yes | yes | yes | - |
| NDR re-attempt (single + bulk) | yes | yes | no | yes | - |
| Search: mobile, order id, AWB, name, date range, status | yes | yes | yes (own) | yes | - |
| Employees, attendance | yes | - | - | - | yes |
| Users & roles | yes | - | - | - | - |

All rules are enforced by the API (`routes/*.js`, `utils/orderScope.js`); the screens only hide what a role cannot use.

## Upgrading an existing database
Orders created before this version are still *New Order* / *Agent Assigned*. Select them in **Orders > Pending confirmation** and use **Confirm selected orders** once; after that they can be shipped. Orders already booked are not affected.

## Demo users (`npm run seed`)
`ops@herbaldeep.in` (admin), `agent@herbaldeep.in` and `agent2@herbaldeep.in` (agents), `ndr@herbaldeep.in` (NDR team), `hr@herbaldeep.in` (HR). Password is SEED_ADMIN_PASSWORD (default `Admin@123`).

## Tests
`cd backend && npm test` (courier providers, order flow, roles and permissions; no database needed).


## v3.4 additions
- Agent: also adds and picks **own customers** only (Customers page = "My customers"), and works **NDR** on their own orders (NDR page, orders table, order page). An agent never sees another agent's orders or customers.
- Admin / NDR team: NDR action on any order, every courier platform.
