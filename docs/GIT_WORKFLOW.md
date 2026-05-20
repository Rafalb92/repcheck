# START DNIA / NOWY FEATURE

git checkout main
git pull
git checkout -b feat/krotka-nazwa

# W TRAKCIE PRACY (rób często)

git status
git add -A
git commit -m "feat: opis"

# KONIEC PRACY (push + PR)

git push -u origin feat/krotka-nazwa

# → GitHub: PR → Review → Squash and merge → Delete branch

# PO MERGE (sprzątanie)

git checkout main
git pull
git branch -d feat/krotka-nazwa
