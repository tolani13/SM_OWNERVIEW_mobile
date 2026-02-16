import "dotenv/config";
import { storage } from "../server/storage";

async function seedPolicies() {
  console.log("🌱 Seeding policies and policy agreements...");

  const policySeeds = [
    {
      name: "Liability Waiver",
      content:
        "I acknowledge and accept the risks associated with dance training and participation in classes, rehearsals, and performances.",
      requiresSignature: true,
      active: true,
      documentVersion: "1.0",
    },
    {
      name: "Photo & Video Release",
      content:
        "I grant Studio Maestro permission to photograph and record my dancer for studio-related promotional and educational purposes.",
      requiresSignature: true,
      active: true,
      documentVersion: "1.0",
    },
    {
      name: "Tuition & Attendance Policy",
      content:
        "Tuition is due monthly. Make-up classes are subject to availability. Competition team attendance is required for rehearsals.",
      requiresSignature: true,
      active: true,
      documentVersion: "1.0",
    },
  ];

  const existingPolicies = await storage.getPolicies();
  let createdPolicies = 0;

  for (const seed of policySeeds) {
    const exists = existingPolicies.find((p) => p.name === seed.name);
    if (!exists) {
      await storage.createPolicy(seed as any);
      createdPolicies += 1;
    }
  }

  const policies = await storage.getPolicies();
  const dancers = await storage.getDancers();
  const existingAgreements = await storage.getPolicyAgreements();
  const dancersToSign = dancers.slice(0, Math.min(4, dancers.length));

  let createdAgreements = 0;

  for (const policy of policies) {
    for (const dancer of dancersToSign) {
      const exists = existingAgreements.find(
        (agreement) => agreement.policyId === policy.id && agreement.dancerId === dancer.id,
      );

      if (!exists) {
        await storage.createPolicyAgreement({
          policyId: policy.id,
          dancerId: dancer.id,
          signedBy:
            dancer.parentName || `${dancer.firstName} ${dancer.lastName} Guardian`,
          documentVersion: policy.documentVersion,
        } as any);
        createdAgreements += 1;
      }
    }
  }

  console.log(`✅ Policies seeded. created=${createdPolicies}, total=${policies.length}`);
  console.log(
    `✅ Policy agreements seeded. created=${createdAgreements}, total=${(
      await storage.getPolicyAgreements()
    ).length}`,
  );
}

seedPolicies().catch((error) => {
  console.error("❌ Policy seed failed:", error);
  process.exit(1);
});
