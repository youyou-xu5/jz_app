"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  createCategoryAction,
  archiveCategoryAction,
} from "@/features/categories/actions";
import type { Category } from "@/types/database";

interface CategoryManagerProps {
  expenseCategories: Category[];
  incomeCategories: Category[];
}

export function CategoryManager({
  expenseCategories,
  incomeCategories,
}: CategoryManagerProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = React.useState(false);
  const [formType, setFormType] = React.useState<"expense" | "income">("expense");

  async function handleSubmit(formData: FormData) {
    const result = await createCategoryAction(formData);
    if (result.success) {
      toast({ title: "分类创建成功", variant: "success" });
      setShowForm(false);
    } else {
      toast({
        title: "操作失败",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  async function handleArchive(formData: FormData) {
    const result = await archiveCategoryAction(formData);
    if (result.success) {
      toast({ title: "分类已归档", variant: "success" });
    } else {
      toast({
        title: "操作失败",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  function CategoryItem({ category }: { category: Category }) {
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <div className="flex items-center gap-2">
          {category.color && (
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: category.color }}
            />
          )}
          <span className="text-sm font-medium">{category.name}</span>
          {category.is_system && (
            <Badge variant="outline" className="text-xs">
              系统
            </Badge>
          )}
        </div>
        {!category.is_system && (
          <form action={handleArchive}>
            <input type="hidden" name="id" value={category.id} />
            <button
              type="submit"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
              title="归档/删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">分类管理</h3>
        <Button
          size="sm"
          onClick={() => {
            setFormType("expense");
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> 新建分类
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Expense */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            支出分类
          </h4>
          <div className="space-y-1">
            {expenseCategories.map((c) => (
              <CategoryItem key={c.id} category={c} />
            ))}
          </div>
        </div>

        {/* Income */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            收入分类
          </h4>
          <div className="space-y-1">
            {incomeCategories.map((c) => (
              <CategoryItem key={c.id} category={c} />
            ))}
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form action={handleSubmit} className="space-y-4 border rounded-lg p-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">分类名称</Label>
            <Input
              id="cat-name"
              name="name"
              required
              placeholder="例如: 宠物"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-type">类型</Label>
            <Select
              id="cat-type"
              name="type"
              value={formType}
              onChange={(e) => setFormType(e.target.value as "expense" | "income")}
            >
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-color">颜色 (可选)</Label>
            <Input
              id="cat-color"
              name="color"
              type="color"
              defaultValue="#888888"
              className="h-9 w-16 p-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              取消
            </Button>
            <Button type="submit">创建</Button>
          </div>
        </form>
      )}
    </div>
  );
}
