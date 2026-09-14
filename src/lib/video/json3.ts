import fs from "node:fs";
import { wordsFromJson3, type Word } from "./transcript";

/** Lê um arquivo json3 do YouTube (legendas automáticas) e devolve palavras com tempo. */
export function parseJson3(file: string): Word[] {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return wordsFromJson3(raw);
}
