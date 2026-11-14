import {
  LayoutDashboard, PackageSearch, PackagePlus, Boxes, Tags, Users, Truck, FileText,
  UserCog, CalendarCheck, ShieldCheck, Settings, ContactRound, Calculator, Warehouse,
  MapPinned, ClipboardList, TriangleAlert, Plug, Upload,
} from 'lucide-react';

// `roles` = who sees the item. Super admin always sees everything.
export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'hr', 'agent', 'ndr'] }],
  },
  {
    title: 'Orders',
    items: [
      { label: 'Orders', href: '/orders', icon: PackageSearch, roles: ['admin', 'agent', 'ndr'], exact: true },
      { label: 'Create order', href: '/orders/new', icon: PackagePlus, roles: ['admin', 'agent'] },
      { label: 'Bulk upload', href: '/orders/bulk', icon: Upload, roles: ['admin', 'agent'] },
    ],
  },
  {
    title: 'Shipping',
    items: [
      { label: 'Rate calculator', href: '/shipping/rate-calculator', icon: Calculator, roles: ['admin'] },
      { label: 'Pincode serviceability', href: '/shipping/serviceability', icon: MapPinned, roles: ['admin', 'agent', 'ndr'] },
      { label: 'Warehouses', href: '/shipping/warehouses', icon: Warehouse, roles: ['admin'] },
      { label: 'Pickups & manifest', href: '/shipping/pickups', icon: ClipboardList, roles: ['admin'] },
      { label: 'NDR / Exceptions', href: '/shipping/ndr', icon: TriangleAlert, roles: ['admin', 'ndr', 'agent'] },
      { label: 'Courier API status', href: '/shipping/api-status', icon: Plug, roles: ['admin'] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Customers', href: '/customers', icon: ContactRound, roles: ['admin', 'agent'] },
      { label: 'Products', href: '/products', icon: Tags, roles: ['admin'] },
      { label: 'Inventory', href: '/inventory', icon: Boxes, roles: ['admin'] },
      { label: 'Agents', href: '/agents', icon: Truck, roles: ['admin'] },
      { label: 'Invoices', href: '/invoices', icon: FileText, roles: ['admin'] },
    ],
  },
  {
    title: 'HR',
    items: [
      { label: 'Employees', href: '/employees', icon: UserCog, roles: ['hr'] },
      { label: 'Attendance', href: '/attendance', icon: CalendarCheck, roles: ['hr'] },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Users & Roles', href: '/users', icon: ShieldCheck, roles: [] },
      { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin', 'hr', 'agent', 'ndr'] },
    ],
  },
];

export const canSee = (item, role) => role === 'super_admin' || item.roles.includes(role);
