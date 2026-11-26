// One place for the brand. Replace /public/logo.svg with your own logo file to change it everywhere.
export const BRAND = {
  name: 'Herbal Deep',
  tagline: 'Order & shipping management',
  company: 'Herbal Deep',
  logo: '/logo.svg', // the real Herbal Deep logo: put your logo file in frontend/public (e.g. herbaldeep-logo.png) and set this to '/herbaldeep-logo.png'. Used in the app and on the label
  logoHasName: false, // true when the logo picture already contains the words "Herbal Deep": the label then prints the logo alone
  gstin: '', // optional fallback seller GSTIN for the label. The GST number is normally set per pickup warehouse (Shipping > Warehouses)
  contact: '', // optional line printed under the name on invoices, e.g. '+91 98xxxxxx · hello@herbaldeep.in'
};
