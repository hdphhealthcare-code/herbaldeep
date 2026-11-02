import {
  LayoutDashboard, PackageSearch, Boxes, Tags, Users, MapPinned, Truck, FileText,
  UserCog, CalendarCheck, ShieldCheck, Settings, ContactRound, PackageCheck,
} from 'lucide-react';

// `roles` = who sees the item. Super admin always sees everything.
export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'hr', 'agent'] }],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Orders', href: '/orders', icon: PackageSearch, roles: ['admin', 'agent'] },
      { label: 'Customers', href: '/customers', icon: ContactRound, roles: ['admin'] },
      { label: 'Products', href: '/products', icon: Tags, roles: ['admin'] },
      { label: 'Inventory', href: '/inventory', icon: Boxes, roles: ['admin'] },
      { label: 'Shipping', href: '/shipping', icon: PackageCheck, roles: ['admin'] },
      { label: 'Zones', href: '/zones', icon: MapPinned, roles: ['admin'] },
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
      { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin', 'hr', 'agent'] },
    ],
  },
];

export const canSee = (item, role) => role === 'super_admin' || item.roles.includes(role);
