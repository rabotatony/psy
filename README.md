# PSYWEAVE v6 — Psytrance Groovebox & Live Looper

מנוע פסיי-טראנס מלא בדפדפן: סינתזה, תופים, סקוונסר, Song Mode עורך, ארנג'ר אוטומטי, לופר חי, ייצוא WAV ו-STEMS, שמירת פרויקטים ו-MIDI.

## הרצה

    python3 -m http.server 8000

פתח http://localhost:8000 — חובה דרך שרת, לא ישירות מקובץ.

## מה יש בפנים

- Auto-Arranger + Song Mode: שרשרת סקציות ניתנת לעריכה (INTRO/BUILD/DROP/BREAK/RISER/CLIMAX) עם risers ו-crashes אוטומטיים
- Sidechain Pump אמיתי על בס/פאדים/לופים
- מנוע סאונד v6: לימיטר מאסטר, קיק עם mid-punch, drive לבס, ריוורב עם early reflections, Haas widener ללידים
- 6 סצנות: Full-On, Dark, Prog, Acid, Goa, Night — עם BPM אוטומטי
- מלודיות Motif עם call & response + MUTATE + ARP דיאטוני
- לופר 4 ערוצים: מאסטר + מיקרופון, quantize לתיבה, פיצוי טמפו, מדי עוצמה
- EXPORT WAV מיידי + STEMS (drums/bass/lead/pads/loops) לשימוש ב-DAW
- SAVE/LOAD פרויקט כ-JSON
- MIDI + LEARN למיפוי CC למקרואים
- UNDO לסקוונסר, כלי רנדומליזציה לכל ערוץ
- מצב PERF להופעת לייב
- פינג-פונג delay, ריוורב, drive, swing
- שמירה אוטומטית ב-localStorage + שגיאות גלויות

## קיצורי מקלדת

Space = Play/Stop · 1-6 = סצנות · R = הקלטה · M = מוטציה · D = דרופ · F = פיל · U = ביטול

## GitHub Pages

כל push מפורסם אוטומטית דרך .github/workflows/deploy.yml (מקור: GitHub Actions).
