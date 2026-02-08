#!/usr/bin/env python3
"""Create a simple test PDF for testing the RFP parser"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.units import inch
import sys

def create_test_pdf(filename):
    """Create a test PDF with sample RFP content"""

    doc = SimpleDocTemplate(filename, pagesize=letter)
    story = []
    styles = getSampleStyleSheet()

    # Title
    title = Paragraph("<b>REQUEST FOR PROPOSAL - TEST DOCUMENT</b>", styles['Title'])
    story.append(title)
    story.append(Spacer(1, 0.3*inch))

    # Client Information
    story.append(Paragraph("<b>CLIENT INFORMATION</b>", styles['Heading2']))
    story.append(Paragraph("Client: Test Corporation Inc.", styles['Normal']))
    story.append(Paragraph("Project: Website Redesign Project", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))

    # Project Description
    story.append(Paragraph("<b>PROJECT DESCRIPTION</b>", styles['Heading2']))
    story.append(Paragraph(
        "We are seeking proposals for a complete website redesign including "
        "modern UI/UX design, responsive layout, and content management system integration.",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.2*inch))

    # Scope of Work
    story.append(Paragraph("<b>SCOPE OF WORK</b>", styles['Heading2']))
    scope_items = [
        "Brand strategy and positioning",
        "UI/UX design for 10 pages",
        "Responsive web development",
        "CMS integration (WordPress)",
        "SEO optimization",
        "Content migration from old site",
        "Training for content editors"
    ]
    for item in scope_items:
        story.append(Paragraph(f"• {item}", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))

    # Evaluation Criteria
    story.append(Paragraph("<b>EVALUATION CRITERIA</b>", styles['Heading2']))
    story.append(Paragraph("Proposals will be evaluated based on:", styles['Normal']))
    criteria = [
        "Technical approach and methodology (40%)",
        "Team experience and qualifications (30%)",
        "Cost and value proposition (20%)",
        "Proposed timeline and milestones (10%)"
    ]
    for i, criterion in enumerate(criteria, 1):
        story.append(Paragraph(f"{i}. {criterion}", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))

    # Important Dates
    story.append(Paragraph("<b>IMPORTANT DATES</b>", styles['Heading2']))
    story.append(Paragraph("Submission Deadline: March 15, 2026", styles['Normal']))
    story.append(Paragraph("Project Start Date: April 1, 2026", styles['Normal']))
    story.append(Paragraph("Expected Completion: July 31, 2026", styles['Normal']))

    # Build PDF
    doc.build(story)
    print(f"✅ Created test PDF: {filename}")

if __name__ == "__main__":
    output_file = "/Users/Faisal/Documents/iloverfp/angle-rfp/TestData/test-rfp.pdf"
    try:
        create_test_pdf(output_file)
    except ImportError:
        print("❌ reportlab not installed. Install with: pip3 install reportlab")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error creating PDF: {e}")
        sys.exit(1)
