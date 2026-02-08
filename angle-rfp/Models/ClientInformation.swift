//
//  ClientInformation.swift
//  angle-rfp
//
//  Model for client/company information used in financial analysis
//

import Foundation

public struct ClientInformation: Codable {
    var name: String
    var companySize: CompanySize?
    var brandPopularity: BrandPopularity?
    var entityType: EntityType?
    var holdingGroup: String?
    var industry: String?
    var socialMediaPresence: SocialMediaPresence?
    var estimatedEmployees: Int?
    var estimatedRevenue: String?
    var mediaSpendIndicators: String?

    // Research metadata
    var researchSources: [String]
    var researchConfidence: Double // 0.0-1.0
    var researchDate: Date

    public init(name: String,
         companySize: CompanySize? = nil,
         brandPopularity: BrandPopularity? = nil,
         entityType: EntityType? = nil,
         holdingGroup: String? = nil,
         industry: String? = nil,
         socialMediaPresence: SocialMediaPresence? = nil,
         estimatedEmployees: Int? = nil,
         estimatedRevenue: String? = nil,
         mediaSpendIndicators: String? = nil,
         researchSources: [String] = [],
         researchConfidence: Double = 0.0,
         researchDate: Date = Date()) {
        self.name = name
        self.companySize = companySize
        self.brandPopularity = brandPopularity
        self.entityType = entityType
        self.holdingGroup = holdingGroup
        self.industry = industry
        self.socialMediaPresence = socialMediaPresence
        self.estimatedEmployees = estimatedEmployees
        self.estimatedRevenue = estimatedRevenue
        self.mediaSpendIndicators = mediaSpendIndicators
        self.researchSources = researchSources
        self.researchConfidence = researchConfidence
        self.researchDate = researchDate
    }
}

// MARK: - Company Size

public enum CompanySize: String, Codable, CaseIterable {
    case startup = "Startup"
    case small = "Small (1-50)"
    case medium = "Medium (51-500)"
    case large = "Large (501-5000)"
    case enterprise = "Enterprise (5000+)"

    var score: Double {
        switch self {
        case .startup: return 0.2
        case .small: return 0.4
        case .medium: return 0.6
        case .large: return 0.8
        case .enterprise: return 1.0
        }
    }

    var impact: String {
        switch self {
        case .startup: return "Very Low"
        case .small: return "Low"
        case .medium: return "Moderate"
        case .large: return "High"
        case .enterprise: return "Very High"
        }
    }
}

// MARK: - Brand Popularity

public enum BrandPopularity: String, Codable, CaseIterable {
    case unknown = "Unknown"
    case local = "Local"
    case regional = "Regional"
    case national = "National"
    case international = "International"

    var score: Double {
        switch self {
        case .unknown: return 0.0
        case .local: return 0.25
        case .regional: return 0.5
        case .national: return 0.75
        case .international: return 1.0
        }
    }

    var impact: String {
        switch self {
        case .unknown: return "Unknown"
        case .local: return "Low"
        case .regional: return "Moderate"
        case .national: return "High"
        case .international: return "Very High"
        }
    }
}

// MARK: - Entity Type

public enum EntityType: String, Codable, CaseIterable {
    case privateCompany = "Private Company"
    case publicCompany = "Public Company"
    case governmental = "Governmental"
    case nonprofit = "Non-profit"

    var score: Double {
        switch self {
        case .privateCompany: return 1.0
        case .publicCompany: return 0.9
        case .governmental: return 0.4
        case .nonprofit: return 0.3
        }
    }

    var impact: String {
        switch self {
        case .privateCompany: return "High (Best Budget)"
        case .publicCompany: return "High"
        case .governmental: return "Low (Limited Budget)"
        case .nonprofit: return "Very Low"
        }
    }

    var budgetNote: String {
        switch self {
        case .privateCompany: return "Private companies typically have flexible budgets"
        case .publicCompany: return "Public companies have substantial budgets but more oversight"
        case .governmental: return "Government entities usually have limited budgets and strict processes"
        case .nonprofit: return "Non-profits typically have very limited budgets"
        }
    }
}

// MARK: - Social Media Presence

public struct SocialMediaPresence: Codable {
    var hasPresence: Bool
    var activityLevel: ActivityLevel?
    var platforms: [SocialPlatform]
    var contentTypes: [ContentType]

    var score: Double {
        guard hasPresence else { return 0.0 }
        let activityScore = activityLevel?.score ?? 0.5
        let platformBonus = Double(platforms.count) * 0.1
        return min(activityScore + platformBonus, 1.0)
    }
}

public enum ActivityLevel: String, Codable, CaseIterable {
    case inactive = "Inactive"
    case low = "Low"
    case moderate = "Moderate"
    case high = "High"
    case veryHigh = "Very High"

    var score: Double {
        switch self {
        case .inactive: return 0.0
        case .low: return 0.25
        case .moderate: return 0.5
        case .high: return 0.75
        case .veryHigh: return 1.0
        }
    }
}

public enum SocialPlatform: String, Codable, CaseIterable {
    case linkedin = "LinkedIn"
    case instagram = "Instagram"
    case facebook = "Facebook"
    case twitter = "Twitter/X"
    case youtube = "YouTube"
    case tiktok = "TikTok"
}

public enum ContentType: String, Codable, CaseIterable {
    case video = "Video"
    case motionGraphics = "Motion Graphics"
    case images = "Images"
    case textOnly = "Text Only"

    var valueScore: Double {
        switch self {
        case .video: return 1.0
        case .motionGraphics: return 0.75
        case .images: return 0.5
        case .textOnly: return 0.25
        }
    }

    var spendIndicator: String {
        switch self {
        case .video: return "High spend potential"
        case .motionGraphics: return "Moderate-high spend"
        case .images: return "Moderate spend"
        case .textOnly: return "Low spend potential"
        }
    }
}

// MARK: - Holding Group Size

public enum HoldingGroupSize: String, Codable {
    case none = "Independent"
    case small = "Small Group (2-5 brands)"
    case medium = "Medium Group (6-20 brands)"
    case large = "Large Group (21+ brands)"

    var score: Double {
        switch self {
        case .none: return 0.5
        case .small: return 0.6
        case .medium: return 0.8
        case .large: return 1.0
        }
    }
}
