# Birthday Calendar

Aplicație PWA statică pentru aniversări, bilingvă RO/RU, cu Apple Liquid Glass și integrare Calendar iPhone.

## Funcții

- profil personal și mod public/privat (datele rămân locale);
- adăugare, editare și ștergere persoane, inclusiv fotografii;
- filtre după relație, lună și următoarele 30 de zile;
- calendar anual și alerte iPhone cu 30, 7 și 1 zi înainte;
- felicitări RO/RU pentru WhatsApp, Telegram și Share Sheet;
- idei de cadouri, interese, buget și statistici;
- backup/restaurare JSON;
- temă luminoasă, întunecată sau automată;
- instalare PWA și funcționare offline.

Datele utilizatorului sunt păstrate în `localStorage` și nu sunt incluse în repository sau trimise către un server.

## Cloudflare Pages

- Production branch: `main`
- Framework preset: `None`
- Build command: lăsat gol
- Build output directory: `/`

Fiecare modificare publicată în `main` declanșează automat un nou deployment.
