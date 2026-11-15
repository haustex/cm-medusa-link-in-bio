import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261115044520 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "lib_page_translation" drop constraint if exists "lib_page_translation_page_id_locale_unique";`);
    this.addSql(`alter table if exists "lib_item_translation" drop constraint if exists "lib_item_translation_item_id_locale_unique";`);
    this.addSql(`alter table if exists "lib_item" drop constraint if exists "lib_item_key_unique";`);
    this.addSql(`alter table if exists "lib_page" drop constraint if exists "lib_page_handle_unique";`);
    this.addSql(`alter table if exists "lib_click_day" drop constraint if exists "lib_click_day_item_id_day_unique";`);
    this.addSql(`create table if not exists "lib_click_day" ("id" text not null, "page_id" text not null, "item_id" text not null, "day" text not null, "count" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "lib_click_day_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_click_day_deleted_at" ON "lib_click_day" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lib_click_day_item_id_day_unique" ON "lib_click_day" ("item_id", "day") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_click_day_page_id_day" ON "lib_click_day" ("page_id", "day") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "lib_page" ("id" text not null, "handle" text not null, "name" text not null, "locales" jsonb not null, "published" boolean not null default false, "noindex" boolean not null default false, "avatar" text null, "socials" jsonb null, "theme" jsonb null, "utm" boolean not null default true, "utm_source" text null, "utm_medium" text null, "utm_campaign" text null, "og_image" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "lib_page_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_page_deleted_at" ON "lib_page" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lib_page_handle_unique" ON "lib_page" ("handle") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "lib_item" ("id" text not null, "key" text not null, "type" text check ("type" in ('link', 'product', 'collection', 'category', 'promo', 'post', 'whatsapp', 'contact', 'header', 'divider')) not null, "target" jsonb not null, "rank" integer not null default 0, "enabled" boolean not null default true, "starts_at" timestamptz null, "ends_at" timestamptz null, "image" text null, "icon" text null, "style" text null, "utm" boolean null, "metadata" jsonb null, "page_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "lib_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_item_page_id" ON "lib_item" ("page_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_item_deleted_at" ON "lib_item" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lib_item_key_unique" ON "lib_item" ("key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_item_page_id_rank" ON "lib_item" ("page_id", "rank") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "lib_item_translation" ("id" text not null, "locale" text not null, "label" text null, "note" text null, "item_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "lib_item_translation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_item_translation_item_id" ON "lib_item_translation" ("item_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_item_translation_deleted_at" ON "lib_item_translation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lib_item_translation_item_id_locale_unique" ON "lib_item_translation" ("item_id", "locale") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "lib_page_translation" ("id" text not null, "locale" text not null, "title" text not null, "bio" text null, "seo_title" text null, "seo_description" text null, "page_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "lib_page_translation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_page_translation_page_id" ON "lib_page_translation" ("page_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lib_page_translation_deleted_at" ON "lib_page_translation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lib_page_translation_page_id_locale_unique" ON "lib_page_translation" ("page_id", "locale") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "lib_item" add constraint "lib_item_page_id_foreign" foreign key ("page_id") references "lib_page" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table if exists "lib_item_translation" add constraint "lib_item_translation_item_id_foreign" foreign key ("item_id") references "lib_item" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table if exists "lib_page_translation" add constraint "lib_page_translation_page_id_foreign" foreign key ("page_id") references "lib_page" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "lib_item" drop constraint if exists "lib_item_page_id_foreign";`);

    this.addSql(`alter table if exists "lib_page_translation" drop constraint if exists "lib_page_translation_page_id_foreign";`);

    this.addSql(`alter table if exists "lib_item_translation" drop constraint if exists "lib_item_translation_item_id_foreign";`);

    this.addSql(`drop table if exists "lib_click_day" cascade;`);

    this.addSql(`drop table if exists "lib_page" cascade;`);

    this.addSql(`drop table if exists "lib_item" cascade;`);

    this.addSql(`drop table if exists "lib_item_translation" cascade;`);

    this.addSql(`drop table if exists "lib_page_translation" cascade;`);
  }

}
