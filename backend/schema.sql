create table documents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  file_path text not null,
  file_type text not null,
  file_size bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  processed boolean default false,
  questions int default 0
);

-- Enable Row Level Security
alter table documents enable row level security;

-- Create policy to allow users to see only their own documents
create policy "Users can view their own documents" on documents
  for select using (auth.uid() = user_id);

-- Create policy to allow users to insert their own documents
create policy "Users can insert their own documents" on documents
  for insert with check (auth.uid() = user_id);

-- Create policy to allow users to update their own documents
create policy "Users can update their own documents" on documents
  for update using (auth.uid() = user_id);

-- Create policy to allow users to delete their own documents
create policy "Users can delete their own documents" on documents
  for delete using (auth.uid() = user_id);

-- Storage bucket for documents
insert into storage.buckets (id, name)
values ('documents', 'documents');

-- Policy for storage access
create policy "Document Access" on storage.objects
  for all using (auth.uid() = owner) with check (auth.uid() = owner);
