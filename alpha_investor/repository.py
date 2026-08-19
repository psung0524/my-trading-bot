from __future__ import annotations
import sqlite3
from contextlib import closing
from .config import settings

SCHEMA = '''
CREATE TABLE IF NOT EXISTS watchlist (code TEXT PRIMARY KEY, name TEXT NOT NULL, entry REAL, stop REAL, target3 REAL, thesis TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS alert_log (dedupe_key TEXT PRIMARY KEY, channel TEXT, event_type TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS trade_journal (id INTEGER PRIMARY KEY, code TEXT, strategy TEXT, entry REAL, exit REAL, quantity REAL, opened_at TEXT, closed_at TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS theme_mappings (code TEXT PRIMARY KEY, primary_theme TEXT NOT NULL, secondary_theme TEXT, rationale TEXT, reviewed_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS data_health (id INTEGER PRIMARY KEY, source TEXT, dataset TEXT, as_of TEXT, row_count INTEGER, status TEXT, detail TEXT, recorded_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS alert_outbox (id INTEGER PRIMARY KEY, dedupe_key TEXT UNIQUE, channel TEXT, event_type TEXT, symbol TEXT, title TEXT, body TEXT, severity TEXT, priority INTEGER, status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, next_attempt_at TEXT DEFAULT CURRENT_TIMESTAMP, last_error TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, delivered_at TEXT);
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
    def save_theme_mapping(self, code, primary_theme, secondary_theme='', rationale=''):
        with closing(sqlite3.connect(self.path)) as c:
            c.execute('INSERT OR REPLACE INTO theme_mappings(code,primary_theme,secondary_theme,rationale,reviewed_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)',(code,primary_theme,secondary_theme,rationale)); c.commit()
    def theme_mappings(self):
        with closing(sqlite3.connect(self.path)) as c: return c.execute('SELECT code,primary_theme,secondary_theme,rationale,reviewed_at FROM theme_mappings ORDER BY reviewed_at DESC').fetchall()
    def record_health(self, source, dataset, as_of, row_count, status, detail=''):
        with closing(sqlite3.connect(self.path)) as c:
            c.execute('INSERT INTO data_health(source,dataset,as_of,row_count,status,detail) VALUES(?,?,?,?,?,?)',(source,dataset,as_of,row_count,status,detail)); c.commit()
    def recent_health(self):
        with closing(sqlite3.connect(self.path)) as c: return c.execute('SELECT source,dataset,as_of,row_count,status,detail,recorded_at FROM data_health ORDER BY id DESC LIMIT 20').fetchall()
    def enqueue_alert(self, key, channel, event):
        try:
            with closing(sqlite3.connect(self.path)) as c:
                priority={'critical':1,'warning':2,'info':3}.get(event.severity,3)
                c.execute('INSERT INTO alert_outbox(dedupe_key,channel,event_type,symbol,title,body,severity,priority) VALUES(?,?,?,?,?,?,?,?)',(key,channel,event.event_type,event.symbol,event.title,event.body,event.severity,priority)); c.commit(); return True
        except sqlite3.IntegrityError: return False
    def pending_alerts(self, channel, limit=30):
        with closing(sqlite3.connect(self.path)) as c: return c.execute("SELECT id,event_type,symbol,title,body,severity,attempts FROM alert_outbox WHERE channel=? AND status IN ('pending','retry') AND next_attempt_at<=CURRENT_TIMESTAMP ORDER BY priority,id LIMIT ?",(channel,limit)).fetchall()
    def mark_alert_delivered(self, alert_id):
        with closing(sqlite3.connect(self.path)) as c: c.execute("UPDATE alert_outbox SET status='delivered',delivered_at=CURRENT_TIMESTAMP WHERE id=?",(alert_id,)); c.commit()
    def mark_alert_failed(self, alert_id, error):
        with closing(sqlite3.connect(self.path)) as c:
            c.execute("UPDATE alert_outbox SET attempts=attempts+1,status=CASE WHEN attempts+1>=3 THEN 'failed' ELSE 'retry' END,next_attempt_at=datetime('now','+' || CASE WHEN attempts=0 THEN 1 WHEN attempts=1 THEN 5 ELSE 15 END || ' minutes'),last_error=? WHERE id=?",(str(error)[:500],alert_id)); c.commit()
