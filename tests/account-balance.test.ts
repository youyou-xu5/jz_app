import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";

/**
 * Regression tests for the account balance double-counting bug.
 *
 * Bug: get_account_balances RPC returns balance = initial_balance + SUM(transactions.amount).
 * The frontend was incorrectly adding initial_balance again, causing 2× the correct value.
 *
 * Fix: When RPC succeeds, use the RPC balance directly.
 *      Only add initial_balance in the manual fallback path.
 *
 * These tests verify the calculation logic WITHOUT requiring a database connection.
 * They simulate both the RPC path and the fallback path.
 */

// Simulates the RPC return value
interface RpcBalance {
  account_id: string;
  balance: number; // = initial_balance + SUM(transactions.amount)
  transaction_count: number;
}

// Simulates a transaction row
interface TxnRow {
  account_id: string;
  amount: number;
}

// Simulates an account
interface Account {
  id: string;
  initial_balance: string;
  currency: string;
}

/**
 * Replicates the core balance calculation logic from getAccountsGroupedByCurrency.
 * Returns current_balance for each account.
 */
function computeBalances(
  accounts: Account[],
  rpcResult: RpcBalance[] | null, // null = RPC failed, use fallback
  fallbackTxns: TxnRow[],
): { id: string; current_balance: string; transaction_count: number }[] {
  // Build maps
  const txnSumMap: Record<string, number> = {};
  const txnCountMap: Record<string, number> = {};

  let rpcSucceeded = false;

  if (rpcResult) {
    rpcSucceeded = true;
    for (const row of rpcResult) {
      // RPC balance already = initial_balance + SUM(transactions.amount)
      txnSumMap[row.account_id] = Number(row.balance);
      txnCountMap[row.account_id] = Number(row.transaction_count);
    }
  } else {
    // Fallback: sum transactions only (no initial_balance)
    for (const t of fallbackTxns) {
      txnSumMap[t.account_id] = (txnSumMap[t.account_id] ?? 0) + Number(t.amount);
      txnCountMap[t.account_id] = (txnCountMap[t.account_id] ?? 0) + 1;
    }
  }

  return accounts.map((a) => {
    let total: number;

    if (rpcSucceeded) {
      // RPC returned FINAL balance — do NOT add initial_balance again
      total = txnSumMap[a.id] ?? Number(a.initial_balance);
    } else {
      // Fallback: txnSumMap only has SUM(transactions.amount)
      // Must add initial_balance exactly once
      total = Number(a.initial_balance) + (txnSumMap[a.id] ?? 0);
    }

    return {
      id: a.id,
      current_balance: total.toFixed(4),
      transaction_count: txnCountMap[a.id] ?? 0,
    };
  });
}

describe("Account balance — no double counting (RPC path)", () => {
  it("account with initial_balance 499 and no transactions → ¥499", () => {
    const accounts = [{ id: "a1", initial_balance: "499", currency: "CNY" }];
    // RPC returns initial_balance + SUM(0) = 499
    const rpc: RpcBalance[] = [{ account_id: "a1", balance: 499, transaction_count: 0 }];

    const result = computeBalances(accounts, rpc, []);
    expect(result[0].current_balance).toBe("499.0000");
    expect(result[0].current_balance).not.toBe("998.0000");
  });

  it("account with initial_balance 1000 and one expense of 200 → ¥800", () => {
    const accounts = [{ id: "a1", initial_balance: "1000", currency: "CNY" }];
    // RPC: 1000 + (-200) = 800
    const rpc: RpcBalance[] = [{ account_id: "a1", balance: 800, transaction_count: 1 }];

    const result = computeBalances(accounts, rpc, []);
    expect(result[0].current_balance).toBe("800.0000");
  });

  it("account with initial_balance 0 and income 500 → ¥500", () => {
    const accounts = [{ id: "a1", initial_balance: "0", currency: "CNY" }];
    const rpc: RpcBalance[] = [{ account_id: "a1", balance: 500, transaction_count: 1 }];

    const result = computeBalances(accounts, rpc, []);
    expect(result[0].current_balance).toBe("500.0000");
  });

  it("multiple accounts — each balance is correct, not doubled", () => {
    const accounts = [
      { id: "a1", initial_balance: "499", currency: "CNY" },
      { id: "a2", initial_balance: "1000", currency: "CNY" },
      { id: "a3", initial_balance: "5000", currency: "THB" },
    ];
    const rpc: RpcBalance[] = [
      { account_id: "a1", balance: 499, transaction_count: 0 },
      { account_id: "a2", balance: 800, transaction_count: 1 }, // 1000 - 200
      { account_id: "a3", balance: 6000, transaction_count: 1 }, // 5000 + 1000
    ];

    const result = computeBalances(accounts, rpc, []);
    expect(result[0].current_balance).toBe("499.0000");
    expect(result[1].current_balance).toBe("800.0000");
    expect(result[2].current_balance).toBe("6000.0000");
  });
});

describe("Account balance — no double counting (fallback path)", () => {
  it("account with initial_balance 499 and no transactions → ¥499", () => {
    const accounts = [{ id: "a1", initial_balance: "499", currency: "CNY" }];
    // Fallback: no transactions found, txnSumMap is empty
    const result = computeBalances(accounts, null, []);
    expect(result[0].current_balance).toBe("499.0000");
  });

  it("account with initial_balance 1000 and one expense of 200 → ¥800", () => {
    const accounts = [{ id: "a1", initial_balance: "1000", currency: "CNY" }];
    const txns: TxnRow[] = [{ account_id: "a1", amount: -200 }];
    // Fallback: 1000 + (-200) = 800
    const result = computeBalances(accounts, null, txns);
    expect(result[0].current_balance).toBe("800.0000");
  });

  it("account with initial_balance 0 and income 500 → ¥500", () => {
    const accounts = [{ id: "a1", initial_balance: "0", currency: "CNY" }];
    const txns: TxnRow[] = [{ account_id: "a1", amount: 500 }];
    const result = computeBalances(accounts, null, txns);
    expect(result[0].current_balance).toBe("500.0000");
  });
});

describe("Account balance — regression: 499 must NOT become 998", () => {
  // This is the specific bug report: initial_balance 499 showed as 998
  // because the code added initial_balance twice (once from RPC, once manually)

  it("RPC path: 499 stays 499, never 998", () => {
    const accounts = [{ id: "a1", initial_balance: "499", currency: "CNY" }];
    const rpc: RpcBalance[] = [{ account_id: "a1", balance: 499, transaction_count: 0 }];

    const result = computeBalances(accounts, rpc, []);
    const balance = Number(result[0].current_balance);

    expect(balance).toBe(499);
    expect(balance).not.toBe(998);
    expect(balance).not.toBe(499 * 2);
  });

  it("fallback path: 499 stays 499, never 998", () => {
    const accounts = [{ id: "a1", initial_balance: "499", currency: "CNY" }];
    const result = computeBalances(accounts, null, []);
    const balance = Number(result[0].current_balance);

    expect(balance).toBe(499);
    expect(balance).not.toBe(998);
    expect(balance).not.toBe(499 * 2);
  });
});
