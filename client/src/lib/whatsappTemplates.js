/**
 * WhatsApp message templates for all 3 UI languages.
 * Usage: buildWhatsappMessage(templateKey, vars, lang)
 * Returns: { text: string, url: string }
 */

const TEMPLATES = {
  invoice: {
    en: ({ name, inv_no, amount, shop }) =>
      `Dear ${name},\n\nYour invoice *#${inv_no}* for *₹${amount}* from *${shop}* is ready.\n\nThank you for your business! 🙏`,
    hi: ({ name, inv_no, amount, shop }) =>
      `नमस्ते ${name} जी 🙏\n\n*${shop}* से आपका बिल *#${inv_no}* तैयार है।\nकुल राशि: *₹${amount}*\n\nधन्यवाद!`,
    hi_en: ({ name, inv_no, amount, shop }) =>
      `नमस्ते ${name} जी 🙏\n\nआपका Invoice *#${inv_no}* ready है।\nAmount: *₹${amount}* — *${shop}*\n\nThank you!`,
  },

  udhaar_reminder: {
    en: ({ name, amount, shop }) =>
      `Dear ${name},\n\n₹${amount} is outstanding at *${shop}*.\n\nPlease clear at your earliest. Thank you. 🙏`,
    hi: ({ name, amount, shop }) =>
      `नमस्ते ${name} जी 🙏\n\n*${shop}* से आपका *₹${amount}* उधार बाकी है।\n\nकृपया जल्द से जल्द payment करें।\n\nधन्यवाद 🙏`,
    hi_en: ({ name, amount, shop }) =>
      `नमस्ते ${name} जी 🙏\n\n*${shop}* से आपका *₹${amount}* उधार बाकी है।\n\nPlease clear at your earliest. Thank you!`,
  },

  warranty_ready: {
    en: ({ name, product, shop, ref }) =>
      `Dear ${name},\n\nYour *${product}* has been repaired and is ready for pickup at *${shop}*.\n\nJob Ref: *${ref}*\n\nPlease collect at your earliest convenience. 🙏`,
    hi: ({ name, product, shop, ref }) =>
      `नमस्ते ${name} जी 🙏\n\nआपका *${product}* repair हो गया है और pickup के लिए तैयार है।\nदुकान: *${shop}*\nJob No: *${ref}*\n\nधन्यवाद!`,
    hi_en: ({ name, product, shop, ref }) =>
      `नमस्ते ${name} जी 🙏\n\nआपका *${product}* ready है pickup के लिए।\nJob Ref: *${ref}* — *${shop}*\n\nPlease collect soon. Thank you!`,
  },

  amc_renewal: {
    en: ({ name, product, date, shop }) =>
      `Dear ${name},\n\nYour AMC for *${product}* expires on *${date}*.\n\nRenew now at *${shop}* to continue coverage.\n\nContact us to renew. 🙏`,
    hi: ({ name, product, date, shop }) =>
      `नमस्ते ${name} जी 🙏\n\nआपका *${product}* का AMC *${date}* को expire हो रहा है।\n\n*${shop}* से renew करें और coverage जारी रखें।\n\nधन्यवाद!`,
    hi_en: ({ name, product, date, shop }) =>
      `नमस्ते ${name} जी 🙏\n\n*${product}* का AMC *${date}* को expire होगा।\n\nRenew करें *${shop}* से। Thank you!`,
  },

  service_job_ready: {
    en: ({ name, product, shop, ref }) =>
      `Dear ${name},\n\nYour *${product}* service is complete and ready for pickup at *${shop}*.\n\nService Job: *${ref}*\n\nThank you! 🙏`,
    hi: ({ name, product, shop, ref }) =>
      `नमस्ते ${name} जी 🙏\n\n*${product}* की service हो गई है। Pickup के लिए *${shop}* आएं।\nJob: *${ref}*\n\nधन्यवाद!`,
    hi_en: ({ name, product, shop, ref }) =>
      `नमस्ते ${name} जी 🙏\n\n*${product}* ready है service के बाद।\nJob: *${ref}* — *${shop}*\n\nCome pick it up! Thank you 🙏`,
  },
};

/**
 * @param {string} templateKey - One of: invoice, udhaar_reminder, warranty_ready, amc_renewal, service_job_ready
 * @param {object} vars - Template variables
 * @param {string} lang - 'en' | 'hi' | 'hi_en' (default: 'hi_en')
 * @param {string} phone - Recipient phone number (digits only)
 * @returns {{ text: string, url: string }}
 */
export function buildWhatsappMessage(templateKey, vars, lang = 'hi_en', phone = '') {
  const templateSet = TEMPLATES[templateKey];
  if (!templateSet) throw new Error(`Unknown template: ${templateKey}`);
  const effectiveLang = templateSet[lang] ? lang : 'hi_en';
  const text = templateSet[effectiveLang](vars);
  const digits = (phone || '').replace(/\D/g, '');
  const url = digits
    ? `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  return { text, url };
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);
