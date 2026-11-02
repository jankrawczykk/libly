# Jak kontrybuować

Cieszymy się z każdej pomocy, od literówki w README po nową funkcję.

## Zanim zaczniesz

* Przeczytaj [`AGENTS.md`](AGENTS.md) i [`docs/PLAN.md`](docs/PLAN.md). Zawierają zasady bezpieczeństwa i plan prac.
* Poszukaj istniejącego zgłoszenia. Jeśli go nie ma, utwórz nowe i opisz pomysł, zanim napiszesz dużo kodu.
* Przy większych zmianach najpierw dogadaj kierunek w zgłoszeniu.

## Zgłaszanie błędów i pomysłów

* Opisz, co zrobiłeś, czego oczekiwałeś i co się stało.
* **Nigdy nie wklejaj loginu, hasła, ocen, nazwisk ani innych prawdziwych danych.** Używaj trybu demo albo opisu słownego. Zrzuty ekranu z prawdziwego konta zakryj lub zrób w trybie demo.
* Jeśli aplikacja przestała działać po zmianie w Librusie, napisz, która funkcja zawiodła i jaki komunikat błędu się pojawił.

## Wysyłanie zmian

1. Zrób fork repozytorium i utwórz gałąź, na przykład `feat/nazwa-funkcji` albo `fix/nazwa-bledu`.
2. Wprowadź zmiany. Trzymaj się konwencji z `AGENTS.md`, czyli TypeScript w trybie strict, brak `any`, walidacja przez zod i testy dla nowej logiki.
3. Uruchom `npm run check`. Wszystko musi przejść.
4. Pisz commity według Conventional Commits, na przykład `feat(core) dodaj bufor nieobecności`.
5. Otwórz Pull Request, wypełnij szablon i połącz go ze zgłoszeniem. Jeden PR powinien dotyczyć jednej rzeczy.
6. Odpowiedz na uwagi z review. Zmiany dotykające bezpieczeństwa są sprawdzane szczególnie dokładnie.

## Dodawanie zestawu ustawień dla typu szkoły lub konkretnej szkoły

Jeśli znasz zasady swojej szkoły, możesz dodać gotowy zestaw ustawień w folderze `packages/core/presets/community/`.

* Zacznij od wyeksportowania ustawień z aplikacji do pliku JSON.
* Usuń z pliku wszystko, co mogłoby identyfikować konkretną osobę. Powinny zostać tylko zasady, bez nazwisk i prywatnych danych.
* W opisie PR podaj, skąd pochodzą wartości, na przykład z którego paragrafu statutu.
* Skrypt walidacji sprawdzi plik automatycznie.

## Zasady, które obowiązują zawsze

* Żadnych haseł, danych osobowych i prawdziwych danych szkolnych w kodzie, testach, logach i zrzutach ekranu.
* Żadnych nowych zewnętrznych połączeń sieciowych poza Librusem.
* Nowa zależność wymaga uzasadnienia w PR.
* Aplikacja pozostaje tylko do odczytu.
* Żadnych założeń na sztywno o typie szkoły, statucie czy skali ocen. Wszystko pochodzi z profilu szkoły.
* Dotrzymujemy kodeksu postępowania w pliku `CODE_OF_CONDUCT.md`.

## Wkład z pomocą AI

Możesz korzystać z narzędzi AI, na przykład GitHub Copilota, ale odpowiadasz za każdą linię w swoim PR. Agenci muszą przestrzegać `AGENTS.md`. Nie podawaj narzędziom AI prawdziwych danych logowania ani prawdziwych danych z dziennika.
