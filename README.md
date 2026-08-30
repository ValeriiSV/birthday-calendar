# Birthday Calendar

Aplicație PWA statică pentru aniversări, bilingvă RO/RU, cu Apple Liquid Glass și integrare Calendar iPhone.

## Funcții

- cont personal (email + parolă) cu resetare a parolei prin email, sau folosire fără cont (doar local);
- profil personal și mod public/privat — modul public generează un link accesibil oricui, doar-citire;
- adăugare, editare și ștergere persoane, inclusiv fotografii;
- filtre după relație, lună și următoarele 30 de zile;
- calendar anual și alerte iPhone cu 30, 7 și 1 zi înainte;
- felicitări RO/RU pentru WhatsApp, Telegram și Share Sheet;
- idei de cadouri, interese, buget și statistici;
- backup/restaurare JSON;
- temă luminoasă, întunecată sau automată;
- instalare PWA și funcționare offline.

Fără cont, datele rămân doar în `localStorage`, pe dispozitiv. Cu cont, datele sunt salvate și în Firestore (Firebase), ca să nu se piardă și ca modul public să poată funcționa. Linkul public expune aniversările **fără numerele de telefon**.

## Configurare cont (Firebase)

Autentificarea și modul public folosesc [Firebase](https://firebase.google.com) (Authentication + Firestore), gratuit la acest nivel de utilizare.

1. Creează un proiect nou pe [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Get started → activează furnizorul **Email/Password**.
3. **Firestore Database** → Create database → pornește în modul implicit (production).
4. **Firestore → Rules** → copiază conținutul fișierului [`firestore.rules`](./firestore.rules) din acest repo și publică-l.
5. **Project settings** (⚙︎) → în secțiunea "Your apps" → adaugă o aplicație web → copiază obiectul de configurare.
6. Lipește valorile copiate în [`firebase-config.js`](./firebase-config.js) din acest repo, în locul textelor `YOUR_...`.
7. **Authentication → Settings → Authorized domains** → adaugă domeniul de pe Cloudflare Pages (ex. `nume-proiect.pages.dev` și domeniul propriu, dacă ai).
8. Publică modificările pe branch-ul `main` — Cloudflare Pages redeployează automat.

Fără pașii de mai sus, aplicația funcționează normal, dar doar local (fără cont, fără modul public) — nu se blochează nimic.

## Cloudflare Pages

- Production branch: `main`
- Framework preset: `None`
- Build command: lăsat gol
- Build output directory: `/`

Fiecare modificare publicată în `main` declanșează automat un nou deployment.
