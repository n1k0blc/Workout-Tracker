# FoodsSeed.csv – Review-Notizen (Issue #145)

Begleitdatei zum Seed-CSV der generischen Lebensmittel für die Ernährungsfunktion. Nur Datei-Deliverable, kein Code; der Import erfolgt separat nach Review.

## Umfang

- **289 Zeilen** (Ziel 200–300, angestrebt ~250; bewusst etwas höher, weil viele Grundnahrungsmittel in zwei Zuständen sinnvoll sind).
- Quellenverteilung: **202 Zeilen USDA FoodData Central (SR Legacy)**, **87 Zeilen Schweizer Nährwertdatenbank**.
- Keine doppelten `key`, keine doppelten `name` (per Skript geprüft). Alle Felder ohne `;`, Zeilenumbrüche und Anführungszeichen.
- Datei: UTF-8 **ohne BOM**, LF-Zeilenenden, `;`-getrennt, Dezimalpunkt. Die bestehenden `Exercises.csv`/`Workout-Templates.csv` haben BOM + CRLF; das wurde hier absichtlich nicht übernommen, weil ein BOM den ersten Header `key` verunreinigen würde. Wenn der Importer BOM/CRLF erwartet, bitte sagen.

## Zeilen pro Kategorie

| Kategorie | Zeilen | Richtwert aus dem Issue |
|---|---:|---:|
| Obst | 28 | 30 |
| Gemüse | 39 | 40 |
| Getreide & Beilagen | 28 | 25 |
| Brot & Backwaren | 15 | 15 |
| Milchprodukte | 31 | 30 |
| Pflanzendrinks | 6 | 6 |
| Eier | 4 | 4 |
| Fleisch & Wurst | 27 | 25 |
| Fisch | 19 | 15 |
| Hülsenfrüchte | 16 | 15 |
| Nüsse & Samen | 16 | 18 |
| Fette & Öle | 7 | 6 |
| Süßes & Snacks | 14 | 12 |
| Getränke | 18 | 15 |
| Grundzutaten | 21 | 20 |
| **Summe** | **289** | ~250 |

## Verwendete Referenztabellen

- **USDA FoodData Central, SR Legacy** (Datensatz `FoodData_Central_sr_legacy_food_csv_2018-04`, veröffentlicht 2019-04-01). Quelle-Spalte: `USDA FDC <fdcId>`; die ID ist direkt unter `https://fdc.nal.usda.gov/food-details/<fdcId>/nutrients` nachschlagbar.
- **Schweizer Nährwertdatenbank V 7.1 (01.07.2026)**, Bundesamt für Lebensmittelsicherheit und Veterinärwesen, Blatt „Generische Lebensmittel“ (Download von naehrwertdaten.ch, Nutzung mit Quellenangabe erlaubt). Quelle-Spalte: `Swiss FCDB <ID>`. Verwendet für typisch deutschsprachige Produkte, die USDA nicht generisch führt (Quark, Brotsorten, Wurstsorten, Spätzle, Pflanzendrinks, Mehl-Typen usw.).
- **Nicht verwendet:** Bundeslebensmittelschlüssel (BLS) und Souci-Fachmann-Kraut sind lizenzpflichtig und in dieser Session nicht zugänglich. Die Beispielzeilen aus dem Issue (z. B. Apfel 54 kcal, Hähnchenbrust 106 kcal) stammen offenbar aus BLS; die hier gelieferten Werte weichen deshalb leicht davon ab (Apfel 52 kcal, Hähnchenbrust 120 kcal nach USDA FDC 171077 – der im Issue zitierte FDC-Eintrag 171077 hat tatsächlich 120 kcal / 22,5 g Protein / 2,6 g Fett).
- Kein Wert wurde geschätzt oder aus dem Gedächtnis eingetragen. Jede Zeile lässt sich über die ID in der Quelle nachprüfen (vollständige Zuordnung im Anhang).

## Wichtigste Konvention: Kohlenhydrate ohne Ballaststoffe

USDA gibt „Carbohydrate, by difference“ an, also **inklusive** Ballaststoffe. Deutsche/EU-Nährwertangaben (und die Schweizer Tabelle, „Kohlenhydrate, verfügbar“) zählen Ballaststoffe **nicht** zu den Kohlenhydraten. Damit alle Zeilen dieselbe Bedeutung haben, wurde bei USDA-Zeilen `carbs = Carbohydrate by difference − Ballaststoffe` gerechnet (nie unter 0). Die `kcal` sind unverändert der Quellwert. Folge: bei ballaststoffreichen Lebensmitteln liegt `4·carbs + 4·protein + 9·fat` systematisch unter `kcal` (siehe Abweichungsliste). Bei zwei USDA-Einträgen fehlt der Ballaststoffwert; dort wurde 0 angenommen:

- garnelen-roh (FDC 175179: Crustaceans, shrimp, raw)
- balsamico (FDC 172241: Vinegar, balsamic)

## Zeilen mit Abweichung > ±15 % zwischen Makro-Summe und kcal

Prüfformel `4·carbs + 4·protein + 9·fat` gegen `kcal`. Alle anderen Zeilen liegen innerhalb von ±15 %.

