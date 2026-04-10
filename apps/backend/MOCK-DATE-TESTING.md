# 🕒 Mock Date Testing Guide

## Zweck

Ermöglicht das Erstellen von Workouts mit simulierten Datumsangaben für Analytics-Testing.

## ⚠️ Sicherheit

**WICHTIG:** Mock Date funktioniert **NUR** in Development!

### Schutzmaßnahmen:

1. **Code-Check:** `NODE_ENV === 'development'` im Code
2. **Git:** `.env.local` ist gitignored (wird nie committed)
3. **Produktion:** `.env.production` hat kein `MOCK_DATE`
4. **Warnung:** Console zeigt Warnung wenn Mock aktiv

## 🚀 Setup

### 1. .env.local erstellen

```bash
cd apps/backend
cp .env.local.example .env.local
```

### 2. .env.local bearbeiten

```bash
# Uncomment und Datum setzen:
NODE_ENV=development
MOCK_DATE=2026-04-01
```

### 3. Backend starten

```bash
npm run start:dev
```

**Console Output:**
```
⚠️  MOCK_DATE ACTIVE: Using 2026-04-01 instead of real date (NODE_ENV=development)
```

## 📋 Testing Workflow

### Szenario: Analytics mit mehreren Tagen testen

**Tag 1 - Montag 01.04.2026:**
```bash
# In .env.local:
MOCK_DATE=2026-04-01

# Backend neu starten
npm run start:dev

# Im Browser:
# - Workout starten
# - Übungen hinzufügen
# - Workout abschließen
# ✅ Workout hat Datum 01.04.2026
```

**Tag 2 - Mittwoch 03.04.2026:**
```bash
# In .env.local ändern:
MOCK_DATE=2026-04-03

# Backend neu starten (WICHTIG!)
npm run start:dev

# Workout erstellen & abschließen
# ✅ Workout hat Datum 03.04.2026
```

**Tag 3-5 wiederholen...**
```bash
MOCK_DATE=2026-04-05  # Freitag
MOCK_DATE=2026-04-08  # Montag (neue Woche)
MOCK_DATE=2026-04-10  # Mittwoch (heute)
```

**Analytics prüfen:**
- 5 Workouts über 10 Tage verteilt
- Volumen-Graph zeigt Entwicklung
- %ORM Graph zeigt Progress
- Filter und Zeiträume testen

## 🧹 Mock deaktivieren

### Option 1: Kommentieren
```bash
# In .env.local:
# MOCK_DATE=2026-04-05
```

### Option 2: Löschen
```bash
# Zeile komplett entfernen
```

### Option 3: .env.local löschen
```bash
rm .env.local
# Backend verwendet dann .env (kein MOCK_DATE)
```

**Backend neu starten** → Normale Datumsverwendung

## 🔍 Verifizierung

### Check 1: Console Warning

Wenn Mock aktiv:
```
⚠️  MOCK_DATE ACTIVE: Using 2026-04-05 instead of real date (NODE_ENV=development)
```

Wenn Mock inaktiv:
```
(keine Warnung)
```

### Check 2: Database

```sql
SELECT id, date, status 
FROM "Workout" 
ORDER BY date DESC 
LIMIT 5;
```

Sollte gemockte Daten zeigen.

### Check 3: Production Check

```bash
# In .env.production:
NODE_ENV=production
# MOCK_DATE existiert nicht!

# Test auf Pi:
docker logs workout-tracker-backend-prod --tail 50
# Sollte KEINE Mock-Warnung enthalten
```

## ❌ Häufige Fehler

### Mock funktioniert nicht

**Problem:** Datum ist immer heute

**Lösung:**
1. ✅ `NODE_ENV=development` in .env.local?
2. ✅ Backend neu gestartet?
3. ✅ Console Warnung erscheint?
4. ✅ Format korrekt? (YYYY-MM-DD)

### Ungültiges Format

**Fehler in Console:**
```
❌ Invalid MOCK_DATE format: "01-04-2026". 
Use YYYY-MM-DD format. Falling back to real date.
```

**Fix:**
```bash
# Falsch:
MOCK_DATE=01-04-2026  # ❌
MOCK_DATE=2026/04/01  # ❌

# Richtig:
MOCK_DATE=2026-04-01  # ✅
```

## 🎯 Use Cases

### 1. Analytics Testing
Erstelle Workouts für verschiedene Tage → Teste Graphen

### 2. Cycle Progress
Simuliere kompletten Zyklus in Minuten:
- Tag 1-2-3: Benchmark Phase
- Tag 4-8: Progress Phase  
- Tag 9-12: Peak Phase

### 3. Time Filters
Teste 7/30/90 Tage Filter mit echten Daten

### 4. %ORM Development
Verfolge %ORM über mehrere Wochen ohne zu warten

## 🛡️ Production Safety

### Was NICHT passieren kann:

❌ Mock Date in Production aktiviert  
→ Code prüft `NODE_ENV === 'development'`

❌ .env.local auf Pi  
→ Ist gitignored, wird nie deployed

❌ Versehentlich committed  
→ `.gitignore` blockiert `.env.local`

### Beweis:

```bash
# Auf Pi:
cat ~/apps/Workout-Tracker/apps/backend/.env.local
# cat: .env.local: No such file or directory ✅

# Git Status:
git status
# .env.local nicht sichtbar ✅
```

## 📚 Code Referenz

**Utility:** `apps/backend/src/common/utils/date.util.ts`  
**Usage:** `apps/backend/src/workouts/workouts.service.ts` (Zeile 233)

**Funktionen:**
- `getCurrentDate()` - Mockt Date wenn Dev-Mode
- `getCurrentISOString()` - ISO String mit Mock
- `isMockDateActive()` - Check ob Mock läuft

