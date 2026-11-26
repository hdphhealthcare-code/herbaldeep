/**
 * Extra facts shown next to every courier option (Xpressbees / Shipmozo style):
 * mode (surface / air), rating (0-5, only when the courier API sends one), delivery days, and tags
 * "recommended", "cheapest", "fastest". Nothing is invented: no rating from the courier = no rating shown.
 */
const modeOf = (c) => (/\b(air|express|fast|priority|premium|same\s*day)\b/i.test(`${c.name || ''} ${c.service || ''}`) ? 'air' : 'surface');

const ratingOf = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const five = n > 5 && n <= 100 ? n / 20 : n; // some APIs send a percentage
  return five > 5 ? undefined : Math.round(five * 10) / 10;
};

const etaDaysOf = (eta) => {
  const nums = String(eta ?? '').match(/\d+(\.\d+)?/g);
  return nums ? Math.max(...nums.map(Number)) : undefined;
};

const enrichCouriers = (list) => (Array.isArray(list) ? list : []).map((c) => ({
  ...c,
  mode: c.mode || modeOf(c),
  rating: ratingOf(c.rating),
  etaDays: etaDaysOf(c.eta),
}));

// Marks the best options across all platforms (mutates the couriers inside `groups`)
const tagGroups = (groups) => {
  const all = groups.flatMap((g) => g.couriers).filter((c) => Number.isFinite(Number(c.rate)));
  if (!all.length) return groups;
  all.forEach((c) => { c.tags = []; });

  const minRate = Math.min(...all.map((c) => Number(c.rate)));
  const cheapest = all.find((c) => Number(c.rate) === minRate);
  cheapest.tags.push('cheapest');

  const withDays = all.filter((c) => c.etaDays);
  if (withDays.length) {
    const min = Math.min(...withDays.map((c) => c.etaDays));
    withDays.find((c) => c.etaDays === min).tags.push('fastest');
  }

  // Recommended: best mix of price and rating. Without any rating it is simply the cheapest.
  const rated = all.filter((c) => c.rating);
  const best = rated.length
    ? all.reduce((top, c) => {
      const score = 0.55 * (minRate / Number(c.rate)) + 0.45 * ((c.rating || 3) / 5);
      return !top || score > top.score ? { c, score } : top;
    }, null).c
    : cheapest;
  best.tags.push('recommended');
  return groups;
};

module.exports = { modeOf, ratingOf, etaDaysOf, enrichCouriers, tagGroups };