| key | kcal | Makro-Summe | Abw. | Grund |
|---|---:|---:|---:|---|
| `himbeeren` | 52 | 33 | -37 % | high-fibre berry (6.5 g fibre/100 g); USDA kcal includes partial fibre energy, carbs here are fibre-free |
| `brombeeren` | 43 | 27 | -37 % | high-fibre berry (5.3 g fibre/100 g) |
| `johannisbeeren-rot` | 56 | 45 | -19 % | high-fibre berry (4.3 g fibre/100 g) |
| `stachelbeeren` | 44 | 33 | -26 % | high-fibre berry (4.3 g fibre/100 g) |
| `karotte-roh` | 41 | 33 | -20 % | high-fibre vegetable (2.8 g fibre/100 g) |
| `karotte-gekocht` | 35 | 26 | -26 % | high-fibre vegetable (3.0 g fibre/100 g) |
| `brokkoli-gekocht` | 35 | 29 | -18 % | high-fibre vegetable (3.3 g fibre/100 g) |
| `aubergine-roh` | 25 | 17 | -30 % | high-fibre vegetable (3.0 g fibre/100 g) |
| `eisbergsalat` | 14 | 12 | -16 % | very low kcal; rounding of 14 kcal amplifies the percentage |
| `weisskohl-roh` | 25 | 19 | -23 % | high-fibre vegetable (2.5 g fibre/100 g) |
| `wirsing-roh` | 27 | 21 | -23 % | high-fibre vegetable (3.1 g fibre/100 g) |
| `gruenkohl-roh` | 35 | 26 | -25 % | high-fibre vegetable (4.1 g fibre/100 g); fibre-free carbs come out at 0.3 g, see judgement calls |
| `kohlrabi-roh` | 27 | 18 | -33 % | high-fibre vegetable (3.6 g fibre/100 g) |
| `rote-bete-roh` | 43 | 35 | -18 % | high-fibre vegetable (2.8 g fibre/100 g) |
| `radieschen` | 16 | 11 | -32 % | high-fibre, very low kcal (1.6 g fibre, 16 kcal) |
| `spargel-gruen-roh` | 20 | 17 | -16 % | high-fibre, very low kcal (2.1 g fibre, 20 kcal) |
| `gruene-bohnen-roh` | 31 | 26 | -15 % | high-fibre vegetable (2.7 g fibre/100 g) |
| `erbsen-tk` | 77 | 61 | -21 % | high-fibre vegetable (4.5 g fibre/100 g) |
| `sauerkraut` | 19 | 10 | -47 % | high-fibre, very low kcal (2.9 g fibre, 19 kcal) |
| `linsen-braun-gekocht` | 116 | 88 | -24 % | high-fibre legume (7.9 g fibre/100 g) |
| `kichererbsen-gekocht` | 164 | 138 | -16 % | high-fibre legume (7.6 g fibre/100 g) |
| `kichererbsen-dose-abgetropft` | 139 | 118 | -15 % | high-fibre legume (6.4 g fibre/100 g) |
| `kidneybohnen-roh` | 337 | 284 | -16 % | high-fibre legume (15.2 g fibre/100 g) |
| `kidneybohnen-gekocht` | 127 | 101 | -21 % | high-fibre legume (7.4 g fibre/100 g) |
| `weisse-bohnen-roh` | 333 | 282 | -15 % | high-fibre legume (15.2 g fibre/100 g) |
| `weisse-bohnen-gekocht` | 139 | 118 | -15 % | high-fibre legume (6.3 g fibre/100 g) |
| `chiasamen` | 486 | 373 | -23 % | 34 g fibre/100 g; USDA kcal includes partial fibre energy |
| `cola-zuckerfrei` | 1 | 1 | -20 % | 1 kcal row; rounding artefact |
| `kaffee-schwarz` | 1 | 0 | -60 % | 1 kcal row; rounding artefact |
| `tee-schwarz-ungesuesst` | 1 | 1 | +20 % | 1 kcal row; rounding artefact |
| `bier-hell` | 42 | 14 | -66 % | alcohol (4.0 g/100 ml at 7 kcal/g) |
| `radler` | 38 | 29 | -23 % | alcohol (1.3 g/100 ml) |
| `weisswein` | 72 | 1 | -98 % | alcohol (10.1 g/100 ml) |
| `rotwein` | 70 | 2 | -97 % | alcohol (9.7 g/100 ml) |
| `sekt` | 71 | 7 | -90 % | alcohol (9.1 g/100 ml) |
| `wodka` | 231 | 0 | -100 % | alcohol (33.4 g/100 ml); all energy from ethanol |
| `tomaten-gehackt-dose` | 16 | 12 | -23 % | high-fibre relative to kcal (1.9 g fibre, 16 kcal) |
| `weinessig` | 19 | 1 | -94 % | energy from acetic acid, which is not a tracked macro |
| `balsamico` | 88 | 70 | -20 % | energy partly from acetic acid; USDA gives no fibre value for this entry |
| `kakaopulver-ungesuesst` | 228 | 285 | +25 % | 37 g fibre/100 g; USDA energy uses cocoa-specific conversion factors, so the generic Atwater sum overshoots |

## Judgement Calls

**Zustand / Zubereitung**
- „gekocht“ = in Wasser gekocht bzw. gedämpft, ohne Fett und Salz (USDA „boiled, drained, without salt“; Swiss „ohne Zugabe von Fett und Salz“).
- „gebraten“ bei Fleisch/Fisch = USDA „cooked, grilled/dry heat/pan-broiled“ bzw. Swiss „gebraten (ohne Zusatz von Fett und Salz)“, also **ohne Bratfett**. Bratfett muss separat gelogged werden.
- Roh **und** gegart geliefert für: Reis (weiß, Natur), Nudeln (hell, Vollkorn), Couscous, Bulgur, Quinoa, Hirse, Kartoffel (roh / mit Schale / ohne Schale gekocht), Süßkartoffel, Karotte, Brokkoli, Spinat, Hähnchenbrust, Rindersteak, Rinderhackfleisch, Schweinefilet, Lachs, Kabeljau, Forelle (roh + geräuchert), Linsen, Kichererbsen (roh / gekocht / Dose), Kidneybohnen (roh / gekocht / Dose), weiße Bohnen, Ei (roh / gekocht).
- Bratwurst gibt es nur als „gebraten“ (USDA führt kein rohes Pendant; Swiss nur Kalbsbratwurst).
- Fischstäbchen sind „zubereitet“ (USDA „frozen, prepared“).

