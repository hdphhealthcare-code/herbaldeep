'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { toInputDate } from '@/lib/format';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea, Checkbox } from '@/components/ui/FormField';

// Convert an API record into flat form values.
const toFormValues = (fields, item, defaults) => {
  const values = {};
  fields.forEach((f) => {
    let v = item ? item[f.name] : defaults?.[f.name];
    if (Array.isArray(v)) v = v.join(', ');
    else if (v && typeof v === 'object' && v._id) v = v._id;
    else if (f.type === 'date') v = toInputDate(v);
    values[f.name] = v ?? (f.type === 'checkbox' ? true : '');
  });
  return values;
};

export default function ResourceForm({ open, onClose, onSaved, config, item }) {
  const { fields, endpoint, singular, defaults } = config;
  const [values, setValues] = useState({});
  const [options, setOptions] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValues(toFormValues(fields, item, defaults));
  }, [open, item, fields, defaults]);

  // Load dropdown data (e.g. zones for agents) once the modal opens
  useEffect(() => {
    if (!open) return;
    fields.filter((f) => f.optionsFrom).forEach(async (f) => {
      const { endpoint: ep, labelKey = 'name', params } = f.optionsFrom;
      try {
        const res = await api.get(ep, { limit: 100, ...params });
        setOptions((o) => ({ ...o, [f.name]: res.data.map((d) => ({ value: d._id, label: d[labelKey] })) }));
      } catch (err) {
        toast.error(err.message);
      }
    });
  }, [open, fields]);

  const set = (name, v) => setValues((s) => ({ ...s, [name]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...(item ? {} : config.fixedParams), ...values };
      fields.forEach((f) => {
        if (f.type === 'number' && payload[f.name] !== '') payload[f.name] = Number(payload[f.name]);
      });
      if (item) await api.put(`${endpoint}/${item._id}`, payload);
      else await api.post(endpoint, payload);
      toast.success(`${singular} ${item ? 'updated' : 'created'}`);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f) => {
    if (f.hideOnEdit && item) return null;
    if (f.hideOnCreate && !item) return null;
    const common = {
      label: f.label, required: f.required && !(f.requiredOnCreateOnly && item), value: values[f.name] ?? '',
      hint: f.hint, wrapperClass: f.full ? 'sm:col-span-2' : '',
    };
    if (f.type === 'checkbox') {
      return <Checkbox key={f.name} label={f.label} checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />;
    }
    if (f.type === 'select') {
      return (
        <Select key={f.name} {...common} placeholder="Select..." options={f.options || options[f.name] || []}
          onChange={(e) => set(f.name, e.target.value)} />
      );
    }
    if (f.type === 'textarea') {
      return <Textarea key={f.name} {...common} onChange={(e) => set(f.name, e.target.value)} />;
    }
    return (
      <Input key={f.name} {...common} type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined}
        min={f.min} onChange={(e) => set(f.name, e.target.value)} autoComplete="off" />
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${item ? 'Edit' : 'Add'} ${singular}`}
      size="lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="resource-form" loading={saving}>Save {singular.toLowerCase()}</Button>
        </>
      )}
    >
      <form id="resource-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {fields.map(renderField)}
      </form>
    </Modal>
  );
}
