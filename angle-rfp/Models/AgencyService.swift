//
//  AgencyService.swift
//  angle-rfp
//
//  Model for agency services (PLACEHOLDER - user will provide real data)
//

import Foundation

struct AgencyService: Identifiable, Codable {
    let id: String
    let name: String
    let category: ServiceCategory
    let keywords: [String]
    let description: String?

    init(id: String,
         name: String,
         category: ServiceCategory,
         keywords: [String],
         description: String? = nil) {
        self.id = id
        self.name = name
        self.category = category
        self.keywords = keywords
        self.description = description
    }
}

enum ServiceCategory: String, Codable, CaseIterable {
    case strategy = "Strategy"
    case branding = "Branding"
    case videoProduction = "Video Production"
    case motionGraphics = "Motion Graphics"
    case socialMedia = "Social Media"
    case contentCreation = "Content Creation"
    case webDevelopment = "Web Development"
    case digitalMarketing = "Digital Marketing"

    var icon: String {
        switch self {
        case .strategy: return "lightbulb.fill"
        case .branding: return "paintbrush.fill"
        case .videoProduction: return "video.fill"
        case .motionGraphics: return "wand.and.stars"
        case .socialMedia: return "person.2.fill"
        case .contentCreation: return "doc.text.fill"
        case .webDevelopment: return "globe"
        case .digitalMarketing: return "chart.line.uptrend.xyaxis"
        }
    }
}

// MARK: - Agency Services Loader

class AgencyServicesLoader {
    static let shared = AgencyServicesLoader()

    private var cachedServices: [AgencyService]?

    /// Load agency services from JSON file
    func loadServices() -> [AgencyService] {
        if let cached = cachedServices {
            return cached
        }

        guard let url = Bundle.main.url(forResource: "AgencyServices", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(AgencyServicesData.self, from: data) else {
            // Return placeholder services if file not found
            return placeholderServices()
        }

        cachedServices = decoded.services
        return decoded.services
    }

    /// Placeholder services (user will provide real data)
    private func placeholderServices() -> [AgencyService] {
        return [
            AgencyService(
                id: "1",
                name: "Brand Strategy",
                category: .strategy,
                keywords: ["brand", "strategy", "positioning", "identity", "branding"],
                description: "PLACEHOLDER - User will provide real services"
            ),
            AgencyService(
                id: "2",
                name: "Video Production",
                category: .videoProduction,
                keywords: ["video", "filming", "production", "shoot", "cinematography"]
            ),
            AgencyService(
                id: "3",
                name: "Motion Graphics",
                category: .motionGraphics,
                keywords: ["motion graphics", "animation", "motion design", "animated"]
            ),
            AgencyService(
                id: "4",
                name: "Social Media Management",
                category: .socialMedia,
                keywords: ["social media", "community management", "social content"]
            ),
            AgencyService(
                id: "5",
                name: "Content Creation",
                category: .contentCreation,
                keywords: ["content", "copywriting", "writing", "blog"]
            )
        ]
    }
}

struct AgencyServicesData: Codable {
    let services: [AgencyService]
}