**Namens-/Produkt-Zuordnungen, die man wissen sollte**
- `haehnchenschenkel-*`: Swiss „Poulet, Schenkel, mit Haut“ (ganzer Schenkel, nicht nur Oberschenkel).
- `rindersteak-entrecote-*`: Swiss „Rind, Entrecôte“. `rinderhackfleisch-roh`: USDA 85 % mager / 15 % Fett (deutsches Rinderhack darf max. 20 % Fett haben; 15 % ist ein typischer Wert). `rinderhackfleisch-gebraten`: dasselbe Hack als Patty pan-broiled.
- `schweinehackfleisch-roh`: USDA „Pork, fresh, ground“ (21 % Fett). `schweineschnitzel-roh`: USDA Schweinekeule/Oberschale, nur Magerfleisch. `fruehstuecksspeck-roh`: USDA „bacon, unprepared“.
- `leberwurst`: USDA „Liver sausage, liverwurst, pork“ (326 kcal), nicht die deutlich magerere Swiss Leberwurst (253 kcal). `fleischwurst-lyoner`: Swiss „Lyoner“. `leberkaese`: Swiss „Fleischkäse“. `kochschinken`: Swiss „Hinterschinken“. `wiener-wuerstchen`: Swiss „Wienerli“.
- `seelachs-roh`: USDA „Pollock, Atlantic“ (= Köhler, der deutsche „Seelachs“). `zander-roh`: USDA „Pike, walleye“ (Sander vitreus, nächster Verwandter des europäischen Zanders Sander lucioperca). `scholle-roh`: Swiss „Scholle“.
- `thunfisch-dose-*`: USDA „light tuna, drained“. `raeucherlachs`: Swiss.
- `joghurt-griechisch-0` / `-5`: USDA Greek yogurt nonfat bzw. whole milk (≈5 % Fett). Der in Deutschland verbreitete 10-%-Typ ist in keiner der Tabellen generisch vorhanden.
- `speisequark-20`: Swiss „Quark, nature, halbfett“ (5 g Fett/100 g, entspricht 20 % Fett i. Tr.). `sahnequark`: Swiss „Quark, nature, Rahm“ (15,6 g Fett; fetter als deutscher 40-%-Quark mit ≈11 g). `magerquark`: Swiss „Quark, nature, mager“.
- `saure-sahne`: USDA „sour cream, reduced fat“ (12 % Fett; deutsche saure Sahne hat 10 %). `schmand`: USDA „sour cream, cultured“ (19 % Fett; Schmand hat 20–29 %). `creme-fraiche`: Swiss „Sauerrahm“ (35 % Fett; Crème fraîche hat ≥30 %). `schlagsahne`: USDA „light whipping cream“ (31 % Fett, passt zu deutscher Schlagsahne mit 30 %).
- `frischkaese-doppelrahm`: USDA „Cheese, cream“ (34 % Fett). `emmentaler`: Swiss „Emmentaler, vollfett“. `cheddar`, `gouda`, `edamer`, `camembert`, `feta`, `mozzarella`, `parmesan`, `ricotta`, `ziegenfrischkaese`, `blauschimmelkaese`: USDA.
- `fettarme-milch-1-5`: Swiss „Halbentrahmte Milch 1.5 % Fett, UHT“. `vollmilch-3-5`: Swiss „Vollmilch, standardisiert, 3.5 % Fett, UHT“. `magermilch`: Swiss UHT.
- `haferdrink-ungesuesst` usw.: Swiss „…getränk, nature“ (nicht angereicherte Variante; die angereicherte hat identische Makros). `sojajoghurt-natur` steht unter Pflanzendrinks, weil es keine passendere Kategorie gibt.
- `weizenbroetchen`: Swiss „Semmeli“. `laugenbroetchen`: Swiss „Laugenbrötli“. `mischbrot`: Swiss „Bauernbrot“ (Weizen-Roggen-Mischbrot). `baguette`: Swiss „Pariserbrot“. `toastbrot`: Swiss „Toastbrot mit Pflanzenölen“. `pumpernickel`: USDA. `pita-fladenbrot`: USDA Pita weiß. `weizentortilla-wrap`: USDA Flour tortilla.
- `muesli-ungesuesst`: Swiss „Müeslimischung, Getreideflocken mit Früchten und Nüssen, ungesüsst“ (ein Handelsprodukt-Durchschnitt, keine Rezeptur). `cornflakes`: Swiss, ungezuckert.
- `polenta-maisgriess-roh`: Swiss „Maisgriess, trocken“. `spaetzle-gekocht`: Swiss, hausgemacht, abgetropft. `pommes-frites-ofen`: Swiss, im Ofen gebacken, ungesalzen. `reiswaffel`: Swiss Vollkornreiswaffel.
- `cashewkerne`: Swiss (USDA-Rohwert hat keinen Ballaststoffwert). `erdnuesse-*` und `pistazien-*`: USDA geröstet + gesalzen, weil das die Supermarkt-Standardform ist. Alle übrigen Nüsse/Samen: USDA roh/getrocknet.
- `fruchtgummi`: Swiss „Gummibonbon mit Fruchtessenz“ (Gelatine-Typ, 6,6 g Protein) – passt zu deutschen Gummibärchen besser als USDA „gumdrops“ (Stärke-Typ). `butterkekse`: Swiss „Petit Beurre“. `konfituere`: Swiss. `salzstangen`: USDA „pretzels, hard“. `kartoffelchips`: USDA plain salted.
- `zartbitterschokolade-70`: USDA 70–85 % Kakao. `vollmilchschokolade`: USDA. `nuss-nougat-creme`: USDA „Chocolate-flavored hazelnut spread“.
- `bier-hell`: Swiss Lager (4,0 g Alkohol/100 ml). `radler`: Swiss Panaché. `wodka`: USDA „distilled, 80 proof“ (gilt für alle 40-%-Spirituosen). `weisswein` 12,5 vol%, `rotwein` 12 vol%, `sekt`: Swiss Schaumwein.
- `saftschorle`: Swiss „Fruchtsaft-Schorle, 60 % Saft“ (Durchschnitt; kein reiner Apfelschorle-Eintrag verfügbar). `cola`: USDA „cola, regular“. `cola-zuckerfrei`: USDA aspartame cola. `energydrink`: Swiss, gezuckert.
- `weizenmehl-405`: Swiss Typ 400 (Schweizer Weißmehl, Ascheklasse entspricht Type 405). `weizenvollkornmehl`: Swiss Typ 1700. `dinkelmehl-630`: Swiss „Dinkelmehl, weiss, Typ 550“ (nächstliegende Type).
- `senf`: Swiss (mittelscharfer Typ; USDA „yellow mustard“ ist amerikanischer Hotdog-Senf). `mayonnaise`: Swiss (75 % Fett). `ketchup`: USDA. `sojasauce`: USDA Shoyu. `kokosmilch`: Swiss (Dosenware, 21 g Fett). `gemuesebruehe-zubereitet`: Swiss, trinkfertig (Instant-Brühe angerührt).
- `whey-proteinpulver`: USDA „Protein powder whey based“ (generisch, 78 g Protein/100 g). Steht in „Grundzutaten“ als Notlösung; falls unerwünscht einfach streichen.
- `tomaten-gehackt-dose`: USDA „canned, packed in tomato juice“ (inkl. Saft). `tomaten-passiert`: USDA „tomato puree“. `tomatenmark`: USDA „tomato paste“.
- `gruenkohl-roh`: Durch die Ballaststoff-Subtraktion bleiben nur 0,3 g verfügbare Kohlenhydrate (USDA: 4,4 g by difference, 4,1 g Ballaststoffe). BLS nennt für Grünkohl ≈2,5 g. Der Wert ist formal korrekt abgeleitet, wirkt aber niedrig; ggf. beim Review anpassen.

**Flüssigkeiten (isLiquid=true)**
- Beide Quellen geben Werte **pro 100 g** an. Für Flüssigkeiten wurden sie unverändert als „pro 100 ml“ übernommen (Dichte ≈ 1 angenommen). Die Referenz-Dichten liegen bei 0,99–1,05 (Milch 1,03, Säfte 1,05, Cola 1,04, Bier 1,01, Wein 0,99), der Fehler ist also ≤ 5 %. Größere Abweichungen: `kondensmilch-ungezuckert` (Dichte 1,07), `wodka` (0,94) und `sojasauce` (≈1,16, keine Referenzdichte in USDA). Wer es genauer will, multipliziert dort mit der Dichte.
- Als Flüssigkeit markiert: Milch, Buttermilch, Kondensmilch, Schlagsahne, alle Pflanzendrinks (außer Sojajoghurt), alle Getränke, Sojasauce, Essig, Kokosmilch, Gemüsebrühe. Öle sind **nicht** als Flüssigkeit markiert (Esslöffel-Portionen in Gramm wie im Issue-Beispiel).

**Portionsgrößen**
- Portionsgewichte sind Review-Vorschläge nach üblichen deutschen Haushaltsmaßen, nicht aus den Tabellen: Ei Gr. M = 58 g (EU-Klasse M 53–63 g; USDA „large“ wären 50 g), Brotscheibe 45 g (Toast 25 g), Brötchen 55 g, Käsescheibe 30 g, Wurstscheibe 20–25 g, EL Öl 10 g, EL Zucker 12 g, Glas 200/250 ml, Bier 300/500 ml, Wein 150 ml, Sekt 100 ml, Shot 20 ml, Handvoll Nüsse 30 g, Tafel Schokolade 100 g / Riegel 17 g, Kugel Eis 50 g.
- Obst-Stückgewichte orientieren sich an den USDA-Portionsangaben (z. B. Kiwi 69 g → 70 g, Pflaume 66 g → 65 g, Aprikose 35 g).
- Rohe Grundzutaten (Fleisch, Fisch, Reis, Gemüse ohne natürliche Stückzahl) haben bewusst keine Portion.

