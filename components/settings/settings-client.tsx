"use client";

import * as React from "react";
import { Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateProfileAction, exportDataAction } from "@/features/settings/actions";
import { SUPPORTED_CURRENCIES } from "@/types/transaction";
import type { Profile } from "@/types/database";

const TIMEZONES = [
  { value: "Asia/Bangkok", label: "Asia/Bangkok (UTC+7)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (UTC+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (UTC+8)" },
  { value: "America/New_York", label: "America/New_York (UTC-5)" },
  { value: "Europe/London", label: "Europe/London (UTC+0)" },
];

interface SettingsClientProps {
  profile: Profile;
  email: string;
}

export function SettingsClient({ profile, email }: SettingsClientProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [exportLoading, setExportLoading] = React.useState(false);

  async function handleSave(formData: FormData) {
    setLoading(true);
    const result = await updateProfileAction(formData);
    setLoading(false);

    if (result.success) {
      toast({ title: "保存成功", variant: "success" });
    } else {
      toast({
        title: "保存失败",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  async function handleExport(format: "json" | "csv") {
    setExportLoading(true);
    try {
      const result = await exportDataAction(format);
      if (result.success && result.content) {
        // Trigger download
        const blob = new Blob([result.content], { type: result.contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename ?? `export.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "导出成功",
          description: result.filename,
          variant: "success",
        });
      } else {
        toast({
          title: "导出失败",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "导出失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>个人资料</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleSave} className="space-y-4">
          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>邮箱</Label>
            <Input value={email} disabled className="bg-muted/50" />
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display_name">显示名称</Label>
            <Input
              id="display_name"
              name="display_name"
              type="text"
              defaultValue={profile.display_name ?? ""}
              placeholder="你的昵称"
            />
          </div>

          {/* Base Currency */}
          <div className="space-y-2">
            <Label htmlFor="base_currency">基础币种</Label>
            <Select
              id="base_currency"
              name="base_currency"
              defaultValue={profile.base_currency}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name} ({c.symbol})
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              基础币种是汇率换算和资产汇总的基准货币
            </p>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone">时区</Label>
            <Select
              id="timezone"
              name="timezone"
              defaultValue={profile.timezone}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit" loading={loading}>
            <Save className="h-4 w-4 mr-1" />
            保存
          </Button>
        </form>
      </CardContent>

      {/* Data Export */}
      <CardContent className="border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">数据导出</p>
            <p className="text-xs text-muted-foreground mt-1">
              导出所有账户、交易和汇率数据
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("json")}
              loading={exportLoading}
            >
              <Download className="h-4 w-4 mr-1" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              loading={exportLoading}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
