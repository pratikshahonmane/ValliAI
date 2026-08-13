// Known-record lookups for the demo -- per the field spec, customer_id and
// merchant_id must be real lookups, not free text. No backend exists yet, so
// this is the "fall back to a plain dropdown populated from a known sample
// list" path called out in frontend_field_specification.md.

export const CURRENCIES = ["AED", "AUD", "BRL", "GBP", "INR", "MYR", "SGD", "USD"];

export const COUNTRIES = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "AU", name: "Australia" },
  { code: "BR", name: "Brazil" },
  { code: "GB", name: "United Kingdom" },
  { code: "IN", name: "India" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "US", name: "United States" },
];

export const CHANNELS = ["api", "atm", "mobile_app", "pos", "web"];

export const MERCHANT_CATEGORIES = [
  "crypto",
  "electronics",
  "fashion",
  "fuel",
  "gambling",
  "grocery",
  "pharmacy",
  "restaurant",
  "travel",
  "utilities",
];

export const COUNTRY_TO_CURRENCY = {
  AE: "AED",
  AU: "AUD",
  BR: "BRL",
  GB: "GBP",
  IN: "INR",
  MY: "MYR",
  SG: "SGD",
  US: "USD",
};

export const SAMPLE_CUSTOMERS = [
  { id: "cust_501", name: "Wei Ling Tan", homeCountry: "SG" },
  { id: "cust_502", name: "Arjun Mehta", homeCountry: "IN" },
  { id: "cust_503", name: "Sophie Clarke", homeCountry: "GB" },
  { id: "cust_504", name: "Carlos Almeida", homeCountry: "BR" },
  { id: "cust_505", name: "Fatima Al Suwaidi", homeCountry: "AE" },
  { id: "cust_506", name: "Jack Wilson", homeCountry: "AU" },
  { id: "cust_507", name: "Nurul Aisyah", homeCountry: "MY" },
  { id: "cust_508", name: "Daniel Reyes", homeCountry: "US" },
];

export const SAMPLE_MERCHANTS = [
  { id: "merchant_112", name: "Orchard Electronics", category: "electronics" },
  { id: "merchant_118", name: "CoinVault Exchange", category: "crypto" },
  { id: "merchant_121", name: "Golden Fortune Casino", category: "gambling" },
  { id: "merchant_130", name: "FreshMart Grocers", category: "grocery" },
  { id: "merchant_133", name: "SkyHigh Travel Co", category: "travel" },
  { id: "merchant_140", name: "MediCare Pharmacy", category: "pharmacy" },
  { id: "merchant_145", name: "Riverside Diner", category: "restaurant" },
  { id: "merchant_150", name: "QuickFuel Station", category: "fuel" },
  { id: "merchant_155", name: "Urban Threads Fashion", category: "fashion" },
  { id: "merchant_160", name: "CityPower Utilities", category: "utilities" },
];

export function customerLabel(id) {
  const c = SAMPLE_CUSTOMERS.find((x) => x.id === id);
  return c ? `${c.name} (${c.id})` : id;
}

export function merchantLabel(id) {
  const m = SAMPLE_MERCHANTS.find((x) => x.id === id);
  return m ? `${m.name} (${m.id})` : id;
}

export function countryName(code) {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
