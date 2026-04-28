-- Store one horoscope per zodiac sign and actual local date.
-- Older cache keys included the UI period (daily/tomorrow), which could create
-- duplicate rows for the same sign/date. The app now keys rows as sign_<sign>_<date>.

delete from public.horoscope_cache
where id like 'sign_daily_%'
   or id like 'sign_tomorrow_%';

create unique index if not exists horoscope_cache_sign_date_unique_idx
  on public.horoscope_cache (sign, date);
