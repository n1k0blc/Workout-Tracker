repo: n1k0blc/Workout-Tracker
branch: main
path: apps/frontend

## Last sync
date: 2026-09-07T21:35:00Z

### Updated in this project
- Neues Ernährungs-Modul (11 Screens) im bestehenden Design-System aufgebaut
- Vorlagen-Seite um Tabs „Lebensmittel“ und „Mahlzeiten“ erweitert
- Profil um Block „Tagesziele“, Dashboard um Karte „Ernährung heute“ ergänzt
- Analytics um Ernährungs-Chart mit Metrik-Umschalter ergänzt

## Screen map
| Screen (Ernährung.dc.html) | Repo-Dateien |
| --- | --- |
| 01 Tagesansicht | app/globals.css, app/layout.tsx, components/mobile-nav.tsx, components/ui/card.tsx, components/ui/button.tsx, components/ui/progress.tsx |
| 02 Abschnitte verwalten | components/ui/drawer.tsx, components/ui/input.tsx, components/ui/button.tsx |
| 03 Abschnitt · Einträge | components/ui/card.tsx, components/ui/sonner.tsx, hooks/useSwipe.ts |
| 04 Auswahl-Drawer | components/ui/drawer.tsx, components/ui/tabs.tsx, components/ui/badge.tsx, components/workout/exercise-selection-modal.tsx |
| 05 Schnelleintrag | components/ui/input.tsx, components/ui/field.tsx, components/ui/button.tsx |
| 06 / 06b Barcode-Scanner | components/ui/drawer.tsx, components/ui/alert.tsx, components/ui/button.tsx |
| 07 / 07b / 07c Lebensmittel | app/templates/page.tsx, components/templates/exercises-tab.tsx, components/exercises/exercise-editor-dialog.tsx |
| 08 / 08b Mahlzeiten | app/templates/page.tsx, components/templates/workout-templates-tab.tsx, components/templates/template-editor-screen.tsx |
| 09 Profil › Tagesziele | app/profile/page.tsx, components/ui/card.tsx, components/ui/field.tsx |
| 10 Dashboard-Karte | app/dashboard/page.tsx, components/CircularProgress.tsx |
| 11 Analytics · Ernährung | components/analytics/AnalyticsChart.tsx, components/analytics/chart-styles.ts, components/ui/toggle-group.tsx |

Icons: Tabler outline/filled SVG-Pfade, 1:1 aus tabler/tabler-icons übernommen (das Repo nutzt @tabler/icons-react).