**Bewusst weggelassen (kein verlässlicher generischer Wert in den zugänglichen Tabellen)**
- Skyr, Kefir (USDA nur als Markenprodukt LIFEWAY), Harzer Käse, Butterkäse, Bergkäse, Halloumi, griechischer Joghurt 10 %, Kasseler, Nürnberger/rohe Bratwurst, Mettwurst/Teewurst, Matjes (USDA „pickled herring“ ist Bismarckhering, im Trim gestrichen), Pangasius, Dorade, Basmati (nur „white long-grain“ generisch), Apfelschorle als solche, Hummus und Pesto (Rezept-/Fertigprodukte, laut Issue nicht gewünscht), Milchreis/Grießbrei (zubereitete Speisen).
- Aus Umfangsgründen (Kandidaten mit Quelle vorhanden, auf Wunsch nachlieferbar): Clementine, Cantaloupe, Rhabarber, Feige, Granatapfel, gelbe Paprika, braune Champignons, Mangold, Chinakohl, Pak Choi, Butternut, Chili, Petersilie, Schnittlauch, Stangensellerie, Fenchel, Parboiled-Reis, Eiernudeln, Gnocchi, Dinkel-Körner, Graupen, Hartweizengrieß, Knuspermüsli, Ofenkartoffel, Buchweizen, Mehrkornbrot, Zwieback, Paniermehl, Sahnejoghurt, Tilsiter, Gruyère, Raclette, Limburger, Schafskäse, Schmelzkäse, Mascarpone, Brie, Hähnchenflügel, Hähnchen ganz, Geflügelhack, mageres Rinderhack 5 %, Rinderbraten, Rinderleber, Schweinenacken, Schweinebraten, Landjäger, Weißwurst, Bierwurst, Blutwurst, Lammkeule, Ente, Mortadella, Rohschinken, Wildlachs, frischer Thunfisch, Schellfisch, Heilbutt, Karpfen, Tilapia, Sardellen, Tintenfisch, schwarze Bohnen, Schälerbsen, Sojabohnen, Sojagranulat, Pekannüsse, Mohn, Maronen, Tahini, Hanfsamen, Kokosraspeln, Butterschmalz, Schweineschmalz, Cracker, Schokokekse, Schokopudding, weiße Schokolade, Karotten-/Trauben-/Tomatensaft, Kokoswasser, Espresso, Puderzucker, brauner Zucker, Agavendicksaft, Roggenmehl, Weizenmehl 550, Gelatine, Backpulver, Hefe, Apfelessig, Zitronensaft.

## Anhang: Zuordnung key → Quelleintrag

