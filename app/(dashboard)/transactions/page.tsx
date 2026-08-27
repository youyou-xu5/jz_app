import { getTransactionsByMonth } from "@/features/transactions/queries";
import { getFormData } from "@/features/transactions/queries";
import { getAllAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getCurrentYearMonth } from "@/lib/utils/date";
import { TransactionList } from "@/components/transaction/transaction-list";

export default async function TransactionsPage() {
  const { year, month } = getCurrentYearMonth();
  const [transactions, formData, accounts, { expense, income }] = await Promise.all([
    getTransactionsByMonth(year, month),
    getFormData(),
    getAllAccounts(),
    getCategories(),
  ]);

  const allCategories = [...expense, ...income];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">账单</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看和管理所有交易记录
          </p>
        </div>
      </div>

      <TransactionList
        initialTransactions={transactions}
        initialYear={year}
        initialMonth={month}
        accounts={formData.accounts}
        allCategories={allCategories}
        baseCurrency={formData.baseCurrency}
        latestRate={formData.latestRate}
        expenseCategories={expense}
        incomeCategories={income}
      />
    </div>
  );
}
