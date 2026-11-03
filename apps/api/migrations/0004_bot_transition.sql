-- A single compare-and-swap update of cloud_meta.bot_id switches operational
-- identity atomically. Financial records, projections and profiles stay intact.
CREATE TRIGGER cloud_bot_transition AFTER UPDATE OF value ON cloud_meta
WHEN OLD.key='bot_id' AND OLD.value<>NEW.value
BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM cloud_outbox)
    THEN RAISE(ABORT,'Respostas pendentes impedem a troca de bot.') END;
  DELETE FROM cloud_processed;
  UPDATE cloud_state SET version=version+1,pending=NULL;
  DELETE FROM web_sessions;
  DELETE FROM web_auth_flows;
  DELETE FROM web_auth_accepts;
  DELETE FROM web_auth_limits;
END;
-- statement-breakpoint
