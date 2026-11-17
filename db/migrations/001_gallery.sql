-- Photo gallery: albums (general, race) and photos (general, race, space).
-- Race records are plain albums like general ones. Space photos have no album;
-- every other photo belongs to an album of the same category.

CREATE TABLE albums (
  id            text PRIMARY KEY,
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category      text NOT NULL CHECK (category IN ('general', 'race')),
  title         text NOT NULL CHECK (length(title) > 0),
  description   text NOT NULL DEFAULT '',
  tags          text[] NOT NULL DEFAULT '{}',
  cover_photo_id text,
  date_start    date,
  date_end      date,
  visibility    text NOT NULL DEFAULT 'draft' CHECK (visibility IN ('public', 'draft')),
  sort          integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (date_end IS NULL OR date_start IS NULL OR date_end >= date_start)
);

CREATE TABLE photos (
  id             text PRIMARY KEY,
  category       text NOT NULL CHECK (category IN ('general', 'race', 'space')),
  album_id       text REFERENCES albums(id) ON DELETE RESTRICT,
  title          text NOT NULL DEFAULT '',
  caption        text NOT NULL DEFAULT '',
  alt            text NOT NULL DEFAULT '',
  tags           text[] NOT NULL DEFAULT '{}',
  credit         text,
  source_url     text,
  taken_at       timestamptz,
  uploaded_at    timestamptz NOT NULL DEFAULT now(),
  width          integer NOT NULL CHECK (width > 0),
  height         integer NOT NULL CHECK (height > 0),
  color          text,
  -- Public, EXIF-free variants. A key starting with "/" is a static site asset (seed samples).
  key_lg         text NOT NULL,
  key_md         text NOT NULL,
  key_thumb      text NOT NULL,
  -- Untouched original in the private bucket. It may contain GPS EXIF; never served publicly.
  key_original   text,
  original_name  text,
  original_type  text,
  original_bytes integer,
  visibility     text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'draft')),
  sort           integer NOT NULL DEFAULT 0,
  CHECK ((category = 'space') = (album_id IS NULL))
);

ALTER TABLE albums ADD CONSTRAINT albums_cover_photo_fk
  FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL;

CREATE INDEX photos_album_order ON photos (album_id, sort, uploaded_at DESC);
CREATE INDEX photos_category_order ON photos (category, visibility, sort, uploaded_at DESC);
CREATE INDEX albums_category_order ON albums (category, visibility, sort);
