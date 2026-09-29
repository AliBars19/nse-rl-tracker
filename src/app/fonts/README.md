# Fonts

Self-hosted Latin subsets (woff2) of the design's typefaces, loaded with `next/font/local`
in `src/app/layout.tsx`:

- Chakra Petch 500 / 600 / 700 (display): SIL Open Font License 1.1, see `OFL-ChakraPetch.txt`
- IBM Plex Sans 400 / 500 / 600 and IBM Plex Mono 500 / 600: SIL Open Font License 1.1, see `OFL-IBMPlex.txt`

Downloaded from Google Fonts. They are self-hosted so builds don't depend on fonts.googleapis.com
(Vercel builds failed resolving Google Fonts URLs with Turbopack).
