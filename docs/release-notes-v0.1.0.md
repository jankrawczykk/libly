# Libly v0.1.0

Pierwsze wydanie Libly — lokalnej aplikacji pokazującej statystyki frekwencji
z Librus Synergia.

## Najważniejsze funkcje

- ogólna frekwencja i frekwencja dla każdego przedmiotu,
- statusy progów krytycznych i ostrzegawczych z ikoną oraz opisem,
- przełączanie semestru i całego roku,
- kreator pierwszego uruchomienia oraz edytowalny profil szkoły,
- tryb demo na sztucznych danych,
- wylogowanie i wygaszanie sesji,
- produkcyjne serwowanie z restrykcyjną polityką CSP,
- dokumentacja modelu prywatności i [weryfikacja lokalnego działania](./how-to-verify-local.md).

## Bezpieczeństwo i prywatność

Serwer domyślnie nasłuchuje wyłącznie na `127.0.0.1`. Hasła nie są
zapisywane, a dane sesji są przechowywane tylko w pamięci. Przed użyciem
przeczytaj ostrzeżenie dotyczące nieoficjalnego korzystania z Librus Synergia
w [README](../README.md).

Do bezpiecznego wypróbowania wydania użyj trybu demo. Nie umieszczaj prawdziwych
danych logowania ani danych uczniów w zgłoszeniach, logach lub zrzutach ekranu.
