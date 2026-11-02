import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'Nothing here yet', description, action }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <span className="rounded-full bg-primary-soft p-3 text-primary"><Inbox className="h-5 w-5" /></span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted">{description}</p>}
      {action}
    </div>
  );
}
