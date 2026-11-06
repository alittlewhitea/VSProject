-- Optional pre-provisioning for database users without CREATE permission.
create table if not exists studio_avatar_favorites (
  user_id varchar(191) not null,
  avatar_kind varchar(8) not null,
  avatar_id varchar(160) not null,
  item_json json not null,
  created_at timestamp not null default current_timestamp,
  primary key (user_id, avatar_kind, avatar_id)
) character set utf8mb4 collate utf8mb4_bin;
