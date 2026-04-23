import os
import sqlite3

# On Vercel, the filesystem is read-only except for /tmp.
if os.environ.get("VERCEL"):
    DB_PATH = "/tmp/gym_coach.db"
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), "gym_coach.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT 'Athlete',
            age INTEGER,
            height REAL,
            weight REAL,
            goal TEXT CHECK(goal IN ('bulk', 'cut', 'fit')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT CHECK(role IN ('user', 'model')),
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def get_user_profile():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_profile ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def save_user_profile(name: str, age: int, height: float, weight: float, goal: str):
    conn = get_connection()
    cursor = conn.cursor()

    existing = get_user_profile()
    if existing:
        cursor.execute("""
            UPDATE user_profile
            SET name = ?, age = ?, height = ?, weight = ?, goal = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (name, age, height, weight, goal, existing["id"]))
    else:
        cursor.execute("""
            INSERT INTO user_profile (name, age, height, weight, goal)
            VALUES (?, ?, ?, ?, ?)
        """, (name, age, height, weight, goal))

    conn.commit()
    conn.close()


def update_user_weight(new_weight: float):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE user_profile
        SET weight = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM user_profile ORDER BY id DESC LIMIT 1)
    """, (new_weight,))
    conn.commit()
    conn.close()


def save_message(role: str, content: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_history (role, content) VALUES (?, ?)",
        (role, content),
    )
    conn.commit()
    conn.close()


def get_chat_history(limit: int = 30):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT role, content FROM chat_history ORDER BY id DESC LIMIT ?",
        (limit,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]


def clear_history():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_history")
    conn.commit()
    conn.close()

