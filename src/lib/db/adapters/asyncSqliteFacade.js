import { AsyncLocalStorage } from "node:async_hooks";

// Expose the existing synchronous SQLite drivers through the same async contract
// used by PostgreSQL. A small process-local queue keeps awaited transactions
// isolated from other queries on the shared SQLite connection.
export function makeAsyncSqliteFacade(syncAdapter) {
  const scope = new AsyncLocalStorage();
  let queue = Promise.resolve();
  let savepointId = 0;
  let facade;

  async function withLock(fn) {
    const previous = queue;
    let release;
    queue = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async function invoke(method, ...args) {
    if (scope.getStore()?.facade === facade) {
      return syncAdapter[method](...args);
    }
    return withLock(() => syncAdapter[method](...args));
  }

  async function transaction(fn) {
    const context = scope.getStore();
    if (context?.facade === facade) {
      const savepoint = `fr_sp_${++savepointId}`;
      syncAdapter.exec(`SAVEPOINT ${savepoint}`);
      try {
        const result = await scope.run({ facade, depth: context.depth + 1 }, fn);
        syncAdapter.exec(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        try {
          syncAdapter.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          syncAdapter.exec(`RELEASE SAVEPOINT ${savepoint}`);
        } catch {}
        throw error;
      }
    }

    return withLock(async () => {
      syncAdapter.exec("BEGIN IMMEDIATE");
      try {
        const result = await scope.run({ facade, depth: 1 }, fn);
        syncAdapter.exec("COMMIT");
        return result;
      } catch (error) {
        try { syncAdapter.exec("ROLLBACK"); } catch {}
        throw error;
      }
    });
  }

  facade = {
    driver: `${syncAdapter.driver}-async`,
    raw: syncAdapter.raw,
    run: (...args) => invoke("run", ...args),
    get: (...args) => invoke("get", ...args),
    all: (...args) => invoke("all", ...args),
    exec: (...args) => invoke("exec", ...args),
    transaction,
    checkpoint: (...args) => invoke("checkpoint", ...args),
    close: (...args) => invoke("close", ...args),
  };

  return facade;
}
