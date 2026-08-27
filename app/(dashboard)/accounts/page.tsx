import { getAccountsGroupedByCurrency } from "@/features/accounts/queries";
import { AccountList } from "@/components/account/account-list";

export default async function AccountsPage() {
  const { currencies } = await getAccountsGroupedByCurrency();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">账户</h1>
      </div>
      <AccountList currencies={currencies} />
    </div>
  );
}
