'use client';

import { SlidersHorizontal } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

export function StockLevel({ product }) {
  if (product.stock === 0) return <Badge tone="danger">Out of stock</Badge>;
  if (product.stock <= product.reorderLevel) return <Badge tone="warning">Low stock</Badge>;
  return <Badge tone="success">In stock</Badge>;
}

export default function StockTable({ rows, loading, onAdjust }) {
  const columns = [
    { key: 'name', label: 'Product', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'sku', label: 'SKU' },
    { key: 'stock', label: 'Available', render: (r) => <span className="font-semibold">{r.stock}</span> },
    { key: 'reorderLevel', label: 'Reorder level' },
    { key: 'level', label: 'Stock level', render: (r) => <StockLevel product={r} /> },
    {
      key: 'actions', label: '',
      render: (r) => <Button size="sm" variant="soft" icon={SlidersHorizontal} onClick={() => onAdjust(r)}>Adjust</Button>,
    },
  ];
  return <DataTable columns={columns} rows={rows} loading={loading} emptyTitle="No products yet" emptyDescription="Add products first, then manage their stock here." />;
}
