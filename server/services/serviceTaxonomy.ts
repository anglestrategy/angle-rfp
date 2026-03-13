export interface ServiceItem {
  id: string;
  name: string;
  category: "Strategy" | "Content" | "Design" | "Management" | "Production" | "Media";
  subcategory: string;
  keywords: string[];
}

export const SERVICE_TAXONOMY: ServiceItem[] = [
  { id: "str_01", name: "Brand Strategy", category: "Strategy", subcategory: "Brand", keywords: ["brand strategy", "brand positioning", "brand architecture", "brand identity strategy"] },
  { id: "str_02", name: "Digital Strategy", category: "Strategy", subcategory: "Digital", keywords: ["digital strategy", "digital transformation", "online strategy"] },
  { id: "str_03", name: "Marketing Strategy", category: "Strategy", subcategory: "Marketing", keywords: ["marketing strategy", "go-to-market", "GTM", "marketing plan"] },
  { id: "str_04", name: "Content Strategy", category: "Strategy", subcategory: "Content", keywords: ["content strategy", "editorial strategy", "content planning"] },
  { id: "str_05", name: "Social Media Strategy", category: "Strategy", subcategory: "Social", keywords: ["social media strategy", "social strategy", "social media plan"] },
  { id: "str_06", name: "Campaign Strategy", category: "Strategy", subcategory: "Campaign", keywords: ["campaign strategy", "campaign planning", "advertising strategy"] },
  { id: "str_07", name: "Communication Strategy", category: "Strategy", subcategory: "Communication", keywords: ["communication strategy", "comms strategy", "PR strategy", "public relations"] },
  { id: "str_08", name: "Market Research", category: "Strategy", subcategory: "Research", keywords: ["market research", "competitive analysis", "market analysis", "consumer research"] },
  { id: "str_09", name: "Audience Analysis", category: "Strategy", subcategory: "Research", keywords: ["audience analysis", "target audience", "persona development", "user research"] },
  { id: "str_10", name: "Customer Journey Mapping", category: "Strategy", subcategory: "Experience", keywords: ["customer journey", "user journey", "experience mapping", "touchpoint analysis"] },
  { id: "str_11", name: "UX Strategy", category: "Strategy", subcategory: "Experience", keywords: ["UX strategy", "user experience strategy", "experience design strategy"] },
  { id: "str_12", name: "Data Strategy", category: "Strategy", subcategory: "Data", keywords: ["data strategy", "data-driven", "analytics strategy", "data analysis"] },
  { id: "str_13", name: "Growth Strategy", category: "Strategy", subcategory: "Growth", keywords: ["growth strategy", "growth hacking", "growth marketing", "scaling strategy"] },
  { id: "str_14", name: "Influencer Strategy", category: "Strategy", subcategory: "Influencer", keywords: ["influencer strategy", "influencer planning", "KOL strategy", "creator strategy"] },
  { id: "str_15", name: "Partnership Strategy", category: "Strategy", subcategory: "Partnerships", keywords: ["partnership strategy", "co-branding", "strategic alliance", "brand partnership"] },
  { id: "str_16", name: "Event Strategy", category: "Strategy", subcategory: "Events", keywords: ["event strategy", "event planning", "experiential strategy", "activation strategy"] },
  { id: "str_17", name: "CRM Strategy", category: "Strategy", subcategory: "CRM", keywords: ["CRM strategy", "customer relationship", "loyalty strategy", "retention strategy"] },
  { id: "str_18", name: "E-commerce Strategy", category: "Strategy", subcategory: "E-commerce", keywords: ["e-commerce strategy", "ecommerce", "online retail strategy", "digital commerce"] },
  { id: "str_19", name: "SEO Strategy", category: "Strategy", subcategory: "SEO", keywords: ["SEO strategy", "search engine optimization", "organic search strategy"] },
  { id: "str_20", name: "Employer Branding", category: "Strategy", subcategory: "Brand", keywords: ["employer branding", "employer brand", "talent branding", "recruitment marketing"] },
  { id: "str_21", name: "Crisis Communication Strategy", category: "Strategy", subcategory: "Communication", keywords: ["crisis communication", "crisis management strategy", "reputation recovery"] },
  { id: "str_22", name: "Product Launch Strategy", category: "Strategy", subcategory: "Launch", keywords: ["product launch", "launch strategy", "go-to-market launch", "market entry"] },
  { id: "str_23", name: "Rebranding Strategy", category: "Strategy", subcategory: "Brand", keywords: ["rebranding", "brand refresh", "brand evolution", "brand overhaul"] },
  { id: "str_24", name: "Channel Strategy", category: "Strategy", subcategory: "Distribution", keywords: ["channel strategy", "distribution strategy", "omnichannel", "multi-channel"] },
  { id: "str_25", name: "Sustainability Strategy", category: "Strategy", subcategory: "ESG", keywords: ["sustainability strategy", "ESG communication", "CSR strategy", "green marketing"] },

  { id: "cnt_01", name: "Copywriting", category: "Content", subcategory: "Copy", keywords: ["copywriting", "copy writing", "creative copy", "advertising copy"] },
  { id: "cnt_02", name: "Blog Writing", category: "Content", subcategory: "Editorial", keywords: ["blog writing", "blog content", "blog posts", "article writing"] },
  { id: "cnt_03", name: "Social Media Content", category: "Content", subcategory: "Social", keywords: ["social media content", "social content", "social posts", "social media posts"] },
  { id: "cnt_04", name: "Email Content", category: "Content", subcategory: "Email", keywords: ["email content", "email copy", "email marketing content", "newsletter copy"] },
  { id: "cnt_05", name: "Video Scripts", category: "Content", subcategory: "Scripts", keywords: ["video scripts", "scriptwriting", "script writing", "video copy"] },
  { id: "cnt_06", name: "Arabic Content & Translation", category: "Content", subcategory: "Localization", keywords: ["arabic content", "arabic translation", "arabic copywriting", "arabic localization"] },
  { id: "cnt_07", name: "SEO Content", category: "Content", subcategory: "SEO", keywords: ["SEO content", "SEO writing", "search optimized content", "keyword content"] },
  { id: "cnt_08", name: "Technical Writing", category: "Content", subcategory: "Technical", keywords: ["technical writing", "technical documentation", "technical content", "user manuals"] },
  { id: "cnt_09", name: "Press Releases", category: "Content", subcategory: "PR", keywords: ["press release", "media release", "news release", "PR writing"] },
  { id: "cnt_10", name: "Thought Leadership", category: "Content", subcategory: "Editorial", keywords: ["thought leadership", "opinion pieces", "expert content", "leadership articles"] },
  { id: "cnt_11", name: "Reports & Whitepapers", category: "Content", subcategory: "Research", keywords: ["whitepapers", "white papers", "reports", "research reports", "industry reports"] },
  { id: "cnt_12", name: "Case Studies", category: "Content", subcategory: "Marketing", keywords: ["case studies", "case study writing", "success stories", "client stories"] },
  { id: "cnt_13", name: "Presentation Content", category: "Content", subcategory: "Presentations", keywords: ["presentation content", "presentation writing", "deck content", "pitch deck content"] },
  { id: "cnt_14", name: "Newsletter Content", category: "Content", subcategory: "Email", keywords: ["newsletter content", "newsletter writing", "newsletter copy", "email newsletter"] },
  { id: "cnt_15", name: "Content Localization", category: "Content", subcategory: "Localization", keywords: ["content localization", "translation", "multilingual content", "content adaptation"] },
  { id: "cnt_16", name: "UX Writing", category: "Content", subcategory: "UX", keywords: ["UX writing", "UX copy", "microcopy", "interface copy", "user interface writing"] },
  { id: "cnt_17", name: "Ad Copy", category: "Content", subcategory: "Advertising", keywords: ["ad copy", "advertising copy", "ad writing", "creative writing ads"] },
  { id: "cnt_18", name: "Product Descriptions", category: "Content", subcategory: "E-commerce", keywords: ["product descriptions", "product copy", "product content", "catalog copy"] },
  { id: "cnt_19", name: "Content Audit", category: "Content", subcategory: "Analysis", keywords: ["content audit", "content analysis", "content review", "content assessment"] },
  { id: "cnt_20", name: "Content Calendar Management", category: "Content", subcategory: "Planning", keywords: ["content calendar", "editorial calendar", "content schedule", "publishing schedule"] },
  { id: "cnt_21", name: "Podcast Content", category: "Content", subcategory: "Audio", keywords: ["podcast content", "podcast scripts", "podcast planning", "audio content"] },
  { id: "cnt_22", name: "Content Guidelines", category: "Content", subcategory: "Guidelines", keywords: ["content guidelines", "editorial guidelines", "writing guidelines", "style guide content"] },
  { id: "cnt_23", name: "Tone of Voice Development", category: "Content", subcategory: "Brand", keywords: ["tone of voice", "brand voice", "voice guidelines", "brand tone"] },
  { id: "cnt_24", name: "Website Content", category: "Content", subcategory: "Web", keywords: ["website content", "web copy", "website copy", "web content writing"] },
  { id: "cnt_25", name: "Tagline & Naming", category: "Content", subcategory: "Brand", keywords: ["tagline", "naming", "brand naming", "slogan", "brand tagline"] },

  { id: "des_01", name: "Brand Identity Design", category: "Design", subcategory: "Brand", keywords: ["brand identity", "brand identity design", "corporate identity", "visual brand"] },
  { id: "des_02", name: "Logo Design", category: "Design", subcategory: "Brand", keywords: ["logo design", "logo creation", "logomark", "brand mark"] },
  { id: "des_03", name: "Visual Identity", category: "Design", subcategory: "Brand", keywords: ["visual identity", "visual identity system", "visual language", "brand visuals"] },
  { id: "des_04", name: "UI Design", category: "Design", subcategory: "Digital", keywords: ["UI design", "user interface design", "interface design", "app UI"] },
  { id: "des_05", name: "UX Design", category: "Design", subcategory: "Digital", keywords: ["UX design", "user experience design", "usability design", "interaction design"] },
  { id: "des_06", name: "Web Design", category: "Design", subcategory: "Digital", keywords: ["web design", "website design", "responsive design", "web layout"] },
  { id: "des_07", name: "App Design", category: "Design", subcategory: "Digital", keywords: ["app design", "mobile app design", "application design", "mobile design"] },
  { id: "des_08", name: "Print Design", category: "Design", subcategory: "Print", keywords: ["print design", "print collateral", "brochure design", "flyer design"] },
  { id: "des_09", name: "Packaging Design", category: "Design", subcategory: "Packaging", keywords: ["packaging design", "package design", "product packaging", "label design"] },
  { id: "des_10", name: "Environmental Design", category: "Design", subcategory: "Spatial", keywords: ["environmental design", "spatial design", "environmental graphics", "wayfinding"] },
  { id: "des_11", name: "Social Media Design", category: "Design", subcategory: "Social", keywords: ["social media design", "social graphics", "social media graphics", "social visuals"] },
  { id: "des_12", name: "Infographic Design", category: "Design", subcategory: "Information", keywords: ["infographic", "infographic design", "data visualization", "information design"] },
  { id: "des_13", name: "Icon Design", category: "Design", subcategory: "Iconography", keywords: ["icon design", "iconography", "icon set", "custom icons"] },
  { id: "des_14", name: "Illustration", category: "Design", subcategory: "Illustration", keywords: ["illustration", "custom illustration", "digital illustration", "brand illustration"] },
  { id: "des_15", name: "Typography", category: "Design", subcategory: "Typography", keywords: ["typography", "type design", "custom typography", "font selection"] },
  { id: "des_16", name: "Motion Graphics Design", category: "Design", subcategory: "Motion", keywords: ["motion graphics design", "motion design", "animated graphics", "kinetic design"] },
  { id: "des_17", name: "Email Design", category: "Design", subcategory: "Digital", keywords: ["email design", "email template design", "HTML email design", "email layout"] },
  { id: "des_18", name: "Presentation Design", category: "Design", subcategory: "Presentations", keywords: ["presentation design", "PowerPoint design", "deck design", "pitch deck design"] },
  { id: "des_19", name: "Annual Report Design", category: "Design", subcategory: "Print", keywords: ["annual report design", "annual report", "corporate report design"] },
  { id: "des_20", name: "Signage Design", category: "Design", subcategory: "Spatial", keywords: ["signage design", "sign design", "billboard design", "directional signage"] },
  { id: "des_21", name: "Exhibition Design", category: "Design", subcategory: "Spatial", keywords: ["exhibition design", "booth design", "trade show design", "stand design"] },
  { id: "des_22", name: "AR/VR Design", category: "Design", subcategory: "Immersive", keywords: ["AR design", "VR design", "augmented reality", "virtual reality design", "immersive design"] },
  { id: "des_23", name: "Design System Creation", category: "Design", subcategory: "Systems", keywords: ["design system", "component library", "design tokens", "design framework"] },
  { id: "des_24", name: "Style Guide Design", category: "Design", subcategory: "Guidelines", keywords: ["style guide", "brand guidelines", "brand book", "visual guidelines"] },
  { id: "des_25", name: "Dashboard Design", category: "Design", subcategory: "Digital", keywords: ["dashboard design", "analytics dashboard", "data dashboard", "reporting dashboard"] },

  { id: "mgt_01", name: "Project Management", category: "Management", subcategory: "Project", keywords: ["project management", "project coordination", "project planning", "PMO"] },
  { id: "mgt_02", name: "Account Management", category: "Management", subcategory: "Account", keywords: ["account management", "client management", "client servicing", "account handling"] },
  { id: "mgt_03", name: "Community Management", category: "Management", subcategory: "Community", keywords: ["community management", "online community", "community engagement", "forum management"] },
  { id: "mgt_04", name: "Social Media Management", category: "Management", subcategory: "Social", keywords: ["social media management", "social media handling", "social account management"] },
  { id: "mgt_05", name: "Campaign Management", category: "Management", subcategory: "Campaign", keywords: ["campaign management", "campaign execution", "campaign coordination", "campaign operations"] },
  { id: "mgt_06", name: "Vendor Management", category: "Management", subcategory: "Vendor", keywords: ["vendor management", "supplier management", "third-party management", "vendor coordination"] },
  { id: "mgt_07", name: "Influencer Management", category: "Management", subcategory: "Influencer", keywords: ["influencer management", "influencer coordination", "KOL management", "creator management"] },
  { id: "mgt_08", name: "Event Management", category: "Management", subcategory: "Events", keywords: ["event management", "event coordination", "event execution", "event operations"] },
  { id: "mgt_09", name: "Content Management", category: "Management", subcategory: "Content", keywords: ["content management", "CMS management", "content operations", "content workflow"] },
  { id: "mgt_10", name: "Digital Asset Management", category: "Management", subcategory: "Assets", keywords: ["digital asset management", "DAM", "asset library", "media management"] },
  { id: "mgt_11", name: "Budget Management", category: "Management", subcategory: "Finance", keywords: ["budget management", "budget tracking", "financial management", "cost management"] },
  { id: "mgt_12", name: "Timeline Management", category: "Management", subcategory: "Planning", keywords: ["timeline management", "scheduling", "milestone tracking", "deadline management"] },
  { id: "mgt_13", name: "Stakeholder Management", category: "Management", subcategory: "Stakeholder", keywords: ["stakeholder management", "stakeholder engagement", "stakeholder communication"] },
  { id: "mgt_14", name: "Crisis Management", category: "Management", subcategory: "Crisis", keywords: ["crisis management", "crisis response", "issue management", "crisis handling"] },
  { id: "mgt_15", name: "Reputation Management", category: "Management", subcategory: "Reputation", keywords: ["reputation management", "online reputation", "brand reputation", "ORM"] },
  { id: "mgt_16", name: "Agency Coordination", category: "Management", subcategory: "Coordination", keywords: ["agency coordination", "multi-agency", "agency management", "agency liaison"] },
  { id: "mgt_17", name: "Quality Assurance", category: "Management", subcategory: "Quality", keywords: ["quality assurance", "QA", "quality control", "review process"] },
  { id: "mgt_18", name: "Reporting & Analytics", category: "Management", subcategory: "Analytics", keywords: ["reporting", "analytics", "performance reporting", "data reporting", "monthly reports"] },
  { id: "mgt_19", name: "Performance Monitoring", category: "Management", subcategory: "Performance", keywords: ["performance monitoring", "KPI tracking", "performance measurement", "metrics tracking"] },
  { id: "mgt_20", name: "Workshop Facilitation", category: "Management", subcategory: "Workshops", keywords: ["workshop facilitation", "workshops", "brainstorming sessions", "ideation sessions"] },
  { id: "mgt_21", name: "Training & Development", category: "Management", subcategory: "Training", keywords: ["training", "team training", "capability building", "knowledge transfer"] },
  { id: "mgt_22", name: "Consultation", category: "Management", subcategory: "Advisory", keywords: ["consultation", "consulting", "advisory", "strategic advice"] },
  { id: "mgt_23", name: "Brand Governance", category: "Management", subcategory: "Governance", keywords: ["brand governance", "brand compliance", "brand standards", "brand policing"] },
  { id: "mgt_24", name: "Localization Management", category: "Management", subcategory: "Localization", keywords: ["localization management", "translation management", "language management"] },
  { id: "mgt_25", name: "Workflow Automation", category: "Management", subcategory: "Operations", keywords: ["workflow automation", "process automation", "marketing automation", "automation setup"] },

  { id: "prd_01", name: "Video Production", category: "Production", subcategory: "Video", keywords: ["video production", "video shoot", "film production", "video filming"] },
  { id: "prd_02", name: "Photography", category: "Production", subcategory: "Photo", keywords: ["photography", "photo shoot", "photoshoot", "professional photography"] },
  { id: "prd_03", name: "Animation", category: "Production", subcategory: "Animation", keywords: ["animation", "2D animation", "character animation", "animated video"] },
  { id: "prd_04", name: "Motion Graphics", category: "Production", subcategory: "Motion", keywords: ["motion graphics", "motion video", "animated graphics", "kinetic typography"] },
  { id: "prd_05", name: "3D Rendering", category: "Production", subcategory: "3D", keywords: ["3D rendering", "3D modeling", "3D visualization", "CGI", "3D animation"] },
  { id: "prd_06", name: "Audio Production", category: "Production", subcategory: "Audio", keywords: ["audio production", "music production", "jingle", "audio recording", "voiceover"] },
  { id: "prd_07", name: "Podcast Production", category: "Production", subcategory: "Audio", keywords: ["podcast production", "podcast recording", "podcast editing", "podcast series"] },
  { id: "prd_08", name: "Live Streaming", category: "Production", subcategory: "Live", keywords: ["live streaming", "live broadcast", "live event streaming", "webinar production"] },
  { id: "prd_09", name: "Post-Production & Editing", category: "Production", subcategory: "Post", keywords: ["post-production", "video editing", "post production", "editing", "film editing"] },
  { id: "prd_10", name: "Color Grading", category: "Production", subcategory: "Post", keywords: ["color grading", "color correction", "color grade", "DI"] },
  { id: "prd_11", name: "Sound Design", category: "Production", subcategory: "Audio", keywords: ["sound design", "sound effects", "SFX", "audio design"] },
  { id: "prd_12", name: "VFX", category: "Production", subcategory: "Effects", keywords: ["VFX", "visual effects", "special effects", "compositing"] },
  { id: "prd_13", name: "Drone Videography", category: "Production", subcategory: "Video", keywords: ["drone videography", "aerial video", "drone footage", "aerial photography"] },
  { id: "prd_14", name: "Time-lapse", category: "Production", subcategory: "Video", keywords: ["time-lapse", "timelapse", "time lapse", "hyperlapse"] },
  { id: "prd_15", name: "Product Photography", category: "Production", subcategory: "Photo", keywords: ["product photography", "product shoot", "product photos", "e-commerce photography"] },
  { id: "prd_16", name: "Food Photography", category: "Production", subcategory: "Photo", keywords: ["food photography", "food shoot", "culinary photography", "food styling"] },
  { id: "prd_17", name: "Fashion Photography", category: "Production", subcategory: "Photo", keywords: ["fashion photography", "fashion shoot", "lookbook", "fashion editorial"] },
  { id: "prd_18", name: "Corporate Photography", category: "Production", subcategory: "Photo", keywords: ["corporate photography", "headshots", "corporate portraits", "business photography"] },
  { id: "prd_19", name: "Event Coverage", category: "Production", subcategory: "Events", keywords: ["event coverage", "event photography", "event videography", "event filming"] },
  { id: "prd_20", name: "TVC Production", category: "Production", subcategory: "Commercial", keywords: ["TVC", "television commercial", "TV commercial", "commercial production", "TV ad"] },
  { id: "prd_21", name: "Digital Ad Production", category: "Production", subcategory: "Digital", keywords: ["digital ad production", "digital ads", "banner production", "online ad production"] },
  { id: "prd_22", name: "Social Media Video", category: "Production", subcategory: "Social", keywords: ["social media video", "social video", "short-form video", "social clips"] },
  { id: "prd_23", name: "Reel Production", category: "Production", subcategory: "Social", keywords: ["reel production", "reels", "Instagram reels", "short video", "TikTok video"] },
  { id: "prd_24", name: "Documentary", category: "Production", subcategory: "Long-form", keywords: ["documentary", "documentary production", "docu-series", "brand documentary"] },
  { id: "prd_25", name: "Web Development", category: "Production", subcategory: "Digital", keywords: ["web development", "website development", "frontend development", "website build"] },

  { id: "med_01", name: "Media Planning", category: "Media", subcategory: "Planning", keywords: ["media planning", "media plan", "media strategy", "media schedule"] },
  { id: "med_02", name: "Media Buying", category: "Media", subcategory: "Buying", keywords: ["media buying", "media purchase", "ad buying", "media procurement"] },
  { id: "med_03", name: "Digital Media", category: "Media", subcategory: "Digital", keywords: ["digital media", "digital advertising", "online advertising", "digital marketing"] },
  { id: "med_04", name: "Social Media Advertising", category: "Media", subcategory: "Social", keywords: ["social media advertising", "social ads", "paid social", "social media ads"] },
  { id: "med_05", name: "Google Ads / SEM", category: "Media", subcategory: "Search", keywords: ["Google Ads", "SEM", "search engine marketing", "PPC", "pay-per-click", "Google AdWords"] },
  { id: "med_06", name: "Programmatic Advertising", category: "Media", subcategory: "Programmatic", keywords: ["programmatic", "programmatic advertising", "programmatic buying", "RTB"] },
  { id: "med_07", name: "Display Advertising", category: "Media", subcategory: "Display", keywords: ["display advertising", "display ads", "banner ads", "digital display"] },
  { id: "med_08", name: "OOH / Outdoor Advertising", category: "Media", subcategory: "OOH", keywords: ["OOH", "outdoor advertising", "out-of-home", "billboard advertising", "outdoor media"] },
  { id: "med_09", name: "Print Media Advertising", category: "Media", subcategory: "Print", keywords: ["print media", "print advertising", "magazine advertising", "newspaper advertising"] },
  { id: "med_10", name: "TV & Radio Advertising", category: "Media", subcategory: "Broadcast", keywords: ["TV advertising", "radio advertising", "broadcast advertising", "television ads", "radio ads"] },
  { id: "med_11", name: "Influencer Marketing", category: "Media", subcategory: "Influencer", keywords: ["influencer marketing", "influencer campaign", "KOL marketing", "creator marketing"] },
  { id: "med_12", name: "Affiliate Marketing", category: "Media", subcategory: "Affiliate", keywords: ["affiliate marketing", "affiliate program", "referral marketing", "affiliate network"] },
  { id: "med_13", name: "Email Marketing", category: "Media", subcategory: "Email", keywords: ["email marketing", "email campaigns", "email automation", "drip campaigns"] },
  { id: "med_14", name: "SMS Marketing", category: "Media", subcategory: "Mobile", keywords: ["SMS marketing", "text marketing", "mobile marketing", "WhatsApp marketing"] },
  { id: "med_15", name: "SEO", category: "Media", subcategory: "Search", keywords: ["SEO", "search engine optimization", "organic search", "on-page SEO", "off-page SEO"] },
  { id: "med_16", name: "App Store Optimization", category: "Media", subcategory: "Mobile", keywords: ["app store optimization", "ASO", "app marketing", "app store marketing"] },
  { id: "med_17", name: "Performance Marketing", category: "Media", subcategory: "Performance", keywords: ["performance marketing", "performance media", "conversion marketing", "ROI marketing"] },
  { id: "med_18", name: "Retargeting", category: "Media", subcategory: "Retargeting", keywords: ["retargeting", "remarketing", "audience retargeting", "pixel-based retargeting"] },
  { id: "med_19", name: "Native Advertising", category: "Media", subcategory: "Native", keywords: ["native advertising", "native ads", "sponsored content", "advertorial"] },
  { id: "med_20", name: "Sponsorship Management", category: "Media", subcategory: "Sponsorship", keywords: ["sponsorship", "sponsorship management", "brand sponsorship", "event sponsorship"] },
  { id: "med_21", name: "Media Monitoring", category: "Media", subcategory: "Monitoring", keywords: ["media monitoring", "media tracking", "press monitoring", "media intelligence"] },
  { id: "med_22", name: "Analytics & Reporting", category: "Media", subcategory: "Analytics", keywords: ["media analytics", "campaign analytics", "media reporting", "ad reporting"] },
  { id: "med_23", name: "Audience Targeting", category: "Media", subcategory: "Targeting", keywords: ["audience targeting", "targeting strategy", "audience segmentation", "ad targeting"] },
  { id: "med_24", name: "Media Auditing", category: "Media", subcategory: "Audit", keywords: ["media audit", "media auditing", "spend audit", "media effectiveness"] },
  { id: "med_25", name: "Connected TV Advertising", category: "Media", subcategory: "Digital", keywords: ["connected TV", "CTV", "OTT advertising", "streaming ads", "digital TV"] },
];

