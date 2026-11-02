# Libly

Statystyki z Librus Synergia, których Librus sam nie pokazuje. Aplikacja działa lokalnie na Twoim komputerze, a Twoje hasło nigdzie nie jest zapisywane. Libly jest uniwersalne, więc dopasujesz je do swojej szkoły, niezależnie od tego, czy to podstawówka, liceum, technikum czy szkoła branżowa.

![Status](https://img.shields.io/badge/status-pre--alpha-orange)
![Licencja](https://img.shields.io/badge/licencja-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

## Ważne ostrzeżenie

Przeczytaj to przed pierwszym użyciem.

* Librus nie udostępnia oficjalnego API. Ta aplikacja korzysta z nieoficjalnej biblioteki [`librus-api`](https://github.com/Mati365/librus-api), która pobiera dane w sposób podobny do zwykłej przeglądarki i parsuje strony HTML.
* **Takie korzystanie może być niezgodne z regulaminem Librus Synergia**, w szczególności z zakazem systematycznego pobierania danych. Używasz aplikacji na własne ryzyko. Autorzy nie odpowiadają za zablokowanie konta ani inne konsekwencje.
* Aplikacja jest przeznaczona wyłącznie do użytku prywatnego, na własnym koncie, w niewielkiej skali. Nie używaj jej do masowego pobierania danych, monitorowania całych klas ani w celach komercyjnych.
* Projekt nie jest powiązany z firmą Librus ani Synergia i nie jest przez nie wspierany. Nazwy Librus i Synergia należą do ich właścicieli.
* Librus może w każdej chwili zmienić swoje strony, a wtedy aplikacja może przestać działać do czasu poprawki.

## Co potrafi

Plan funkcji jest rozłożony na etapy. Aktualny stan znajdziesz w sekcji Roadmapa.

* Ogólna frekwencja w procentach
* Frekwencja w procentach dla każdego przedmiotu, od najgorszej
* Podświetlenie na czerwono lub bursztynowo przedmiotów poniżej progów (razem z ikoną i opisem, nie tylko kolorem)
* Pełne dopasowanie do Twojej szkoły (typ szkoły, próg frekwencji ze statutu, zasady liczenia, praktyki zawodowe), opisane niżej w sekcji Ustawienia szkoły
* Ile lekcji możesz jeszcze opuścić i ile musisz być obecny, żeby wrócić nad próg
* Symulator frekwencji i ocen
* Średnia ważona, także wtedy, gdy szkoła wyłączyła ją w Librusie
* Osobne traktowanie ocen z praktyk zawodowych i zajęć praktycznych, jeśli Twoja szkoła je ma
* Postęp w stronę świadectwa z wyróżnieniem (z konfigurowalnym progiem średniej)
* Wykresy trendów oraz eksport danych lokalnie do pliku
* Tryb demo na sztucznych danych, bez logowania

## Jak chronimy Twoje dane

Bezpieczeństwo jest najważniejszym założeniem projektu.

* **Wszystko dzieje się na Twoim komputerze.** Domyślnie serwer aplikacji nasłuchuje tylko na `127.0.0.1`, a nieprawidłowe nagłówki `Host` są odrzucane.
* **Hasło nie jest zapisywane.** Trafia do lokalnego serwera tylko po to, żeby zalogować się do Librusa, a zaraz potem jest porzucane. Nie ma bazy danych ani plików z danymi; `localStorage` przechowuje wyłącznie niesekretny wybór typu szkoły.
* **Dane trzymamy tylko w pamięci** i znikają po wylogowaniu, po wygaśnięciu sesji albo po zamknięciu aplikacji.
* **Sesja ma ograniczony czas życia.** Wygasa po 15 minutach bez aktywności albo po 60 minutach łącznie; wylogowanie usuwa ją od razu.
* **Nieprawidłowe próby utworzenia sesji są ograniczane.** Po pięciu błędach w ruchomym oknie minuty kolejne żądania otrzymują `429` z czasem oczekiwania; po każdym błędzie rośnie wykładniczo cooldown.
* **Jedyny ruch wychodzący idzie do Librusa.** Brak analityki, telemetrii, zewnętrznych czcionek i skryptów z internetu.
* **Zabezpieczenia przeglądarkowe.** Restrykcyjne nagłówki (CSP), sprawdzanie nagłówków `Host` i `Origin` przy żądaniach zmieniających stan oraz `Cache-Control: no-store` dla API.
* **Dzienniki nie ujawniają sekretów.** Pola hasła, ciasteczek i autoryzacji są redagowane, logi żądań nie zapisują URL ani nagłówków, a błędy są raportowane bez treści wyjątku.
* **Aplikacja tylko czyta.** Nie wysyła ani nie usuwa wiadomości i niczego nie zmienia na Twoim koncie.
* **Uczciwe zastrzeżenie.** JavaScript nie pozwala w pełni wyczyścić pamięci, więc nie obiecujemy zerowania haseł w RAM. Obiecujemy, że hasło nigdy nie trafia na dysk ani do sieci poza Librusem.

Jak sprawdzić to samodzielnie. Otwórz narzędzia deweloperskie w przeglądarce, zakładkę Sieć, i zobacz, że wszystkie zapytania idą pod `127.0.0.1`. Kod jest otwarty, więc możesz też przeczytać go sam. Szczegóły modelu zagrożeń są w [`docs/PLAN.md`](docs/PLAN.md).

Nie wystawiaj tej aplikacji publicznie w internecie i nie hostuj jej dla innych osób. To pogwałciłoby jej założenia bezpieczeństwa.

## Szybki start

### Wymagania

* Node.js w wersji LTS (22 lub nowszej)
* npm (instaluje się razem z Node.js)
* Konto w Librus Synergia (uczniowskie) albo po prostu tryb demo

### Instalacja i uruchomienie

```bash
git clone https://github.com/<twoj-login>/libly.git
cd libly
npm ci
npm run build
npm start
```

Następnie otwórz w przeglądarce adres `http://127.0.0.1:3000`.

Port możesz zmienić zmienną środowiskową `PORT`. Domyślny adres nasłuchu to `127.0.0.1`; ustawienie `HOST` na inny adres wymaga flagi `--i-understand-the-risks`, która wyświetla głośne ostrzeżenie. Nie rób tego, jeśli nie wiesz dokładnie, co robisz.

### Tryb demo

Na ekranie logowania wybierz przycisk trybu demo. Aplikacja pokaże sztuczne dane i nie połączy się z Librusem. Przy pierwszym wejściu na dashboard wybierz typ szkoły i sprawdź typowe wartości profilu w statucie swojej szkoły; presety nie są poradą prawną. Tryb demo jest też bezpiecznym sposobem na wypróbowanie aplikacji oraz na tworzenie zrzutów ekranu do zgłoszeń. Logowanie do Librusa nie jest jeszcze dostępne; nie wpisuj loginu ani hasła w aplikacji.

## Ustawienia szkoły

Szkoły różnią się zasadami, więc Libly niczego nie zakłada na sztywno. Przy pierwszym uruchomieniu kreator poprosi Cię o wybranie typu szkoły, a potem pokaże typowe wartości do sprawdzenia. Wszystko możesz później zmienić w Ustawieniach, w sekcji Szkoła.

**Typ szkoły** do wyboru to szkoła podstawowa, liceum ogólnokształcące, technikum, szkoła branżowa I stopnia, szkoła branżowa II stopnia, szkoła policealna oraz inna, w której sam ustawiasz wszystko. Typ szkoły włącza odpowiednie sekcje. Na przykład praktyki zawodowe i zajęcia praktyczne pojawiają się dla technikum i szkoły branżowej, a w liceum ich nie widać.

| Ustawienie | Domyślnie | Opis |
| --- | --- | --- |
| Próg krytyczny frekwencji | 50 procent | Poniżej tej wartości przedmiot jest czerwony. Wpisz wartość ze statutu swojej szkoły. |
| Próg ostrzegawczy | 60 procent | Poniżej tej wartości przedmiot jest pomarańczowy |
| Czego dotyczy próg | per przedmiot | Statut może liczyć frekwencję osobno z każdego przedmiotu, ogólnie albo oba naraz |
| Okres rozliczeniowy | semestr | Frekwencja może być oceniana w semestrze albo w całym roku |
| Spóźnienie jako obecność | tak | Czy spóźnienie liczy się jako obecność |
| Nieobecność usprawiedliwiona jako obecność | nie | Zależy od statutu, sprawdź go |
| Pomijane rodzaje wpisów | zwolnienia, wycieczki | Te wpisy nie wchodzą do wyliczeń |
| Symbole frekwencji | typowe symbole Librusa | Jeśli Twoja szkoła ma własne symbole, przypiszesz je ręcznie do rodzajów wpisów |
| Semestry lub trymestry | dwa semestry | Daty możesz zmienić |
| Kategoria przedmiotu | sugerowana automatycznie, wymaga potwierdzenia | Ogólny, zawodowy, zajęcia praktyczne, praktyki zawodowe, wychowanie fizyczne, religia lub etyka, zachowanie. Możesz poprawić każdą sugestię; nierozpoznane nazwy nie dostają kategorii automatycznie. |
| Progi dla pojedynczego przedmiotu | brak | Możesz ustawić inny próg dla wybranego przedmiotu, na przykład dla praktyk |
| Praktyki zawodowe i zajęcia praktyczne | osobna średnia | Wykluczenie ze średniej, zwykły przedmiot albo osobna średnia |
| Skala ocen | 1 do 6 | Możesz wybrać też punkty lub procenty, a wartość plusa i minusa ustawisz sam |
| Zachowanie w średniej | nie | Czy ocena z zachowania liczy się do średniej |
| Średnia na wyróżnienie | 4,75 | Cel dla świadectwa z wyróżnieniem, do zmiany |

Wartości domyślne i gotowe zestawy dla typów szkół to punkt wyjścia, a nie porada prawna. Zasady frekwencji i klasyfikacji ustala statut Twojej szkoły, więc zawsze go sprawdź.

Ustawienia możesz wyeksportować do pliku JSON i zaimportować na innym komputerze. W pliku nie ma żadnych danych osobowych, więc można go bezpiecznie udostępnić koledze z tej samej szkoły. Zapisują się tylko w Twojej przeglądarce. Jeśli chcesz dodać gotowy zestaw dla swojej szkoły dla wszystkich, opisujemy to w sekcji o kontrybucji.

## Struktura repozytorium

```
apps/
  server/     serwer Fastify, sesje, adapter Librusa
  web/        aplikacja React (Vite)
packages/
  core/       czysta logika i statystyki bez wejścia i wyjścia
docs/
  PLAN.md     pełny plan budowy
  decisions/  krótkie notatki o ważnych decyzjach
AGENTS.md     zasady dla agentów AI i programistów
```

## Rozwój

```bash
npm ci
npm run dev          # serwer i frontend w trybie watch
npm run check        # lint, typecheck, testy i audyt
npm test
npm run test:e2e     # testy Playwright w trybie demo
```

Podczas pracy używaj trybu demo. Nie potrzebujesz prawdziwego konta Librus, żeby rozwijać większość projektu. Serwer udostępnia demonstracyjny `POST /api/session`, który przyjmuje wyłącznie JSON `{"demo":true}` i tworzy sesję z danymi syntetycznymi; logowanie do Librusa nie jest jeszcze dostępne. Po zalogowaniu demo `GET /api/attendance` i `GET /api/grades` zwracają surowe, znormalizowane rekordy. `POST /api/refresh` odświeża pamięć podręczną, która żyje trzy minuty; ręczne odświeżenie ma limit jednej próby na minutę. Endpointy podsumowań statystyk powstaną po ustaleniu przepływu ustawień szkoły.

## Jak kontrybuować

Cieszymy się z każdej pomocy, od literówki w README po nową funkcję.

### Zanim zaczniesz

* Przeczytaj [`AGENTS.md`](AGENTS.md) i [`docs/PLAN.md`](docs/PLAN.md). Zawierają zasady bezpieczeństwa i plan prac.
* Poszukaj istniejącego zgłoszenia. Jeśli go nie ma, utwórz nowe i opisz pomysł, zanim napiszesz dużo kodu.
* Przy większych zmianach najpierw dogadaj kierunek w zgłoszeniu.

### Zgłaszanie błędów i pomysłów

* Opisz, co zrobiłeś, czego oczekiwałeś i co się stało.
* **Nigdy nie wklejaj loginu, hasła, ocen, nazwisk ani innych prawdziwych danych.** Używaj trybu demo albo opisu słownego. Zrzuty ekranu z prawdziwego konta zakryj lub zrób w trybie demo.
* Jeśli aplikacja przestała działać po zmianie w Librusie, napisz, która funkcja zawiodła i jaki komunikat błędu się pojawił.

### Wysyłanie zmian

1. Zrób fork repozytorium i utwórz gałąź, na przykład `feat/nazwa-funkcji` albo `fix/nazwa-bledu`.
2. Wprowadź zmiany. Trzymaj się konwencji z `AGENTS.md`, czyli TypeScript w trybie strict, brak `any`, walidacja przez zod i testy dla nowej logiki.
3. Uruchom `npm run check`. Wszystko musi przejść.
4. Pisz commity według Conventional Commits, na przykład `feat(core) dodaj bufor nieobecności`.
5. Otwórz Pull Request, wypełnij szablon i połącz go ze zgłoszeniem. Jeden PR powinien dotyczyć jednej rzeczy.
6. Odpowiedz na uwagi z review. Zmiany dotykające bezpieczeństwa są sprawdzane szczególnie dokładnie.

### Dodawanie zestawu ustawień dla typu szkoły lub konkretnej szkoły

Jeśli znasz zasady swojej szkoły, możesz dodać gotowy zestaw ustawień w folderze `packages/core/presets/community/`.

* Zacznij od wyeksportowania ustawień z aplikacji do pliku JSON.
* Usuń z pliku wszystko, co mogłoby identyfikować konkretną osobę. Powinny zostać tylko zasady, bez nazwisk i prywatnych danych.
* W opisie PR podaj, skąd pochodzą wartości, na przykład z którego paragrafu statutu.
* Skrypt walidacji sprawdzi plik automatycznie.

### Zasady, które obowiązują zawsze

* Żadnych haseł, danych osobowych i prawdziwych danych szkolnych w kodzie, testach, logach i zrzutach ekranu.
* Żadnych nowych zewnętrznych połączeń sieciowych poza Librusem.
* Nowa zależność wymaga uzasadnienia w PR.
* Aplikacja pozostaje tylko do odczytu.
* Żadnych założeń na sztywno o typie szkoły, statucie czy skali ocen. Wszystko pochodzi z profilu szkoły.
* Dotrzymujemy kodeksu postępowania w pliku `CODE_OF_CONDUCT.md`.

### Wkład z pomocą AI

Możesz korzystać z narzędzi AI, na przykład GitHub Copilota, ale odpowiadasz za każdą linię w swoim PR. Agenci muszą przestrzegać `AGENTS.md`. Nie podawaj narzędziom AI prawdziwych danych logowania ani prawdziwych danych z dziennika.

## Zgłaszanie luk w bezpieczeństwie

Nie zgłaszaj luk jako publicznych zgłoszeń. Użyj prywatnego zgłoszenia w zakładce Security repozytorium na GitHubie (Report a vulnerability). Opis procesu jest w `SECURITY.md`.

## Roadmapa

* [ ] v0.1.0 logowanie lokalne, tryb demo, kreator i ustawienia szkoły, frekwencja ogólna i per przedmiot, czerwone podświetlenie
* [ ] v0.2.0 bufor nieobecności, kalkulator powrotu nad próg, symulator, trendy
* [ ] v0.3.0 średnie ważone, symulator ocen, kalkulator oceny docelowej, wykresy, praktyki zawodowe i skale punktowe
* [ ] v0.4.0 widok sprawdzianów i prac domowych, eksport CSV i wydruk, tłumaczenie na angielski, zestawy ustawień społeczności
* [ ] Później nowy wygląd na podstawie projektu w Figmie

Pełne zadania znajdziesz w [`docs/PLAN.md`](docs/PLAN.md).

## Licencja

Projekt jest dostępny na licencji MIT, szczegóły w pliku [`LICENSE`](LICENSE).

## Podziękowania i zastrzeżenia

* Dziękujemy autorowi i społeczności [`librus-api`](https://github.com/Mati365/librus-api) (Mateusz Bagiński, licencja MIT) za bibliotekę, na której opiera się ta aplikacja.
* To jest niezależny projekt społecznościowy. Nie jest oficjalnym produktem Librus ani Synergia.
* Oprogramowanie jest udostępniane "tak jak jest", bez żadnej gwarancji. Statystyki mają charakter pomocniczy i nie zastępują informacji z dziennika ani ustaleń ze szkołą.
