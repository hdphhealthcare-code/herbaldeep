import ActiveBadge from '@/components/common/ActiveBadge';
import { currency } from '@/lib/format';

export const productsConfig = {
  title: 'Products',
  description: 'Catalogue used while creating orders and invoices. Stock is managed in Inventory.',
  singular: 'Product',
  endpoint: '/products',
  searchPlaceholder: 'Search by name or SKU',
  filters: [{ key: 'isActive', placeholder: 'All status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }],
  columns: [
    { key: 'name', label: 'Product', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'sku', label: 'SKU' },
    { key: 'price', label: 'Price', render: (r) => currency(r.price) },
    { key: 'stock', label: 'In stock' },
    { key: 'isActive', label: 'Status', render: (r) => <ActiveBadge active={r.isActive} /> },
  ],
  fields: [
    { name: 'name', label: 'Product name', required: true },
    { name: 'sku', label: 'SKU', required: true },
    { name: 'price', label: 'Price (INR)', type: 'number', required: true, min: 0 },
    { name: 'reorderLevel', label: 'Low-stock alert at', type: 'number', min: 0 },
    { name: 'stock', label: 'Opening stock', type: 'number', min: 0, hideOnEdit: true, hint: 'Change stock later from Inventory' },
    { name: 'description', label: 'Details', type: 'textarea', full: true },
    { name: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  defaults: { reorderLevel: 10, stock: 0, isActive: true },
};
