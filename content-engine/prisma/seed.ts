import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "데모 사용자", passwordHash: await bcrypt.hash("demo1234!", 10) },
  });
  const ws = await prisma.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: { slug: "demo", name: "데모 워크스페이스", members: { create: { userId: user.id, role: "OWNER" } } },
  });
  console.log(`seed 완료: ${email} / demo1234! → /w/${ws.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
