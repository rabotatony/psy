# PSYWEAVE v7 — Psytrance Groovebox & Live Looper

מנוע פסיי-טראנס מלא בדפדפן: סינתזה עמוקה, סקוונסר, Song Mode, ארנג'ר אוטומטי, לופר חי, ייצוא WAV/STEMS מנורמל-לאודנס, ו-MIDI.

## הרצה

    python3 -m http.server 8000

פתח http://localhost:8000 — חובה דרך שרת, לא ישירות מקובץ.

## מנוע הסאונד v7

- Wavefolder Lead: סינתזת sin-folding לתוך tanh — הגרסה הפסיכדלית, סצנת FOLD ייעודית
- Acid 303 אמיתי: square, envelope עמוק לפילטר, accents על downbeats, glide
- Saw leads עם fold עדין נשלט ב-MORPH X
- Sidechain pump עמוק וחלק על בס/פאדים/לופים
- Ping-pong delay עם פידבק מוגבל תדרים (low+high cut)
- ריוורב עם early reflections + דיפוזיה
- לימיטר מאסטר + soft-clip
- Haas widener ללידים
- ייצוא WAV ו-STEMS עם peak normalization (0.97/0.95)

## מה יש בפנים

- Auto-Arranger + Song Mode: שרשרת סקציות ניתנת לעריכה עם risers ו-crashes אוטומטיים
- 7 סצנות: Full-On, Dark, Prog, Acid, Goa, Night, Fold — BPM אוטומטי לכל סצנה
- מלודיות Motif עם call & response + MUTATE + ARP דיאטוני
- לופר 4 ערוצים: מאסטר + מיקרופון, quantize לתיבה, פיצוי טמפו, מדי עוצמה
- STEMS: drums/bass/lead/pads/loops כקבצי WAV נפרדים
- SAVE/LOAD פרויקט כ-JSON
- MIDI + LEARN למיפוי CC
- UNDO, רנדומליזציה לכל ערוץ, מצב PERF להופעה
- שמירה אוטומטית + שגיאות גלויות

## קיצורי מקלדת

Space = Play/Stop · 1-7 = סצנות · R = הקלטה · M = מוטציה · D = דרופ · F = פיל · U = ביטול

## GitHub Pages

כל push מפורסם אוטומטית דרך .github/workflows/deploy.yml (GitHub Actions).
