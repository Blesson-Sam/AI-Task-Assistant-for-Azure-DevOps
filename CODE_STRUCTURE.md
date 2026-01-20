# Code Structure Guide - popup.js

## File Organization

The `popup.js` file (3300+ lines) is organized into the following major sections:

### 1. **GLOBAL STATE MANAGEMENT** (Lines 1-50)
- Create Task Tab State
  - `generatedTasks[]` - AI-generated tasks
  - `userStoryData` - Selected User Story
  - `iterationPath`, `assignedTo`, `areaPath`
  - `selectedWorkItemType`
- Evaluate Tab State
  - `currentEvaluation` - Evaluation results
  - `currentEvalStoryId` - Story being evaluated
  - `currentEvalStoryData` - Full story data
- Insights Tab State
  - `currentInsights` - Analysis results
  - `allInsightTeams[]` - Teams for filtering
  - `filteredInsightWorkItems[]` - Filtered results

### 2. **CONSTANTS AND CONFIGURATION** (Lines 51-110)
- **AI_CONFIG** - GPT-5.2-Chat endpoint configuration
- **EXPERIENCE_CONFIG** - Developer experience multipliers (Fresher 2x, Junior 1.5x, Mid 1x, Senior 0.75x)
- **VALIDATION_RULES** - Required fields for Feature, User Story, Task work items

### 3. **INITIALIZATION** (Lines 111-125)
- `DOMContentLoaded` event listener
- `loadSettings()` - Load saved Azure DevOps settings
- `setupEventListeners()` - Bind all UI events
- `updateExperienceInfo()` - Show experience level description

### 4. **EVENT LISTENERS SETUP** (Lines 126-210)
Organized by functionality:
- Settings Modal events
- Tab Navigation events
- Work Item Type Selection
- Tab 1: Create Task events
- Tab 2: Evaluate events
- Tab 3: Insights events
- Security Controls

### 5. **EVENT DELEGATION HANDLERS** (Lines 211-280)
- `handleEvaluationClick()` - Evaluate tab button clicks
- `handleTaskListClick()` - Task list interactions
- `handleTaskCheckboxChange()` - Task selection
- `handleInsightsClick()` - Insights results actions

### 6. **SETTINGS MANAGEMENT** (Lines 281-450)
Functions:
- `openSettingsModal()` - Show settings dialog
- `closeSettingsModal()` - Hide settings dialog
- `loadSettings()` - Load from Chrome storage
- `saveSettings()` - Save to Chrome storage
- `testADOConnection()` - Test Azure DevOps API connection
- `clearAllStoredData()` - Clear all saved data
- `togglePasswordVisibility()` - Show/hide passwords
- `getSettings()` - Retrieve current settings

### 7. **UI HELPER FUNCTIONS** (Lines 451-650)
- `switchTab()` - Navigate between 3 tabs
- `showLoading()` - Show loading spinner
- `showResult()` - Show success/error messages
- `updateExperienceInfo()` - Update experience level description
- `selectWorkItemType()` - Handle work item type selection
- `selectEvalWorkItemType()` - Handle evaluation type selection

### 8. **CREATE TASK TAB** (Lines 651-1450)

#### 8.1 Fetching Work Items
- `fetchWorkItem()` - Fetch User Story/Feature from Azure DevOps
- `fetchParentFeatureData()` - Get parent Feature for validation
- `displayWorkItemInfo()` - Show fetched work item details
- `displayWorkItemHierarchy()` - Show Feature → User Story relationship

#### 8.2 AI Task Generation
- `generateTasks()` - Call AI to generate tasks
- `buildPrompt()` - Construct AI prompt with context
- `callAI()` - Make API call to Azure OpenAI
- `displayTasks()` - Show generated tasks in UI
- `forceGenerateTasks()` - Regenerate without existing tasks check

#### 8.3 Task Management
- `toggleTask()` - Select/deselect task for creation
- `toggleEdit()` - Enable editing task details
- `saveTaskEdit()` - Save edited task
- `cancelEdit()` - Cancel task editing
- `removeTask()` - Remove task from list
- `clearTasks()` - Clear all generated tasks

#### 8.4 Creating Tasks in Azure DevOps
- `createAllTasksInADO()` - Create all selected tasks
- `createSingleTaskInADO()` - Create one task
- `goToEvaluateTab()` - Navigate to Evaluate tab with work item

### 9. **EVALUATE TAB** (Lines 1451-1950)

#### 9.1 Fetching and Evaluation
- `fetchAndEvaluate()` - Fetch and evaluate work item
- `evaluateWorkItem()` - Run validation checks
- `fetchChildTasksForEval()` - Get child tasks for User Story

