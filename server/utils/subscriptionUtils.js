const DAY_MS = 24 * 60 * 60 * 1000;

function calculateDaysRemaining(targetDate) {
  if (!targetDate) return 0;
  const end = new Date(targetDate);
  const diff = end.getTime() - Date.now();
  if (Number.isNaN(end.getTime()) || diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
}

module.exports = {
  calculateDaysRemaining,
  DAY_MS,
};
