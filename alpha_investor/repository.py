from __future__ import annotations
import sqlite3
from contextlib import closing
from .config import settings

SCHEMA = '''
CREATE TABLE IF NOT EXISTS watchlist (code TEXT PRIMARY KEY, name TEXT NOT NULL, entry REAL, stop REAL, target3 REAL, thesis TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS alert_log (dedupe_key TEXT PRIMARY KEY, channel TEXT, event_type TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS trade_journal (id INTEGER PRIMARY KEY, code TEXT, strategy TEXT, entry REAL, exit REAL, quantity REAL, opened_at TEXT, closed_at TEXT, notes TEXT);
'''
class Repository:
    def __init__(self, path=settings.database_path):
        path.parent.mkdir(parents=True, exist_ok=True); self.path = path
        with closing(sqlite3.connect(path)) as c: c.executescript(SCHEMA)
    def watchlist(self):
        with closing(sqlite3.connect(self.path)) as c: return c.execute('SELECT code,name,entry,stop,target3,thesis,created_at FROM watchlist ORDER BY created_at DESC').fetchall()
    def add_watch(self, code, name, entry, stop, target3, thesis=''):
        with closing(sqlite3.connect(self.path)) as c:
            c.execute('INSERT OR REPLACE INTO watchlist(code,name,entry,stop,target3,thesis) VALUES(?,?,?,?,?,?)',(code,name,entry,stop,target3,thesis)); c.commit()
    def reserve_alert(self, key, channel, event_type):
        try:
            with closing(sqlite3.connect(self.path)) as c: c.execute('INSERT INTO alert_log(dedupe_key,channel,event_type) VALUES(?,?,?)',(key,channel,event_type)); c.commit(); return True
        except sqlite3.IntegrityError: return False
