export const customersConfig = {
  title: 'Customers',
  description: 'People who place orders with you.',
  singular: 'Customer',
  endpoint: '/customers',
  searchPlaceholder: 'Search by name, mobile or city',
  columns: [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'mobile', label: 'Mobile' },
    { key: 'city', label: 'City / Area', render: (r) => [r.city, r.area].filter(Boolean).join(', ') },
    { key: 'address', label: 'Address', className: 'max-w-xs truncate' },
  ],
  fields: [
    { name: 'name', label: 'Customer name', required: true },
    { name: 'mobile', label: 'Mobile number', required: true },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'city', label: 'City', required: true },
    { name: 'area', label: 'Area' },
    { name: 'state', label: 'State', hint: 'Needed for shipping' },
    { name: 'pincode', label: 'Pincode', hint: 'Needed for shipping' },
    { name: 'address', label: 'Address', type: 'textarea', required: true, full: true },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true },
  ],
};
