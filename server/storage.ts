import crypto from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  agencyProfiles,
  clientMemory,
  credentialSuggestions,
  emailVerificationTokens,
  pursuitDecisions,
  pursuitOutcomes,
  rfpAnalyses,
  users,
  workspaceCredentials,
  workspaceDomains,
  workspaceMemberships,
  workspacePreferencesHistory,
  workspaces,
  type AgencyProfile,
  type ClientMemory,
  type CredentialSuggestion,
  type InsertRfpAnalysis,
  type InsertUser,
  type PursuitDecision,
  type PursuitOutcome,
  type RfpAnalysis,
  type User,
  type Workspace,
  type WorkspaceCredential,
  type WorkspaceMembership,
} from "@shared/schema";

export interface WorkspaceContext {
  workspace: Workspace;
  membership: WorkspaceMembership;
  profile: AgencyProfile | null;
}

export interface IStorage {
  createUser(data: InsertUser & { fullName?: string | null }): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  markUserEmailVerified(userId: string): Promise<User | undefined>;
  createEmailVerificationToken(userId: string, email: string): Promise<string>;
  consumeEmailVerificationToken(token: string): Promise<User | null>;
  createOrJoinWorkspaceForUser(user: User): Promise<WorkspaceContext>;
  getWorkspaceContextForUser(userId: string): Promise<WorkspaceContext | null>;
  getWorkspaceById(id: string): Promise<Workspace | undefined>;
  getAgencyProfileForWorkspace(workspaceId: string): Promise<AgencyProfile | undefined>;
  updateAgencyProfile(workspaceId: string, calibration: any, status?: string): Promise<AgencyProfile>;
  listWorkspaceCredentials(workspaceId: string): Promise<WorkspaceCredential[]>;
  createWorkspaceCredential(workspaceId: string, input: Partial<WorkspaceCredential> & { title: string; caseStudyText: string }): Promise<WorkspaceCredential>;
  updateWorkspaceCredential(id: number, workspaceId: string, input: Partial<WorkspaceCredential>): Promise<WorkspaceCredential | undefined>;
  listCredentialSuggestions(workspaceId: string): Promise<CredentialSuggestion[]>;
  createCredentialSuggestion(workspaceId: string, input: { sourceAnalysisId?: number | null; sourceNote?: string | null; extractedSummary: string; proposedTags?: string[]; approvalStatus?: string; }): Promise<CredentialSuggestion>;
  updateCredentialSuggestion(id: number, workspaceId: string, input: Partial<CredentialSuggestion>): Promise<CredentialSuggestion | undefined>;
  listClientMemory(workspaceId: string): Promise<ClientMemory[]>;
  updateClientMemoryById(id: number, workspaceId: string, input: Partial<ClientMemory> & { qualityRating?: string; badFitFlag?: boolean; notes?: string | null }): Promise<ClientMemory | undefined>;
  upsertClientMemory(workspaceId: string, normalizedClientKey: string, input: Partial<ClientMemory> & { qualityRating?: string; badFitFlag?: boolean; notes?: string | null }): Promise<ClientMemory>;
  createOrUpdatePursuitDecision(input: { analysisId: number; workspaceId: string; userId?: string | null; systemRecommendation: string; userDecision: string; overrideReason?: string | null; }): Promise<PursuitDecision>;
  createOrUpdatePursuitOutcome(input: { analysisId: number; workspaceId: string; outcome: string; notes?: string | null; }): Promise<PursuitOutcome>;
  getPursuitDecision(analysisId: number, workspaceId: string): Promise<PursuitDecision | undefined>;
  getPursuitOutcome(analysisId: number, workspaceId: string): Promise<PursuitOutcome | undefined>;
  createAnalysis(data: InsertRfpAnalysis): Promise<RfpAnalysis>;
  getAnalysis(id: number): Promise<RfpAnalysis | undefined>;
  getAnalysisForWorkspace(id: number, workspaceId: string): Promise<RfpAnalysis | undefined>;
  getAllAnalyses(): Promise<RfpAnalysis[]>;
  getAllAnalysesForWorkspace(workspaceId: string): Promise<RfpAnalysis[]>;
  updateAnalysis(id: number, data: Partial<RfpAnalysis>): Promise<RfpAnalysis | undefined>;
  deleteAnalysis(id: number): Promise<void>;
  deleteAnalysisForWorkspace(id: number, workspaceId: string): Promise<void>;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function slugifyDomain(domain: string) {
  return domain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function workspaceNameFromDomain(domain: string) {
  const base = domain.split(".")[0] || domain;
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export class DatabaseStorage implements IStorage {
  async createUser(data: InsertUser & { fullName?: string | null }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        username: data.username.toLowerCase(),
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

  async markUserEmailVerified(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createEmailVerificationToken(userId: string, email: string): Promise<string> {
    const token = crypto.randomBytes(24).toString("hex");
    await db.insert(emailVerificationTokens).values({
      userId,
      email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    });
    return token;
  }

  async consumeEmailVerificationToken(token: string): Promise<User | null> {
    const tokenHash = sha256(token);
    const [record] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.consumedAt),
          gt(emailVerificationTokens.expiresAt, new Date()),
        ),
      );

    if (!record) return null;

    const [user] = await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, record.userId))
      .returning();

    await db
      .update(emailVerificationTokens)
      .set({ consumedAt: new Date() })
      .where(eq(emailVerificationTokens.id, record.id));

    return user ?? null;
  }

