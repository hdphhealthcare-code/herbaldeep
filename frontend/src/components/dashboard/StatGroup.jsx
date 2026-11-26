import StatCard from '@/components/ui/StatCard';

// Titled row of stat cards. stats: [{ label, value, icon, tone }]
export default function StatGroup({ title, stats }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-muted">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>
    </section>
  );
}
