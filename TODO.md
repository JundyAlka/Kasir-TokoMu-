# Data-access technical debt

The workspace isolation work intentionally leaves explicitly scoped raw SQL and
Drizzle queries in place. Do not migrate them to `scoped-query.ts` until the
store data migration is complete and a dedicated, reviewed refactor is
approved.

Remaining direct-access areas include reporting and profit-sharing aggregates,
investor services, AI tools, shift services, audit/RBAC services, and report,
payout, expense, inventory, restock, and monthly-report endpoints. Each must
retain an explicit `user_id` or `workspace_owner_id` predicate (including
joined business tables) until that later refactor.
