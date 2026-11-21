CREATE TABLE IF NOT EXISTS webadi_inquiries (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, token_hash text NOT NULL UNIQUE, name text NOT NULL,email text NOT NULL,organization text NOT NULL,website text NOT NULL,goal text NOT NULL,timing text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS webadi_bookings (inquiry_id bigint PRIMARY KEY REFERENCES webadi_inquiries(id), starts_at timestamptz NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON webadi_inquiries, webadi_bookings FROM PUBLIC;
