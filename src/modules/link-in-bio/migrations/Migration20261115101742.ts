import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261115101742 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "lib_page" add column if not exists "profile_style" text not null default 'circle', add column if not exists "hero" text null, add column if not exists "hero_ratio" text not null default '16:9', add column if not exists "qr_logo" text null, add column if not exists "focus" jsonb null, add column if not exists "files" jsonb null;`);

    this.addSql(`alter table if exists "lib_page_translation" add column if not exists "avatar_alt" text null, add column if not exists "hero_alt" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "lib_page" drop column if exists "profile_style", drop column if exists "hero", drop column if exists "hero_ratio", drop column if exists "qr_logo", drop column if exists "focus", drop column if exists "files";`);

    this.addSql(`alter table if exists "lib_page_translation" drop column if exists "avatar_alt", drop column if exists "hero_alt";`);
  }

}
