import "dotenv/config";
import { hashPassword } from "../server/auth";
import { storage } from "../server/storage";

const DEV_EMAIL = "dev@example.com";
const DEV_PASSWORD = "password123";
const DEV_NAME = "Dev User";

async function seedDevUser() {
  try {
    // Check if user already exists
    const existing = await storage.getUserByUsername(DEV_EMAIL);
    if (existing) {
      console.log(`✓ Dev user already exists: ${DEV_EMAIL}`);
      console.log(`  Password: ${DEV_PASSWORD}`);
      process.exit(0);
    }

    // Create the dev user
    const hashedPassword = await hashPassword(DEV_PASSWORD);
    const user = await storage.createUser({
      username: DEV_EMAIL,
      password: hashedPassword,
      fullName: DEV_NAME,
    });

    console.log(`✓ Dev user created successfully`);
    console.log(`  Email: ${DEV_EMAIL}`);
    console.log(`  Password: ${DEV_PASSWORD}`);
    console.log(`  User ID: ${user.id}`);
    process.exit(0);
  } catch (error: any) {
    console.error("✗ Failed to create dev user:", error.message);
    process.exit(1);
  }
}

seedDevUser();
