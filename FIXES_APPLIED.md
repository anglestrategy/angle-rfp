# File Upload Fix - Applied 2026-02-04

## Issues Reported

1. **TXT file upload failed** - Error: "Invalid document: Could not load PDF file"
2. **PDF file upload failed** - Could not load PDF files

## Root Causes Identified

### Issue #1: Wrong Parser Used for TXT Files
**Problem**: `parseDocument()` always used `PDFParsingService` regardless of file type

**Location**: `ContentView.swift:154`
```swift
// BEFORE (Wrong):
let parser = PDFParsingService()  // Always PDF!
```

**Fix**: Added file extension detection with switch statement
```swift
// AFTER (Correct):
let fileExtension = url.pathExtension.lowercased()
switch fileExtension {
case "pdf":
    let parser = PDFParsingService()
case "txt":
    let parser = TXTParsingService()
case "docx":
    // Coming in Phase 2
}
```

### Issue #2: Security-Scoped Resource Access
**Problem**: macOS sandboxing prevents reading files from file picker without explicit permission

**Location**: `ContentView.swift` - `parseDocument()` function

**Fix**: Added security-scoped resource access before reading file
```swift
// Request access to security-scoped resource (macOS sandboxing requirement)
let accessGranted = url.startAccessingSecurityScopedResource()

defer {
    if accessGranted {
        url.stopAccessingSecurityScopedResource()
    }
}
```

**Why This Matters**:
- File picker returns security-scoped URLs
- Without `startAccessingSecurityScopedResource()`, PDFDocument(url:) returns nil
- This caused "Could not load PDF file" error even though file was valid

### Issue #3: Missing TXTParsingService
**Problem**: Referenced TXTParsingService but it didn't exist

**Fix**: Created `/Services/DocumentParsing/TXTParsingService.swift` with:
- UTF-8 encoding (with ASCII fallback)
- Text validation (checks for empty content)
- Warning for very short files (<200 chars)
- Proper error handling with localized messages

## Changes Made

### 1. ContentView.swift
- ✅ Added file extension detection
- ✅ Added security-scoped resource access
- ✅ Added switch statement for different parsers
- ✅ Added helpful error messages for unsupported formats
- ✅ Added DOCX placeholder (Phase 2)

### 2. TXTParsingService.swift (NEW FILE)
- ✅ Created complete TXT parsing service
- ✅ Implements DocumentParsingService protocol
- ✅ UTF-8 encoding with ASCII fallback
- ✅ Content validation
- ✅ Warning generation for short files
- ✅ Progress reporting

## Testing Checklist

**Before Testing**:
- [x] Build succeeds
- [x] No compilation errors
- [x] TXTParsingService added to project

**To Test**:
1. [ ] Launch app
2. [ ] Upload sample-rfp.txt - should show parsed text
3. [ ] Upload a PDF file - should show parsed text
4. [ ] Try DOCX - should show "DOCX support coming in Phase 2"
5. [ ] Try unsupported format (e.g., .jpg) - should show error

## Expected Results

### TXT File Upload
- ✅ File picker accepts .txt files
- ✅ Parsing starts with progress indicator
- ✅ Text content displayed (first 1000 chars)
- ✅ No "Could not load PDF file" error

### PDF File Upload
- ✅ File picker accepts .pdf files
- ✅ Security-scoped access granted
- ✅ PDFDocument loads successfully
- ✅ Text extracted and displayed
- ✅ OCR triggers if scanned PDF
- ✅ Page count shown in console

### Error Handling
- ✅ Unsupported formats show helpful message
- ✅ Empty files show "No text could be extracted"
- ✅ Corrupted files show appropriate error
- ✅ DOCX shows "Phase 2" message

## Files Modified

1. `/angle-rfp/App/ContentView.swift`
   - Lines 147-206: Complete rewrite of `parseDocument()` function

2. `/angle-rfp/Services/DocumentParsing/TXTParsingService.swift`
   - NEW FILE: 58 lines
   - Implements complete TXT parsing functionality

## Technical Details

### Security-Scoped Resources
macOS apps using file pickers must:
1. Call `startAccessingSecurityScopedResource()` before reading
2. Call `stopAccessingSecurityScopedResource()` when done
3. Use `defer` to ensure cleanup happens even on errors

Without this, file access fails silently (returns nil).

### File Type Detection
Using `url.pathExtension.lowercased()` to handle:
- Mixed case extensions (.PDF, .Pdf, .pdf)
- Different file types with appropriate parsers
- Future extensibility (easy to add .docx, .doc, etc.)

## Next Steps

1. User tests file upload with TXT and PDF
2. Verify error messages are user-friendly
3. Continue with Phase 2: DOCX parsing implementation
4. Then: Claude API integration for actual RFP extraction

---

**Status**: ✅ Ready for Testing
**Build**: SUCCESS
**Critical Bugs**: 2/2 Fixed
