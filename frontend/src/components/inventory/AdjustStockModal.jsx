'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormField';

const TYPES = [
  { value: 'in', label: 'Add stock (purchase / return)' },
  { value: 'adjustment', label: 'Remove stock (damage / correction)' },
];

export default function AdjustStockModal({ product, onClose, onSaved }) {
  const [type, setType] = useState('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setType('in'); setQuantity(''); setReason('');
  }, [product]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/products/${product._id}/adjust-stock`, { type, quantity, reason });
      toast.success('Stock updated');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!product} onClose={onClose} title={`Adjust stock · ${product?.name || ''}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="adjust-form" loading={busy}>Save adjustment</Button>
        </>
      )}
    >
      <form id="adjust-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">Current stock: <span className="font-semibold text-foreground">{product?.stock}</span></p>
        <Select label="Action" options={TYPES} value={type} onChange={(e) => setType(e.target.value)} />
        <Input label="Quantity" type="number" min="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Input label="Reason" placeholder="e.g. New purchase, damaged in transit" value={reason} onChange={(e) => setReason(e.target.value)} />
      </form>
    </Modal>
  );
}
