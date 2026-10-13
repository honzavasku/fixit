/* ==========================================================================
   config.example.js – vzor konfigurace FixIt
   --------------------------------------------------------------------------
   1. Zkopíruj tento soubor jako config.js (cp config.example.js config.js).
   2. Vyplň hodnoty. Nechané prázdné = aplikace běží v záložním režimu
      (lokální data, OpenStreetMap + Nominatim).

   !! Do prohlížeče patří JEN veřejné klíče:
      - Supabase "anon" / "publishable" klíč (chrání ho Row Level Security),
      - klíč Mapy.com (v konzoli developer.mapy.com ho omez na svou doménu).
   !! Klíč "service_role" ani žádné jiné tajné klíče sem NIKDY nevkládej.
   ========================================================================== */
window.FIXIT_CONFIG = {
  // Supabase → Project Settings → API → Project URL
  SUPABASE_URL: '',
  // Supabase → Project Settings → API → anon public key
  SUPABASE_ANON_KEY: '',
  // developer.mapy.com → API klíč (dlaždice + geokódování + našeptávání)
  MAPY_API_KEY: '',
};