export interface ScopeMatchResult {
  scopeItem: string;
  matchedService: ServiceItem | null;
  matchType: "full" | "partial" | "gap";
  confidence: number;
  category: string;
}

export interface ScopeAnalysisResult {
  matches: ScopeMatchResult[];
  agencyServicePercentage: number;
  fullMatches: number;
  partialMatches: number;
  gaps: number;
  categoryBreakdown: Record<string, { full: number; partial: number; gap: number }>;
  outputCounts: {
    videos: number;
    motionGraphics: number;
    designAssets: number;
    contentPieces: number;
    total: number;
  };
}

const VIDEO_KEYWORDS = ["video", "film", "tvc", "commercial", "reel", "documentary", "streaming", "drone", "time-lapse", "timelapse"];
const MOTION_KEYWORDS = ["motion graphics", "animation", "animated", "motion", "3d", "vfx", "cgi"];
const DESIGN_KEYWORDS = ["design", "logo", "brand identity", "visual", "ui", "ux", "packaging", "infographic", "illustration", "icon", "signage", "exhibition"];
const CONTENT_KEYWORDS = ["content", "copy", "writing", "blog", "article", "press release", "whitepaper", "case study", "newsletter", "script", "podcast"];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function calculateKeywordConfidence(deliverable: string, service: ServiceItem): number {
  const normalizedDeliverable = normalizeText(deliverable);
  const words = normalizedDeliverable.split(" ");
  let matchedKeywords = 0;
  let totalKeywords = service.keywords.length;

  for (const keyword of service.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedDeliverable.includes(normalizedKeyword)) {
      matchedKeywords++;
    }
  }

  const keywordScore = totalKeywords > 0 ? matchedKeywords / totalKeywords : 0;

  const nameMatch = normalizedDeliverable.includes(normalizeText(service.name)) ? 0.4 : 0;
  const subcategoryMatch = normalizedDeliverable.includes(normalizeText(service.subcategory)) ? 0.1 : 0;

  return Math.min(1, keywordScore + nameMatch + subcategoryMatch);
}

