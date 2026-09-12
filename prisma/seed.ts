import { PrismaClient, RoleKey } from "@prisma/client";
import { hash, Algorithm } from "@node-rs/argon2";
import { randomBytes, createHash } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("Password123!", { algorithm: Algorithm.Argon2id });

  const user = await prisma.user.upsert({
    where: { email: "demo@authforge.dev" },
    update: {},
    create: {
      email: "demo@authforge.dev",
      name: "Demo User",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "acme-inc" },
    update: {},
    create: {
      name: "Acme Inc.",
      slug: "acme-inc",
      members: { create: { userId: user.id, role: RoleKey.OWNER, joinedAt: new Date() } },
    },
  });

  const clientSecret = `secret_${randomBytes(24).toString("base64url")}`;
  await prisma.application.upsert({
    where: { clientId: "client_demo_saas" },
    update: {},
    create: {
      name: "My SaaS (demo)",
      clientId: "client_demo_saas",
      clientSecretHash: createHash("sha256").update(clientSecret).digest("hex"),
      ownerId: user.id,
      organizationId: org.id,
      redirectUrls: ["http://localhost:3000/demo"],
    },
  });

  console.log("Seed complete.");
  console.log("  Demo login: demo@authforge.dev / Password123!");
  console.log(`  Demo org:   ${org.name} (${org.slug})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