  async createOrJoinWorkspaceForUser(user: User): Promise<WorkspaceContext> {
    const domain = user.username.split("@")[1]?.toLowerCase();
    if (!domain) {
      throw new Error("User email domain is invalid");
    }

    const existingDomain = await db
      .select()
      .from(workspaceDomains)
      .where(eq(workspaceDomains.domain, domain));
    const existingMembership = await this.getWorkspaceContextForUser(user.id);
    if (existingMembership) return existingMembership;

    let workspaceId: string;
    let role = "member";

    if (existingDomain[0]) {
      workspaceId = existingDomain[0].workspaceId;
    } else {
      const slug = slugifyDomain(domain);
      const [workspace] = await db
        .insert(workspaces)
        .values({
          name: workspaceNameFromDomain(domain),
          slug,
          primaryDomain: domain,
          onboardingStatus: "not_started",
        })
        .returning();
      workspaceId = workspace.id;
      role = "owner";

      await db.insert(workspaceDomains).values({
        workspaceId,
        domain,
        isPrimary: true,
        status: "verified",
      });

      await db.insert(agencyProfiles).values({
        workspaceId,
        calibration: {},
        status: "not_started",
      });
    }

    await db.insert(workspaceMemberships).values({
      workspaceId,
      userId: user.id,
      role,
    });

    const context = await this.getWorkspaceContextForUser(user.id);
    if (!context) throw new Error("Failed to load workspace context");
    return context;
  }

