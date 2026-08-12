-- Add provider-neutral payment fields without removing historical Stripe data.
-- Run once before deploying the PayPal-capable application. It is safe to rerun.

delimiter //

drop procedure if exists add_column_if_missing//
create procedure add_column_if_missing(
  in p_table varchar(64),
  in p_column varchar(64),
  in p_definition text
)
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = database()
      and table_name = p_table
      and column_name = p_column
  ) then
    set @ddl = concat('alter table `', p_table, '` add column `', p_column, '` ', p_definition);
    prepare ddl_statement from @ddl;
    execute ddl_statement;
    deallocate prepare ddl_statement;
  end if;
end//

drop procedure if exists add_index_if_missing//
create procedure add_index_if_missing(
  in p_table varchar(64),
  in p_index varchar(64),
  in p_definition text
)
begin
  if not exists (
    select 1
    from information_schema.statistics
    where table_schema = database()
      and table_name = p_table
      and index_name = p_index
  ) then
    set @ddl = concat('alter table `', p_table, '` add ', p_definition);
    prepare ddl_statement from @ddl;
    execute ddl_statement;
    deallocate prepare ddl_statement;
  end if;
end//

call add_column_if_missing('credit_purchases', 'payment_provider', 'varchar(32) not null default ''stripe'' after `user_id`')//
call add_column_if_missing('credit_purchases', 'provider_order_id', 'varchar(255) null after `payment_provider`')//
call add_column_if_missing('credit_purchases', 'provider_transaction_id', 'varchar(255) null after `provider_order_id`')//
call add_column_if_missing('credit_purchases', 'provider_capture_id', 'varchar(255) null after `provider_transaction_id`')//

alter table credit_purchases modify stripe_checkout_id varchar(255) null//
alter table credit_purchases modify status varchar(64) not null default 'pending'//

update credit_purchases
set payment_provider = 'stripe',
    provider_order_id = coalesce(provider_order_id, stripe_checkout_id),
    provider_transaction_id = coalesce(provider_transaction_id, stripe_checkout_id)
where stripe_checkout_id is not null//

call add_index_if_missing(
  'credit_purchases',
  'credit_purchases_provider_transaction_unique',
  'unique key `credit_purchases_provider_transaction_unique` (`payment_provider`, `provider_transaction_id`)'
)//
call add_index_if_missing(
  'credit_purchases',
  'credit_purchases_provider_order_idx',
  'key `credit_purchases_provider_order_idx` (`payment_provider`, `provider_order_id`)'
)//
call add_index_if_missing(
  'credit_purchases',
  'credit_purchases_provider_capture_idx',
  'key `credit_purchases_provider_capture_idx` (`payment_provider`, `provider_capture_id`)'
)//

call add_column_if_missing('user_subscriptions', 'payment_provider', 'varchar(32) not null default ''stripe'' after `user_id`')//
call add_column_if_missing('user_subscriptions', 'provider_customer_id', 'varchar(255) null after `payment_provider`')//
call add_column_if_missing('user_subscriptions', 'provider_subscription_id', 'varchar(255) null after `provider_customer_id`')//

alter table user_subscriptions modify stripe_subscription_id varchar(255) null//

update user_subscriptions
set payment_provider = 'stripe',
    provider_customer_id = coalesce(provider_customer_id, stripe_customer_id),
    provider_subscription_id = coalesce(provider_subscription_id, stripe_subscription_id)
where stripe_subscription_id is not null//

call add_index_if_missing(
  'user_subscriptions',
  'user_subscriptions_provider_subscription_unique',
  'unique key `user_subscriptions_provider_subscription_unique` (`payment_provider`, `provider_subscription_id`)'
)//

create table if not exists payment_webhook_events (
  payment_provider varchar(32) not null,
  event_id varchar(255) not null,
  event_type varchar(128) not null,
  processed_at datetime(6) not null,
  primary key (payment_provider, event_id),
  key payment_webhook_events_processed_idx (processed_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci//

create table if not exists payment_incidents (
  id bigint primary key auto_increment,
  payment_provider varchar(32) not null,
  event_id varchar(255) not null,
  event_type varchar(128) not null,
  user_id char(36) null,
  purchase_id bigint null,
  provider_transaction_id varchar(255) null,
  amount_cents int null,
  currency varchar(16) null,
  status varchar(32) not null default 'review_required',
  reason varchar(500) not null,
  resolved_at datetime(6) null,
  resolved_by varchar(255) null,
  resolution_note varchar(500) null,
  created_at datetime(6) not null,
  updated_at datetime(6) not null,
  unique key payment_incidents_provider_event_unique (payment_provider, event_id),
  key payment_incidents_status_created_idx (status, created_at),
  key payment_incidents_user_created_idx (user_id, created_at),
  constraint payment_incidents_user_id_fk foreign key (user_id) references users(id) on delete set null,
  constraint payment_incidents_purchase_id_fk foreign key (purchase_id) references credit_purchases(id) on delete set null
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci//

drop procedure if exists add_column_if_missing//
drop procedure if exists add_index_if_missing//

delimiter ;
