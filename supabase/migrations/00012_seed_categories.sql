-- Migration: 00012_seed_categories
-- Description: Seed default system categories (user_id = NULL, is_system = true)

-- =============================================================
-- DEFAULT EXPENSE CATEGORIES
-- =============================================================
INSERT INTO public.categories (user_id, name, type, icon, color, sort_order, is_system, is_archived)
VALUES
  (NULL, '餐饮',    'expense', 'utensils',   '#e24b4a',  1, true, false),
  (NULL, '交通',    'expense', 'car',         '#378add',  2, true, false),
  (NULL, '购物',    'expense', 'shopping-bag','#993556',  3, true, false),
  (NULL, '住房',    'expense', 'home',        '#534ab7',  4, true, false),
  (NULL, '水电',    'expense', 'zap',         '#ef9f27',  5, true, false),
  (NULL, '娱乐',    'expense', 'music',       '#7f77dd',  6, true, false),
  (NULL, '医疗',    'expense', 'heart-pulse', '#d85a30',  7, true, false),
  (NULL, '学习',    'expense', 'book-open',  '#1d9e75',  8, true, false),
  (NULL, '旅行',    'expense', 'plane',       '#185fa5',  9, true, false),
  (NULL, '宝宝',    'expense', 'baby',        '#ed93b1', 10, true, false),
  (NULL, '人情',    'expense', 'gift',        '#ba7517', 11, true, false),
  (NULL, '其他',    'expense', 'more-horizontal','#888780', 12, true, false)
ON CONFLICT DO NOTHING;

-- =============================================================
-- DEFAULT INCOME CATEGORIES
-- =============================================================
INSERT INTO public.categories (user_id, name, type, icon, color, sort_order, is_system, is_archived)
VALUES
  (NULL, '工资',      'income', 'briefcase',     '#1d9e75',  1, true, false),
  (NULL, '奖金',      'income', 'award',          '#3b6d11',  2, true, false),
  (NULL, '退款',      'income', 'rotate-ccw',     '#378add',  3, true, false),
  (NULL, '兼职',      'income', 'laptop',         '#534ab7',  4, true, false),
  (NULL, '投资收益',  'income', 'trending-up',    '#ef9f27',  5, true, false),
  (NULL, '其他收入',  'income', 'more-horizontal','#888780',  6, true, false)
ON CONFLICT DO NOTHING;
