// Baixa as fontes usadas nas legendas para storage/fonts (usadas pelo libass no ffmpeg).
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage", "fonts");
fs.mkdirSync(dir, { recursive: true });

const FONTS = {
  "Montserrat-Black.ttf": "https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
  "Anton-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf",
  "BebasNeue-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf",
  "LuckiestGuy-Regular.ttf": "https://github.com/google/fonts/raw/main/apache/luckiestguy/LuckiestGuy-Regular.ttf",
  "TitanOne-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/titanone/TitanOne-Regular.ttf",
  "Bungee-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/bungee/Bungee-Regular.ttf",
  "BowlbyOne-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/bowlbyone/BowlbyOne-Regular.ttf",
  "Oswald.ttf": "https://github.com/google/fonts/raw/main/ofl/oswald/Oswald%5Bwght%5D.ttf",
  "Poppins-Black.ttf": "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Black.ttf",
  "Inter.ttf": "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
};

for (const [name, url] of Object.entries(FONTS)) {
  const out = path.join(dir, name);
  if (fs.existsSync(out) && fs.statSync(out).size > 10_000) {
    console.log("ok   ", name);
    continue;
  }
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(out, buf);
    console.log("baixou", name, (buf.length / 1024).toFixed(0) + "KB");
  } catch (e) {
    console.warn("falhou", name, e.message);
  }
}
console.log("Fontes em", dir);
