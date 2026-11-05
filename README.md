# Kdo je kriv?

Brezplačna spletna aplikacija za zabavo. Dve osebi, najpogosteje par, vsaka zase opišeta vsakdanji prepir, AI sodnik pa suhoparno uradno razsodi, kdo je kriv: naslov, delež krivde v odstotkih, kratka obrazložitev in nedolžna kazen.

Aplikacija ne daje pravnih nasvetov. Besedilo obdela Claude API (Anthropic). Zadeve se samodejno izbrišejo po 7 dneh.

## Kako deluje

1. Prva oseba brez prijave vpiše svoje ime, ime druge osebe, zadevo in svojo plat zgodbe.
2. AI pregleda, ali vnos vsebuje resno temo (nasilje, zloraba, samopoškodovanje …). Če jo, zadeva ni ustvarjena, prikažejo se številke za pomoč.
3. Prva oseba dobi povezavo za drugo osebo in svojo zasebno povezavo s ključem (`#k=…`).
4. Druga oseba pred oddajo vidi samo zadevo in imeni, nikoli izjave prve osebe.
5. Ko odda svojo izjavo, sodnik takoj razsodi. Čakalna stran prve osebe se osvežuje sama.
6. Šele ob razsodbi sta vidni obe izjavi. Razsodbo lahko prenesete kot sliko 1080 × 1350 (brez izjav), prijavite ali izbrišete.

## Tehnologija

- Next.js 16 (App Router) in TypeScript
- PostgreSQL prek paketa `pg`; tabele se ustvarijo samodejno ob prvi uporabi
- Anthropic SDK, privzeti model `claude-haiku-5-5`, odgovor s prisiljenim klicem orodja
- Slika razsodbe prek `next/og`; pisave IBM Plex (licenca OFL) so v `assets/fonts`, zato se č, š in ž izpišejo pravilno

## Lokalni zagon

Potrebuješ Node.js 20.9 ali novejši in PostgreSQL.

```bash
npm install
cp .env.example .env.local      # nato izpolni vrednosti
npm run dev
```

Aplikacija teče na <http://localhost:3000>. Baza mora obstajati (npr. `createdb kdojekriv`), tabele pa se ustvarijo same.

Pred objavo:

```bash
npm run typecheck
npm run build
npm start                       # produkcijski strežnik na PORT (privzeto 3000), posluša na 0.0.0.0
```

### Okoljske spremenljivke

| Spremenljivka | Obvezna | Opis |
| --- | --- | --- |
| `DATABASE_URL` | da | Povezava do PostgreSQL. |
| `ANTHROPIC_API_KEY` | da | Ključ za Claude API. Uporablja se samo na strežniku. |
| `IP_SALT` | da | Dolg naključen niz. IP naslovi se shranijo le kot zgoščena vrednost s to soljo. Ustvariš ga npr. z `openssl rand -hex 32`. |
| `ANTHROPIC_MODEL` | ne | Drug model. Model mora podpirati prisiljeni `tool_choice` (`claude-haiku-5-5` ga podpira, Claude Opus 5.5 in Sonnet 5.5 ne). |
| `IP_DAILY_LIMIT` | ne | Največ oddaj na IP na dan, privzeto 15. |
| `AI_DAILY_LIMIT` | ne | Največ klicev AI na dan za vso aplikacijo, privzeto 200. |

Dnevi se štejejo po slovenskem času. Števci so v tabeli `usage_counters`.

## Objava na Railwayu

1. **Nova storitev iz GitHuba.** Na [railway.com](https://railway.com) izberi *New Project → Deploy from GitHub repo* in izberi repozitorij `AI-sodnik`. Railway prebere `railway.json`: zgradi z `npm run build`, zažene z `npm run start` in preverja zdravje na `/api/health`.
2. **Dodaj Postgres.** V istem projektu izberi *+ New → Database → PostgreSQL*.
3. **Nastavi spremenljivke.** V storitvi aplikacije odpri *Variables* in dodaj:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (sklic na bazo v istem projektu)
   - `ANTHROPIC_API_KEY` = tvoj ključ iz [console.anthropic.com](https://console.anthropic.com)
   - `IP_SALT` = dolg naključen niz

   `PORT` nastavi Railway sam, strežnik pa posluša na `0.0.0.0`.
4. **Javna domena.** V storitvi aplikacije odpri *Settings → Networking → Generate Domain*. Dobiš naslov `….up.railway.app`, ki ga lahko deliš s prijatelji.
5. Po spremembi spremenljivk Railway storitev znova objavi. Vsak `git push` na `main` sproži novo objavo.

Railway nastavi glavo `X-Real-IP`, iz katere aplikacija bere IP za omejitve.

## Varnost in zasebnost

- ID zadeve ima 128 naključnih bitov, ključ prve osebe 192. Ključ je v delu povezave za `#`, zato ga brskalnik ne pošlje strežniku v naslovu, ampak v glavi `x-case-key`. V bazi je shranjena samo njegova zgoščena vrednost.
- Druga oseba ob oddaji dobi svoj ključ, s katerim lahko zadevo izbriše ali ponovno zahteva razsodbo.
- API pred razsodbo nikoli ne vrne izjave druge strani.
- Če je resna tema zaznana šele ob razsodbi, ali če model odgovor zavrne, se obe izjavi, imeni in zadeva takoj izbrišejo in nobena stran jih ne vidi več.
- Če klic modela ne uspe, se razsodba ne izda, izjavi ostaneta shranjeni in stranki lahko poskusita znova.
- Prevzem zadeve za razsojanje je atomaren. Prevzem, ki obtiči več kot 2 minuti, se sprosti.
- Uporabniško besedilo je v pozivu ločeno z oznakami, znaka `<` in `>` sta nevtralizirana, model pa ga obravnava kot podatke.
- Zastarane zadeve se brišejo ob vsaki novi oddaji in se nikoli ne prikažejo. Prijave se hranijo 30 dni.
- Strani imajo `Referrer-Policy: no-referrer` in `noindex`. Izjave se ne izpisujejo v loge.

### Pregled prijav

Administratorske plošče ni. Prijave si ogledaš neposredno v bazi (na Railwayu v zavihku *Data* pri Postgresu):

```sql
SELECT created_at, case_id, reason, verdict FROM reports ORDER BY created_at DESC;
```

## Struktura

```
app/                  strani in API poti (app/api/cases/…)
components/           odjemalske komponente vmesnika
lib/ai.ts             pozivi, orodja in klici Claude API
lib/cases.ts          stanja zadeve, vloge, atomarni prevzem, brisanje
lib/db.ts             povezava in samodejna shema
lib/limits.ts         dnevne omejitve v Postgresu
lib/validation.ts     omejitve dolžine in čiščenje vnosa
assets/fonts/         pisave IBM Plex (OFL)
railway.json          nastavitve za Railway
```
