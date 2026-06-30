-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT DEFAULT 'active',
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business')),
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    scanned_pages INTEGER DEFAULT 0,
    ocr_runs INTEGER DEFAULT 0,
    pdf_operations INTEGER DEFAULT 0,
    google_drive_syncs INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for usage_tracking
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage" ON public.usage_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage" ON public.usage_tracking
    FOR UPDATE USING (auth.uid() = user_id);

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    is_local_only BOOLEAN DEFAULT FALSE,
    google_drive_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own documents" ON public.documents
    FOR ALL USING (auth.uid() = user_id);

-- Create pages table
CREATE TABLE IF NOT EXISTS public.pages (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    page_number INTEGER NOT NULL,
    image_path TEXT NOT NULL, -- Storage bucket path
    transform_matrix JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for pages
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD pages of their own documents" ON public.pages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE public.documents.id = public.pages.document_id
            AND public.documents.user_id = auth.uid()
        )
    );

-- Create ocr_results table
CREATE TABLE IF NOT EXISTS public.ocr_results (
    id TEXT PRIMARY KEY,
    page_id TEXT REFERENCES public.pages(id) ON DELETE CASCADE UNIQUE NOT NULL,
    raw_text TEXT NOT NULL,
    hocr_data JSONB,
    language TEXT NOT NULL,
    engine TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for ocr_results
ALTER TABLE public.ocr_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD OCR results of their own pages" ON public.ocr_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.pages
            JOIN public.documents ON public.documents.id = public.pages.document_id
            WHERE public.pages.id = public.ocr_results.page_id
            AND public.documents.user_id = auth.uid()
        )
    );

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    document_id TEXT,
    action TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Profile auto-creation trigger when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'avatar_url'
    );

    -- Create default free subscription
    INSERT INTO public.subscriptions (user_id, tier)
    VALUES (new.id, 'free');

    -- Create usage tracking record
    INSERT INTO public.usage_tracking (user_id)
    VALUES (new.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow users to upload files to their own folder
CREATE POLICY "Allow users to upload files to their own folder" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to view their own files
CREATE POLICY "Allow users to view their own files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to update their own files
CREATE POLICY "Allow users to update their own files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

