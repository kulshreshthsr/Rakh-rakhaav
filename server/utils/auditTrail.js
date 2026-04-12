const AuditTrail = require('../models/auditTrailModel');

const cloneForAudit = (value) => {
  if (value == null) return null;
  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, versionKey: false });
  }
  return JSON.parse(JSON.stringify(value));
};

const logAuditEvent = async ({
  shopId,
  userId,
  actionType,
  entity,
  entityId,
  referenceId = '',
  beforeValue = null,
  afterValue = null,
  metadata = null,
  session = null,
}) => {
  if (!shopId || !userId || !actionType || !entity || !entityId) return;

  const payload = {
    shop: shopId,
    user_id: userId,
    action_type: actionType,
    entity,
    entity_id: String(entityId),
    reference_id: referenceId || '',
    before_value: cloneForAudit(beforeValue),
    after_value: cloneForAudit(afterValue),
    metadata: cloneForAudit(metadata),
  };

  await AuditTrail.create([payload], session ? { session } : {});
};

module.exports = {
  cloneForAudit,
  logAuditEvent,
};
