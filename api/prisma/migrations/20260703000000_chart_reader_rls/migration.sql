-- Advanced (LLM-authored SQL) chart path: a least-privilege, read-only role
-- fenced by Row-Level Security so an arbitrary SELECT can only ever see the
-- session user's own rows. The main application connects as a superuser and is
-- therefore never constrained by these policies.

-- 1. Least-privilege role. Roles are cluster-global, so guard against re-creation
--    when this migration is applied to more than one database in the cluster
--    (e.g. the dev DB and expense_classifier_test).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chart_reader') THEN
    CREATE ROLE chart_reader LOGIN PASSWORD 'chart_reader_pw';
  END IF;
END
$$;

-- chart_reader may read, and only read, the two tables the chart compiler needs.
GRANT USAGE ON SCHEMA public TO chart_reader;
GRANT SELECT ON TABLE "Expense" TO chart_reader;
GRANT SELECT ON TABLE "Category" TO chart_reader;

-- 2. Row-Level Security scoped to the session user. `app.user_id` is set
--    transaction-locally by the API before executing model SQL; when unset,
--    current_setting(..., true) yields NULL and no rows match (default deny).
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chart_user_isolation ON "Expense";
CREATE POLICY chart_user_isolation ON "Expense"
  FOR SELECT
  USING ("userId" = current_setting('app.user_id', true));

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chart_user_isolation ON "Category";
CREATE POLICY chart_user_isolation ON "Category"
  FOR SELECT
  USING ("userId" = current_setting('app.user_id', true));
