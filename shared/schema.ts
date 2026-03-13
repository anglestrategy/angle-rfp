import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  serial,
  integer,
  jsonb,
  timestamp,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  fullName: text("full_name"),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const rfpAnalyses = pgTable("rfp_analyses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  analysisVersion: text("analysis_version").notNull().default("live-v1"),
  status: text("status").notNull().default("uploading"),
  currentPass: integer("current_pass").default(0),
  documentText: text("document_text"),
  extractedData: jsonb("extracted_data"),
  scopeAnalysis: jsonb("scope_analysis"),
  clientResearch: jsonb("client_research"),
  financialScore: jsonb("financial_score"),
  redFlags: jsonb("red_flags"),
  shadowRunStatus: text("shadow_run_status").notNull().default("not_started"),
  shadowOutputs: jsonb("shadow_outputs"),
  manualReviewRequired: boolean("manual_review_required")
    .notNull()
    .default(false),
  documentQuality: jsonb("document_quality"),
  analysisMeta: jsonb("analysis_meta"),
  reviewReasons: jsonb("review_reasons"),
  comparisonSummary: jsonb("comparison_summary"),
  overallScore: integer("overall_score"),
  recommendation: text("recommendation"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRfpAnalysisSchema = createInsertSchema(rfpAnalyses).omit({
  id: true,
  createdAt: true,
});

export type InsertRfpAnalysis = z.infer<typeof insertRfpAnalysisSchema>;
export type RfpAnalysis = typeof rfpAnalyses.$inferSelect;

export const analysisPayloads = pgTable("analysis_payloads", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id")
    .notNull()
    .references(() => rfpAnalyses.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileContentBase64: text("file_content_base64").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AnalysisPayload = typeof analysisPayloads.$inferSelect;

export const analysisRuns = pgTable("analysis_runs", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id")
    .notNull()
    .references(() => rfpAnalyses.id, { onDelete: "cascade" }),
  pipelineVersion: text("pipeline_version").notNull(),
  trigger: text("trigger").notNull().default("upload"),
  status: text("status").notNull().default("queued"),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(2),
  attemptCount: integer("attempt_count").notNull().default(0),
  currentStageKey: text("current_stage_key"),
  degraded: boolean("degraded").notNull().default(false),
  usedFallback: boolean("used_fallback").notNull().default(false),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  documentQuality: jsonb("document_quality"),
  reviewReasons: jsonb("review_reasons"),
  meta: jsonb("meta"),
  requestedAt: timestamp("requested_at").defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  staleAfterSeconds: integer("stale_after_seconds").notNull().default(300),
});

export type AnalysisRun = typeof analysisRuns.$inferSelect;

export const analysisStageRuns = pgTable("analysis_stage_runs", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  analysisId: integer("analysis_id")
    .notNull()
    .references(() => rfpAnalyses.id, { onDelete: "cascade" }),
  stageKey: text("stage_key").notNull(),
  label: text("label").notNull(),
  stageOrder: integer("stage_order").notNull(),
  status: text("status").notNull().default("pending"),
  retryCount: integer("retry_count").notNull().default(0),
  usedFallback: boolean("used_fallback").notNull().default(false),
  degraded: boolean("degraded").notNull().default(false),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  elapsedMs: integer("elapsed_ms"),
  modelUsage: jsonb("model_usage"),
  resultEnvelope: jsonb("result_envelope"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
});

export type AnalysisStageRun = typeof analysisStageRuns.$inferSelect;

export const analysisChunks = pgTable("analysis_chunks", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id")
    .notNull()
    .references(() => rfpAnalyses.id, { onDelete: "cascade" }),
  runId: integer("run_id").references(() => analysisRuns.id, {
    onDelete: "cascade",
  }),
  chunkIndex: integer("chunk_index").notNull(),
  pageNumber: integer("page_number"),
  sectionLabel: text("section_label"),
  text: text("text").notNull(),
  charStart: integer("char_start"),
  charEnd: integer("char_end"),
  parseMethod: text("parse_method").notNull(),
  languageHint: text("language_hint"),
  meta: jsonb("meta"),
});

export type AnalysisChunk = typeof analysisChunks.$inferSelect;

export const analysisSources = pgTable("analysis_sources", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id")
    .notNull()
    .references(() => rfpAnalyses.id, { onDelete: "cascade" }),
  runId: integer("run_id").references(() => analysisRuns.id, {
    onDelete: "cascade",
  }),
  sourceType: text("source_type").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  domain: text("domain"),
  publishedAt: timestamp("published_at"),
  retrievedAt: timestamp("retrieved_at").defaultNow(),
  reliabilityTier: text("reliability_tier").notNull().default("unknown"),
  snippet: text("snippet"),
  note: text("note"),
  meta: jsonb("meta"),
});

export type AnalysisSource = typeof analysisSources.$inferSelect;

export const analysisEvidence = pgTable("analysis_evidence", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id")
    .notNull()
    .references(() => rfpAnalyses.id, { onDelete: "cascade" }),
  runId: integer("run_id").references(() => analysisRuns.id, {
    onDelete: "cascade",
  }),
  sourceId: integer("source_id").references(() => analysisSources.id, {
    onDelete: "set null",
  }),
  fieldPath: text("field_path").notNull(),
  label: text("label"),
  sourceKind: text("source_kind").notNull(),
  snippet: text("snippet").notNull(),
  matchedText: text("matched_text"),
  pageNumber: integer("page_number"),
  charStart: integer("char_start"),
  charEnd: integer("char_end"),
  clauseReference: text("clause_reference"),
  confidence: real("confidence"),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  note: text("note"),
  meta: jsonb("meta"),
});

export type AnalysisEvidence = typeof analysisEvidence.$inferSelect;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
