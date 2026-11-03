# Jak sprawdzić, że Libly działa lokalnie

Libly jest aplikacją lokalną. Możesz samodzielnie sprawdzić, że przeglądarka
łączy się wyłącznie z serwerem na Twoim komputerze.

## Sprawdzenie w przeglądarce

1. Uruchom aplikację poleceniami `npm ci`, `npm run build` i `npm start`.
2. Otwórz `http://127.0.0.1:3000` i włącz narzędzia deweloperskie.
3. Przejdź do zakładki **Sieć (Network)** i odśwież stronę.
4. Sprawdź adresy wszystkich żądań. Powinny wskazywać `127.0.0.1` oraz port
   aplikacji. Aplikacja nie powinna ładować zasobów z CDN, zewnętrznych czcionek
   ani usług analitycznych.
5. Wybierz tryb demo, aby wykonać żądania aplikacji bez używania danych
   logowania i bez łączenia z Librusem.

Możesz również przejrzeć kod źródłowy i uruchomić automatyczne sprawdzenia:

```bash
npm run check
npm run test:e2e
```

Nie wystawiaj serwera publicznie. Zmiana `HOST` na adres inny niż
`127.0.0.1` wymaga flagi `--i-understand-the-risks` i wyświetla ostrzeżenie
bezpieczeństwa.
