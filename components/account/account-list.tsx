"use client";

import * as React from "react";
import { Plus, Edit, Archive, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/currency/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { AccountForm } from "./account-form";
import { archiveAccountAction } from "@/features/accounts/actions";
import type { AccountWithBalance } from "@/features/accounts/queries";
import { ACCOUNT_TYPES } from "@/types/transaction";

interface AccountListProps {
  currencies: { currency: string; accounts: AccountWithBalance[] }[];
}

export function AccountList({ currencies }: AccountListProps) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = React.useState(false);
  const [editAccount, setEditAccount] = React.useState<
    AccountWithBalance | null
  >(null);
  const [confirmArchive, setConfirmArchive] = React.useState<
    AccountWithBalance | null
  >(null);

  async function handleArchive(formData: FormData) {
    const result = await archiveAccountAction(formData);
    if (result.success) {
      toast({ title: "账户已归档", variant: "success" });
    } else {
      toast({
        title: "操作失败",
        description: result.error,
        variant: "destructive",
      });
    }
    setConfirmArchive(null);
  }

  if (currencies.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Wallet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">还没有账户，创建一个开始记账</p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> 新建账户
        </Button>
        {showCreate && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <AccountForm mode="create" onClose={() => setShowCreate(false)} />
          </Dialog>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> 新建账户
        </Button>
      </div>

      {currencies.map(({ currency, accounts }) => (
        <div key={currency} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {currency} 账户
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => {
              const typeLabel = ACCOUNT_TYPES.find(
                (t) => t.value === account.account_type
              )?.label;
              return (
                <Card key={account.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{account.name}</p>
                      {typeLabel && (
                        <Badge variant="secondary" className="mt-1">
                          {typeLabel}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditAccount(account)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      {account.transaction_count > 0 && (
                        <form action={handleArchive}>
                          <input
                            type="hidden"
                            name="id"
                            value={account.id}
                          />
                          <button
                            type="submit"
                            className="rounded p-1 text-muted-foreground hover:bg-accent"
                            title="归档"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xl font-semibold">
                      {formatCurrency(account.current_balance, account.currency)}
                    </p>
                    {account.transaction_count > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {account.transaction_count} 笔交易
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Create Dialog */}
      {showCreate && (
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <AccountForm
            mode="create"
            onClose={() => setShowCreate(false)}
          />
        </Dialog>
      )}

      {/* Edit Dialog */}
      {editAccount && (
        <Dialog open={!!editAccount} onOpenChange={(v) => !v && setEditAccount(null)}>
          <AccountForm
            mode="edit"
            account={editAccount}
            onClose={() => setEditAccount(null)}
          />
        </Dialog>
      )}
    </div>
  );
}
