@echo off
npx -y create-next-app@14 fin-family --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
xcopy /E /I /H /Y fin-family .
rd /S /Q fin-family
