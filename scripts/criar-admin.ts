// Cria (ou reseta) a conta de teste local do Cortix.
// Uso: npx tsx scripts/criar-admin.ts [usuario] [senha]
// Padrao: admin / 12345 — conta de DESENVOLVIMENTO, nao usar em producao.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ulid } from "ulid";

const db = new PrismaClient();

async function main() {
  const login = (process.argv[2] ?? "admin").toLowerCase().trim();
  const senha = process.argv[3] ?? "12345";
  const passwordHash = await bcrypt.hash(senha, 10);

  const existente = await db.user.findUnique({ where: { email: login } });

  if (existente) {
    await db.user.update({
      where: { id: existente.id },
      data: { passwordHash, credits: 5000, plan: "viral", planCycle: "yearly" },
    });
    console.log(`Senha redefinida para o usuario "${login}".`);
  } else {
    await db.user.create({
      data: {
        id: ulid(),
        name: "Admin",
        email: login,
        passwordHash,
        credits: 5000,
        referralCode: `ADMIN${ulid().slice(-6)}`,
        plan: "viral",
        planCycle: "yearly",
        planRenewsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`Usuario "${login}" criado.`);
  }

  console.log(`Entre em http://localhost:3001/login com ${login} / ${senha}`);
  console.log("5000 creditos e plano viral, para testar sem marca d'agua.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
