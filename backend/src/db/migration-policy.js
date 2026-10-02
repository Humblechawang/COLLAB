'use strict';

const MIGRATION_DISPOSITIONS = new Map([
  ['20260930000000_baseline.sql', 'baseline'],
  ['20260930001000_auth_profiles_rls.sql', 'hold'],
  ['20260930002000_express_only_rls.sql', 'hold'],
  ['20260930003000_rls_request_jwt.sql', 'hold'],
]);

function migrationDisposition(name) {
  return MIGRATION_DISPOSITIONS.get(name) || 'unreviewed';
}

module.exports = { migrationDisposition };
