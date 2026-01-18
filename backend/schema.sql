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

-- User statistics table
create table user_statistics (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  document_id uuid references documents(id),
  score int not null,
  accuracy float not null,
  best_streak int not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table user_statistics enable row level security;

-- Create policy to allow users to insert their own statistics
create policy "Users can insert their own statistics" on user_statistics
  for insert with check (auth.uid() = user_id);

-- Create policy to allow users to view their own statistics" on user_statistics
create policy "Users can view their own statistics" on user_statistics
  for select using (auth.uid() = user_id);

-- Store Items
create table if not exists store_items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  cost int not null,
  type text not null, -- 'saber_color', etc.
  value text not null, -- The hex code or asset path
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Access policy
alter table store_items enable row level security;
create policy "Anyone can view store items" on store_items for select using (true);

-- User Purchases
create table if not exists user_purchases (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  item_id uuid references store_items(id) not null,
  cost int not null, -- Record cost at time of purchase
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table user_purchases enable row level security;
create policy "Users can view their own purchases" on user_purchases for select using (auth.uid() = user_id);
create policy "Users can insert their own purchases" on user_purchases for insert with check (auth.uid() = user_id);

-- User Equipped Items
create table if not exists user_equipped_items (
  user_id uuid references auth.users not null,
  item_type text not null,
  item_id uuid references store_items(id) not null,
  primary key (user_id, item_type)
);

alter table user_equipped_items enable row level security;
create policy "Users can view their own equipped items" on user_equipped_items for select using (auth.uid() = user_id);
create policy "Users can insert their own equipped items" on user_equipped_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own equipped items" on user_equipped_items for update using (auth.uid() = user_id);

-- Seed some data (Check if exists first or just insert, assuming empty for now or use ON CONFLICT DO NOTHING)
insert into store_items (name, description, cost, type, value) values
    ('Red Saber', 'A classic red lightsaber color.', 100, 'saber_color', '#FF0000'),
    ('Green Saber', 'A classic green lightsaber color.', 100, 'saber_color', '#00FF00'),
    ('Blue Saber', 'A classic blue lightsaber color.', 100, 'saber_color', '#0000FF'),
    ('Purple Saber', 'A unique purple lightsaber color.', 500, 'saber_color', '#800080'),
    ('Gold Saber', 'A prestigious gold lightsaber color.', 1000, 'saber_color', '#FFD700');

-- Update store items to support dual colors (pairs)
-- We'll store value as "ColorLeft,ColorRight" e.g., "#FF0000,#00FF00"

-- First, clear existing items (Development Phase Convenience)
truncate table store_items cascade;

-- Insert New Paired Items
insert into store_items (name, description, cost, type, value) values
    ('Classic Duo', 'The classic Pink and Blue combination.', 0, 'saber_pair', '#FF00FF,#00FFFF'),
    ('Sith Lord', 'Embrace the dark side with Dark and Light Red sabers.', 500, 'saber_pair', '#8B0000,#FF4D4D'),
    ('Jedi Master', 'A peaceful Green and Blue combination.', 500, 'saber_pair', '#00FF00,#0000FF'),
    ('Royal Guard', 'A prestigious Gold and Purple combination.', 1000, 'saber_pair', '#FFD700,#800080'),
    ('Neon Nights', 'Vibrant Cyan and Magenta pair.', 750, 'saber_pair', '#00FFFF,#FF00FF'),
    ('nwPlus', 'Represent the nwPlus community!', 1200, 'saber_pair', '#20F2B0,#2C3E50');

-- Ensure users start with the default item unlocked
-- This logic is usually better handled in application code (on user creation trigger)
-- or handled by "price: 0" logic in frontend/backend where 0 cost items are auto-owned or easy to buy.
-- For now, we set 'Classic Duo' cost to 0.

-- Add topic column to documents table
alter table documents add column if not exists topic text;