| key | name | Quelle | Originalbezeichnung |
|---|---|---|---|
| `apfel-mit-schale` | Apfel, mit Schale | USDA FDC 171688 | Apples, raw, with skin (Includes foods for USDA's Food Distribution Program) |
| `banane` | Banane | USDA FDC 173944 | Bananas, raw |
| `birne` | Birne | USDA FDC 169118 | Pears, raw |
| `orange` | Orange | USDA FDC 169097 | Oranges, raw, all commercial varieties |
| `mandarine` | Mandarine | USDA FDC 169105 | Tangerines, (mandarin oranges), raw |
| `erdbeeren` | Erdbeeren | USDA FDC 167762 | Strawberries, raw |
| `himbeeren` | Himbeeren | USDA FDC 167755 | Raspberries, raw |
| `heidelbeeren` | Heidelbeeren | USDA FDC 171711 | Blueberries, raw |
| `brombeeren` | Brombeeren | USDA FDC 173946 | Blackberries, raw |
| `johannisbeeren-rot` | Johannisbeeren, rot | USDA FDC 173964 | Currants, red and white, raw |
| `stachelbeeren` | Stachelbeeren | USDA FDC 173030 | Gooseberries, raw |
| `weintrauben` | Weintrauben | USDA FDC 174683 | Grapes, red or green (European type, such as Thompson seedless), raw |
| `kirschen-suess` | Kirschen, süß | USDA FDC 171719 | Cherries, sweet, raw |
| `pflaume` | Pflaume | USDA FDC 169949 | Plums, raw |
| `pfirsich` | Pfirsich | USDA FDC 169928 | Peaches, yellow, raw |
| `nektarine` | Nektarine | USDA FDC 169914 | Nectarines, raw |
| `aprikose` | Aprikose | USDA FDC 171697 | Apricots, raw |
| `wassermelone` | Wassermelone | USDA FDC 167765 | Watermelon, raw |
| `honigmelone` | Honigmelone | USDA FDC 169911 | Melons, honeydew, raw |
| `ananas` | Ananas | USDA FDC 169124 | Pineapple, raw, all varieties |
| `mango` | Mango | USDA FDC 169910 | Mangos, raw |
| `kiwi` | Kiwi | USDA FDC 168153 | Kiwifruit, green, raw |
| `zitrone-ohne-schale` | Zitrone, ohne Schale | USDA FDC 167746 | Lemons, raw, without peel |
| `grapefruit` | Grapefruit | USDA FDC 174673 | Grapefruit, raw, pink and red, all areas |
| `avocado` | Avocado | USDA FDC 171705 | Avocados, raw, all commercial varieties |
| `rosinen` | Rosinen | USDA FDC 168165 | Raisins, dark, seedless (Includes foods for USDA's Food Distribution Program) |
| `datteln-getrocknet` | Datteln, getrocknet | USDA FDC 171726 | Dates, deglet noor |
| `aprikosen-getrocknet` | Aprikosen, getrocknet | USDA FDC 173941 | Apricots, dried, sulfured, uncooked |
| `tomate` | Tomate | USDA FDC 170457 | Tomatoes, red, ripe, raw, year round average |
| `gurke-mit-schale` | Gurke, mit Schale | USDA FDC 168409 | Cucumber, with peel, raw |
| `paprika-rot` | Paprika, rot | USDA FDC 170108 | Peppers, sweet, red, raw |
| `paprika-gruen` | Paprika, grün | USDA FDC 170427 | Peppers, sweet, green, raw |
| `zwiebel` | Zwiebel | USDA FDC 170000 | Onions, raw |
| `fruehlingszwiebel` | Frühlingszwiebel | USDA FDC 170005 | Onions, spring or scallions (includes tops and bulb), raw |
| `knoblauch` | Knoblauch | USDA FDC 169230 | Garlic, raw |
| `ingwer-roh` | Ingwer, roh | USDA FDC 169231 | Ginger root, raw |
| `karotte-roh` | Karotte, roh | USDA FDC 170393 | Carrots, raw |
| `karotte-gekocht` | Karotte, gekocht | USDA FDC 170394 | Carrots, cooked, boiled, drained, without salt |
| `brokkoli-roh` | Brokkoli, roh | USDA FDC 170379 | Broccoli, raw |
| `brokkoli-gekocht` | Brokkoli, gekocht | USDA FDC 169967 | Broccoli, cooked, boiled, drained, without salt |
| `blumenkohl-roh` | Blumenkohl, roh | USDA FDC 169986 | Cauliflower, raw |
| `spinat-roh` | Spinat, roh | USDA FDC 168462 | Spinach, raw |
| `spinat-gekocht` | Spinat, gekocht | USDA FDC 168463 | Spinach, cooked, boiled, drained, without salt |
| `zucchini-roh` | Zucchini, roh | USDA FDC 169291 | Squash, summer, zucchini, includes skin, raw |
| `aubergine-roh` | Aubergine, roh | USDA FDC 169228 | Eggplant, raw |
| `champignons-roh` | Champignons, roh | USDA FDC 169251 | Mushrooms, white, raw |
| `kopfsalat` | Kopfsalat | USDA FDC 168429 | Lettuce, butterhead (includes boston and bibb types), raw |
| `eisbergsalat` | Eisbergsalat | USDA FDC 169248 | Lettuce, iceberg (includes crisphead types), raw |
| `rucola` | Rucola | USDA FDC 169387 | Arugula, raw |
| `weisskohl-roh` | Weißkohl, roh | USDA FDC 169975 | Cabbage, raw |
| `rotkohl-roh` | Rotkohl, roh | USDA FDC 169977 | Cabbage, red, raw |
| `wirsing-roh` | Wirsing, roh | USDA FDC 170388 | Cabbage, savoy, raw |
| `gruenkohl-roh` | Grünkohl, roh | USDA FDC 168421 | Kale, raw |
| `rosenkohl-roh` | Rosenkohl, roh | USDA FDC 170383 | Brussels sprouts, raw |
| `lauch-roh` | Lauch, roh | USDA FDC 169246 | Leeks, (bulb and lower leaf-portion), raw |
| `knollensellerie-roh` | Knollensellerie, roh | USDA FDC 170400 | Celeriac, raw |
| `kohlrabi-roh` | Kohlrabi, roh | USDA FDC 168424 | Kohlrabi, raw |
| `rote-bete-roh` | Rote Bete, roh | USDA FDC 169145 | Beets, raw |
| `radieschen` | Radieschen | USDA FDC 169276 | Radishes, raw |
| `spargel-gruen-roh` | Spargel, grün, roh | USDA FDC 168389 | Asparagus, raw |
| `kuerbis-roh` | Kürbis, roh | USDA FDC 168448 | Pumpkin, raw |
| `gruene-bohnen-roh` | Grüne Bohnen, roh | USDA FDC 169961 | Beans, snap, green, raw |
| `erbsen-tk` | Erbsen, tiefgekühlt | USDA FDC 170016 | Peas, green, frozen, unprepared (Includes foods for USDA's Food Distribution Program) |
| `mais-dose-abgetropft` | Mais, Dose, abgetropft | USDA FDC 169214 | Corn, sweet, yellow, canned, whole kernel, drained solids |
| `sauerkraut` | Sauerkraut | USDA FDC 169279 | Sauerkraut, canned, solids and liquids |
| `gewuerzgurken` | Gewürzgurken | USDA FDC 168558 | Pickles, cucumber, dill or kosher dill |
| `oliven-schwarz` | Oliven, schwarz | USDA FDC 169094 | Olives, ripe, canned (small-extra large) |
| `reis-weiss-roh` | Reis, weiß, roh | USDA FDC 169756 | Rice, white, long-grain, regular, raw, unenriched |
| `reis-weiss-gekocht` | Reis, weiß, gekocht | USDA FDC 169757 | Rice, white, long-grain, regular, unenriched, cooked without salt |
| `naturreis-roh` | Naturreis, roh | USDA FDC 169703 | Rice, brown, long-grain, raw (Includes foods for USDA's Food Distribution Program) |
| `naturreis-gekocht` | Naturreis, gekocht | USDA FDC 169704 | Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program) |
| `nudeln-roh` | Nudeln, roh | USDA FDC 168927 | Pasta, dry, unenriched |
| `nudeln-gekocht` | Nudeln, gekocht | USDA FDC 168928 | Pasta, cooked, unenriched, without added salt |
| `vollkornnudeln-roh` | Vollkornnudeln, roh | USDA FDC 169738 | Pasta, whole-wheat, dry (Includes foods for USDA's Food Distribution Program) |
| `vollkornnudeln-gekocht` | Vollkornnudeln, gekocht | USDA FDC 168910 | Pasta, whole-wheat, cooked (Includes foods for USDA's Food Distribution Program) |
| `spaetzle-gekocht` | Spätzle, gekocht | Swiss FCDB 14180 | Spätzli, gekocht, abgetropft, hausgemacht |
| `haferflocken` | Haferflocken | USDA FDC 173904 | Cereals, oats, regular and quick, not fortified, dry |
| `couscous-roh` | Couscous, roh | USDA FDC 169699 | Couscous, dry |
| `couscous-gekocht` | Couscous, gekocht | USDA FDC 169700 | Couscous, cooked |
| `bulgur-roh` | Bulgur, roh | USDA FDC 170688 | Bulgur, dry |
| `bulgur-gekocht` | Bulgur, gekocht | USDA FDC 170287 | Bulgur, cooked |
| `quinoa-roh` | Quinoa, roh | USDA FDC 168874 | Quinoa, uncooked |
| `quinoa-gekocht` | Quinoa, gekocht | USDA FDC 168917 | Quinoa, cooked |
| `hirse-roh` | Hirse, roh | USDA FDC 169702 | Millet, raw |
| `hirse-gekocht` | Hirse, gekocht | USDA FDC 168871 | Millet, cooked |
| `polenta-maisgriess-roh` | Polenta / Maisgrieß, roh | Swiss FCDB 425 | Maisgriess, trocken |
| `cornflakes` | Cornflakes | Swiss FCDB 940 | Cornflakes |
| `muesli-ungesuesst` | Müsli, ungesüßt | Swiss FCDB 943 | Müeslimischung, Getreideflocken mit Früchten und Nüssen, ungesüsst |
| `kartoffel-roh` | Kartoffel, roh | USDA FDC 170026 | Potatoes, flesh and skin, raw |
| `kartoffel-gekocht-mit-schale` | Kartoffel, gekocht, mit Schale | USDA FDC 170438 | Potatoes, boiled, cooked in skin, flesh, without salt |
| `kartoffel-gekocht-ohne-schale` | Kartoffel, gekocht, ohne Schale | USDA FDC 170440 | Potatoes, boiled, cooked without skin, flesh, without salt |
| `suesskartoffel-roh` | Süßkartoffel, roh | USDA FDC 168482 | Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program) |
| `suesskartoffel-gekocht` | Süßkartoffel, gekocht | USDA FDC 168484 | Sweet potato, cooked, boiled, without skin |
| `pommes-frites-ofen` | Pommes frites, Ofen | Swiss FCDB 10450 | Pommes Frites (im Ofen gebacken), ungesalzen |
| `reiswaffel` | Reiswaffel | Swiss FCDB 802 | Vollkornreiswaffel |
| `weizenbroetchen` | Weizenbrötchen | Swiss FCDB 1463 | Semmeli |
| `laugenbroetchen` | Laugenbrötchen | Swiss FCDB 832 | Laugenbrötli (mit jodiertem Kochsalz) |
| `weissbrot` | Weißbrot | Swiss FCDB 823 | Weissbrot |
| `toastbrot` | Toastbrot | Swiss FCDB 826 | Toastbrot mit Pflanzenölen |
| `vollkorntoast` | Vollkorntoast | Swiss FCDB 825 | Toastbrot, Vollkorn |
| `baguette` | Baguette | Swiss FCDB 845 | Pariserbrot |
| `weizenvollkornbrot` | Weizenvollkornbrot | Swiss FCDB 821 | Weizenvollkornbrot |
| `mischbrot` | Mischbrot | Swiss FCDB 1268 | Bauernbrot |
| `roggenbrot-sauerteig` | Roggenbrot, Sauerteig | Swiss FCDB 830 | Roggenbrot mit Sauerteig |
| `roggenvollkornbrot` | Roggenvollkornbrot | Swiss FCDB 846 | Roggenschrotbrot |
| `pumpernickel` | Pumpernickel | USDA FDC 174918 | Bread, pumpernickel |
| `knaeckebrot-vollkorn` | Knäckebrot, Vollkorn | Swiss FCDB 918 | Knäckebrot, Vollkorn |
| `croissant-butter` | Croissant, Butter | USDA FDC 174987 | Croissants, butter |
| `weizentortilla-wrap` | Weizentortilla / Wrap | USDA FDC 173242 | Tortillas, ready-to-bake or -fry, flour, without added calcium |
| `pita-fladenbrot` | Pita / Fladenbrot | USDA FDC 174915 | Bread, pita, white, enriched |
| `vollmilch-3-5` | Vollmilch 3,5 % | Swiss FCDB 14126 | Vollmilch, standardisiert, 3.5% Fett, UHT |
| `fettarme-milch-1-5` | Fettarme Milch 1,5 % | Swiss FCDB 13399 | Halbentrahmte Milch 1.5% Fett, UHT |
| `magermilch` | Magermilch | Swiss FCDB 64 | Magermilch, UHT |
| `buttermilch` | Buttermilch | Swiss FCDB 529 | Buttermilch |
| `kondensmilch-ungezuckert` | Kondensmilch, ungezuckert | Swiss FCDB 527 | Kondensmilch, ungezuckert |
| `joghurt-natur-3-5` | Joghurt, natur, 3,5 % | Swiss FCDB 52 | Joghurt, nature |
| `joghurt-natur-fettarm` | Joghurt, natur, fettarm | Swiss FCDB 587 | Joghurt, nature, mager |
| `fruchtjoghurt-gezuckert` | Fruchtjoghurt, gezuckert | Swiss FCDB 1192 | Joghurt, gezuckert (Durchschnitt) |
| `joghurt-griechisch-0` | Joghurt, griechisch, 0 % Fett | USDA FDC 170894 | Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program) |
| `joghurt-griechisch-5` | Joghurt, griechisch, 5 % Fett | USDA FDC 171304 | Yogurt, Greek, plain, whole milk |
| `magerquark` | Magerquark | Swiss FCDB 71 | Quark, nature, mager |
| `speisequark-20` | Speisequark 20 % Fett i. Tr. | Swiss FCDB 571 | Quark, nature, halbfett |
| `sahnequark` | Sahnequark | Swiss FCDB 70 | Quark, nature, Rahm |
| `fruchtquark-gezuckert` | Fruchtquark, gezuckert | Swiss FCDB 13501 | Quark, mit Früchten, gezuckert |
| `huettenkaese` | Hüttenkäse | Swiss FCDB 505 | Hüttenkäse, nature |
| `frischkaese-doppelrahm` | Frischkäse, Doppelrahmstufe | USDA FDC 173418 | Cheese, cream |
| `schlagsahne` | Schlagsahne | USDA FDC 170858 | Cream, fluid, light whipping |
| `saure-sahne` | Saure Sahne | USDA FDC 171256 | Cream, sour, reduced fat, cultured |
| `schmand` | Schmand | USDA FDC 171257 | Cream, sour, cultured |
| `creme-fraiche` | Crème fraîche | Swiss FCDB 574 | Sauerrahm |
| `gouda` | Gouda | USDA FDC 171241 | Cheese, gouda |
| `edamer` | Edamer | USDA FDC 173419 | Cheese, edam |
| `emmentaler` | Emmentaler | Swiss FCDB 555 | Emmentaler, vollfett |
| `cheddar` | Cheddar | USDA FDC 173414 | Cheese, cheddar (Includes foods for USDA's Food Distribution Program) |
| `camembert` | Camembert | USDA FDC 172178 | Cheese, camembert |
| `blauschimmelkaese` | Blauschimmelkäse | USDA FDC 172175 | Cheese, blue |
| `mozzarella` | Mozzarella | USDA FDC 170845 | Cheese, mozzarella, whole milk |
| `feta` | Feta | USDA FDC 173420 | Cheese, feta |
| `ziegenfrischkaese` | Ziegenfrischkäse | USDA FDC 173435 | Cheese, goat, soft type |
| `parmesan` | Parmesan | USDA FDC 170848 | Cheese, parmesan, hard |
| `ricotta` | Ricotta | USDA FDC 170851 | Cheese, ricotta, whole milk |
| `haferdrink-ungesuesst` | Haferdrink, ungesüßt | Swiss FCDB 14114 | Hafergetränk, nature |
| `sojadrink-ungesuesst` | Sojadrink, ungesüßt | Swiss FCDB 72 | Sojagetränk, nature |
| `mandeldrink-ungesuesst` | Mandeldrink, ungesüßt | Swiss FCDB 14113 | Mandelgetränk, nature |
| `reisdrink` | Reisdrink | Swiss FCDB 13450 | Reisgetränk, nature |
| `kokosdrink` | Kokosdrink | Swiss FCDB 14124 | Kokosnussgetränk, nature |
| `sojajoghurt-natur` | Sojajoghurt, natur | Swiss FCDB 13451 | Joghurtalternative aus Soja, nature |
| `huehnerei-roh` | Hühnerei, roh | USDA FDC 171287 | Egg, whole, raw, fresh |
| `huehnerei-gekocht` | Hühnerei, gekocht | USDA FDC 173424 | Egg, whole, cooked, hard-boiled |
| `eiweiss-roh` | Eiweiß (Eiklar), roh | USDA FDC 172183 | Egg, white, raw, fresh |
| `eigelb-roh` | Eigelb, roh | USDA FDC 172184 | Egg, yolk, raw, fresh |
| `haehnchenbrust-roh` | Hähnchenbrust, roh | USDA FDC 171077 | Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw |
| `haehnchenbrust-gebraten` | Hähnchenbrust, gebraten | USDA FDC 171534 | Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, grilled |
| `haehnchenschenkel-mit-haut-roh` | Hähnchenschenkel, mit Haut, roh | Swiss FCDB 24 | Poulet, Schenkel, mit Haut, roh |
| `haehnchenschenkel-mit-haut-gebraten` | Hähnchenschenkel, mit Haut, gebraten | Swiss FCDB 13310 | Poulet, Schenkel, mit Haut, gebraten (ohne Zusatz von Fett und Salz) |
| `putenbrust-roh` | Putenbrust, roh | Swiss FCDB 713 | Truthahn, Brust, Schnitzel oder Geschnetzeltes, roh |
| `putenbrust-gebraten` | Putenbrust, gebraten | Swiss FCDB 13275 | Truthahn, Brust, Schnitzel oder Geschnetzeltes, gebraten (ohne Zusatz von Fett und Salz) |
| `putenbrust-aufschnitt` | Putenbrust, Aufschnitt | Swiss FCDB 14291 | Trutenbrust, gepökelt, gekocht, in Scheiben |
| `rinderhackfleisch-roh` | Rinderhackfleisch, roh | USDA FDC 171796 | Beef, ground, 85% lean meat / 15% fat, raw (Includes foods for USDA's Food Distribution Program) |
| `rinderhackfleisch-gebraten` | Rinderhackfleisch, gebraten | USDA FDC 174033 | Beef, ground, 85% lean meat / 15% fat, patty, cooked, pan-broiled |
| `rinderfilet-roh` | Rinderfilet, roh | Swiss FCDB 639 | Rind, Filet, roh |
| `rindersteak-entrecote-roh` | Rindersteak (Entrecôte), roh | Swiss FCDB 30 | Rind, Entrecôte, roh |
| `rindersteak-entrecote-gebraten` | Rindersteak (Entrecôte), gebraten | Swiss FCDB 13258 | Rind, Entrecôte, "medium" gebraten (ohne Zusatz von Fett und Salz) |
| `schweinehackfleisch-roh` | Schweinehackfleisch, roh | USDA FDC 167902 | Pork, fresh, ground, raw |
| `schweinefilet-roh` | Schweinefilet, roh | Swiss FCDB 677 | Schwein, Filet, roh |
| `schweinefilet-gebraten` | Schweinefilet, gebraten | Swiss FCDB 13269 | Schwein, Filet, gebraten (ohne Zusatz von Fett und Salz) |
| `schweineschnitzel-roh` | Schweineschnitzel (Oberschale), roh | USDA FDC 167816 | Pork, fresh, leg (ham), rump half, separable lean only, raw (Includes foods for USDA's Food Distribution Program) |
| `schweinekotelett-roh` | Schweinekotelett, roh | Swiss FCDB 8 | Schwein, Kotelett, roh |
| `schweinebauch-roh` | Schweinebauch, roh | USDA FDC 167812 | Pork, fresh, belly, raw |
| `fruehstuecksspeck-roh` | Frühstücksspeck (Bacon), roh | USDA FDC 168277 | Pork, cured, bacon, unprepared |
| `kochschinken` | Kochschinken | Swiss FCDB 691 | Hinterschinken |
| `salami` | Salami | Swiss FCDB 1091 | Salami |
| `bratwurst-gebraten` | Bratwurst (Schwein), gebraten | USDA FDC 171620 | Bratwurst, pork, cooked |
| `wiener-wuerstchen` | Wiener Würstchen | Swiss FCDB 1082 | Wienerli |
| `leberwurst` | Leberwurst | USDA FDC 173870 | Liver sausage, liverwurst, pork |
| `fleischwurst-lyoner` | Fleischwurst (Lyoner) | Swiss FCDB 1083 | Lyoner |
| `leberkaese` | Leberkäse / Fleischkäse | Swiss FCDB 1084 | Fleischkäse |
| `lammkotelett-roh` | Lammkotelett, roh | Swiss FCDB 5 | Lamm, Kotelett, roh (Schweiz) |
| `lachs-zucht-roh` | Lachs, Zucht, roh | USDA FDC 175167 | Fish, salmon, Atlantic, farmed, raw |
| `lachs-zucht-gebraten` | Lachs, Zucht, gebraten | USDA FDC 175168 | Fish, salmon, Atlantic, farmed, cooked, dry heat |
| `raeucherlachs` | Räucherlachs | Swiss FCDB 193 | Lachs, geräuchert |
| `thunfisch-dose-wasser` | Thunfisch, Dose, in Wasser, abgetropft | USDA FDC 173709 | Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program) |
| `thunfisch-dose-oel` | Thunfisch, Dose, in Öl, abgetropft | USDA FDC 173708 | Fish, tuna, light, canned in oil, drained solids |
| `forelle-roh` | Forelle, roh | USDA FDC 173717 | Fish, trout, rainbow, farmed, raw |
| `forelle-geraeuchert` | Forelle, geräuchert | Swiss FCDB 13976 | Forelle, geräuchert |
| `kabeljau-roh` | Kabeljau, roh | USDA FDC 171955 | Fish, cod, Atlantic, raw |
| `kabeljau-gegart` | Kabeljau, gegart | USDA FDC 171956 | Fish, cod, Atlantic, cooked, dry heat |
| `seelachs-roh` | Seelachs, roh | USDA FDC 175129 | Fish, pollock, Atlantic, raw |
| `scholle-roh` | Scholle, roh | Swiss FCDB 415 | Scholle, roh |
| `zander-roh` | Zander, roh | USDA FDC 175128 | Fish, pike, walleye, raw |
| `hering-roh` | Hering, roh | USDA FDC 175116 | Fish, herring, Atlantic, raw |
| `rollmops` | Rollmops | Swiss FCDB 805 | Rollmops |
| `makrele-roh` | Makrele, roh | USDA FDC 175119 | Fish, mackerel, Atlantic, raw |
| `sardinen-dose-oel` | Sardinen, Dose, in Öl, abgetropft | USDA FDC 175139 | Fish, sardine, Atlantic, canned in oil, drained solids with bone |
| `garnelen-roh` | Garnelen, roh | USDA FDC 175179 | Crustaceans, shrimp, raw |
| `miesmuscheln-roh` | Miesmuscheln, roh | USDA FDC 174216 | Mollusks, mussel, blue, raw |
| `fischstaebchen-zubereitet` | Fischstäbchen, zubereitet | USDA FDC 174195 | Fish, fish sticks, frozen, prepared |
| `linsen-braun-roh` | Linsen, braun, roh | USDA FDC 172420 | Lentils, raw |
| `linsen-braun-gekocht` | Linsen, braun, gekocht | USDA FDC 172421 | Lentils, mature seeds, cooked, boiled, without salt |
| `linsen-rot-roh` | Linsen, rot, roh | USDA FDC 174284 | Lentils, pink or red, raw |
| `kichererbsen-roh` | Kichererbsen, roh | USDA FDC 173756 | Chickpeas (garbanzo beans, bengal gram), mature seeds, raw |
| `kichererbsen-gekocht` | Kichererbsen, gekocht | USDA FDC 173757 | Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt |
| `kichererbsen-dose-abgetropft` | Kichererbsen, Dose, abgetropft | USDA FDC 173800 | Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained solids |
| `kidneybohnen-roh` | Kidneybohnen, roh | USDA FDC 173744 | Beans, kidney, red, mature seeds, raw |
| `kidneybohnen-gekocht` | Kidneybohnen, gekocht | USDA FDC 175194 | Beans, kidney, red, mature seeds, cooked, boiled, without salt |
| `kidneybohnen-dose-abgetropft` | Kidneybohnen, Dose, abgetropft | USDA FDC 174285 | Beans, kidney, red, mature seeds, canned, drained solids |
| `weisse-bohnen-roh` | Weiße Bohnen, roh | USDA FDC 175202 | Beans, white, mature seeds, raw |
| `weisse-bohnen-gekocht` | Weiße Bohnen, gekocht | USDA FDC 175203 | Beans, white, mature seeds, cooked, boiled, without salt |
| `edamame-tk` | Edamame, tiefgekühlt | USDA FDC 168410 | Edamame, frozen, unprepared |
| `tofu-fest` | Tofu, fest | Swiss FCDB 13437 | Tofu, fest, nature (Durchschnitt) |
| `tofu-geraeuchert` | Tofu, geräuchert | Swiss FCDB 14090 | Tofu, geräuchert (Durchschnitt) |
| `seidentofu` | Seidentofu | Swiss FCDB 13438 | Tofu, seidig (weich), nature |
| `tempeh` | Tempeh | Swiss FCDB 14251 | Tempeh, nature |
| `mandeln` | Mandeln | USDA FDC 170567 | Nuts, almonds |
| `walnuesse` | Walnüsse | USDA FDC 170187 | Nuts, walnuts, english |
| `haselnuesse` | Haselnüsse | USDA FDC 170581 | Nuts, hazelnuts or filberts |
| `cashewkerne` | Cashewkerne | Swiss FCDB 275 | Cashewnuss |
| `erdnuesse-geroestet-gesalzen` | Erdnüsse, geröstet, gesalzen | USDA FDC 174262 | Peanuts, all types, dry-roasted, with salt |
| `pistazien-geroestet-gesalzen` | Pistazien, geröstet, gesalzen | USDA FDC 169426 | Nuts, pistachio nuts, dry roasted, with salt added |
| `paranuesse` | Paranüsse | USDA FDC 170569 | Nuts, brazilnuts, dried, unblanched |
| `macadamianuesse` | Macadamianüsse | USDA FDC 170178 | Nuts, macadamia nuts, raw |
| `pinienkerne` | Pinienkerne | USDA FDC 170591 | Nuts, pine nuts, dried |
| `sonnenblumenkerne` | Sonnenblumenkerne | USDA FDC 170562 | Seeds, sunflower seed kernels, dried |
| `kuerbiskerne` | Kürbiskerne | USDA FDC 170556 | Seeds, pumpkin and squash seed kernels, dried |
| `leinsamen` | Leinsamen | USDA FDC 169414 | Seeds, flaxseed |
| `chiasamen` | Chiasamen | USDA FDC 170554 | Seeds, chia seeds, dried |
| `sesam` | Sesam | USDA FDC 170150 | Seeds, sesame seeds, whole, dried |
| `erdnussbutter` | Erdnussbutter | USDA FDC 174266 | Peanut butter, smooth style, with salt (Includes foods for USDA's Food Distribution Program) |
| `mandelmus` | Mandelmus | USDA FDC 168588 | Nuts, almond butter, plain, without salt added |
| `olivenoel` | Olivenöl | USDA FDC 171413 | Oil, olive, salad or cooking |
| `rapsoel` | Rapsöl | USDA FDC 172336 | Oil, canola |
| `sonnenblumenoel` | Sonnenblumenöl | USDA FDC 171025 | Oil, sunflower, linoleic, (approx. 65%) |
| `kokosoel` | Kokosöl | USDA FDC 171412 | Oil, coconut |
| `leinoel` | Leinöl | USDA FDC 167702 | Oil, flaxseed, cold pressed |
| `butter` | Butter | USDA FDC 173430 | Butter, without salt |
| `margarine` | Margarine | USDA FDC 172346 | Margarine, regular, 80% fat, composite, stick, with salt |
| `vollmilchschokolade` | Vollmilchschokolade | USDA FDC 167587 | Candies, milk chocolate |
| `zartbitterschokolade-70` | Zartbitterschokolade 70 % | USDA FDC 170273 | Chocolate, dark, 70-85% cacao solids |
| `nuss-nougat-creme` | Nuss-Nougat-Creme | USDA FDC 168000 | Chocolate-flavored hazelnut spread |
| `konfituere` | Konfitüre | Swiss FCDB 696 | Konfitüre |
| `fruchtgummi` | Fruchtgummi | Swiss FCDB 951 | Gummibonbon mit Fruchtessenz |
| `kartoffelchips` | Kartoffelchips | USDA FDC 169677 | Snacks, potato chips, plain, salted |
| `salzstangen` | Salzstangen | USDA FDC 167555 | Snacks, pretzels, hard, plain, salted |
| `butterkekse` | Butterkekse | Swiss FCDB 14074 | Petit Beurre |
| `vanilleeis` | Vanilleeis | USDA FDC 167575 | Ice creams, vanilla |
| `muesliriegel` | Müsliriegel | USDA FDC 167542 | Snacks, granola bars, hard, plain |
| `popcorn-ohne-fett` | Popcorn, ohne Fett | USDA FDC 167959 | Snacks, popcorn, air-popped |
| `marzipan` | Marzipan | Swiss FCDB 14288 | Marzipan |
| `lebkuchen` | Lebkuchen | Swiss FCDB 14287 | Lebkuchen |
| `pudding-vanille` | Pudding, Vanille | Swiss FCDB 809 | Pudding, Vanille |
| `mineralwasser` | Mineralwasser | USDA FDC 174158 | Water, bottled, generic |
| `apfelsaft` | Apfelsaft | USDA FDC 173933 | Apple juice, canned or bottled, unsweetened, without added ascorbic acid |
| `orangensaft` | Orangensaft | USDA FDC 169098 | Orange juice, raw (Includes foods for USDA's Food Distribution Program) |
| `saftschorle` | Saftschorle (60 % Saft) | Swiss FCDB 1131 | Fruchtsaft-Schorle (Durchschnitt, 60% Saft - 40% Wasser), ungezuckert |
| `cola` | Cola | USDA FDC 174852 | Beverages, carbonated, cola, regular |
| `cola-zuckerfrei` | Cola, zuckerfrei | USDA FDC 174850 | Beverages, carbonated, low calorie, cola or pepper-type, with aspartame, without caffeine |
| `limonade` | Limonade | Swiss FCDB 595 | Limonade, mit Aroma, gezuckert |
| `eistee-gezuckert` | Eistee, gezuckert | Swiss FCDB 804 | Eistee, gezuckert |
| `energydrink` | Energydrink | Swiss FCDB 13465 | Energy Drink mit Koffein, Taurin und Vitaminen, gezuckert |
| `kaffee-schwarz` | Kaffee, schwarz | USDA FDC 171890 | Beverages, coffee, brewed, prepared with tap water |
| `tee-schwarz-ungesuesst` | Tee, schwarz, ungesüßt | USDA FDC 173227 | Beverages, tea, black, brewed, prepared with tap water |
| `bier-hell` | Bier, hell (Pils/Lager) | Swiss FCDB 816 | Bier, Lager |
| `bier-alkoholfrei` | Bier, alkoholfrei | Swiss FCDB 13420 | Bier, alkoholfrei |
| `radler` | Radler | Swiss FCDB 1183 | Bier Panache (Durchschnitt) |
| `weisswein` | Weißwein | Swiss FCDB 511 | Wein weiss, 12.5 vol% |
| `rotwein` | Rotwein | Swiss FCDB 509 | Wein rot, 12 vol% |
| `sekt` | Sekt | Swiss FCDB 551 | Schaumwein |
| `wodka` | Wodka (40 %) | USDA FDC 174815 | Alcoholic beverage, distilled, all (gin, rum, vodka, whiskey) 80 proof |
| `zucker` | Zucker | USDA FDC 169655 | Sugars, granulated |
| `honig` | Honig | USDA FDC 169640 | Honey |
| `ahornsirup` | Ahornsirup | USDA FDC 169661 | Syrups, maple |
| `weizenmehl-405` | Weizenmehl Type 405 | Swiss FCDB 205 | Weizenmehl, weiss, Typ 400 |
| `weizenvollkornmehl` | Weizenvollkornmehl | Swiss FCDB 206 | Weizenmehl, Vollkorn, Typ 1700 |
| `dinkelmehl-630` | Dinkelmehl Type 630 | Swiss FCDB 1043 | Dinkelmehl, weiss, Typ 550 |
| `speisestaerke` | Speisestärke | USDA FDC 169698 | Cornstarch |
| `salz` | Salz | USDA FDC 173468 | Salt, table |
| `tomatenmark` | Tomatenmark | USDA FDC 170459 | Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program) |
| `tomaten-passiert` | Tomaten, passiert | USDA FDC 170460 | Tomato products, canned, puree, without salt added |
| `tomaten-gehackt-dose` | Tomaten, gehackt, Dose | USDA FDC 170051 | Tomatoes, red, ripe, canned, packed in tomato juice |
| `ketchup` | Ketchup | USDA FDC 168556 | Catsup |
| `senf` | Senf | Swiss FCDB 13464 | Senf |
| `mayonnaise` | Mayonnaise | Swiss FCDB 771 | Mayonnaise |
| `sojasauce` | Sojasauce | USDA FDC 174277 | Soy sauce made from soy and wheat (shoyu) |
| `weinessig` | Weinessig | USDA FDC 172240 | Vinegar, red wine |
| `balsamico` | Balsamico-Essig | USDA FDC 172241 | Vinegar, balsamic |
| `kakaopulver-ungesuesst` | Kakaopulver, ungesüßt | USDA FDC 169593 | Cocoa, dry powder, unsweetened |
| `kokosmilch` | Kokosmilch | Swiss FCDB 13458 | Kokosnussmilch |
| `gemuesebruehe-zubereitet` | Gemüsebrühe, zubereitet | Swiss FCDB 664 | Bouillon, Gemüse, zubereitet |
| `whey-proteinpulver` | Whey-Proteinpulver | USDA FDC 173180 | Beverages, Protein powder whey based |