function countOutputType(deliverables: string[], keywords: string[]): number {
  let count = 0;
  for (const d of deliverables) {
    const normalized = normalizeText(d);
    if (keywords.some((k) => normalized.includes(k))) {
      count++;
    }
  }
  return count;
}

export async function aiScopeMatching(deliverables: string[], scopeText: string): Promise<ScopeAnalysisResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const pRetry = (await import("p-retry")).default;

  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    ...(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && {
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    }),
  });

  const taxonomySummary = SERVICE_TAXONOMY.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push({ id: s.id, name: s.name, subcategory: s.subcategory });
    return acc;
  }, {} as Record<string, { id: string; name: string; subcategory: string }[]>);

  const run = async () => {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      system: `You are an expert at matching project deliverables to agency service categories. Given a numbered list of deliverables from an RFP and a service taxonomy, map EACH deliverable to the best matching service.

You MUST respond with ONLY valid JSON matching this schema:
{
  "matches": [
    {
      "scopeItem": "string - the EXACT original deliverable text from the DELIVERABLES list (copy verbatim)",
      "serviceId": "string or null - the matched service ID (e.g., 'str_01', 'des_05') or null if no match",
      "matchType": "full|partial|gap",
      "confidence": "number 0-1",
      "category": "string - the service category"
    }
  ],
  "outputCounts": {
    "videos": "number - count of video-related outputs (sum all quantities)",
    "motionGraphics": "number - count of motion/animation outputs",
    "designAssets": "number - count of design-related outputs",
    "contentPieces": "number - count of content/copy outputs (includes guides, documents)",
    "total": "number - sum of all outputs"
  }
}

CRITICAL RULES:
- You MUST create EXACTLY one match entry per deliverable in the DELIVERABLES list — no more, no less
- DO NOT add extra items from the scope context. Only match the numbered deliverables.
- "full" match: The deliverable clearly maps to this service (confidence > 0.7)
- "partial" match: The deliverable is related but not a perfect fit (confidence 0.3-0.7)
- "gap": No matching service in the taxonomy (confidence < 0.3)
- For outputCounts, extract and SUM quantities from the deliverable descriptions (e.g., "10 social media posts" = 10 content pieces, "5 video edits" = 5 videos, "6 designs" = 6 design assets)
- Consider semantic meaning, not just keyword matching (e.g., "brand localization" maps to content localization and brand strategy)
- A single deliverable can be a partial match to multiple services — choose the BEST single match`,
      messages: [{
        role: "user",
        content: `Map these deliverables to the agency service taxonomy.

DELIVERABLES:
${deliverables.map((d, i) => `${i + 1}. ${d}`).join("\n")}

${scopeText ? `SCOPE CONTEXT:\n${scopeText.slice(0, 3000)}` : ""}

SERVICE TAXONOMY:
${JSON.stringify(taxonomySummary, null, 2)}`
      }],
    });

    const block = response.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type");
    const fenced = block.text.match(/```(?:json)?\s*([\s\S]*?)```/);
    let parsed;
    if (fenced) {
      parsed = JSON.parse(fenced[1].trim());
    } else {
      const match = block.text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("No JSON in AI scope matching response");
    }
    return parsed;
  };

  const aiResult = await pRetry(run, { retries: 2, minTimeout: 2000 });

  // Convert AI result to ScopeAnalysisResult format
  const categoryBreakdown: Record<string, { full: number; partial: number; gap: number }> = {};
  for (const category of ["Strategy", "Content", "Design", "Management", "Production", "Media"]) {
    categoryBreakdown[category] = { full: 0, partial: 0, gap: 0 };
  }

  const matches: ScopeMatchResult[] = (aiResult.matches || []).map((m: any) => {
    const serviceId = m.serviceId;
    const matchedService = serviceId ? SERVICE_TAXONOMY.find(s => s.id === serviceId) || null : null;
    const matchType = m.matchType || "gap";
    const category = matchedService?.category || m.category || "Uncategorized";

    if (categoryBreakdown[category]) {
      categoryBreakdown[category][matchType as "full" | "partial" | "gap"]++;
    }

    return {
      scopeItem: m.scopeItem || "",
      matchedService,
      matchType,
      confidence: m.confidence || 0,
      category,
    };
  });

  const fullMatches = matches.filter(m => m.matchType === "full").length;
  const partialMatches = matches.filter(m => m.matchType === "partial").length;
  const gaps = matches.filter(m => m.matchType === "gap").length;
  const totalItems = matches.length;
  const agencyServicePercentage = totalItems > 0 ? Math.round(((fullMatches + partialMatches * 0.5) / totalItems) * 100) : 0;

  const outputCounts = aiResult.outputCounts || {
    videos: 0,
    motionGraphics: 0,
    designAssets: 0,
    contentPieces: 0,
    total: 0,
  };
  if (!outputCounts.total) {
    outputCounts.total = (outputCounts.videos || 0) + (outputCounts.motionGraphics || 0) + (outputCounts.designAssets || 0) + (outputCounts.contentPieces || 0);
  }

  return {
    matches,
    agencyServicePercentage,
    fullMatches,
    partialMatches,
    gaps,
    categoryBreakdown,
    outputCounts,
  };
}

