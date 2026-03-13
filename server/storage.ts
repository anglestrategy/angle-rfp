import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  rfpAnalyses,
  users,
  type InsertRfpAnalysis,
  type InsertUser,
  type RfpAnalysis,
  type User,
} from "@shared/schema";

export interface IStorage {
  createUser(data: InsertUser & { fullName?: string | null }): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createAnalysis(data: InsertRfpAnalysis): Promise<RfpAnalysis>;
  getAnalysis(id: number): Promise<RfpAnalysis | undefined>;
  getAnalysisForUser(id: number, userId: string): Promise<RfpAnalysis | undefined>;
  getAllAnalyses(): Promise<RfpAnalysis[]>;
  getAllAnalysesForUser(userId: string): Promise<RfpAnalysis[]>;
  updateAnalysis(id: number, data: Partial<RfpAnalysis>): Promise<RfpAnalysis | undefined>;
  deleteAnalysis(id: number): Promise<void>;
  deleteAnalysisForUser(id: number, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createUser(data: InsertUser & { fullName?: string | null }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        username: data.username,
        password: data.password,
        fullName: data.fullName ?? null,
      })
      .returning();
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()));
    return user;
  }

  async createAnalysis(data: InsertRfpAnalysis): Promise<RfpAnalysis> {
    const [analysis] = await db.insert(rfpAnalyses).values(data).returning();
    return analysis;
  }

  async getAnalysis(id: number): Promise<RfpAnalysis | undefined> {
    const [analysis] = await db.select().from(rfpAnalyses).where(eq(rfpAnalyses.id, id));
    return analysis;
  }

  async getAnalysisForUser(id: number, userId: string): Promise<RfpAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(rfpAnalyses)
      .where(and(eq(rfpAnalyses.id, id), eq(rfpAnalyses.userId, userId)));
    return analysis;
  }

  async getAllAnalyses(): Promise<RfpAnalysis[]> {
    return await db.select().from(rfpAnalyses).orderBy(desc(rfpAnalyses.createdAt));
  }

  async getAllAnalysesForUser(userId: string): Promise<RfpAnalysis[]> {
    return await db
      .select()
      .from(rfpAnalyses)
      .where(eq(rfpAnalyses.userId, userId))
      .orderBy(desc(rfpAnalyses.createdAt));
  }

  async updateAnalysis(id: number, data: Partial<RfpAnalysis>): Promise<RfpAnalysis | undefined> {
    const [analysis] = await db.update(rfpAnalyses).set(data).where(eq(rfpAnalyses.id, id)).returning();
    return analysis;
  }

  async deleteAnalysis(id: number): Promise<void> {
    await db.delete(rfpAnalyses).where(eq(rfpAnalyses.id, id));
  }

  async deleteAnalysisForUser(id: number, userId: string): Promise<void> {
    await db
      .delete(rfpAnalyses)
      .where(and(eq(rfpAnalyses.id, id), eq(rfpAnalyses.userId, userId)));
  }
}

export const storage = new DatabaseStorage();
