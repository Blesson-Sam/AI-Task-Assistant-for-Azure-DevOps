# AI Task Assistant for Azure DevOps

A powerful, free Chrome extension that uses AI to create, evaluate, and analyze Azure DevOps work items with intelligent task breakdown, quality validation, and personalized insights.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Cost](https://img.shields.io/badge/cost-FREE-brightgreen)
![Security](https://img.shields.io/badge/security-local--only-green)
![Tabs](https://img.shields.io/badge/features-3%20tabs-purple)

---

## Features

### 🎯 Three Powerful Tabs

| Tab | Purpose | Key Features |
|-----|---------|-------------|
| **📝 Create Task** | AI-powered task generation | Break down User Stories into tasks with smart estimation |
| **✅ Evaluate Tasks** | Quality validation | Analyze existing tasks for completeness and standards |
| **📊 Easy Insights** | Personal analytics | Get insights on your assigned work items |

### Core Capabilities

- **AI-Powered Task Breakdown** - Automatically analyzes User Stories and creates detailed tasks
- **Experience-Based Estimation** - Adjusts estimates based on developer skill level (Fresher → Senior)
- **Time-Constrained Planning** - Fits all tasks within your specified deadline
- **Existing Task Detection** - Warns before generating if tasks already exist
- **Quality Validation** - AI evaluates tasks against mandatory field requirements
- **Smart Field Mapping** - Auto-sets Iteration, Assignee, Area Path, Priority, and Activity
- **Personalized Insights** - Validates your assigned work items across the project
- **Modern UI** - Clean, developer-friendly interface with tabbed navigation
- **100% Free** - Uses Groq AI free tier, no costs involved


---

## Table of Contents

1. [Security & Privacy](#-security--privacy)
2. [Installation](#installation)
3. [Setup](#setup)
4. [The Three Tabs](#the-three-tabs)
   - [Tab 1: Create Task](#tab-1-create-task)
   - [Tab 2: Evaluate Tasks](#tab-2-evaluate-tasks)
   - [Tab 3: Easy Insights](#tab-3-easy-insights)
5. [Features Explained](#features-explained)
6. [Field Mappings](#field-mappings)
7. [Troubleshooting](#troubleshooting)

---

## 🔒 Security & Privacy

**Your credentials are safe.** This extension is designed with security-first principles:

| Security Feature | Description |
|-----------------|-------------|
| ✅ **Local Storage Only** | All credentials are stored only on YOUR device using Chrome's secure local storage |
| ✅ **No Backend Server** | This extension has NO backend server - your data never passes through any intermediary |
| ✅ **Direct API Calls** | PAT tokens are sent ONLY to official Azure DevOps APIs (dev.azure.com) |
| ✅ **No Data Collection** | We do NOT collect, store, or transmit any of your data anywhere |
| ✅ **Open Source** | All code is visible and auditable - you can verify exactly what the extension does |
| ✅ **Session-Only Mode** | Option to NOT save credentials - enter them each session for maximum security |
| ✅ **One-Click Clear** | Instantly delete all stored data from your device |


### Data Flow Diagram

```
┌─────────────────────┐
│   Your Browser      │
│  (Chrome Extension) │
└──────────┬──────────┘
           │
           │ Direct HTTPS calls only
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐   ┌────────┐
│ Azure  │   │ Groq   │
│ DevOps │   │  AI    │
│ (PAT)  │   │ (API)  │
└────────┘   └────────┘
Microsoft    Groq Inc.

❌ No third-party servers
❌ No data collection
❌ No analytics
```

### Best Practices for PAT Security

1. **Create a dedicated PAT** for this extension with minimal permissions
2. **Set expiration** - Use short-lived PATs (30-90 days)
3. **Scope permissions** - Only grant "Work Items: Read & Write"
4. **Use session mode** - Uncheck "Remember credentials" for shared computers
5. **Revoke when done** - Remove the PAT from Azure DevOps if no longer needed


## Installation

### Step 1: Download the Extension

Clone or download this repository to your local machine.

### Step 2: Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right corner)
3. Click **Load unpacked**
4. Select the `ado-ai-task-extension` folder
5. The extension icon will appear in your Chrome toolbar

---

## Setup

### Get a Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up for a free account
3. Navigate to **API Keys**
4. Click **Create API Key**
5. Copy the key (starts with `gsk_...`)

> **Note:** Groq offers a generous free tier - no credit card required!

### Get Azure DevOps Personal Access Token (PAT)

1. Go to your Azure DevOps organization (e.g., `https://dev.azure.com/yourorg`)
2. Click on **User Settings** (gear icon) → **Personal access tokens**
3. Click **+ New Token**
4. Configure the token:
   - **Name:** `AI Task Assistant`
   - **Organization:** Select your organization
   - **Expiration:** Choose a date
   - **Scopes:** Select **Custom defined**, then check:
     - ✅ **Work Items** → **Read & Write**
5. Click **Create**
6. **Copy the token immediately** (you won't see it again!)

### Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Expand the **Settings** section
3. Enter:
   - **Organization Name:** Your ADO organization (e.g., `mycompany`)
   - **Project Name:** Your project name exactly as shown in ADO
   - **Azure DevOps PAT:** The token you created
   - **Groq API Key:** Your Groq API key
4. Click **Save Settings**

---

## The Three Tabs

### Tab 1: Create Task

**Purpose:** AI-powered task generation from User Stories, Features, or manual input.

#### Quick Start

1. Click the extension icon → **Create Task** tab is active by default
2. Enter Work Item ID (Feature/User Story) and click **Fetch**
3. Select developer **experience level**
4. Set **days to complete**
5. Click **Generate Tasks with AI**
6. Review, edit, or remove tasks
7. Click **Create All Tasks in ADO**

#### Detailed Workflow

**Step 1: Fetch Work Item**

| Method | How to Use |
|--------|------------|
| **By ID** | Enter Work Item ID (e.g., `12345`) → Click **Fetch** |
| **Manual** | Paste User Story text directly into the text area |

The extension retrieves:
- Title
- Description
- Acceptance Criteria
- Iteration Path, Area Path, Assigned To (for auto-mapping)

**Step 2: Configure Parameters**

*Developer Experience Level:*

| Level | Multiplier | Description |
|-------|------------|-------------|
| 👶 Fresher (0-1 years) | 2.0x | Learning tech stack, needs extra time |
| 🧑 Junior (1-2 years) | 1.5x | Needs guidance, some documentation lookup |
| 👨‍💻 Mid-Level (2-5 years) | 1.0x | Standard estimates, works independently |
| 🧙 Senior (5+ years) | 0.75x | Expert, efficient execution |

*Days to Complete:*
- Set working days available
- Calculated at **6 productive hours per day**
- AI fits all tasks within this timeframe

**Step 3: Generate Tasks**

⚠️ **Smart Detection:** If tasks already exist under the User Story, you'll see a warning with option to go to **Evaluate Tab** instead.

Click **Generate Tasks with AI** to:
- Analyze the User Story
- Break it into actionable tasks
- Assign priorities and activities
- Estimate hours based on experience level

**Step 4: Review & Edit**

For each generated task:
- ✅ **Select/Deselect** - Choose which tasks to create
- ✏️ **Edit** - Modify title, description, hours, priority, activity
- 🗑️ **Remove** - Delete unwanted tasks

**Step 5: Create in Azure DevOps**

Click **Create All Tasks in ADO** to create selected tasks with:
- Parent link to User Story
- All fields auto-populated
- Immediate sync to Azure DevOps

---

### Tab 2: Evaluate Tasks

**Purpose:** Validate existing tasks under a User Story for completeness and quality.

#### How It Works

1. Switch to **Evaluate Tasks** tab
2. Enter **User Story ID**
3. Optionally enter **Title** (auto-filled on fetch)
4. Optionally enter **Description** (helps AI understand context)
5. Click **Fetch & Evaluate**

#### What It Evaluates

The AI analyzes each task against **mandatory field requirements**:

| Work Item Type | Mandatory Fields |
|----------------|------------------|
| **Feature** | Title, Description, Priority, Business Value |
| **User Story** | Title, Description, Acceptance Criteria, Priority, Story Points |
| **Task** | Title, Description, Original Estimate, Remaining Work, Activity, Priority |

#### Evaluation Results

Each task is categorized:

| Status | Meaning |
|--------|--------|
| ✅ **Valid** | All mandatory fields are properly filled |
| ⚠️ **Needs Attention** | Some fields missing or incomplete |
| ❌ **Invalid** | Critical fields missing |

For each issue, you get:
- **Field name** that needs attention
- **Specific recommendation** from AI
- **Suggested value** when applicable

#### Actions Available

- **💾 Save Changes** - Apply AI suggestions to tasks in ADO
- **➕ Create Missing Tasks** - If AI recommends additional tasks

---

### Tab 3: Easy Insights

**Purpose:** Get personalized validation of YOUR assigned work items across the entire project.

#### How It Works

1. Switch to **Easy Insights** tab
2. Select your **Experience Level** (affects estimation validation)
3. Click **Analyze My Work Items**

#### What It Analyzes

The extension fetches ALL work items assigned to you (based on your ADO credentials) and validates:

| Check | Description |
|-------|-------------|
| **Field Completeness** | Are all mandatory fields filled? |
| **Estimation Accuracy** | Are hours realistic for your experience level? |
| **Priority Consistency** | Do priorities align with parent items? |
| **Activity Mapping** | Are activities correctly categorized? |

#### Insights Provided

- **Summary Statistics**
  - Total items assigned
  - Items needing attention
  - Completion percentage

- **Per-Item Analysis**
  - Validation status (Valid/Warning/Invalid)
  - Specific field issues
  - AI recommendations

- **Experience-Based Feedback**
  - Estimation adjustment suggestions
  - Workload distribution insights

---

## Usage Summary

| Task | Tab to Use |
|------|------------|
| Create new tasks from User Story | **Create Task** |
| Check if existing tasks are complete | **Evaluate Tasks** |
| Review all my assigned items | **Easy Insights** |
| Fix missing fields on tasks | **Evaluate Tasks** → Save Changes |
| Get AI task recommendations | **Create Task** → Generate |

---

## Features Explained

### Experience-Based Estimation

The extension adjusts estimates based on who will do the work:

```
Base Estimate × Experience Multiplier = Final Estimate

Example: 4 hour task
- Fresher: 4 × 2.0 = 8 hours
- Junior:  4 × 1.5 = 6 hours
- Mid:     4 × 1.0 = 4 hours
- Senior:  4 × 0.75 = 3 hours
```

### Time-Constrained Planning

When you set "Days to Complete":
1. Extension calculates available hours (days × 6 hrs/day)
2. Accounts for experience multiplier
3. AI generates tasks that fit within the limit

```
Example: 2 days with Junior developer
- Available: 2 × 6 = 12 hours
- AI budget: 12 ÷ 1.5 = 8 hours (before multiplier)
- After multiplier: 8 × 1.5 = 12 hours ✓
```

### Smart Field Mapping

Tasks inherit from the parent User Story:

| Task Field | Source |
|------------|--------|
| Iteration Path | Same as User Story |
| Area Path | Same as User Story |
| Assigned To | Same as User Story |
| Parent Link | Linked to User Story |

---

## Field Mappings

### Priority Values

| Value | Label | Color |
|-------|-------|-------|
| 1 | Critical | Red |
| 2 | High | Orange |
| 3 | Medium | Blue |
| 4 | Low | Green |

### Activity Types

Only these 6 activities are supported (matches Azure DevOps):

- **Deployment** - Release and deployment tasks
- **Design** - Architecture and design work
- **Development** - Coding and implementation
- **Documentation** - Writing docs and guides
- **Requirements** - Gathering and analysis
- **Testing** - Unit tests, QA, validation

### Work Item Fields Set

| Field | Description |
|-------|-------------|
| System.Title | Task title |
| System.Description | Detailed description |
| System.IterationPath | Sprint/Iteration |
| System.AreaPath | Team/Area |
| System.AssignedTo | Developer |
| Microsoft.VSTS.Scheduling.OriginalEstimate | Initial hours |
| Microsoft.VSTS.Scheduling.RemainingWork | Hours remaining |
| Microsoft.VSTS.Scheduling.CompletedWork | Hours done (0) |
| Microsoft.VSTS.Common.Priority | 1-4 |
| Microsoft.VSTS.Common.Activity | Activity type |

---

## Troubleshooting

### Error: Failed to fetch: 401

**Cause:** Authentication failed

**Solutions:**
1. Verify **Organization Name** matches your ADO URL
   - URL: `https://dev.azure.com/kantaranalytics` → Org: `kantaranalytics`
2. Check **Project Name** is exact (case-sensitive, includes spaces)
3. Ensure **PAT has Work Items Read & Write** permission
4. PAT may have expired - create a new one

### Error: Connection failed

**Solutions:**
1. Click **Test ADO Connection** in Settings
2. Check if you can access ADO in browser
3. Verify organization name spelling

### AI Returns Invalid JSON

**Cause:** AI response parsing failed

**Solutions:**
1. Try again - AI responses vary
2. Simplify the User Story text
3. Check Groq API key is valid

### Tasks Not Fitting Time Limit

**Cause:** Complex User Story for given timeframe

**Solutions:**
1. Increase days to complete
2. Select higher experience level
3. Break User Story into smaller stories

### Extension Not Loading

**Solutions:**
1. Go to `chrome://extensions/`
2. Click refresh button on the extension
3. Check for errors in extension details
4. Ensure all files are present in folder

---

## File Structure

```
ado-ai-task-extension/
├── manifest.json      # Extension configuration
├── popup.html         # Extension UI
├── popup.js           # Main application logic
├── styles.css         # Styling
├── content.js         # Content script for ADO pages
├── icon.png           # Extension icon
└── README.md          # This documentation
```

---

## Privacy & Security

This extension is designed with a **security-first approach**:

- 🔒 **Local Storage Only** - Credentials stored in Chrome's secure local storage on your device
- 🔒 **No Backend Server** - Extension has NO backend - data never passes through any intermediary
- 🔒 **Direct API Calls** - PAT sent ONLY to Azure DevOps, API key sent ONLY to Groq AI
- 🔒 **No Data Collection** - We do NOT collect, track, or transmit any telemetry
- 🔒 **Session Mode Available** - Option to NOT remember credentials between sessions
- 🔒 **Clear Data Option** - One-click button to delete all stored data
- 🔒 **Open Source** - Full code transparency - audit the code yourself

### Where is my data stored?

| Data | Storage Location | Sent To |
|------|-----------------|---------|
| Azure DevOps PAT | Your browser (local) | Azure DevOps API only |
| Groq API Key | Your browser (local) | Groq AI API only |
| Organization/Project | Your browser (local) | Azure DevOps API only |
| Work Items | Not stored | Azure DevOps (read/write) |
| Generated Tasks | Memory only | Azure DevOps (when created) |

### Security FAQ

**Q: Is my PAT token safe?**
> Yes. Your PAT is stored only on YOUR device in Chrome's local storage. It's sent only to Azure DevOps API endpoints (`https://dev.azure.com/...`) for legitimate operations.

**Q: Does this extension have a backend server?**
> No. This is a 100% client-side extension. All code runs locally in your browser. There is no server that receives your data.

**Q: Can the developer see my credentials?**
> No. We have no server, no analytics, no tracking. Your credentials never leave your device except to call the official APIs.

**Q: What if I'm on a shared computer?**
> Uncheck "Remember credentials" in settings. Your data will only be stored in memory during the session and cleared when you close the popup.

**Q: How do I delete all my stored data?**
> Click the "Clear All Stored Data" button in Settings. This immediately removes everything from Chrome storage.

**Q: What's the best practice for PAT security?**
> 1. Create a PAT with only "Work Items: Read & Write" scope
> 2. Set a short expiration (30-90 days)
> 3. Use session-only mode on shared computers
> 4. Revoke the PAT when you no longer need it

---

## Technologies Used

- **Groq AI** - Free LLaMA 3.1 8B model for task generation
- **Azure DevOps REST API** - Work item creation and management
- **Chrome Extensions API** - Browser integration
- **Vanilla JavaScript** - No frameworks, lightweight

---

## Cost

**Completely FREE!**

| Service | Cost |
|---------|------|
| Groq AI | Free tier (generous limits) |
| Azure DevOps | Included with your subscription |
| Chrome Extension | Free |

---

## Contributing

Feel free to submit issues and pull requests!

---

## License

MIT License - Use freely for personal and commercial projects.

---

## Support

If you find this useful, give it a ⭐ and share with your team!
