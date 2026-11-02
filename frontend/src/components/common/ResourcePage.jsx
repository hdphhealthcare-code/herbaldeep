'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import useList from '@/hooks/useList';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from './FilterBar';
import ResourceForm from './ResourceForm';

/**
 * Config-driven CRUD page. See src/config/resources/* for configs.
 * config: { title, description, singular, endpoint, columns, fields, filters,
 *           fixedParams, defaults, canDelete, searchPlaceholder, extraActions(row, reload) }
 */
export default function ResourcePage({ config }) {
  const { title, description, singular, endpoint, columns, filters, fixedParams, canDelete = true } = config;
  const list = useList(endpoint, { ...fixedParams });
  const [editing, setEditing] = useState(null); // null = closed, {} = new, record = edit
  const open = editing !== null;

  const remove = async (row) => {
    if (!window.confirm(`Delete this ${singular.toLowerCase()}? This cannot be undone.`)) return;
    try {
      await api.del(`${endpoint}/${row._id}`);
      toast.success(`${singular} deleted`);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const actionColumn = {
    key: 'actions',
    label: 'Actions',
    className: 'w-32',
    render: (row) => (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {config.extraActions?.(row, list.reload)}
        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(row)} aria-label="Edit" />
        {canDelete && <Button variant="ghost" size="sm" icon={Trash2} className="hover:text-danger" onClick={() => remove(row)} aria-label="Delete" />}
      </div>
    ),
  };

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={<Button icon={Plus} onClick={() => setEditing({})}>Add {singular.toLowerCase()}</Button>}
      />
      <Card padded={false}>
        <FilterBar
          params={list.params}
          setParam={list.setParam}
          filters={filters}
          searchPlaceholder={config.searchPlaceholder}
        />
        <DataTable
          columns={[...columns, actionColumn]}
          rows={list.rows}
          loading={list.loading}
          emptyTitle={`No ${title.toLowerCase()} found`}
          emptyDescription={`Add your first ${singular.toLowerCase()} to get started.`}
        />
        <Pagination meta={list.meta} onChange={list.setPage} />
      </Card>

      <ResourceForm
        open={open}
        item={editing && editing._id ? editing : null}
        config={config}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); list.reload(); }}
      />
    </>
  );
}
