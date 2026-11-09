-- Existing projects: run this migration once in the Supabase SQL Editor.
-- Returns club aggregates and masked student podium representatives only.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_club_leaderboard()
RETURNS TABLE (
    rank BIGINT,
    club_id TEXT,
    name TEXT,
    location TEXT,
    visitor_count BIGINT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    WITH counts AS (
        SELECT c.club_id, c.name, c.location,
               COUNT(DISTINCT s.student_id) AS visitor_count
        FROM public.clubs c
        LEFT JOIN public.stamps s ON s.club_id = c.club_id
        GROUP BY c.club_id, c.name, c.location
    )
    SELECT CASE WHEN c.visitor_count > 0 THEN
               DENSE_RANK() OVER (ORDER BY c.visitor_count DESC)
           ELSE NULL END AS rank,
           c.club_id, c.name, c.location, c.visitor_count
    FROM counts c
    ORDER BY c.visitor_count DESC, c.name ASC, c.club_id ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_stamp_podium()
RETURNS TABLE (
    rank BIGINT,
    masked_student_id TEXT,
    masked_name TEXT,
    stamp_count BIGINT,
    member_count BIGINT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    WITH ranked AS (
        SELECT s.student_id, COUNT(s.id) AS stamp_count,
               DENSE_RANK() OVER (
                   ORDER BY COUNT(s.id) DESC, MAX(s.created_at) ASC
               ) AS rank
        FROM public.stamps s
        GROUP BY s.student_id
    ), representatives AS (
        SELECT r.rank, MIN(r.student_id) AS student_id,
               MAX(r.stamp_count) AS stamp_count, COUNT(*) AS member_count
        FROM ranked r
        WHERE r.rank <= 3
        GROUP BY r.rank
    )
    SELECT r.rank,
           CASE WHEN LENGTH(SPLIT_PART(r.student_id, '@', 1)) >= 4 THEN
               CONCAT(SUBSTR(SPLIT_PART(r.student_id, '@', 1), 1, 3), '**')
           ELSE
               CONCAT(SUBSTR(SPLIT_PART(r.student_id, '@', 1), 1, 1), '**')
           END AS masked_student_id,
           CASE WHEN LENGTH(COALESCE(u.name, '')) >= 3 THEN
               CONCAT(SUBSTR(u.name, 1, 1), '*', SUBSTR(u.name, 3))
           WHEN LENGTH(COALESCE(u.name, '')) = 2 THEN
               CONCAT(SUBSTR(u.name, 1, 1), '*')
           ELSE COALESCE(u.name, '참가자') END AS masked_name,
           r.stamp_count, r.member_count
    FROM representatives r
    LEFT JOIN public.users u ON u.student_id = r.student_id
    ORDER BY r.rank ASC;
$$;

REVOKE ALL ON FUNCTION public.get_club_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_club_leaderboard() TO authenticated;
REVOKE ALL ON FUNCTION public.get_stamp_podium() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_stamp_podium() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
