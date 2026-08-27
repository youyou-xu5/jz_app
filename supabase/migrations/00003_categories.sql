-- Migration: 00003_categories
-- Description: Create categories table with self-referencing parent_id

-- =============================================================
-- CATEGORIES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL,
  icon        text,
  color       text,
  parent_id   uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_system   boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categories IS 'Transaction categories. System categories have user_id = NULL';
COMMENT ON COLUMN public.categories.type IS 'expense or income';
COMMENT ON COLUMN public.categories.is_system IS 'System categories are shared across all users';

-- CHECK: parent_id != id (prevent self-reference)
ALTER TABLE public.categories
  ADD CONSTRAINT categories_no_self_reference
  CHECK (parent_id IS NULL OR parent_id != id);

-- CHECK: type must be expense or income
ALTER TABLE public.categories
  ADD CONSTRAINT categories_type_check
  CHECK (type IN ('expense', 'income'));
