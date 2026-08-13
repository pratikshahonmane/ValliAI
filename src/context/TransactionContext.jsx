import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildSeedTransactions } from "../lib/seedTransactions";

const TransactionContext = createContext(null);
const STORAGE_KEY = "vaaligard_transactions";

export function TransactionProvider({ children }) {
  const [records, setRecords] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // fall through to seed data
    }
    return buildSeedTransactions();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  function addRecord(request, response) {
    const record = { request, response, analyzedAt: new Date().toISOString() };
    setRecords((prev) => [record, ...prev]);
    return record;
  }

  function addRecords(entries) {
    const now = new Date().toISOString();
    const newRecords = entries.map(({ request, response }) => ({
      request,
      response,
      analyzedAt: now,
    }));
    setRecords((prev) => [...newRecords, ...prev]);
    return newRecords;
  }

  function resetToSeed() {
    setRecords(buildSeedTransactions());
  }

  const value = useMemo(() => ({ records, addRecord, addRecords, resetToSeed }), [records]);

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error("useTransactions must be used within TransactionProvider");
  return ctx;
}
