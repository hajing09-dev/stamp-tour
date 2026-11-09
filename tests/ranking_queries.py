"""Execute the portable query bodies in SQLite, without touching Supabase.

PostgreSQL function DDL, grants and RLS still require an operating-environment check.
Only split_part/concat compatibility functions are supplied to the SQLite runner.
"""
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
migration = (ROOT / "migrations/20261016_01_rankings.sql").read_text()
schema = (ROOT / "schema.sql").read_text()
queries = {}
for name in ("get_club_leaderboard", "get_stamp_podium"):
    pattern = rf"CREATE OR REPLACE FUNCTION public\.{name}\(\)[\s\S]*?\$\$;"
    source = re.search(pattern, migration)
    installed = re.search(pattern, schema)
    assert source and installed, f"Missing function declaration: {name}"
    assert source.group() == installed.group(), f"Schema/migration mismatch: {name}"
    queries[name] = re.search(r"AS \$\$(.*?)\$\$;", source.group(), re.S).group(1)


def database():
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.create_function("split_part", 3, lambda value, delimiter, index: value.split(delimiter)[index - 1])
    db.create_function("concat", -1, lambda *values: "".join("" if value is None else str(value) for value in values))
    db.executescript("""
        ATTACH DATABASE ':memory:' AS public;
        CREATE TABLE public.clubs(club_id TEXT PRIMARY KEY, name TEXT, location TEXT);
        CREATE TABLE public.stamps(id INTEGER PRIMARY KEY, student_id TEXT, club_id TEXT, created_at TEXT);
        CREATE TABLE public.users(student_id TEXT PRIMARY KEY, name TEXT);
    """)
    return db


def rows(db, name):
    return [dict(row) for row in db.execute(queries[name])]


with database() as db:
    db.executemany("INSERT INTO public.clubs VALUES(?,?,?)", [
        ("a", "코딩 동아리", "컴퓨터실"), ("b", "밴드 동아리", "강당"),
        ("c", "사진 동아리", "로비"), ("d", "미방문 동아리", None),
    ])
    for club_id, student_id in [("a", "one"), ("a", "two"), ("a", "two"), ("b", "one"), ("b", "two"), ("c", "one")]:
        db.execute("INSERT INTO public.stamps(student_id,club_id) VALUES(?,?)", (student_id, club_id))
    result = rows(db, "get_club_leaderboard")
    assert [row["visitor_count"] for row in result] == [2, 2, 1, 0]
    assert [row["rank"] for row in result] == [1, 1, 2, None]
    assert {row["name"] for row in result} == {"코딩 동아리", "밴드 동아리", "사진 동아리", "미방문 동아리"}
    assert set(result[0]) == {"rank", "club_id", "name", "location", "visitor_count"}
    db.execute("DELETE FROM public.stamps")
    db.executemany("INSERT INTO public.stamps(student_id,club_id) VALUES(?,?)", [(str(i), "a") for i in range(1005)])
    assert rows(db, "get_club_leaderboard")[0]["visitor_count"] == 1005
    db.execute("DELETE FROM public.stamps")
    assert all(row["rank"] is None and row["visitor_count"] == 0 for row in rows(db, "get_club_leaderboard"))
    db.execute("DELETE FROM public.clubs")
    assert rows(db, "get_club_leaderboard") == []
print("PASS SQL club query: shared ranks, unique visitors, >1000 records, zero/empty data and aggregate-only columns")

with database() as db:
    def student(student_id, name, count, timestamp):
        email = student_id + "@festival.com"
        db.execute("INSERT INTO public.users VALUES(?,?)", (email, name))
        for i in range(count):
            db.execute("INSERT INTO public.stamps(student_id,club_id,created_at) VALUES(?,?,?)", (email, str(i), timestamp))

    for i in range(32):
        student(str(21000 + i), "홍길동", 3, "2026-10-15T01:00:00Z")
    student("22000", "이산", 2, "2026-10-15T01:00:00Z")
    student("23000", "루", 2, "2026-10-15T02:00:00Z")
    student("23001", "동순위", 2, "2026-10-15T02:00:00Z")
    student("24000", "목록밖", 1, "2026-10-15T01:00:00Z")
    result = rows(db, "get_stamp_podium")
    assert [row["rank"] for row in result] == [1, 2, 3]
    assert [row["member_count"] for row in result] == [32, 1, 2]
    assert [row["stamp_count"] for row in result] == [3, 2, 2]
    assert [row["masked_student_id"] for row in result] == ["210**", "220**", "230**"]
    assert [row["masked_name"] for row in result] == ["홍*동", "이*", "루"]
    assert set(result[0]) == {"rank", "masked_student_id", "masked_name", "stamp_count", "member_count"}
    db.execute("DELETE FROM public.stamps")
    assert rows(db, "get_stamp_podium") == []
print("PASS SQL podium query: complete tie counts, original time ordering, masked representatives and empty data")
print("PASS SQL source consistency: fresh schema and incremental migration contain identical functions")