  async getWorkspaceContextForUser(userId: string): Promise<WorkspaceContext | null> {
    const [membership] = await db
      .select()
      .from(workspaceMemberships)
      .where(eq(workspaceMemberships.userId, userId))
      .orderBy(desc(workspaceMemberships.createdAt));

    if (!membership) return null;
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, membership.workspaceId));
    if (!workspace) return null;
    const profile = await this.getAgencyProfileForWorkspace(workspace.id);
    return { workspace, membership, profile: profile ?? null };
  }

  async getWorkspaceById(id: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace;
  }

  async getAgencyProfileForWorkspace(workspaceId: string): Promise<AgencyProfile | undefined> {
    const [profile] = await db
      .select()
      .from(agencyProfiles)
      .where(eq(agencyProfiles.workspaceId, workspaceId))
      .orderBy(desc(agencyProfiles.updatedAt));
    return profile;
  }

  async updateAgencyProfile(workspaceId: string, calibration: any, status = "completed"): Promise<AgencyProfile> {
    const existing = await this.getAgencyProfileForWorkspace(workspaceId);
    if (existing) {
      await db.insert(workspacePreferencesHistory).values({
        workspaceId,
        calibrationSnapshot: existing.calibration,
      });

      const [profile] = await db
        .update(agencyProfiles)
        .set({
          calibration,
          status,
          updatedAt: new Date(),
        })
        .where(eq(agencyProfiles.id, existing.id))
        .returning();

      await db
        .update(workspaces)
        .set({
          onboardingStatus: status === "completed" ? "completed" : "in_progress",
        })
        .where(eq(workspaces.id, workspaceId));

      return profile;
    }

    const [profile] = await db
      .insert(agencyProfiles)
      .values({
        workspaceId,
        calibration,
        status,
      })
      .returning();

    await db
      .update(workspaces)
      .set({
        onboardingStatus: status === "completed" ? "completed" : "in_progress",
      })
      .where(eq(workspaces.id, workspaceId));

    return profile;
  }

  async listWorkspaceCredentials(workspaceId: string): Promise<WorkspaceCredential[]> {
    return db
      .select()
      .from(workspaceCredentials)
      .where(eq(workspaceCredentials.workspaceId, workspaceId))
      .orderBy(desc(workspaceCredentials.updatedAt));
  }

  async createWorkspaceCredential(
    workspaceId: string,
    input: Partial<WorkspaceCredential> & { title: string; caseStudyText: string },
  ): Promise<WorkspaceCredential> {
    const [credential] = await db
      .insert(workspaceCredentials)
      .values({
        workspaceId,
        title: input.title,
        caseStudyText: input.caseStudyText,
        sectors: input.sectors ?? [],
        services: input.services ?? [],
        formats: input.formats ?? [],
        tags: input.tags ?? [],
        status: input.status ?? "approved",
      })
      .returning();
    return credential;
  }

  async updateWorkspaceCredential(
    id: number,
    workspaceId: string,
    input: Partial<WorkspaceCredential>,
  ): Promise<WorkspaceCredential | undefined> {
    const [credential] = await db
      .update(workspaceCredentials)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(workspaceCredentials.id, id), eq(workspaceCredentials.workspaceId, workspaceId)))
      .returning();
    return credential;
  }

  async listCredentialSuggestions(workspaceId: string): Promise<CredentialSuggestion[]> {
    return db
      .select()
      .from(credentialSuggestions)
      .where(eq(credentialSuggestions.workspaceId, workspaceId))
      .orderBy(desc(credentialSuggestions.createdAt));
  }

  async createCredentialSuggestion(
    workspaceId: string,
    input: {
      sourceAnalysisId?: number | null;
      sourceNote?: string | null;
      extractedSummary: string;
      proposedTags?: string[];
      approvalStatus?: string;
    },
  ): Promise<CredentialSuggestion> {
    const [suggestion] = await db
      .insert(credentialSuggestions)
      .values({
        workspaceId,
        sourceAnalysisId: input.sourceAnalysisId ?? null,
        sourceNote: input.sourceNote ?? null,
        extractedSummary: input.extractedSummary,
        proposedTags: input.proposedTags ?? [],
        approvalStatus: input.approvalStatus ?? "draft",
      })
      .returning();
    return suggestion;
  }

  async updateCredentialSuggestion(
    id: number,
    workspaceId: string,
    input: Partial<CredentialSuggestion>,
  ): Promise<CredentialSuggestion | undefined> {
    const [suggestion] = await db
      .update(credentialSuggestions)
      .set(input)
      .where(and(eq(credentialSuggestions.id, id), eq(credentialSuggestions.workspaceId, workspaceId)))
      .returning();
    return suggestion;
  }

  async listClientMemory(workspaceId: string): Promise<ClientMemory[]> {
    return db
      .select()
      .from(clientMemory)
      .where(eq(clientMemory.workspaceId, workspaceId))
      .orderBy(desc(clientMemory.lastTouchedAt));
  }

  async updateClientMemoryById(
    id: number,
    workspaceId: string,
    input: Partial<ClientMemory> & {
      qualityRating?: string;
      badFitFlag?: boolean;
      notes?: string | null;
    },
  ): Promise<ClientMemory | undefined> {
    const [updated] = await db
      .update(clientMemory)
      .set({
        qualityRating: input.qualityRating,
        badFitFlag: input.badFitFlag,
        notes: input.notes,
        lastTouchedAt: new Date(),
      })
      .where(and(eq(clientMemory.id, id), eq(clientMemory.workspaceId, workspaceId)))
      .returning();
    return updated;
  }

  async upsertClientMemory(
    workspaceId: string,
    normalizedClientKey: string,
    input: Partial<ClientMemory> & {
      qualityRating?: string;
      badFitFlag?: boolean;
      notes?: string | null;
    },
  ): Promise<ClientMemory> {
    const [existing] = await db
      .select()
      .from(clientMemory)
      .where(
        and(
          eq(clientMemory.workspaceId, workspaceId),
          eq(clientMemory.normalizedClientKey, normalizedClientKey),
        ),
      );

    if (existing) {
      const [updated] = await db
        .update(clientMemory)
        .set({
          qualityRating: input.qualityRating ?? existing.qualityRating,
          badFitFlag: input.badFitFlag ?? existing.badFitFlag,
          notes: input.notes ?? existing.notes,
          lastTouchedAt: new Date(),
        })
        .where(eq(clientMemory.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(clientMemory)
      .values({
        workspaceId,
        normalizedClientKey,
        qualityRating: input.qualityRating ?? "unknown",
        badFitFlag: input.badFitFlag ?? false,
        notes: input.notes ?? null,
      })
      .returning();
    return created;
  }

  async createOrUpdatePursuitDecision(input: {
    analysisId: number;
    workspaceId: string;
    userId?: string | null;
    systemRecommendation: string;
    userDecision: string;
    overrideReason?: string | null;
  }): Promise<PursuitDecision> {
    const [existing] = await db
      .select()
      .from(pursuitDecisions)
      .where(
        and(
          eq(pursuitDecisions.analysisId, input.analysisId),
          eq(pursuitDecisions.workspaceId, input.workspaceId),
        ),
      );

    if (existing) {
      const [updated] = await db
        .update(pursuitDecisions)
        .set({
          systemRecommendation: input.systemRecommendation,
          userDecision: input.userDecision,
          overrideReason: input.overrideReason ?? null,
          userId: input.userId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(pursuitDecisions.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(pursuitDecisions)
      .values({
        analysisId: input.analysisId,
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        systemRecommendation: input.systemRecommendation,
        userDecision: input.userDecision,
        overrideReason: input.overrideReason ?? null,
      })
      .returning();
    return created;
  }

  async createOrUpdatePursuitOutcome(input: {
    analysisId: number;
    workspaceId: string;
    outcome: string;
    notes?: string | null;
  }): Promise<PursuitOutcome> {
    const [existing] = await db
      .select()
      .from(pursuitOutcomes)
      .where(
        and(
          eq(pursuitOutcomes.analysisId, input.analysisId),
          eq(pursuitOutcomes.workspaceId, input.workspaceId),
        ),
      );

    if (existing) {
      const [updated] = await db
        .update(pursuitOutcomes)
        .set({
          outcome: input.outcome,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(pursuitOutcomes.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(pursuitOutcomes)
      .values({
        analysisId: input.analysisId,
        workspaceId: input.workspaceId,
        outcome: input.outcome,
        notes: input.notes ?? null,
      })
      .returning();
    return created;
  }

  async getPursuitDecision(analysisId: number, workspaceId: string): Promise<PursuitDecision | undefined> {
    const [decision] = await db
      .select()
      .from(pursuitDecisions)
      .where(and(eq(pursuitDecisions.analysisId, analysisId), eq(pursuitDecisions.workspaceId, workspaceId)));
    return decision;
  }

  async getPursuitOutcome(analysisId: number, workspaceId: string): Promise<PursuitOutcome | undefined> {
    const [outcome] = await db
      .select()
      .from(pursuitOutcomes)
      .where(and(eq(pursuitOutcomes.analysisId, analysisId), eq(pursuitOutcomes.workspaceId, workspaceId)));
    return outcome;
  }

  async createAnalysis(data: InsertRfpAnalysis): Promise<RfpAnalysis> {
    const [analysis] = await db.insert(rfpAnalyses).values(data).returning();
    return analysis;
  }

  async getAnalysis(id: number): Promise<RfpAnalysis | undefined> {
    const [analysis] = await db.select().from(rfpAnalyses).where(eq(rfpAnalyses.id, id));
    return analysis;
  }

  async getAnalysisForWorkspace(id: number, workspaceId: string): Promise<RfpAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(rfpAnalyses)
      .where(and(eq(rfpAnalyses.id, id), eq(rfpAnalyses.workspaceId, workspaceId)));
    return analysis;
  }

  async getAllAnalyses(): Promise<RfpAnalysis[]> {
    return db.select().from(rfpAnalyses).orderBy(desc(rfpAnalyses.createdAt));
  }

  async getAllAnalysesForWorkspace(workspaceId: string): Promise<RfpAnalysis[]> {
    return db
      .select()
      .from(rfpAnalyses)
      .where(eq(rfpAnalyses.workspaceId, workspaceId))
      .orderBy(desc(rfpAnalyses.createdAt));
  }

  async updateAnalysis(id: number, data: Partial<RfpAnalysis>): Promise<RfpAnalysis | undefined> {
    const [analysis] = await db
      .update(rfpAnalyses)
      .set(data)
      .where(eq(rfpAnalyses.id, id))
      .returning();
    return analysis;
  }

  async deleteAnalysis(id: number): Promise<void> {
    await db.delete(rfpAnalyses).where(eq(rfpAnalyses.id, id));
  }

  async deleteAnalysisForWorkspace(id: number, workspaceId: string): Promise<void> {
    await db
      .delete(rfpAnalyses)
      .where(and(eq(rfpAnalyses.id, id), eq(rfpAnalyses.workspaceId, workspaceId)));
  }
}

export const storage = new DatabaseStorage();
