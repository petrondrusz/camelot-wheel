# Camelot kolo · kytarový tahák

Interaktivní Camelot wheel pro kytaristy. Klepnutím na kód tóniny (např. `10A` ze Spotify)
se zobrazí název tóniny, kompatibilní tóniny pro plynulou harmonickou návaznost
a poloha základního tónu na strunách E a A.

## Pravidla harmonického mixu

- **±1, stejné písmeno** — sousední kvinta na kvintovém kruhu
- **stejné číslo, A↔B** — relativní dur/moll
- **stejný kód** — stejná tónina

## Stack

Čistá statika: HTML + CSS + vanilla JS. Žádný build, žádné závislosti.
PWA manifest — na telefonu lze přidat na plochu (Add to Home Screen).

## Lokální spuštění

```bash
npx serve .
```

## Deploy

Hostováno na Vercelu jako statický web. Po propojení s GitHub repozitářem
se každý push do `main` nasadí automaticky.
