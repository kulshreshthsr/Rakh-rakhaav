export const HELD_BILLS_KEY = 'rr-held-bills';

export function getHeldBills() {
  try {
    return JSON.parse(localStorage.getItem(HELD_BILLS_KEY) || '[]');
  } catch { return []; }
}

export function saveHeldBill(bill) {
  const bills = getHeldBills();
  const existing = bills.findIndex(b => b.id === bill.id);
  if (existing >= 0) {
    bills[existing] = bill;
  } else {
    if (bills.length >= 5) bills.shift();
    bills.push(bill);
  }
  localStorage.setItem(HELD_BILLS_KEY, JSON.stringify(bills));
}

export function removeHeldBill(id) {
  const bills = getHeldBills().filter(b => b.id !== id);
  localStorage.setItem(HELD_BILLS_KEY, JSON.stringify(bills));
}

export function clearAllHeldBills() {
  localStorage.removeItem(HELD_BILLS_KEY);
}

export function getRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'अभी';
  if (mins < 60) return `${mins} मिनट पहले`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} घंटे पहले`;
  return `${Math.floor(hrs / 24)} दिन पहले (पुराना)`;
}
