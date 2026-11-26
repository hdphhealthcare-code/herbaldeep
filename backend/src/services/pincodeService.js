const ApiError = require('../utils/ApiError');

/**
 * Pincode -> state / city / localities, used to auto-fill address forms.
 * Source: India Post's public pincode directory. If it cannot be reached, the state is still worked out from the
 * pincode prefix (marked `approximate`) so the form is never blocked.
 */
const ENDPOINT = process.env.PINCODE_API_URL || 'https://api.postalpincode.in/pincode';
const TIMEOUT_MS = 6000;
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

// Longest matching prefix wins. Only prefixes that are unambiguous are listed.
const PREFIX_STATE = [
  ['11', 'Delhi'], ['12', 'Haryana'], ['13', 'Haryana'], ['14', 'Punjab'], ['15', 'Punjab'], ['160', 'Chandigarh'], ['16', 'Punjab'],
  ['17', 'Himachal Pradesh'], ['18', 'Jammu & Kashmir'], ['19', 'Jammu & Kashmir'],
  ['20', 'Uttar Pradesh'], ['21', 'Uttar Pradesh'], ['22', 'Uttar Pradesh'], ['23', 'Uttar Pradesh'], ['24', 'Uttar Pradesh'],
  ['25', 'Uttar Pradesh'], ['26', 'Uttar Pradesh'], ['27', 'Uttar Pradesh'], ['28', 'Uttar Pradesh'],
  ['246', 'Uttarakhand'], ['248', 'Uttarakhand'], ['249', 'Uttarakhand'], ['262', 'Uttarakhand'], ['263', 'Uttarakhand'],
  ['30', 'Rajasthan'], ['31', 'Rajasthan'], ['32', 'Rajasthan'], ['33', 'Rajasthan'], ['34', 'Rajasthan'],
  ['36', 'Gujarat'], ['37', 'Gujarat'], ['38', 'Gujarat'], ['39', 'Gujarat'],
  ['40', 'Maharashtra'], ['41', 'Maharashtra'], ['42', 'Maharashtra'], ['43', 'Maharashtra'], ['44', 'Maharashtra'], ['403', 'Goa'],
  ['45', 'Madhya Pradesh'], ['46', 'Madhya Pradesh'], ['47', 'Madhya Pradesh'], ['48', 'Madhya Pradesh'], ['49', 'Chhattisgarh'],
  ['50', 'Telangana'], ['51', 'Andhra Pradesh'], ['52', 'Andhra Pradesh'], ['53', 'Andhra Pradesh'],
  ['56', 'Karnataka'], ['57', 'Karnataka'], ['58', 'Karnataka'], ['59', 'Karnataka'],
  ['60', 'Tamil Nadu'], ['61', 'Tamil Nadu'], ['62', 'Tamil Nadu'], ['63', 'Tamil Nadu'], ['64', 'Tamil Nadu'],
  ['67', 'Kerala'], ['68', 'Kerala'], ['69', 'Kerala'],
  ['70', 'West Bengal'], ['71', 'West Bengal'], ['72', 'West Bengal'], ['73', 'West Bengal'], ['74', 'West Bengal'], ['737', 'Sikkim'],
  ['75', 'Odisha'], ['76', 'Odisha'], ['77', 'Odisha'], ['78', 'Assam'],
  ['790', 'Arunachal Pradesh'], ['791', 'Arunachal Pradesh'], ['792', 'Arunachal Pradesh'], ['793', 'Meghalaya'], ['794', 'Meghalaya'],
  ['795', 'Manipur'], ['796', 'Mizoram'], ['797', 'Nagaland'], ['798', 'Nagaland'], ['799', 'Tripura'],
  ['80', 'Bihar'], ['83', 'Jharkhand'], ['84', 'Bihar'],
];

const stateFromPrefix = (pin) => {
  const hit = PREFIX_STATE.filter(([p]) => pin.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
};

const unique = (list) => [...new Set(list.filter((v) => v && v !== 'NA'))];

const fromPostOffices = (pin, offices) => {
  const first = offices[0];
  const district = first.District && first.District !== 'NA' ? first.District : '';
  const block = first.Block && first.Block !== 'NA' ? first.Block : '';
  return {
    pincode: pin,
    state: first.State || stateFromPrefix(pin) || '',
    city: district || block || first.Division || '',
    district,
    localities: unique(offices.map((o) => o.Name)), // post office names, offered as "area" suggestions
    source: 'india-post',
    approximate: false,
  };
};

async function fetchIndiaPost(pin) {
  const res = await fetch(`${ENDPOINT}/${pin}`, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const entry = Array.isArray(json) ? json[0] : null;
  if (!entry) throw new Error('Unexpected response');
  if (entry.Status !== 'Success' || !Array.isArray(entry.PostOffice) || !entry.PostOffice.length) return null; // unknown pincode
  return fromPostOffices(pin, entry.PostOffice);
}

exports.stateFromPrefix = stateFromPrefix;
exports._cache = cache;

exports.lookup = async (rawPin) => {
  const pin = String(rawPin || '').trim();
  if (!/^[1-9]\d{5}$/.test(pin)) throw new ApiError(400, 'Enter a valid 6-digit pincode');

  const hit = cache.get(pin);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value;
  try {
    value = await fetchIndiaPost(pin);
    if (!value) throw new ApiError(404, 'Pincode not found. Check the number');
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const state = stateFromPrefix(pin);
    if (!state) throw new ApiError(502, 'Could not look up this pincode right now. Enter the city and state by hand');
    // Directory unreachable: give the state only, and do not cache so the next try asks again
    return { pincode: pin, state, city: '', district: '', localities: [], source: 'prefix', approximate: true };
  }
  cache.set(pin, { at: Date.now(), value });
  return value;
};