export function matchScopeToServices(deliverables: string[], scopeText: string): ScopeAnalysisResult {
  const allItems = [...deliverables];
  // Only use scopeText as a last resort when we have zero real deliverables.
  // Splitting overview paragraphs on commas produces misleading fragments
  // like "including campaign strategy", "creative concepts", etc.
  if (scopeText && allItems.length === 0) {
    const scopeLines = scopeText
      .split(/[\n;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10 && !s.startsWith("including") && !s.startsWith("and "));
    for (const line of scopeLines) {
      if (!allItems.some((d) => normalizeText(d) === normalizeText(line))) {
        allItems.push(line);
      }
    }
  }

  const uniqueItems = Array.from(new Set(allItems.map((item) => item.trim()).filter((item) => item.length > 0)));

  const matches: ScopeMatchResult[] = [];
  const categoryBreakdown: Record<string, { full: number; partial: number; gap: number }> = {};

  for (const category of ["Strategy", "Content", "Design", "Management", "Production", "Media"]) {
    categoryBreakdown[category] = { full: 0, partial: 0, gap: 0 };
  }

  for (const item of uniqueItems) {
    let bestService: ServiceItem | null = null;
    let bestConfidence = 0;

    for (const service of SERVICE_TAXONOMY) {
      const confidence = calculateKeywordConfidence(item, service);
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestService = service;
      }
    }

    let matchType: "full" | "partial" | "gap";
    if (bestConfidence > 0.6) {
      matchType = "full";
    } else if (bestConfidence > 0.3) {
      matchType = "partial";
    } else {
      matchType = "gap";
    }

    const category = bestService?.category || "Uncategorized";

    matches.push({
      scopeItem: item,
      matchedService: matchType !== "gap" ? bestService : null,
      matchType,
      confidence: Math.round(bestConfidence * 100) / 100,
      category,
    });

    if (categoryBreakdown[category]) {
      categoryBreakdown[category][matchType]++;
    }
  }

  const fullMatches = matches.filter((m) => m.matchType === "full").length;
  const partialMatches = matches.filter((m) => m.matchType === "partial").length;
  const gaps = matches.filter((m) => m.matchType === "gap").length;
  const totalItems = matches.length;
  const agencyServicePercentage = totalItems > 0 ? Math.round(((fullMatches + partialMatches * 0.5) / totalItems) * 100) : 0;

  const outputCounts = {
    videos: countOutputType(uniqueItems, VIDEO_KEYWORDS),
    motionGraphics: countOutputType(uniqueItems, MOTION_KEYWORDS),
    designAssets: countOutputType(uniqueItems, DESIGN_KEYWORDS),
    contentPieces: countOutputType(uniqueItems, CONTENT_KEYWORDS),
    total: 0,
  };
  outputCounts.total = outputCounts.videos + outputCounts.motionGraphics + outputCounts.designAssets + outputCounts.contentPieces;

  return {
    matches,
    agencyServicePercentage,
    fullMatches,
    partialMatches,
    gaps,
    categoryBreakdown,
    outputCounts,
  };
}
