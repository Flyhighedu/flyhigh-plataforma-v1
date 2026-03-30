-- ============================================================
-- FlyHigh HR Module — Phase 1 Migration
-- ============================================================
-- SAFETY: These are NEW tables only. No existing tables modified.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. HR Documents (Bóveda Digital)
CREATE TABLE IF NOT EXISTS hr_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('ine', 'curp', 'proof_of_address', 'driver_license')),
    file_url TEXT NOT NULL,
    file_name TEXT,
    expires_at DATE,                 -- NULL for CURP (doesn't expire)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected', 'expired')),
    validated_at TIMESTAMPTZ,
    validated_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. HR Time Off (Solicitudes — UI paused, table created for future use)
CREATE TABLE IF NOT EXISTS hr_time_off (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('vacation', 'sick_leave', 'personal', 'other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    evidence_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    reviewer_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. HR Payslips (Recibos de Pago)
CREATE TABLE IF NOT EXISTS hr_payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_label TEXT NOT NULL,       -- 'Semana 12 - Marzo 2026'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    concept TEXT,                     -- 'Salario semanal', 'Bono puntualidad'
    payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'other')),
    notes TEXT,
    pdf_url TEXT,                     -- Auto-generated PDF path in Storage
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. HR Schedule Config (Hora de entrada configurable)
CREATE TABLE IF NOT EXISTS hr_schedule_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    required_checkin_time TIME DEFAULT '07:00',
    note TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hr_documents_user ON hr_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_documents_status ON hr_documents(status);
CREATE INDEX IF NOT EXISTS idx_hr_documents_expires ON hr_documents(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hr_time_off_user ON hr_time_off(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_time_off_status ON hr_time_off(status);
CREATE INDEX IF NOT EXISTS idx_hr_payslips_user ON hr_payslips(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_payslips_period ON hr_payslips(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_hr_schedule_date ON hr_schedule_config(date);

-- ============================================================
-- RLS Policies
-- ============================================================

-- Enable RLS
ALTER TABLE hr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_schedule_config ENABLE ROW LEVEL SECURITY;

-- hr_documents: Users can read/write their own docs. Admins can read all + validate.
CREATE POLICY "Users can view own documents" ON hr_documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON hr_documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON hr_documents
    FOR UPDATE USING (auth.uid() = user_id);

-- hr_time_off: Users can read/create their own requests.
CREATE POLICY "Users can view own time off" ON hr_time_off
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time off" ON hr_time_off
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- hr_payslips: Users can only read their own payslips.
CREATE POLICY "Users can view own payslips" ON hr_payslips
    FOR SELECT USING (auth.uid() = user_id);

-- hr_schedule_config: All authenticated users can read (for calculating punctuality).
CREATE POLICY "Authenticated users can read schedule" ON hr_schedule_config
    FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Storage bucket (run manually in Supabase Dashboard > Storage)
-- ============================================================
-- Create bucket: "hr-documents" (private, no public access)
-- Max file size: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf
