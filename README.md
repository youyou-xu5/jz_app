# Money Book - 双币种个人记账系统

CNY / THB 双币种个人记账 Web 应用，支持多账户、跨币种换汇、汇率管理、统计报表等。

## 技术栈

- Next.js 16 (App Router)
- TypeScript (strict)
- Tailwind CSS v4
- shadcn/ui
- Supabase (PostgreSQL + Auth + RLS)
- @supabase/ssr
- React Hook Form + Zod
- Recharts
- date-fns
- decimal.js (财务金额精确计算)
- Vitest

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 环境变量

```bash
cp .env.example .env.local
```

填写你的 Supabase 项目 URL 和 anon key。

### 3. 数据库初始化

```bash
# 安装 Supabase CLI (如未安装)
# brew install supabase/tap/supabase

# 链接项目
supabase link --project-ref <your-project-ref>

# 运行 migration
supabase db push
```

### 4. 本地开发

```bash
pnpm dev
```

访问 http://localhost:3000

## 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | ESLint 检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 运行测试 |
| `pnpm db:types` | 生成 Supabase TypeScript 类型 |

## 汇率规则

系统使用统一汇率标准：

```
1 base_currency = exchange_rate × quote_currency
```

示例 (base = CNY)：

```
1 CNY = 4.8 THB
```

- CNY -> THB: `THB = CNY × rate`
- THB -> CNY: `CNY = THB ÷ rate`

历史账单保存汇率快照，当前资产用最新汇率估值。

## 金额符号规则

| 类型 | 符号 |
|------|------|
| 收入 | 正数 |
| 支出 | 负数 |
| 转入 | 正数 |
| 转出 | 负数 |

账户余额 = `initial_balance + SUM(transactions.amount)`

## 项目结构

```
money-book/
├── app/              # 路由 (App Router)
├── components/       # UI 组件
├── features/         # 业务逻辑层
├── lib/              # 公共基础能力
│   ├── supabase/    # Supabase 客户端
│   ├── currency/    # 汇率/金额计算
│   └── utils/       # 工具函数
├── types/           # TypeScript 类型
├── supabase/        # 数据库 migration
└── tests/           # 测试
```

## 部署

- 代码托管: GitHub
- Web 部署: Vercel
- 数据库: Supabase

## License

Personal use.