#### 9.2 Validation Logic
- `checkRequiredFields()` - Verify all required fields present
- `validateDateLogic()` - Check date consistency
- `validateWorkTracking()` - Verify Original = Remaining + Completed
- `checkTimelineIssues()` - Find tasks ending after parent

#### 9.3 Display Results
- `displayEvaluationResults()` - Show validation results
- `displayMissingFields()` - List missing fields
- `displayInvalidValues()` - Show date/value issues
- `displayChildTasks()` - Show tasks with issues

#### 9.4 Fixing Issues
- `createSuggestedTask()` - Create single suggested task
- `createAllSuggestedTasks()` - Create all suggested tasks
- `deleteWorkItemFromADO()` - Delete work item

### 10. **INSIGHTS TAB** (Lines 1951-2850)

#### 10.1 Fetching Work Items
- `fetchUserWorkItems()` - Fetch all work items for user
- `fetchProjectsByUser()` - Get projects with user's work items
- `fetchSprintsByProject()` - Get sprints for project
- `fetchWorkItemsByFilters()` - Apply filters and fetch
- `updateBoardFilter()` - Update board/team dropdown

#### 10.2 Filtering
- `applyInsightFilters()` - Apply selected filters
- `filterByProject()` - Filter by project
- `filterByTeam()` - Filter by board/team
- `filterBySprint()` - Filter by sprint
- `filterByWorkItemType()` - Filter by type

#### 10.3 Validation and Analysis
- `validateWorkItem()` - Validate single work item
- `validateWorkItem()` - Check all required fields
- `checkDateConsistency()` - Verify dates are logical
- `checkWorkTrackingConsistency()` - Verify time tracking math
- `analyzeInsights()` - Categorize and analyze all items
- `fetchChildTasksForStory()` - Get child tasks for end date calculation

#### 10.4 Display Results
- `displayInsightsResults()` - Show analysis results
- `displayIncompleteItems()` - Show items with missing fields
- `displayTimelineIssues()` - Show tasks crossing deadlines
- `renderInsightItem()` - Render single item card

#### 10.5 Auto-Fix Functionality
- `autoFixSingleItem()` - Fix single work item
- `autoFixAllIncomplete()` - Fix all incomplete items
- `generateDefaultValues()` - Calculate correct values for fields
- `updateWorkItem()` - Send updates to Azure DevOps

### 11. **AZURE DEVOPS API HELPERS** (Lines 2851-3100)
- `getAzureDevOpsHeaders()` - Build API request headers
- `fetchWorkItemById()` - Get work item by ID
- `createWorkItem()` - Create new work item
- `updateWorkItem()` - Update existing work item
- `deleteWorkItem()` - Delete work item
- `fetchWorkItemRelations()` - Get parent/child relationships
- `buildWorkItemPayload()` - Construct API payload

### 12. **UTILITY FUNCTIONS** (Lines 3101-3271)
- `formatDate()` - Format dates for display
- `parseDate()` - Parse date strings
- `calculateWorkDays()` - Calculate work days between dates
- `formatDuration()` - Format hours as "Xh" or "Xd Yh"
- `escapeHtml()` - Prevent XSS attacks
- `debounce()` - Debounce function calls
- `formatDateDiff()` - Calculate difference between dates

## Key Design Patterns

### 1. **Event Delegation**
- Use event delegation for dynamically created elements
- Reduces memory footprint and handles new elements automatically

### 2. **Separation of Concerns**
- Settings management separate from business logic
- Each tab has dedicated functions
- API calls isolated in helper functions

### 3. **State Management**
- Global state variables for each tab
- State cleared when switching contexts
- Session vs persistent storage for security

### 4. **Validation**
- Centralized VALIDATION_RULES configuration
- Reusable validation functions
- Consistent error messaging

### 5. **AI Integration**
- Experience-based time multipliers
- Context-aware prompt building
- Error handling for API failures

## Function Naming Conventions

- `fetch*()` - API calls to Azure DevOps
- `display*()` - UI rendering functions
- `show*()` - Show/hide UI elements
- `validate*()` - Validation logic
- `handle*()` - Event handlers
- `toggle*()` - Toggle states (edit, visibility)
- `create*()` - Create work items in Azure DevOps
- `autoFix*()` - Automatic fixing of issues

## Common Parameters

- `org` - Azure DevOps organization name
- `project` - Project name
- `pat` - Personal Access Token
- `itemId` - Work item ID
- `itemType` - "Feature", "User Story", or "Task"
- `auth` - Base64 encoded PAT for API calls

## Error Handling

- Try-catch blocks around all API calls
- User-friendly error messages via `showResult()`
- Console logging for debugging
- Fallback values for missing data
