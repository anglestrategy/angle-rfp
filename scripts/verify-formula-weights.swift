#!/usr/bin/env swift

import Foundation

print("🔍 Verifying Financial Formula Weights...\n")
print(String(repeating: "=", count: 60))

let weights: [(String, Double, String)] = [
    ("Company Size & Popularity", 0.15, "10 (size) + 5 (popularity)"),
    ("Project Scope Magnitude", 0.20, "Scope complexity"),
    ("Social Media Activity", 0.08, "Activity level"),
    ("Content Types Published", 0.12, "Video > Graphics > Images > Text"),
    ("Holding Group", 0.08, "Present or independent"),
    ("Entity Type", 0.07, "Public > Private > Govt > Nonprofit"),
    ("Media/Ad Spend", 0.10, "Spend indicators"),
    ("Agency Service Alignment", 0.05, "Match percentage"),
    ("Output Quantities", 0.03, "Total count"),
    ("Output Types", 0.02, "Video > Motion > Visuals > Content")
]

print("\nFactor Breakdown:")
print(String(repeating: "-", count: 60))

var total: Double = 0.0
for (index, (name, weight, note)) in weights.enumerated() {
    let percentage = weight * 100
    total += weight
    print(String(format: "%2d. %-30s %5.1f%%  │ %s",
                 index + 1, name, percentage, note))
}

print(String(repeating: "=", count: 60))
print(String(format: "TOTAL:                                 %5.1f%%", total * 100))
print(String(repeating: "=", count: 60))

if abs(total - 1.0) < 0.001 {
    print("\n✅ SUCCESS: Weights sum to exactly 100%!")
    print("✅ Formula is mathematically correct")
} else {
    print("\n❌ ERROR: Weights sum to \(String(format: "%.1f%%", total * 100))")
    print("❌ Expected: 100.0%")
    print("❌ Difference: \(String(format: "%.1f%%", (total - 1.0) * 100))")
}

print("\n📊 Scoring Ranges:")
print(String(repeating: "-", count: 60))
print("  0-40%:  Low Financial Potential - High Risk")
print(" 41-65%:  Moderate Financial Potential - Proceed with Caution")
print(" 66-85%:  Good Financial Potential - Recommended")
print("86-100%:  Excellent Financial Potential - High Priority")

print("\n" + String(repeating: "=", count: 60))
