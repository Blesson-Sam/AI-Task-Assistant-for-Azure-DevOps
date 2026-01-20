// ================================================================================================
// AI TASK ASSISTANT FOR AZURE DEVOPS
// ================================================================================================
// A Chrome extension for AI-powered task generation, evaluation, and insights for Azure DevOps
// Features:
//   - Create Task: Generate tasks using AI based on User Story context
//   - Evaluate: Validate work items for completeness and date consistency  
//   - Insights: Analyze projects for incomplete items and timeline issues
// ================================================================================================

// ================================================================================================
// GLOBAL STATE MANAGEMENT
// ================================================================================================

// Create Task Tab State
let generatedTasks = [];           // AI-generated tasks from current session
let userStoryData = null;          // Currently selected User Story data
let iterationPath = null;          // Selected iteration/sprint path
let assignedTo = null;             // Currently assigned user
let areaPath = null;               // Selected area path
let selectedWorkItemType = 'User Story';  // Type of work item being created

// Parent context for validation
let parentFeatureData = null;      // Parent Feature data for date validation

// Evaluate Tab State
let currentEvaluation = null;      // Current evaluation results
let currentEvalStoryId = null;     // ID of User Story being evaluated
let currentEvalStoryData = null;   // Full data of User Story being evaluated

// Insights Tab State
// let currentInsights = null;        // Current insights analysis results
let allInsightTeams = [];          // All teams for board/team filtering
// let filteredInsightWorkItems = []; // Filtered work items for current view

// ================================================================================================
// CONSTANTS AND CONFIGURATION
// ================================================================================================

// AI Provider Configuration
const AI_PROVIDERS = {
  azure: {
    name: 'Azure OpenAI',
    model: 'gpt-4',
    endpoint: 'https://raja-mkdvd70u-eastus2.cognitiveservices.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-08-01-preview',
    description: 'Azure OpenAI GPT-4',
    headerType: 'api-key'
  },
  groq: {
    name: 'Groq',
    model: 'llama-3.1-8b-instant',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    description: 'Free and fast, uses Llama 3.1',
    headerType: 'bearer'
  }
};

// Get current AI provider configuration
function getAIConfig() {
  const provider = document.getElementById('aiProvider')?.value || 'azure';
  return AI_PROVIDERS[provider];
}

// Experience Level Configuration
// Defines time multipliers and context for different developer experience levels
const EXPERIENCE_CONFIG = {
  fresher: {
    multiplier: 2.0,
    description: "<strong>Fresher:</strong> Learning the tech stack. Tasks include extra time for research, learning, and code reviews. Estimates are doubled.",
    promptContext: "a fresher developer (0-1 years experience) who is still learning the technology stack and needs detailed guidance, extra time for research, and frequent code reviews"
  },
  junior: {
    multiplier: 1.5,
    description: "<strong>Junior:</strong> Needs guidance and mentoring. Estimates include buffer for learning and reviews. 50% extra time added.",
    promptContext: "a junior developer (1-2 years experience) who needs some guidance, may need to look up documentation, and requires code review time"
  },
  mid: {
    multiplier: 1.0,
    description: "<strong>Mid-Level:</strong> Standard estimates. Works independently with occasional guidance.",
    promptContext: "a mid-level developer (2-5 years experience) who works independently and has good knowledge of the tech stack"
  },
  senior: {
    multiplier: 0.75,
    description: "<strong>Senior:</strong> Expert in the domain. Efficient execution with optimized approaches. 25% faster than standard.",
    promptContext: "a senior developer (5+ years experience) who is an expert, works very efficiently, and can implement complex features quickly"
  }
};

// Work Item Validation Rules
// Defines required fields for each work item type
// isCustom: true means field might not exist in all Azure DevOps organizations
// isDateField: true means field should be validated for logical date values
const VALIDATION_RULES = {
  Feature: [
    { field: 'Microsoft.VSTS.Common.Priority', label: 'Priority' },
    { field: 'Microsoft.VSTS.Common.Risk', label: 'Risk' },
    { field: 'Microsoft.VSTS.Scheduling.Effort', label: 'Effort' },
    { field: 'Microsoft.VSTS.Common.BusinessValue', label: 'Business Value' },
    { field: 'Microsoft.VSTS.Common.TimeCriticality', label: 'Time Criticality' },
    { field: 'Microsoft.VSTS.Scheduling.StartDate', label: 'Start Date', isDateField: true },
    { field: 'Microsoft.VSTS.Scheduling.TargetDate', label: 'Target Date', isDateField: true }
  ],
  'User Story': [
    { field: 'Microsoft.VSTS.Scheduling.StoryPoints', label: 'Story Points' },
    { field: 'Microsoft.VSTS.Common.Priority', label: 'Priority' },
    { field: 'Microsoft.VSTS.Common.Risk', label: 'Risk' },
    { field: 'Microsoft.VSTS.Scheduling.StartDate', label: 'Planned Start Date', isDateField: true },
    { field: 'Microsoft.VSTS.Scheduling.FinishDate', label: 'Planned End Date', isDateField: true },
    { field: 'Custom.QAReadyDateK', label: 'QA Ready Date', isCustom: true, isDateField: true },
    { field: 'Custom.ActualStartDateK', label: 'Actual Start Date', isCustom: true, isDateField: true },
    { field: 'Custom.ActualEndDateK', label: 'Actual End Date', isCustom: true, isDateField: true }
  ],
  Task: [
    { field: 'Microsoft.VSTS.Common.Priority', label: 'Priority' },
    { field: 'Microsoft.VSTS.Common.Activity', label: 'Activity' },
    { field: 'Microsoft.VSTS.Scheduling.StartDate', label: 'Start Date', isDateField: true },
    { field: 'Microsoft.VSTS.Scheduling.FinishDate', label: 'Finish Date', isDateField: true },
    { field: 'Microsoft.VSTS.Scheduling.OriginalEstimate', label: 'Original Estimate' },
    { field: 'Microsoft.VSTS.Scheduling.RemainingWork', label: 'Remaining Work' },
    { field: 'Microsoft.VSTS.Scheduling.CompletedWork', label: 'Completed Work' }
  ]
};

// ================================================================================================
// INITIALIZATION
// ================================================================================================

/**
 * Initialize the extension when DOM is loaded
 * - Load saved settings
 * - Setup event listeners
 * - Update UI with experience info
 */
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
  updateExperienceInfo();
});

// ================================================================================================
// EVENT LISTENERS SETUP
// ================================================================================================

/**
 * Setup all event listeners for the extension
 * Organizes listeners by tab and functionality
 */
function setupEventListeners() {
  // ========== Settings Modal ==========
  document.getElementById('settingsBtn').onclick = openSettingsModal;
  document.getElementById('closeSettings').onclick = closeSettingsModal;
  document.getElementById('saveSettings').onclick = saveSettings;
  document.getElementById('testConnection').onclick = testADOConnection;
  document.getElementById('toggleApiKeyVisibility').onclick = () => togglePasswordVisibility('apiKey');
  document.getElementById('aiProvider').onchange = updateAIProviderHints;
  
  // Close modal on overlay click
  document.getElementById('settingsModal').onclick = (e) => {
    if (e.target.id === 'settingsModal') closeSettingsModal();
  };
  
  // ========== Tab Navigation ==========
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  
  // ========== Work Item Type Selection ==========
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.onclick = () => selectWorkItemType(btn);
  });
  
  // Initialize hint text for default selection (User Story)
  initializeWorkItemTypeHint();
  
  // ========== Tab 1: Create Task ==========
  document.getElementById('fetchWorkItem').onclick = fetchWorkItem;
  document.getElementById('generateTasks').onclick = generateTasks;
  document.getElementById('createAllTasks').onclick = createAllTasksInADO;
  document.getElementById('clearTasks').onclick = clearTasks;
  document.getElementById('level').onchange = updateExperienceInfo;
  
  // Event delegation for dynamically created task cards
  document.getElementById('tasksList').addEventListener('click', handleTaskListClick);
  document.getElementById('tasksList').addEventListener('change', handleTaskCheckboxChange);
  
  // ========== Tab 2: Evaluate Tasks ==========
  document.getElementById('fetchEvalStory').onclick = fetchAndEvaluate;
  document.getElementById('evalTypeFeature').onclick = () => selectEvalWorkItemType('Feature');
  document.getElementById('evalTypeUserStory').onclick = () => selectEvalWorkItemType('User Story');
  
  // Event delegation for dynamically created buttons in Evaluate tab
  document.getElementById('evaluationResults').addEventListener('click', handleEvaluationClick);
  document.getElementById('evalSummary').addEventListener('click', handleEvaluationClick);
  
  // ========== Tab 3: Insights ==========
  document.getElementById('fetchUserWorkItems').onclick = fetchUserWorkItems;
  document.getElementById('applyFilters').onclick = applyInsightFilters;
  document.getElementById('autoFixAll').onclick = autoFixAllIncomplete;
  
  // Project filter change to update boards dynamically
  document.getElementById('filterProject').onchange = updateBoardFilter;
  
  // Event delegation for insights results
  document.getElementById('insightsResults').addEventListener('click', handleInsightsClick);
  
  // ========== Security Controls ==========
  document.getElementById('togglePatVisibility').onclick = () => togglePasswordVisibility('pat');
  document.getElementById('clearAllData').onclick = clearAllStoredData;
}

// ================================================================================================
// EVENT DELEGATION HANDLERS
// ================================================================================================

/**
 * Handle clicks in the Evaluate tab (Create Task, Delete Item, etc.)
 */
function handleEvaluationClick(e) {
  const target = e.target.closest('button');
  if (!target) return;
  
  if (target.dataset.action === 'createTask') {
    const index = parseInt(target.dataset.index, 10);
    createSuggestedTask(index);
  } else if (target.dataset.action === 'createAllTasks') {
    createAllSuggestedTasks();
  } else if (target.dataset.action === 'deleteItem') {
    const id = parseInt(target.dataset.id, 10);
    const index = parseInt(target.dataset.index, 10);
    deleteWorkItemFromADO(id, index);
  }
}

/**
 * Handle clicks in the task list (Edit, Remove, Go to Evaluate, etc.)
 */
function handleTaskListClick(e) {
  const target = e.target.closest('button');
  if (!target) return;
  
  const taskId = parseInt(target.dataset.taskId, 10);
  
  if (target.dataset.action === 'edit') {
    toggleEdit(taskId);
  } else if (target.dataset.action === 'remove') {
    removeTask(taskId);
  } else if (target.dataset.action === 'goToEvaluate') {
    const workItemId = target.dataset.workItemId;
    const evalType = target.dataset.evalType;
    goToEvaluateTab(workItemId, evalType);
  } else if (target.dataset.action === 'forceGenerate') {
    forceGenerateTasks();
  }
}

/**
 * Handle checkbox changes in task list (select/deselect tasks)
 */
function handleTaskCheckboxChange(e) {
  const checkbox = e.target;
  if (checkbox.type === 'checkbox' && checkbox.dataset.taskId) {
    const taskId = parseInt(checkbox.dataset.taskId, 10);
    toggleTask(taskId);
  }
}

/**
 * Handle clicks in the Insights results (Auto Fix single item, etc.)
 */
function handleInsightsClick(e) {
  const target = e.target.closest('button');
  if (!target) return;
  
  if (target.dataset.action === 'autoFix') {
    const itemId = parseInt(target.dataset.itemId, 10);
    const itemType = target.dataset.itemType;
    autoFixSingleItem(itemId, itemType);
  }
}

// ================================================================================================
// SETTINGS MANAGEMENT
// ================================================================================================

// Session-only credentials (not persisted if "Remember Credentials" is unchecked)
let sessionCredentials = {
  pat: null,
  apiKey: null
};

/**
 * Open the settings modal
 */
function openSettingsModal() {
  document.getElementById('settingsModal').classList.remove('hidden');
  loadRememberPreference();
}

/**
 * Close the settings modal
 * If "remember" is unchecked, store credentials only in session
 */
function closeSettingsModal() {
  document.getElementById('settingsModal').classList.add('hidden');
  const remember = document.getElementById('rememberCredentials').checked;
  if (!remember) {
    sessionCredentials = {
      pat: document.getElementById('pat').value,
      apiKey: document.getElementById('apiKey').value
    };
  }
}

/**
 * Load the "Remember Credentials" checkbox state
 */
function loadRememberPreference() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['rememberCredentials'], (data) => {
      const checkbox = document.getElementById('rememberCredentials');
      checkbox.checked = data.rememberCredentials !== false;
    });
  }
}

/**
 * Load saved settings from Chrome storage
 */
function loadSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['org', 'project', 'pat', 'apiKey', 'aiProvider', 'rememberCredentials'], (data) => {
      if (data.org) document.getElementById('org').value = data.org;
      if (data.project) document.getElementById('project').value = data.project;
      if (data.aiProvider) document.getElementById('aiProvider').value = data.aiProvider;
      
      // Update hints after loading provider
      updateAIProviderHints();
      
      // Only load sensitive data if "remember" was enabled
      if (data.rememberCredentials !== false) {
        if (data.pat) document.getElementById('pat').value = data.pat;
        if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;
      }
      
      // Also check session credentials
      if (sessionCredentials.pat) document.getElementById('pat').value = sessionCredentials.pat;
      if (sessionCredentials.apiKey) document.getElementById('apiKey').value = sessionCredentials.apiKey;
    });
  }
}

// Save settings to chrome storage
function saveSettings() {
  const remember = document.getElementById('rememberCredentials').checked;
  
  const settings = {
    org: document.getElementById('org').value,
    project: document.getElementById('project').value,
    aiProvider: document.getElementById('aiProvider').value,
    rememberCredentials: remember
  };
  
  // Only save sensitive data if "remember" is checked
  if (remember) {
    settings.pat = document.getElementById('pat').value;
    settings.apiKey = document.getElementById('apiKey').value;
  } else {
    // Store in session only
    sessionCredentials = {
      pat: document.getElementById('pat').value,
      apiKey: document.getElementById('apiKey').value
    };
    // Clear from persistent storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['pat', 'apiKey']);
    }
  }
  
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set(settings, () => {
      showResult('Settings saved securely!', 'success');
      closeSettingsModal();
    });
  } else {
    showResult('Settings saved (local mode)', 'success');
    closeSettingsModal();
  }
}

// Clear all stored data
function clearAllStoredData() {
  if (confirm('Are you sure you want to clear all stored data? This will remove your saved credentials.')) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.clear(() => {
        // Clear form fields
        document.getElementById('org').value = '';
        document.getElementById('project').value = '';
        document.getElementById('pat').value = '';
        document.getElementById('apiKey').value = '';
        document.getElementById('rememberCredentials').checked = true;
        
        // Clear session
        sessionCredentials = { pat: null, apiKey: null };
        
        showResult('All stored data cleared!', 'success');
      });
    } else {
      showResult('Data cleared (local mode)', 'success');
    }
  }
}

// Test ADO and AI Connections
async function testADOConnection() {
  const org = document.getElementById('org').value.trim();
  const project = document.getElementById('project').value.trim();
  const pat = document.getElementById('pat').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  const statusEl = document.getElementById('connectionStatus');
  
  if (!org || !project || !pat) {
    statusEl.className = 'connection-status error';
    statusEl.textContent = 'Please fill in Organization, Project, and PAT';
    statusEl.classList.remove('hidden');
    return;
  }
  
  try {
    statusEl.className = 'connection-status';
    statusEl.textContent = 'Testing Azure DevOps connection...';
    statusEl.classList.remove('hidden');
    
    // Test ADO Connection
    const auth = btoa(":" + pat);
    const testUrl = `https://dev.azure.com/${org}/_apis/projects?api-version=7.0`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: { "Authorization": `Basic ${auth}` }
    });
    
    if (!response.ok) {
      statusEl.className = 'connection-status error';
      statusEl.textContent = ` ADO Connection failed: ${response.status}. Check PAT permissions.`;
      return;
    }
    
    const data = await response.json();
    const projectNames = data.value.map(p => p.name);
    
    if (!projectNames.includes(project)) {
      statusEl.className = 'connection-status error';
      statusEl.textContent = ` Project not found. Available: ${projectNames.slice(0, 3).join(', ')}...`;
      return;
    }
    
    // ADO Success
    statusEl.className = 'connection-status success';
    statusEl.textContent = `✓ Azure DevOps connected! Project "${project}" found.`;
    
    // Test AI Connection if API key is provided
    if (apiKey) {
      statusEl.className = 'connection-status';
      statusEl.textContent = `✓ ADO connected! Testing AI connection...`;
      
      const aiTestResult = await testAIConnection(apiKey);
      
      if (aiTestResult.success) {
        statusEl.className = 'connection-status success';
        statusEl.textContent = `✓ All connections successful! ADO: "${project}" | AI: ${aiTestResult.provider}`;
      } else {
        statusEl.className = 'connection-status warning';
        statusEl.textContent = `✓ ADO connected | ❌ AI failed: ${aiTestResult.error}`;
      }
    }
    
  } catch (error) {
    statusEl.className = 'connection-status error';
    statusEl.textContent = `Error: ${error.message}`;
  }
}

// Test AI Connection
async function testAIConnection(apiKey) {
  try {
    const aiConfig = getAIConfig();
    
    const headers = {
      "Content-Type": "application/json"
    };
    
    // Add appropriate auth header based on provider
    if (aiConfig.headerType === 'bearer') {
      headers["Authorization"] = `Bearer ${apiKey}`;
    } else {
      headers["api-key"] = apiKey;
    }
    
    // Small test request
    const response = await fetch(aiConfig.endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say 'OK' if you can read this." }
        ],
        temperature: 0.3,
        max_tokens: 10,
        model: aiConfig.model
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error?.message || `API Error: ${response.status}` 
      };
    }
    
    const data = await response.json();
    
    // Verify response has expected structure
    if (data.choices && data.choices[0]?.message?.content) {
      return { 
        success: true, 
        provider: aiConfig.name 
      };
    } else {
      return { 
        success: false, 
        error: 'Unexpected response format' 
      };
    }
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// ============================================
// Tab Navigation
// ============================================

function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });
}

function selectWorkItemType(btn) {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedWorkItemType = btn.dataset.type;
  
  // Update hint text based on selection
  updateWorkItemTypeHint();
  
  // Update button text
  const generateBtnText = document.getElementById('generateBtnText');
  if (generateBtnText) {
    generateBtnText.textContent = selectedWorkItemType === 'Feature' 
      ? 'Generate User Stories with AI' 
      : 'Generate Tasks with AI';
  }
}

// Initialize hint text on page load
function initializeWorkItemTypeHint() {
  updateWorkItemTypeHint();
  
  // Also update button text
  const generateBtnText = document.getElementById('generateBtnText');
  if (generateBtnText) {
    generateBtnText.textContent = selectedWorkItemType === 'Feature' 
      ? 'Generate User Stories with AI' 
      : 'Generate Tasks with AI';
  }
}

// Update hint text based on current selection
function updateWorkItemTypeHint() {
  const hintEl = document.getElementById('workItemTypeHint');
  if (hintEl) {
    if (selectedWorkItemType === 'Feature') {
      hintEl.textContent = '🎯 Feature → Creates User Stories (max 3 with Fibonacci Story Points)';
    } else {
      hintEl.textContent = '📖 User Story → Creates Tasks (with hour estimates)';
    }
  }
}

// Update experience info display
function updateExperienceInfo() {
  const level = document.getElementById('level').value;
  const info = EXPERIENCE_CONFIG[level];
  document.getElementById('experienceInfo').innerHTML = info.description;
}

// Update AI provider hints
function updateAIProviderHints() {
  const provider = document.getElementById('aiProvider')?.value || 'azure';
  const config = AI_PROVIDERS[provider];
  
  const providerHint = document.getElementById('aiProviderHint');
  const apiKeyHint = document.getElementById('apiKeyHint');
  
  if (providerHint) {
    providerHint.textContent = config.description;
  }
  
  if (apiKeyHint) {
    if (provider === 'groq') {
      apiKeyHint.textContent = 'Get free API key from https://console.groq.com';
    } else {
      apiKeyHint.textContent = 'API key for Azure OpenAI service';
    }
  }
}

// ============================================
// TAB 1: Create Task Functions
// ============================================

// Fetch Work Item from Azure DevOps
async function fetchWorkItem() {
  const { org, project, pat } = getSettings();
  const storyId = document.getElementById('workItemId').value.trim();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  if (!storyId) {
    showResult('Please enter a Work Item ID', 'error');
    return;
  }
  
  try {
    showLoading('createLoading', true, 'Fetching work item...');
    
    const auth = btoa(":" + pat);
    // Include $expand=relations to get child items
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${storyId}?$expand=relations&api-version=7.0`;
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    
    const data = await response.json();
    
    // Validate work item type matches selection
    const actualType = data.fields['System.WorkItemType'];
    if (actualType !== selectedWorkItemType) {
      showLoading('createLoading', false);
      const expectedAction = selectedWorkItemType === 'Feature' ? 'create User Stories' : 'create Tasks';
      const actualAction = actualType === 'Feature' ? 'create User Stories from it' : actualType === 'User Story' ? 'create Tasks from it' : 'view it';
      showResult(`❌ Type Mismatch: You selected "${selectedWorkItemType}" but #${storyId} is a "${actualType}". Please select the correct type or enter a different Work Item ID.`, 'error');
      
      // Clear form
      document.getElementById('workItemTitle').value = '';
      document.getElementById('workItemDescription').value = '';
      document.getElementById('workItemInfo').classList.add('hidden');
      return;
    }
    
    userStoryData = data;
    
    const title = data.fields['System.Title'] || '';
    const description = data.fields['System.Description'] || '';
    const acceptanceCriteria = data.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '';
    iterationPath = data.fields['System.IterationPath'] || '';
    areaPath = data.fields['System.AreaPath'] || '';
    assignedTo = data.fields['System.AssignedTo'] || null;
    
    // Populate form
    document.getElementById('workItemTitle').value = title;
    document.getElementById('workItemDescription').value = 
      `${stripHtml(description)}\n\nAcceptance Criteria:\n${stripHtml(acceptanceCriteria)}`;
    
    // Show info cards
    document.getElementById('workItemInfo').classList.remove('hidden');
    document.getElementById('iterationPath').textContent = iterationPath || 'Not set';
    document.getElementById('assigneeName').textContent = 
      assignedTo ? (assignedTo.displayName || assignedTo.uniqueName) : 'Unassigned';
    
    // Check for existing child items
    const existingChildItems = await checkForExistingChildItems(org, project, pat, data, selectedWorkItemType);
    
    // If User Story, fetch parent Feature data for context
    parentFeatureData = null;
    if (selectedWorkItemType === 'User Story') {
      parentFeatureData = await fetchParentFeatureData(org, project, pat, data);
    }
    
    showLoading('createLoading', false);
    
    if (existingChildItems.count > 0) {
      showExistingChildItemsWarning(existingChildItems.count, storyId, selectedWorkItemType);
    } else {
      showResult(`Fetched: ${title}`, 'success');
    }
    
  } catch (error) {
    showLoading('createLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// Generate tasks using AI
async function generateTasks() {
  const { org, project, pat } = getSettings();
  const aiApiKey = getAIApiKey();
  const title = document.getElementById('workItemTitle').value;
  const description = document.getElementById('workItemDescription').value;
  const level = document.getElementById('level').value;
  const storyId = document.getElementById('workItemId').value.trim();
  
  const userStory = `Title: ${title}\n\n${description}`;
  
  if (!userStory.trim() || userStory.trim() === 'Title:') {
    showResult('Please enter or fetch a work item first', 'error');
    return;
  }
  
  if (!aiApiKey) {
    showResult(`Please enter your ${getAIConfig().name} API Key in Settings`, 'error');
    return;
  }
  
  // Check if child items already exist
  if (storyId && org && project && pat && userStoryData) {
    try {
      showLoading('createLoading', true, 'Checking for existing items...');
      const existingItems = await checkForExistingChildItems(org, project, pat, userStoryData, selectedWorkItemType);
      
      if (existingItems.count > 0) {
        showLoading('createLoading', false);
        showExistingChildItemsWarning(existingItems.count, storyId, selectedWorkItemType);
        return;
      }
    } catch (e) {
      // Continue if check fails
      console.log('Could not check existing items:', e);
    }
  }
  
  try {
    showLoading('createLoading', true, `${getAIConfig().name} AI is analyzing and breaking down the work item...`);
    
    const experienceContext = EXPERIENCE_CONFIG[level].promptContext;
    const multiplier = EXPERIENCE_CONFIG[level].multiplier;
    
    // Get Story Points from fetched work item to give AI context about complexity
    let storyPointsContext = '';
    if (userStoryData) {
      const storyPoints = userStoryData.fields['Microsoft.VSTS.Scheduling.StoryPoints'];
      if (storyPoints) {
        storyPointsContext = storyPoints;
      }
    }
    
    const tasks = await callAI(userStory, experienceContext, aiApiKey, storyPointsContext, multiplier);
    
    const validActivities = ['Deployment', 'Design', 'Development', 'Documentation', 'Requirements', 'Testing'];
    
    generatedTasks = tasks.map((task, index) => ({
      ...task,
      id: index + 1,
      hours: Math.round(task.hours * multiplier * 10) / 10,
      originalHours: task.hours,
      activity: validActivities.includes(task.activity) ? task.activity : 'Development',
      selected: true
    }));
    
    showLoading('createLoading', false);
    displayTasks();
    
  } catch (error) {
    showLoading('createLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// Call AI API (Azure OpenAI GPT-5.2-Chat)
async function callAI(userStory, experienceContext, apiKey, storyPointsContext, multiplier) {
  // Determine what to generate based on selected work item type
  const isFeature = selectedWorkItemType === 'Feature';
  const itemToGenerate = isFeature ? 'User Stories' : 'Tasks';
  const maxItems = isFeature ? 3 : 5;
  const itemDescription = isFeature 
    ? 'User Stories with clear acceptance criteria' 
    : 'development tasks';
  
  // Build context from parent Feature (when creating Tasks from User Story)
  let parentContext = '';
  if (!isFeature && parentFeatureData) {
    const featureTitle = parentFeatureData.fields['System.Title'] || '';
    const featureDesc = stripHtml(parentFeatureData.fields['System.Description'] || '');
    const featureStartDate = parentFeatureData.fields['Microsoft.VSTS.Scheduling.StartDate'];
    const featureTargetDate = parentFeatureData.fields['Microsoft.VSTS.Scheduling.TargetDate'];
    
    parentContext = `\n\nPARENT FEATURE CONTEXT:
Feature Title: ${featureTitle}
Feature Description: ${featureDesc}`;
    
    if (featureStartDate || featureTargetDate) {
      parentContext += `\nFeature Timeline: ${featureStartDate ? new Date(featureStartDate).toLocaleDateString() : 'Not set'} to ${featureTargetDate ? new Date(featureTargetDate).toLocaleDateString() : 'Not set'}`;
      parentContext += `\nIMPORTANT: All tasks should be planned to complete within the Feature timeline.`;
    }
  }
  
  // Add User Story timeline and complexity context
  let complexityContext = '';
  if (!isFeature && userStoryData) {
    const storyStartDate = userStoryData.fields['Microsoft.VSTS.Scheduling.StartDate'];
    const storyFinishDate = userStoryData.fields['Microsoft.VSTS.Scheduling.FinishDate'];
    
    if (storyPointsContext) {
      complexityContext += `\n\nSTORY COMPLEXITY:
Story Points: ${storyPointsContext}`;
    }
    
    if (storyStartDate || storyFinishDate) {
      complexityContext += `\nTIMELINE:
Start Date: ${storyStartDate ? new Date(storyStartDate).toLocaleDateString() : 'Not set'}
End Date: ${storyFinishDate ? new Date(storyFinishDate).toLocaleDateString() : 'Not set'}`;
    }
  }
  
  const prompt = isFeature 
    ? `You are an expert Agile project manager. Break down the following Feature into User Stories.

FEATURE:
${userStory}

DEVELOPER CONTEXT:
User Stories will be assigned to ${experienceContext}.

INSTRUCTIONS:
1. Break down into 1-2 specific, actionable User Stories (MAXIMUM 2)
2. Each User Story should be independently deliverable
3. Include clear acceptance criteria in the description
4. Follow the format: "As a [user], I want [feature], so that [benefit]"
5. Assign Story Points using ONLY Fibonacci sequence: 1, 2, 3, 5, 8, 13
   - 1 point: Very simple, trivial change
   - 2 points: Simple, straightforward task
   - 3 points: Medium complexity, some uncertainty
   - 5 points: Complex, requires significant effort
   - 8 points: Very complex, high uncertainty
   - 13 points: Extremely complex, consider breaking down

RESPOND WITH ONLY A VALID JSON ARRAY:
[
  {
    "title": "Clear User Story title",
    "description": "As a [user], I want [feature], so that [benefit].\n\nAcceptance Criteria:\n- Criteria 1\n- Criteria 2",
    "storyPoints": number (ONLY use 1, 2, 3, 5, 8, or 13),
    "priority": 1 | 2 | 3 | 4,
    "activity": "Development" | "Testing" | "Design" | "Documentation" | "Deployment" | "Requirements"
  }
]`
    : `You are an expert Agile project manager. Break down the following work item into detailed, actionable development tasks.${parentContext}

USER STORY:
${userStory}${complexityContext}

DEVELOPER CONTEXT:
Tasks will be assigned to ${experienceContext}.

INSTRUCTIONS:
1. Analyze the story complexity (Story Points if provided) and timeline to determine appropriate task breakdown
2. Break down into 2-5 specific, actionable tasks based on the work complexity
3. Each task should be 1-6 hours (1 full day max per task)
4. Estimate hours realistically based on:
   - Story complexity/points
   - Developer experience level
   - Technical requirements
5. If timeline dates are provided, ensure tasks fit within the timeframe
6. Focus on essential tasks only

RESPOND WITH ONLY A VALID JSON ARRAY:
[
  {
    "title": "Clear task title",
    "description": "What needs to be done and how",
    "hours": number (1-6 hours, realistic estimate),
    "priority": 1 | 2 | 3 | 4,
    "activity": "Development" | "Testing" | "Design" | "Documentation" | "Deployment" | "Requirements"
  }
]`;

  const aiConfig = getAIConfig();
  const headers = {
    "Content-Type": "application/json"
  };
  
  // Add appropriate auth header based on provider
  if (aiConfig.headerType === 'bearer') {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers["api-key"] = apiKey;
  }
  
  const response = await fetch(aiConfig.endpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You output only valid JSON arrays. No markdown, no explanations." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      model: aiConfig.model
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content.trim();
  content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error('AI returned invalid JSON. Please try again.');
  }
}

// Display generated tasks
function displayTasks() {
  const section = document.getElementById('tasksSection');
  const list = document.getElementById('tasksList');
  const countBadge = document.getElementById('taskCount');
  
  // Determine item type based on selected work item type
  const isFeature = selectedWorkItemType === 'Feature';
  const itemLabel = isFeature ? 'User Story' : 'Task';
  const itemLabelPlural = isFeature ? 'user stories' : 'tasks';
  const estimateLabel = isFeature ? 'SP' : 'h'; // Story Points vs Hours
  
  section.classList.remove('hidden');
  countBadge.textContent = `${generatedTasks.length} ${itemLabelPlural}`;
  
  // Update section header
  const sectionHeader = section.querySelector('.section-header h3');
  if (sectionHeader) {
    sectionHeader.textContent = isFeature ? 'Generated User Stories' : 'Generated Tasks';
  }
  
  const priorityLabels = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' };
  const priorityColors = { 1: '#ef4444', 2: '#f59e0b', 3: '#3b82f6', 4: '#10b981' };
  
  list.innerHTML = generatedTasks.map((task) => {
    const priorityNum = task.priority || 2;
    // Use storyPoints for User Stories, hours for Tasks
    const estimate = isFeature ? (task.storyPoints || task.hours || 3) : (task.hours || 4);
    return `
    <div class="task-card" data-id="${task.id}">
      <div class="task-header">
        <span class="task-number">${itemLabel} ${task.id}</span>
        <span class="task-estimate">${estimate}${estimateLabel}</span>
      </div>
      
      <div class="task-meta">
        <span class="task-priority" style="background:${priorityColors[priorityNum]}">${priorityLabels[priorityNum]}</span>
        ${!isFeature ? `<span class="task-activity">${task.activity || 'Development'}</span>` : ''}
      </div>
      
      <div class="task-checkbox">
        <input type="checkbox" id="task-check-${task.id}" data-task-id="${task.id}" ${task.selected ? 'checked' : ''}>
        <label for="task-check-${task.id}">Include in ADO</label>
      </div>
      
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-description">${escapeHtml(task.description).replace(/\\n/g, '<br>')}</div>
      
      <div class="edit-fields">
        <input type="text" class="edit-title" value="${escapeHtml(task.title)}" placeholder="${itemLabel} title">
        <textarea class="edit-description" rows="3" placeholder="Description">${escapeHtml(task.description)}</textarea>
        <div class="edit-row">
          <input type="number" class="edit-hours" value="${estimate}" min="${isFeature ? '1' : '0.5'}" step="${isFeature ? '1' : '0.5'}" placeholder="${isFeature ? 'Story Points' : 'Hours'}">
          <select class="edit-priority">
            ${[1,2,3,4].map(p => `<option value="${p}" ${priorityNum === p ? 'selected' : ''}>${priorityLabels[p]}</option>`).join('')}
          </select>
          ${!isFeature ? `<select class="edit-activity">
            ${['Deployment','Design','Development','Documentation','Requirements','Testing'].map(a => 
              `<option ${task.activity === a ? 'selected' : ''}>${a}</option>`).join('')}
          </select>` : ''}
        </div>
      </div>
      
      <div class="task-actions">
        <button class="btn btn-edit" data-action="edit" data-task-id="${task.id}">Edit</button>
        <button class="btn btn-remove" data-action="remove" data-task-id="${task.id}">Remove</button>
      </div>
    </div>
  `;
  }).join('');
  
  updateTotalEstimate();
}

// Toggle task selection
function toggleTask(id) {
  const task = generatedTasks.find(t => t.id === id);
  if (task) {
    task.selected = !task.selected;
    updateTotalEstimate();
  }
}

// Toggle edit mode
function toggleEdit(id) {
  const card = document.querySelector(`.task-card[data-id="${id}"]`);
  const isEditing = card.classList.contains('editing');
  
  if (isEditing) {
    const task = generatedTasks.find(t => t.id === id);
    task.title = card.querySelector('.edit-title').value;
    task.description = card.querySelector('.edit-description').value;
    const editValue = parseFloat(card.querySelector('.edit-hours').value) || 4;
    
    // For User Stories (from Feature), save as storyPoints; for Tasks, save as hours
    const isFeature = selectedWorkItemType === 'Feature';
    if (isFeature) {
      // Validate Fibonacci sequence and use nearest valid value
      const fibSequence = [1, 2, 3, 5, 8, 13];
      task.storyPoints = fibSequence.includes(editValue) ? editValue : 
        fibSequence.reduce((prev, curr) => Math.abs(curr - editValue) < Math.abs(prev - editValue) ? curr : prev);
    } else {
      task.hours = editValue;
    }
    
    task.priority = parseInt(card.querySelector('.edit-priority').value) || 2;
    const activitySelect = card.querySelector('.edit-activity');
    if (activitySelect) {
      task.activity = activitySelect.value || 'Development';
    }
    displayTasks();
    return;
  }
  
  card.classList.toggle('editing');
  card.querySelector('.btn-edit').textContent = isEditing ? 'Edit' : 'Save';
}

// Remove task
function removeTask(id) {
  generatedTasks = generatedTasks.filter(t => t.id !== id);
  displayTasks();
}

// Update total estimate
function updateTotalEstimate() {
  const selectedTasks = generatedTasks.filter(t => t.selected);
  
  // Determine item type based on selected work item type
  const isFeature = selectedWorkItemType === 'Feature';
  const itemLabelPlural = isFeature ? 'user stories' : 'tasks';
  const estimateLabel = isFeature ? 'Story Points' : 'hours';
  
  // Calculate total - use storyPoints for User Stories, hours for Tasks
  const total = selectedTasks.reduce((sum, t) => {
    return sum + (isFeature ? (t.storyPoints || t.hours || 0) : (t.hours || 0));
  }, 0);
  
  let estimateDisplay = '';
  if (isFeature) {
    estimateDisplay = `${total} ${estimateLabel}`;
  } else {
    const days = Math.ceil(total / 6);
    estimateDisplay = `${total}h (~${days} days)`;
  }
  
  document.getElementById('totalEstimate').innerHTML = `
    <div class="estimate-label">Total Estimate (${selectedTasks.length} ${itemLabelPlural})</div>
    <div class="estimate-value">${estimateDisplay}</div>
  `;
}

// Calculate task dates based on hours (6 hours per working day)
function calculateTaskDates(tasks, startDate = new Date()) {
  const HOURS_PER_DAY = 6;
  let currentDate = new Date(startDate);
  let remainingHoursInDay = HOURS_PER_DAY;
  
  // Skip weekends for start date
  while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const taskDates = [];
  
  for (const task of tasks) {
    const taskHours = task.hours || 4;
    const taskStartDate = new Date(currentDate);
    let hoursRemaining = taskHours;
    
    // Calculate end date based on hours
    while (hoursRemaining > 0) {
      if (hoursRemaining <= remainingHoursInDay) {
        // Task finishes within current day
        remainingHoursInDay -= hoursRemaining;
        hoursRemaining = 0;
      } else {
        // Task continues to next day
        hoursRemaining -= remainingHoursInDay;
        remainingHoursInDay = HOURS_PER_DAY;
        currentDate.setDate(currentDate.getDate() + 1);
        // Skip weekends
        while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }
    
    const taskEndDate = new Date(currentDate);
    taskDates.push({
      taskId: task.id,
      startDate: taskStartDate,
      finishDate: taskEndDate
    });
    
    // If we used all hours in the day, move to next day for the next task
    if (remainingHoursInDay === 0) {
      remainingHoursInDay = HOURS_PER_DAY;
      currentDate.setDate(currentDate.getDate() + 1);
      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  }
  
  return taskDates;
}

// Create all items in ADO (Tasks for User Story, User Stories for Feature)
async function createAllTasksInADO() {
  const { org, project, pat } = getSettings();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first', 'error');
    return;
  }
  
  const selectedTasks = generatedTasks.filter(t => t.selected);
  if (selectedTasks.length === 0) {
    showResult('No items selected', 'error');
    return;
  }
  
  // Determine work item type to create based on selected parent type
  const isFeature = selectedWorkItemType === 'Feature';
  const workItemTypeToCreate = isFeature ? 'User Story' : 'Task';
  const itemLabel = isFeature ? 'user stories' : 'tasks';
  
  // Get start date from parent Feature or User Story, or use today
  let startDate = new Date();
  if (!isFeature && userStoryData) {
    const userStoryStartDate = userStoryData.fields['Microsoft.VSTS.Scheduling.StartDate'];
    if (userStoryStartDate) {
      startDate = new Date(userStoryStartDate);
    } else if (parentFeatureData) {
      const featureStartDate = parentFeatureData.fields['Microsoft.VSTS.Scheduling.StartDate'];
      if (featureStartDate) startDate = new Date(featureStartDate);
    }
  } else if (isFeature && userStoryData) {
    const featureStartDate = userStoryData.fields['Microsoft.VSTS.Scheduling.StartDate'];
    if (featureStartDate) startDate = new Date(featureStartDate);
  }
  
  // Calculate dates for all tasks
  const taskDates = calculateTaskDates(selectedTasks, startDate);
  
  try {
    showLoading('createLoading', true, `Creating ${selectedTasks.length} ${itemLabel}...`);
    
    const auth = btoa(":" + pat);
    let created = 0, failed = 0;
    
    for (let i = 0; i < selectedTasks.length; i++) {
      const task = selectedTasks[i];
      const dates = taskDates[i];
      
      try {
        const body = [
          { "op": "add", "path": "/fields/System.Title", "value": task.title },
          { "op": "add", "path": "/fields/System.Description", "value": task.description.replace(/\\n/g, '<br>') },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": task.priority || 2 }
        ];
        
        // Add type-specific fields
        if (isFeature) {
          // For User Stories: use Story Points (Fibonacci: 1,2,3,5,8,13)
          const storyPoints = task.storyPoints || task.hours || 3;
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.StoryPoints", "value": storyPoints });
          // Add Start and Finish dates for User Stories (respecting Feature timeline)
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.StartDate", "value": dates.startDate.toISOString() });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.FinishDate", "value": dates.finishDate.toISOString() });
        } else {
          // For Tasks: use time estimates and calculate dates
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.OriginalEstimate", "value": task.hours });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.RemainingWork", "value": task.hours });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.CompletedWork", "value": 0 });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Common.Activity", "value": task.activity || "Development" });
          // Add calculated Start and Finish dates
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.StartDate", "value": dates.startDate.toISOString() });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.FinishDate", "value": dates.finishDate.toISOString() });
        }
        
        if (areaPath) body.push({ "op": "add", "path": "/fields/System.AreaPath", "value": areaPath });
        if (assignedTo) body.push({ "op": "add", "path": "/fields/System.AssignedTo", "value": assignedTo.uniqueName || assignedTo.displayName });
        if (iterationPath) body.push({ "op": "add", "path": "/fields/System.IterationPath", "value": iterationPath });
        
        // Link to parent work item
        if (userStoryData && userStoryData.id) {
          body.push({
            "op": "add",
            "path": "/relations/-",
            "value": { "rel": "System.LinkTypes.Hierarchy-Reverse", "url": userStoryData.url }
          });
        }
        
        const response = await fetch(
          `https://dev.azure.com/${org}/${project}/_apis/wit/workitems/$${encodeURIComponent(workItemTypeToCreate)}?api-version=7.0`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/json-patch+json"
            },
            body: JSON.stringify(body)
          }
        );
        
        if (response.ok) created++;
        else failed++;
      } catch (e) {
        failed++;
      }
    }
    
    showLoading('createLoading', false);
    
    if (failed === 0) {
      showResult(`✓ Created ${created} ${itemLabel} in Azure DevOps!`, 'success');
    } else {
      showResult(`Created ${created}, ${failed} failed`, 'error');
    }
    
  } catch (error) {
    showLoading('createLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// Clear tasks
function clearTasks() {
  generatedTasks = [];
  userStoryData = null;
  iterationPath = null;
  assignedTo = null;
  areaPath = null;
  document.getElementById('tasksSection').classList.add('hidden');
  document.getElementById('workItemInfo').classList.add('hidden');
  document.getElementById('workItemTitle').value = '';
  document.getElementById('workItemDescription').value = '';
  document.getElementById('workItemId').value = '';
}

// ============================================
// TAB 2: Evaluate Work Items
// ============================================

let selectedEvalWorkItemType = 'User Story';

function selectEvalWorkItemType(type) {
  selectedEvalWorkItemType = type;
  
  // Update button states
  document.getElementById('evalTypeFeature').classList.toggle('active', type === 'Feature');
  document.getElementById('evalTypeUserStory').classList.toggle('active', type === 'User Story');
  
  // Update hint text
  const hintEl = document.getElementById('evalTypeHint');
  if (hintEl) {
    hintEl.textContent = type === 'Feature' 
      ? 'Feature → Evaluates User Stories' 
      : 'User Story → Evaluates Tasks';
  }
  
  // Clear previous results
  document.getElementById('evaluationResults').classList.add('hidden');
  document.getElementById('evalWorkItemInfo').classList.add('hidden');
}

async function fetchAndEvaluate() {
  const { org, project, pat } = getSettings();
  const aiApiKey = getAIApiKey();
  const workItemId = document.getElementById('evalStoryId').value.trim();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  if (!workItemId) {
    showResult('Please enter a Work Item ID', 'error');
    return;
  }
  
  if (!aiApiKey) {
    showResult(`Please configure ${getAIConfig().name} API Key in Settings`, 'error');
    return;
  }
  
  // Store for later use
  currentEvalStoryId = workItemId;
  
  try {
    showLoading('evaluateLoading', true, 'Fetching work item...');
    
    const auth = btoa(":" + pat);
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}?$expand=relations&api-version=7.0`;
    
    const response = await fetch(url, {
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    
    const data = await response.json();
    const workItemType = data.fields['System.WorkItemType'];
    const workItemTitle = data.fields['System.Title'] || '';
    const workItemDescription = stripHtml(data.fields['System.Description'] || '');
    const acceptanceCriteria = stripHtml(data.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '');
    
    // Validate work item type matches selection
    if (selectedEvalWorkItemType === 'Feature' && workItemType !== 'Feature') {
      showLoading('evaluateLoading', false);
      showResult(`Work Item #${workItemId} is a "${workItemType}", not a Feature. Please select the correct type.`, 'error');
      return;
    }
    if (selectedEvalWorkItemType === 'User Story' && workItemType !== 'User Story') {
      showLoading('evaluateLoading', false);
      showResult(`Work Item #${workItemId} is a "${workItemType}", not a User Story. Please select the correct type.`, 'error');
      return;
    }
    
    // Store work item data
    currentEvalStoryData = {
      title: workItemTitle,
      description: workItemDescription,
      acceptanceCriteria: acceptanceCriteria,
      iterationPath: data.fields['System.IterationPath'] || null,
      areaPath: data.fields['System.AreaPath'] || null,
      assignedTo: data.fields['System.AssignedTo'] || null,
      url: data.url
    };
    
    // Fetch child items
    showLoading('evaluateLoading', true, `Fetching linked ${selectedEvalWorkItemType === 'Feature' ? 'User Stories' : 'Tasks'}...`);
    
    const childItems = await fetchLinkedChildItems(org, project, pat, data, selectedEvalWorkItemType);
    
    // Show work item info
    document.getElementById('evalWorkItemInfo').classList.remove('hidden');
    document.getElementById('evalWorkItemTitle').textContent = workItemTitle;
    document.getElementById('evalChildCount').textContent = `${childItems.length} ${selectedEvalWorkItemType === 'Feature' ? 'User Stories' : 'Tasks'}`;
    
    if (childItems.length === 0) {
      showLoading('evaluateLoading', false);
      showResult(`No ${selectedEvalWorkItemType === 'Feature' ? 'User Stories' : 'Tasks'} found under this ${selectedEvalWorkItemType}`, 'error');
      return;
    }
    
    // Evaluate with AI
    showLoading('evaluateLoading', true, `${getAIConfig().name} AI is analyzing items...`);
    
    const evaluation = await evaluateChildItemsWithAI(
      workItemTitle, 
      workItemDescription + '\n\n' + acceptanceCriteria, 
      childItems, 
      aiApiKey, 
      selectedEvalWorkItemType
    );
    
    currentEvaluation = evaluation;
    
    showLoading('evaluateLoading', false);
    displayEvaluationResults(evaluation, selectedEvalWorkItemType);
    
  } catch (error) {
    showLoading('evaluateLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

async function fetchLinkedChildItems(org, project, pat, parentData, parentType) {
  const auth = btoa(":" + pat);
  const relations = parentData.relations || [];
  
  // Filter child relations
  const childUrls = relations
    .filter(r => r.rel === 'System.LinkTypes.Hierarchy-Forward')
    .map(r => r.url);
  
  if (childUrls.length === 0) return [];
  
  const expectedChildType = parentType === 'Feature' ? 'User Story' : 'Task';
  const items = [];
  
  for (const url of childUrls) {
    try {
      const response = await fetch(url, {
        headers: { "Authorization": `Basic ${auth}` }
      });
      if (response.ok) {
        const itemData = await response.json();
        if (itemData.fields['System.WorkItemType'] === expectedChildType) {
          if (expectedChildType === 'User Story') {
            items.push({
              id: itemData.id,
              title: itemData.fields['System.Title'],
              description: stripHtml(itemData.fields['System.Description'] || ''),
              acceptanceCriteria: stripHtml(itemData.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || ''),
              storyPoints: itemData.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
              state: itemData.fields['System.State'],
              priority: itemData.fields['Microsoft.VSTS.Common.Priority'] || 2
            });
          } else {
            items.push({
              id: itemData.id,
              title: itemData.fields['System.Title'],
              description: stripHtml(itemData.fields['System.Description'] || ''),
              estimate: itemData.fields['Microsoft.VSTS.Scheduling.OriginalEstimate'] || 0,
              activity: itemData.fields['Microsoft.VSTS.Common.Activity'] || '',
              state: itemData.fields['System.State'],
              priority: itemData.fields['Microsoft.VSTS.Common.Priority'] || 2
            });
          }
        }
      }
    } catch (e) {
      console.error('Error fetching child item:', e);
    }
  }
  
  return items;
}

async function evaluateChildItemsWithAI(parentTitle, parentDescription, childItems, apiKey, parentType) {
  const isFeature = parentType === 'Feature';
  const childType = isFeature ? 'User Stories' : 'Tasks';
  const itemsJson = JSON.stringify(childItems, null, 2);
  
  const prompt = isFeature 
    ? `You are an expert Agile coach. Evaluate the User Stories created for this Feature.

FEATURE:
Title: ${parentTitle}
Description: ${parentDescription}

EXISTING USER STORIES:
${itemsJson || 'No User Stories found'}

ANALYZE AND RESPOND WITH ONLY THIS JSON STRUCTURE:
{
  "correct": [
    { "id": number, "title": "string", "reason": "why it's correct and well-defined" }
  ],
  "toUpdate": [
    { "id": number, "title": "string", "issue": "what's wrong", "suggestion": "how to fix" }
  ],
  "toDelete": [
    { "id": number, "title": "string", "reason": "why to delete (duplicate, out of scope, etc.)" }
  ],
  "newItems": [
    { "title": "string", "description": "As a [user], I want [feature], so that [benefit]. Acceptance Criteria: ...", "storyPoints": number (ONLY use Fibonacci: 1, 2, 3, 5, 8, or 13), "reason": "why needed" }
  ],
  "summary": "Overall assessment in 1-2 sentences"
}`
    : `You are an expert Agile coach. Evaluate the Tasks created for this User Story.

USER STORY:
Title: ${parentTitle}
Description: ${parentDescription}

EXISTING TASKS:
${itemsJson || 'No Tasks found'}

ANALYZE AND RESPOND WITH ONLY THIS JSON STRUCTURE:
{
  "correct": [
    { "id": number, "title": "string", "reason": "why it's correct" }
  ],
  "toUpdate": [
    { "id": number, "title": "string", "issue": "what's wrong", "suggestion": "how to fix" }
  ],
  "toDelete": [
    { "id": number, "title": "string", "reason": "why to delete" }
  ],
  "newItems": [
    { "title": "string", "description": "string", "hours": number, "reason": "why needed" }
  ],
  "summary": "Overall assessment in 1-2 sentences"
}`;

  const aiConfig = getAIConfig();
  const headers = {
    "Content-Type": "application/json"
  };
  
  // Add appropriate auth header based on provider
  if (aiConfig.headerType === 'bearer') {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers["api-key"] = apiKey;
  }
  
  const response = await fetch(aiConfig.endpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You output only valid JSON. No markdown, no explanations." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      model: aiConfig.model
    })
  });

  if (!response.ok) throw new Error('AI API error');

  const data = await response.json();
  let content = data.choices[0].message.content.trim();
  content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  return JSON.parse(content);
}

function displayEvaluationResults(evaluation, parentType = 'User Story') {
  const resultsEl = document.getElementById('evaluationResults');
  resultsEl.classList.remove('hidden');
  
  const isFeature = parentType === 'Feature';
  const childType = isFeature ? 'User Stories' : 'Tasks';
  const childTypeSingular = isFeature ? 'User Story' : 'Task';
  
  // Update section titles
  document.querySelector('#evaluationResults .eval-section:nth-child(1) .eval-section-title').innerHTML = 
    `<span class="status-icon success">✓</span> Correct ${childType}`;
  document.querySelector('#evaluationResults .eval-section:nth-child(2) .eval-section-title').innerHTML = 
    `<span class="status-icon warning">⚠</span> ${childType} to Update`;
  document.querySelector('#evaluationResults .eval-section:nth-child(3) .eval-section-title').innerHTML = 
    `<span class="status-icon error">✕</span> ${childType} to Delete`;
  document.querySelector('#evaluationResults .eval-section:nth-child(4) .eval-section-title').innerHTML = 
    `<span class="status-icon info">+</span> Suggested New ${childType}`;
  
  // Correct items
  document.getElementById('correctTasks').innerHTML = 
    evaluation.correct?.length ? evaluation.correct.map(t => `
      <div class="eval-item">
        <div class="eval-item-header">
          <span class="eval-item-id">#${t.id || 'New'}</span>
        </div>
        <div class="eval-item-title">${escapeHtml(t.title)}</div>
        <div class="eval-item-reason">${escapeHtml(t.reason)}</div>
      </div>
    `).join('') : `<div class="empty-state"><span class="empty-state-text">No correct ${childType.toLowerCase()} identified</span></div>`;
  
  // Items to update
  document.getElementById('updateTasks').innerHTML = 
    evaluation.toUpdate?.length ? evaluation.toUpdate.map(t => `
      <div class="eval-item">
        <div class="eval-item-header">
          <span class="eval-item-id">#${t.id || 'New'}</span>
        </div>
        <div class="eval-item-title">${escapeHtml(t.title)}</div>
        <div class="eval-item-reason">⚠️ ${escapeHtml(t.issue)}</div>
        <div class="eval-item-suggestion">💡 ${escapeHtml(t.suggestion)}</div>
      </div>
    `).join('') : `<div class="empty-state"><span class="empty-state-text">No updates needed</span></div>`;
  
  // Items to delete
  document.getElementById('deleteTasks').innerHTML = 
    evaluation.toDelete?.length ? evaluation.toDelete.map((t, idx) => `
      <div class="eval-item">
        <div class="eval-item-header">
          <span class="eval-item-id">#${t.id || 'New'}</span>
        </div>
        <div class="eval-item-title">${escapeHtml(t.title)}</div>
        <div class="eval-item-reason">${escapeHtml(t.reason)}</div>
        ${t.id ? `<div class="eval-item-actions">
          <button class="btn btn-danger btn-sm" data-action="deleteItem" data-id="${t.id}" data-index="${idx}">🗑️ Delete from ADO</button>
        </div>` : ''}
      </div>
    `).join('') : `<div class="empty-state"><span class="empty-state-text">No ${childType.toLowerCase()} to delete</span></div>`;
  
  // Suggested new items
  const newItems = evaluation.newItems || evaluation.newTasks || [];
  document.getElementById('suggestedTasks').innerHTML = 
    newItems.length ? newItems.map((t, idx) => `
      <div class="eval-item">
        <div class="eval-item-title">${escapeHtml(t.title)}</div>
        <div class="eval-item-reason">${escapeHtml(t.description)}</div>
        <div class="eval-item-suggestion">⏱️ ${isFeature ? (t.storyPoints || 0) + ' SP' : (t.hours || 0) + 'h'} - ${escapeHtml(t.reason)}</div>
        <div class="eval-item-actions">
          <button class="btn btn-success btn-sm" data-action="createTask" data-index="${idx}">➕ Create ${childTypeSingular}</button>
        </div>
      </div>
    `).join('') : `<div class="empty-state"><span class="empty-state-text">No new ${childType.toLowerCase()} suggested</span></div>`;
  
  // Summary with action buttons
  const hasNew = newItems.length > 0;
  
  document.getElementById('evalSummary').innerHTML = `
    <h4>📊 Summary</h4>
    <p>${escapeHtml(evaluation.summary || 'Evaluation complete.')}</p>
    ${hasNew ? `
      <div class="eval-actions">
        <button class="btn btn-success" data-action="createAllTasks">➕ Create All Suggested ${childType}</button>
      </div>
    ` : ''}
  `;
}

// Create a single suggested item in ADO
async function createSuggestedTask(index) {
  const { org, project, pat } = getSettings();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  const newItems = currentEvaluation?.newItems || currentEvaluation?.newTasks || [];
  if (!newItems[index]) {
    showResult('Item not found', 'error');
    return;
  }
  
  const item = newItems[index];
  const isFeature = selectedEvalWorkItemType === 'Feature';
  const workItemType = isFeature ? 'User Story' : 'Task';
  
  try {
    showLoading('evaluateLoading', true, `Creating ${workItemType.toLowerCase()}...`);
    
    const auth = btoa(":" + pat);
    const body = [
      { "op": "add", "path": "/fields/System.Title", "value": item.title },
      { "op": "add", "path": "/fields/System.Description", "value": item.description || '' },
      { "op": "add", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": 2 }
    ];
    
    if (isFeature) {
      // For User Stories: use Story Points
      body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.StoryPoints", "value": item.storyPoints || 3 });
    } else {
      // For Tasks: use time estimates
      body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.OriginalEstimate", "value": item.hours || 4 });
      body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.RemainingWork", "value": item.hours || 4 });
      body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Common.Activity", "value": "Development" });
    }
    
    // Add Iteration Path from parent
    if (currentEvalStoryData?.iterationPath) {
      body.push({ "op": "add", "path": "/fields/System.IterationPath", "value": currentEvalStoryData.iterationPath });
    }
    
    // Add Area Path from parent
    if (currentEvalStoryData?.areaPath) {
      body.push({ "op": "add", "path": "/fields/System.AreaPath", "value": currentEvalStoryData.areaPath });
    }
    
    // Assign to same user as parent (if exists)
    if (currentEvalStoryData?.assignedTo?.uniqueName) {
      body.push({ "op": "add", "path": "/fields/System.AssignedTo", "value": currentEvalStoryData.assignedTo.uniqueName });
    }
    
    // Link to parent work item
    if (currentEvalStoryId && currentEvalStoryData?.url) {
      body.push({
        "op": "add",
        "path": "/relations/-",
        "value": { "rel": "System.LinkTypes.Hierarchy-Reverse", "url": currentEvalStoryData.url }
      });
    }
    
    const response = await fetch(
      `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=7.0`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json-patch+json"
        },
        body: JSON.stringify(body)
      }
    );
    
    showLoading('evaluateLoading', false);
    
    if (response.ok) {
      const created = await response.json();
      showResult(`✓ Created ${workItemType.toLowerCase()} #${created.id}: ${item.title}`, 'success');
      // Remove from suggestions
      newItems.splice(index, 1);
      displayEvaluationResults(currentEvaluation, selectedEvalWorkItemType);
    } else {
      const error = await response.text();
      showResult(`Failed to create task: ${response.status}`, 'error');
    }
  } catch (error) {
    showLoading('evaluateLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// Delete a work item from ADO
async function deleteWorkItemFromADO(workItemId, index) {
  const { org, project, pat } = getSettings();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  // Confirm deletion
  const isFeature = selectedEvalWorkItemType === 'Feature';
  const itemType = isFeature ? 'User Story' : 'Task';
  
  if (!confirm(`Are you sure you want to delete ${itemType} #${workItemId}? This action cannot be undone.`)) {
    return;
  }
  
  try {
    showLoading('evaluateLoading', true, `Deleting ${itemType.toLowerCase()} #${workItemId}...`);
    
    const auth = btoa(":" + pat);
    const response = await fetch(
      `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}?api-version=7.0`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Basic ${auth}`
        }
      }
    );
    
    showLoading('evaluateLoading', false);
    
    if (response.ok) {
      showResult(`✓ Deleted ${itemType.toLowerCase()} #${workItemId}`, 'success');
      // Remove from toDelete list
      if (currentEvaluation?.toDelete) {
        currentEvaluation.toDelete.splice(index, 1);
        displayEvaluationResults(currentEvaluation, selectedEvalWorkItemType);
      }
    } else {
      const errorText = await response.text();
      showResult(`Failed to delete: ${response.status}. ${errorText}`, 'error');
    }
  } catch (error) {
    showLoading('evaluateLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// Create all suggested items
async function createAllSuggestedTasks() {
  const { org, project, pat } = getSettings();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  const newItems = currentEvaluation?.newItems || currentEvaluation?.newTasks || [];
  if (!newItems.length) {
    showResult('No items to create', 'error');
    return;
  }
  
  const isFeature = selectedEvalWorkItemType === 'Feature';
  const workItemType = isFeature ? 'User Story' : 'Task';
  const itemLabel = isFeature ? 'user stories' : 'tasks';
  
  try {
    showLoading('evaluateLoading', true, `Creating ${newItems.length} ${itemLabel}...`);
    
    const auth = btoa(":" + pat);
    let created = 0, failed = 0;
    
    for (const item of newItems) {
      try {
        const body = [
          { "op": "add", "path": "/fields/System.Title", "value": item.title },
          { "op": "add", "path": "/fields/System.Description", "value": item.description || '' },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": 2 }
        ];
        
        if (isFeature) {
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.StoryPoints", "value": item.storyPoints || 3 });
        } else {
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.OriginalEstimate", "value": item.hours || 4 });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.RemainingWork", "value": item.hours || 4 });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Common.Activity", "value": "Development" });
        }
        
        if (currentEvalStoryData?.iterationPath) {
          body.push({ "op": "add", "path": "/fields/System.IterationPath", "value": currentEvalStoryData.iterationPath });
        }
        
        if (currentEvalStoryData?.areaPath) {
          body.push({ "op": "add", "path": "/fields/System.AreaPath", "value": currentEvalStoryData.areaPath });
        }
        
        if (currentEvalStoryData?.assignedTo?.uniqueName) {
          body.push({ "op": "add", "path": "/fields/System.AssignedTo", "value": currentEvalStoryData.assignedTo.uniqueName });
        }
        
        if (currentEvalStoryId && currentEvalStoryData?.url) {
          body.push({
            "op": "add",
            "path": "/relations/-",
            "value": { "rel": "System.LinkTypes.Hierarchy-Reverse", "url": currentEvalStoryData.url }
          });
        }
        
        const response = await fetch(
          `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=7.0`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/json-patch+json"
            },
            body: JSON.stringify(body)
          }
        );
        
        if (response.ok) created++;
        else failed++;
      } catch (e) {
        failed++;
      }
    }
    
    showLoading('evaluateLoading', false);
    
    if (failed === 0) {
      showResult(`✓ Created ${created} ${itemLabel} in Azure DevOps!`, 'success');
      if (currentEvaluation.newItems) currentEvaluation.newItems = [];
      if (currentEvaluation.newTasks) currentEvaluation.newTasks = [];
      displayEvaluationResults(currentEvaluation, selectedEvalWorkItemType);
    } else {
      showResult(`Created ${created}, ${failed} failed`, 'error');
    }
  } catch (error) {
    showLoading('evaluateLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// ============================================
// TAB 3: Easy Insights
// ============================================

let allInsightWorkItems = []; // Store all fetched work items
let filteredInsightWorkItems = []; // Store filtered work items
let currentInsights = null; // Store current insights for auto-fix

async function fetchUserWorkItems() {
  const { org, project, pat } = getSettings();
  
  if (!org || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  const userName = document.getElementById('insightUserName').value.trim();
  if (!userName) {
    showResult('Please enter a user name', 'error');
    return;
  }
  
  try {
    showLoading('insightsLoading', true, 'Fetching work items across all projects...');
    
    const auth = btoa(":" + pat);
    
    // First, get all projects the user has access to
    const projectsResponse = await fetch(
      `https://dev.azure.com/${org}/_apis/projects?api-version=7.0`,
      {
        headers: { "Authorization": `Basic ${auth}` }
      }
    );
    
    if (!projectsResponse.ok) throw new Error('Failed to fetch projects');
    
    const projectsData = await projectsResponse.json();
    const projects = projectsData.value || [];
    
    // Fetch work items from all projects
    allInsightWorkItems = [];
    const projectSet = new Set();
    const sprintSet = new Set();
    const teamSet = new Set();
    const projectTeamsMap = new Map(); // Map project to its teams
    
    for (const proj of projects) {
      try {
        // Fetch teams for this project
        const teamsResponse = await fetch(
          `https://dev.azure.com/${org}/_apis/projects/${encodeURIComponent(proj.id)}/teams?api-version=7.0`,
          {
            headers: { "Authorization": `Basic ${auth}` }
          }
        );
        
        let projectTeams = [];
        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          projectTeams = teamsData.value || [];
        }
        
        const wiql = {
          query: `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.IterationPath], [System.AreaPath], [System.TeamProject]
                  FROM WorkItems 
                  WHERE [System.AssignedTo] CONTAINS '${userName}' 
                  AND [System.State] <> 'Closed' 
                  AND [System.State] <> 'Removed'
                  ORDER BY [System.WorkItemType]`
        };
        
        const wiqlResponse = await fetch(
          `https://dev.azure.com/${org}/${encodeURIComponent(proj.name)}/_apis/wit/wiql?api-version=7.0`,
          {
            method: 'POST',
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(wiql)
          }
        );
        
        if (wiqlResponse.ok) {
          const wiqlData = await wiqlResponse.json();
          const workItemIds = wiqlData.workItems?.map(w => w.id) || [];
          
          if (workItemIds.length > 0) {
            const items = await fetchWorkItemDetails(org, proj.name, auth, workItemIds);
            for (const item of items) {
              item.projectName = proj.name;
              
              // Extract team from Area Path
              const areaPath = item.fields['System.AreaPath'] || '';
              const iterationPath = item.fields['System.IterationPath'] || '';
              
              // Area path format: ProjectName\TeamName\... or ProjectName\...
              const areaParts = areaPath.split('\\');
              if (areaParts.length >= 2) {
                item.teamName = areaParts[1]; // Second part is typically the team name
              } else if (areaParts.length === 1) {
                item.teamName = proj.name; // Default to project name
              }
              
              allInsightWorkItems.push(item);
              projectSet.add(proj.name);
              
              if (item.teamName) {
                const teamKey = `${proj.name}|${item.teamName}`;
                teamSet.add(teamKey);
              }
              
              if (iterationPath) sprintSet.add(iterationPath);
            }
          }
        }
      } catch (e) {
        console.log(`Error fetching from ${proj.name}:`, e);
      }
    }
    
    if (allInsightWorkItems.length === 0) {
      showLoading('insightsLoading', false);
      showResult('No work items found for this user', 'error');
      return;
    }
    
    // Populate filter dropdowns
    populateFilterDropdowns(Array.from(projectSet), Array.from(teamSet), Array.from(sprintSet));
    
    // Show filters
    document.getElementById('insightFilters').classList.remove('hidden');
    
    // Apply initial filters (show all)
    filteredInsightWorkItems = [...allInsightWorkItems];
    analyzeAndDisplayInsights();
    
  } catch (error) {
    showLoading('insightsLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

function populateFilterDropdowns(projects, teams, sprints) {
  const projectSelect = document.getElementById('filterProject');
  const boardSelect = document.getElementById('filterBoard');
  const sprintSelect = document.getElementById('filterSprint');
  
  // Store teams globally for dynamic filtering
  allInsightTeams = teams;
  
  // Clear existing options except first
  projectSelect.innerHTML = '<option value="">All Projects</option>';
  boardSelect.innerHTML = '<option value="">All Boards</option>';
  sprintSelect.innerHTML = '<option value="">All Sprints</option>';
  
  // Add projects
  projects.sort().forEach(proj => {
    const option = document.createElement('option');
    option.value = proj;
    option.textContent = proj;
    projectSelect.appendChild(option);
  });
  
  // Add teams/boards (format: ProjectName|TeamName)
  teams.sort().forEach(teamKey => {
    const [projectName, teamName] = teamKey.split('|');
    const option = document.createElement('option');
    option.value = teamKey;
    option.textContent = `${projectName} - ${teamName}`;
    boardSelect.appendChild(option);
  });
  
  // Add sprints
  sprints.sort().forEach(sprint => {
    const option = document.createElement('option');
    option.value = sprint;
    // Show just the sprint name (last part of path)
    option.textContent = sprint.split('\\').pop();
    sprintSelect.appendChild(option);
  });
}

// Update board filter when project changes
function updateBoardFilter() {
  const projectFilter = document.getElementById('filterProject').value;
  const boardSelect = document.getElementById('filterBoard');
  
  // Clear and reset
  boardSelect.innerHTML = '<option value="">All Boards</option>';
  
  if (!projectFilter) {
    // Show all boards if no project selected
    allInsightTeams.sort().forEach(teamKey => {
      const [projectName, teamName] = teamKey.split('|');
      const option = document.createElement('option');
      option.value = teamKey;
      option.textContent = `${projectName} - ${teamName}`;
      boardSelect.appendChild(option);
    });
  } else {
    // Show only boards for selected project
    const filteredTeams = allInsightTeams.filter(teamKey => teamKey.startsWith(projectFilter + '|'));
    filteredTeams.sort().forEach(teamKey => {
      const [projectName, teamName] = teamKey.split('|');
      const option = document.createElement('option');
      option.value = teamKey;
      option.textContent = teamName; // Show only team name when project is selected
      boardSelect.appendChild(option);
    });
  }
}

function applyInsightFilters() {
  const projectFilter = document.getElementById('filterProject').value;
  const boardFilter = document.getElementById('filterBoard').value;
  const sprintFilter = document.getElementById('filterSprint').value;
  const typeFilter = document.getElementById('filterWorkItemType').value;
  
  filteredInsightWorkItems = allInsightWorkItems.filter(item => {
    const matchProject = !projectFilter || item.projectName === projectFilter;
    
    // Board filter uses ProjectName|TeamName format
    let matchBoard = true;
    if (boardFilter) {
      const [filterProject, filterTeam] = boardFilter.split('|');
      matchBoard = item.projectName === filterProject && item.teamName === filterTeam;
    }
    
    const matchSprint = !sprintFilter || item.fields['System.IterationPath'] === sprintFilter;
    const matchType = !typeFilter || item.fields['System.WorkItemType'] === typeFilter;
    return matchProject && matchBoard && matchSprint && matchType;
  });
  
  analyzeAndDisplayInsights();
}

async function analyzeAndDisplayInsights() {
  showLoading('insightsLoading', true, `Validating ${filteredInsightWorkItems.length} work items...`);
  
  const { org, pat } = getSettings();
  const auth = btoa(":" + pat);
  
  // Categorize and validate
  const insights = {
    features: [],
    stories: [],
    tasks: [],
    allItems: [], // Store all for auto-fix
    timelineIssues: [] // Track timeline issues
  };
  
  // First pass: categorize items and build parent-child relationships
  const storyMap = new Map(); // Map of story ID to story data
  
  for (const item of filteredInsightWorkItems) {
    const type = item.fields['System.WorkItemType'];
    if (type === 'User Story') {
      storyMap.set(item.id, {
        finishDate: item.fields['Microsoft.VSTS.Scheduling.FinishDate'],
        title: item.fields['System.Title']
      });
    }
  }
  
  // Second pass: validate and check timeline issues
  for (const item of filteredInsightWorkItems) {
    const type = item.fields['System.WorkItemType'];
    const validated = validateWorkItem(item, type);
    validated.projectName = item.projectName;
    validated.rawItem = item; // Keep reference for updates
    
    // Check timeline issues for Tasks
    if (type === 'Task') {
      const taskFinishDate = item.fields['Microsoft.VSTS.Scheduling.FinishDate'];
      if (taskFinishDate) {
        // Try to find parent User Story
        const relations = item.relations || [];
        const parentUrl = relations
          .filter(r => r.rel === 'System.LinkTypes.Hierarchy-Reverse')
          .map(r => r.url)[0];
        
        if (parentUrl) {
          // Extract parent ID from URL
          const parentIdMatch = parentUrl.match(/workitems\/(\d+)/);
          if (parentIdMatch) {
            const parentId = parseInt(parentIdMatch[1]);
            const parentStory = storyMap.get(parentId);
            if (parentStory && parentStory.finishDate) {
              const taskEnd = new Date(taskFinishDate);
              const storyEnd = new Date(parentStory.finishDate);
              if (taskEnd > storyEnd) {
                validated.crossesParentDeadline = true;
                validated.timelineWarning = `Task ends ${formatDateDiff(taskEnd, storyEnd)} after User Story "${parentStory.title}" deadline (${storyEnd.toLocaleDateString()})`;
                insights.timelineIssues.push(validated);
              }
            }
          }
        }
      }
    }
    
    insights.allItems.push(validated);
    
    if (type === 'Feature') {
      insights.features.push(validated);
    } else if (type === 'User Story') {
      insights.stories.push(validated);
    } else if (type === 'Task') {
      insights.tasks.push(validated);
    }
  }
  
  currentInsights = insights;
  
  showLoading('insightsLoading', false);
  displayInsightsResults(insights);
}

// Helper function to format date difference
function formatDateDiff(date1, date2) {
  const diffTime = Math.abs(date1 - date2);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return '1 day';
  return `${diffDays} days`;
}

async function analyzeInsights() {
  // This is now handled by fetchUserWorkItems
  await fetchUserWorkItems();
}

async function fetchWorkItemDetails(org, project, auth, ids) {
  // Batch fetch in groups of 200, include relations for parent-child checking
  const batchSize = 200;
  const allItems = [];
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems?ids=${batch.join(',')}&$expand=relations&api-version=7.0`;
    
    const response = await fetch(url, {
      headers: { "Authorization": `Basic ${auth}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      allItems.push(...(data.value || []));
    }
  }
  
  return allItems;
}

// Fetch child tasks for a User Story to calculate total hours
async function fetchChildTasksForStory(org, project, auth, storyId) {
  try {
    // First get the story with its relations
    const storyUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${storyId}?$expand=relations&api-version=7.0`;
    const storyResponse = await fetch(storyUrl, {
      headers: { "Authorization": `Basic ${auth}` }
    });
    
    if (!storyResponse.ok) return [];
    
    const storyData = await storyResponse.json();
    const relations = storyData.relations || [];
    
    // Get child work item IDs
    const childIds = relations
      .filter(r => r.rel === 'System.LinkTypes.Hierarchy-Forward')
      .map(r => {
        const match = r.url.match(/workitems\/(\d+)/);
        return match ? match[1] : null;
      })
      .filter(id => id !== null);
    
    if (childIds.length === 0) return [];
    
    // Fetch child work items
    const childUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems?ids=${childIds.join(',')}&api-version=7.0`;
    const childResponse = await fetch(childUrl, {
      headers: { "Authorization": `Basic ${auth}` }
    });
    
    if (!childResponse.ok) return [];
    
    const childData = await childResponse.json();
    const tasks = (childData.value || []).filter(item => 
      item.fields['System.WorkItemType'] === 'Task'
    );
    
    return tasks;
  } catch (error) {
    console.error('Error fetching child tasks:', error);
    return [];
  }
}

function validateWorkItem(item, type) {
  const rules = VALIDATION_RULES[type] || [];
  const missingFields = [];        // Clean labels for auto-fix
  const invalidFieldLabels = [];   // Clean labels for auto-fix
  const invalidFieldMessages = []; // Detailed messages for display
  const dateWarnings = [];
  
  // DEBUG: Log all fields in the work item to find correct field names
  console.log(`\n=== ALL FIELDS FOR ITEM ${item.id} (${type}) ===`);
  const allFieldNames = Object.keys(item.fields).sort();
  allFieldNames.forEach(fieldName => {
    const value = item.fields[fieldName];
    if (fieldName.toLowerCase().includes('date') || fieldName.toLowerCase().includes('qa') || fieldName.toLowerCase().includes('actual')) {
      console.log(`  ${fieldName}: ${JSON.stringify(value)}`);
    }
  });
  console.log(`=== END ALL FIELDS ===\n`);
  
  // Fields where 0 is a valid value
  const numericFieldsWhereZeroIsValid = [
    'Microsoft.VSTS.Scheduling.CompletedWork',
    'Microsoft.VSTS.Scheduling.RemainingWork'
  ];
  
  // Minimum valid date (anything before 2020 is considered invalid/placeholder)
  const minValidDate = new Date('2020-01-01');
  
  // Get planned dates for comparison
  const plannedStartDate = item.fields['Microsoft.VSTS.Scheduling.StartDate'];
  const plannedEndDate = item.fields['Microsoft.VSTS.Scheduling.FinishDate'];
  const originalEstimate = item.fields['Microsoft.VSTS.Scheduling.OriginalEstimate'];
  const remainingWork = item.fields['Microsoft.VSTS.Scheduling.RemainingWork'];
  
  // Get sprint/iteration end date from iteration path
  let sprintEndDate = null;
  const iterationPath = item.fields['System.IterationPath'];
  // This would need to be fetched from Azure DevOps API in a real scenario
  // For now, we'll use a placeholder or skip this validation
  
  for (const rule of rules) {
    const value = item.fields[rule.field];
    const isNumericZeroValid = numericFieldsWhereZeroIsValid.includes(rule.field);
    
    // Debug: Log each field being checked
    console.log(`Checking field: ${rule.label} (${rule.field})`, { value, isDateField: rule.isDateField });
    
    // Check if field is missing (including string "null")
    let isMissing = false;
    if (isNumericZeroValid) {
      isMissing = (value === undefined || value === null || value === '' || value === 'null');
    } else {
      isMissing = (value === undefined || value === null || value === '' || value === 0 || value === 'null');
    }
    
    if (isMissing) {
      console.log(`  -> Field is MISSING`);
      missingFields.push(rule.label);
      continue;
    }
    
    // Check date fields for validity
    if (rule.isDateField && value && value !== 'null') {
      const dateValue = new Date(value);
      let isInvalid = false;
      
      // Debug logging for date validation
      console.log(`Validating ${rule.label}: value="${value}", parsed=${dateValue.toISOString()}, minValid=${minValidDate.toISOString()}`);
      
      // Check if date parsing failed or date is invalid (before 2020 - likely placeholder)
      if (isNaN(dateValue.getTime())) {
        invalidFieldMessages.push(`${rule.label} has invalid date format`);
        isInvalid = true;
        console.log(`  -> Invalid: date parsing failed`);
      } else if (dateValue.getTime() < minValidDate.getTime()) {
        invalidFieldMessages.push(`${rule.label} (${dateValue.toLocaleDateString()} is invalid - before 2020)`);
        isInvalid = true;
        console.log(`  -> Invalid: before 2020 (${dateValue.getTime()} < ${minValidDate.getTime()})`);
      } else {
        console.log(`  -> Valid date`);
      }
      
      // Only do further validation if date is valid
      if (!isInvalid) {
        // Check Planned End Date (Finish Date) - should be after Start Date
        if (rule.label === 'Planned End Date' && plannedStartDate) {
          const startDate = new Date(plannedStartDate);
          if (!isNaN(startDate.getTime())) {
            // For User Stories: Check if start and end are the same day
            if (type === 'User Story' && dateValue.toDateString() === startDate.toDateString()) {
              invalidFieldMessages.push(`Planned End Date is same as Start Date (${startDate.toLocaleDateString()}) - needs adjustment based on task estimates`);
              isInvalid = true;
            } else if (dateValue <= startDate) {
              invalidFieldMessages.push(`Planned End Date must be after Planned Start Date`);
              isInvalid = true;
            }
          }
        }
        
        // Check Task Finish Date - should be after or same as Start Date (allow same-day tasks)
        if (rule.label === 'Finish Date' && type === 'Task') {
          const taskStartDate = item.fields['Microsoft.VSTS.Scheduling.StartDate'];
          if (taskStartDate) {
            const startDate = new Date(taskStartDate);
            if (!isNaN(startDate.getTime()) && dateValue < startDate) {
              invalidFieldMessages.push(`Finish Date (${dateValue.toLocaleDateString()}) cannot be before Start Date (${startDate.toLocaleDateString()})`);
              isInvalid = true;
            }
          }
        }
        
        // Check QA Ready Date - should be between Planned Start and Planned End
        if (rule.label === 'QA Ready Date' && plannedStartDate && plannedEndDate) {
          const startDate = new Date(plannedStartDate);
          const endDate = new Date(plannedEndDate);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            // If start and end dates are the same, flag for adjustment
            if (startDate.toDateString() === endDate.toDateString()) {
              invalidFieldMessages.push(`${rule.label} cannot be set - Planned Start and End dates are the same. End date needs adjustment based on task estimates.`);
              // Also flag Planned End Date for fixing
              if (!invalidFieldLabels.includes('Planned End Date')) {
                invalidFieldLabels.push('Planned End Date');
              }
              isInvalid = true;
            } else if (dateValue < startDate || dateValue > endDate) {
              invalidFieldMessages.push(`${rule.label} should be between Planned Start (${startDate.toLocaleDateString()}) and End (${endDate.toLocaleDateString()})`);
              isInvalid = true;
            }
          }
        }
        
        // Check Actual Start Date - should be >= Planned Start Date (or close to it)
        if (rule.label === 'Actual Start Date' && plannedStartDate) {
          const startDate = new Date(plannedStartDate);
          if (!isNaN(startDate.getTime())) {
            // Allow some flexibility - actual can be slightly before planned
            const flexStartDate = new Date(startDate);
            flexStartDate.setDate(flexStartDate.getDate() - 7); // 7 days flexibility
            if (dateValue < flexStartDate) {
              invalidFieldMessages.push(`${rule.label} (${dateValue.toLocaleDateString()}) is before Planned Start Date`);
              isInvalid = true;
            }
          }
        }
        
        // Check Actual End Date - should not exceed Planned End Date significantly
        if (rule.label === 'Actual End Date' && plannedEndDate) {
          const endDate = new Date(plannedEndDate);
          if (!isNaN(endDate.getTime()) && dateValue > endDate) {
            dateWarnings.push(`${rule.label} (${dateValue.toLocaleDateString()}) exceeds Planned End Date (${endDate.toLocaleDateString()})`);
          }
        }
      }
      
      // Track clean label for auto-fix
      if (isInvalid && !invalidFieldLabels.includes(rule.label)) {
        invalidFieldLabels.push(rule.label);
      }
    }
  }
  
  // Validate Remaining Work vs Original Estimate
  if (type === 'Task') {
    const originalEst = item.fields['Microsoft.VSTS.Scheduling.OriginalEstimate'];
    const remaining = item.fields['Microsoft.VSTS.Scheduling.RemainingWork'];
    const completed = item.fields['Microsoft.VSTS.Scheduling.CompletedWork'];
    
    // Convert to numbers (treating null/undefined/empty as 0 for calculation)
    const origNum = parseFloat(originalEst) || 0;
    const remNum = parseFloat(remaining) || 0;
    const compNum = parseFloat(completed) || 0;
    
    // Check if values are mathematically consistent
    // Original Estimate should equal Remaining + Completed
    if (origNum > 0 || remNum > 0 || compNum > 0) {
      const expected = remNum + compNum;
      const tolerance = 0.01; // Small tolerance for floating point
      
      if (Math.abs(origNum - expected) > tolerance) {
        invalidFieldMessages.push(`Work tracking mismatch: Original Estimate (${origNum}h) ≠ Remaining (${remNum}h) + Completed (${compNum}h) = ${expected}h`);
        
        // Determine which fields to fix
        // Priority: If Original and one other exist, calculate the missing one
        if (origNum > 0 && remNum > 0 && compNum >= 0) {
          // Have Original and Remaining - calculate Completed
          if (!invalidFieldLabels.includes('Completed Work')) {
            invalidFieldLabels.push('Completed Work');
          }
        } else if (origNum > 0 && compNum > 0 && remNum >= 0) {
          // Have Original and Completed - calculate Remaining
          if (!invalidFieldLabels.includes('Remaining Work')) {
            invalidFieldLabels.push('Remaining Work');
          }
        } else if (remNum > 0 && compNum > 0) {
          // Have Remaining and Completed - calculate Original
          if (!invalidFieldLabels.includes('Original Estimate')) {
            invalidFieldLabels.push('Original Estimate');
          }
        } else {
          // Default: mark all three for consistency
          if (!invalidFieldLabels.includes('Original Estimate')) {
            invalidFieldLabels.push('Original Estimate');
          }
          if (!invalidFieldLabels.includes('Remaining Work')) {
            invalidFieldLabels.push('Remaining Work');
          }
          if (!invalidFieldLabels.includes('Completed Work')) {
            invalidFieldLabels.push('Completed Work');
          }
        }
      }
    }
    
    // Also check: Remaining Work should not exceed Original Estimate
    if (origNum > 0 && remNum > origNum) {
      if (!invalidFieldMessages.some(msg => msg.includes('Work tracking mismatch'))) {
        invalidFieldMessages.push(`Remaining Work (${remNum}h) cannot exceed Original Estimate (${origNum}h)`);
        if (!invalidFieldLabels.includes('Remaining Work')) {
          invalidFieldLabels.push('Remaining Work');
        }
      }
    }
  }
  
  // Validate Remaining Work vs Original Estimate for User Stories (if applicable)
  if (originalEstimate !== undefined && originalEstimate !== null && originalEstimate !== '' &&
      remainingWork !== undefined && remainingWork !== null && remainingWork !== '') {
    const original = parseFloat(originalEstimate) || 0;
    const remaining = parseFloat(remainingWork) || 0;
    
    if (remaining > original) {
      invalidFieldMessages.push(`Remaining Work (${remaining}h) cannot exceed Original Estimate (${original}h)`);
      if (!invalidFieldLabels.includes('Remaining Work')) {
        invalidFieldLabels.push('Remaining Work');
      }
    }
  }
  
  // Check timeline issues for Tasks
  let timelineWarning = null;
  if (type === 'Task') {
    const taskFinishDate = item.fields['Microsoft.VSTS.Scheduling.FinishDate'];
    if (taskFinishDate) {
      const finishDate = new Date(taskFinishDate);
      if (item.parentEndDate && finishDate > new Date(item.parentEndDate)) {
        timelineWarning = `Task ends after User Story deadline (${new Date(item.parentEndDate).toLocaleDateString()})`;
      }
    }
  }
  
  // Combine all warnings for display
  const allWarnings = [...invalidFieldMessages, ...dateWarnings];
  if (timelineWarning) allWarnings.push(timelineWarning);
  
  // Fields to fix = missing + invalid
  const fieldsToFix = [...missingFields, ...invalidFieldLabels];
  
  // Debug logging
  console.log(`Validation result for ${item.id}:`, {
    missingFields,
    invalidFieldLabels,
    invalidFieldMessages,
    isComplete: missingFields.length === 0 && invalidFieldLabels.length === 0
  });
  
  return {
    id: item.id,
    title: item.fields['System.Title'],
    type: type,
    state: item.fields['System.State'],
    missingFields: missingFields,
    invalidFields: invalidFieldMessages,      // Detailed messages for display
    invalidFieldLabels: invalidFieldLabels,   // Clean labels for auto-fix
    fieldsToFix: fieldsToFix,                 // Combined list for auto-fix
    isComplete: missingFields.length === 0 && invalidFieldLabels.length === 0,
    hasIssues: invalidFieldMessages.length > 0 || dateWarnings.length > 0,
    timelineWarning: allWarnings.length > 0 ? allWarnings.join('; ') : null,
    finishDate: item.fields['Microsoft.VSTS.Scheduling.FinishDate'],
    plannedStartDate: plannedStartDate,
    plannedEndDate: plannedEndDate
  };
}

// Fetch parent Feature data for a User Story
async function fetchParentFeatureData(org, project, pat, userStoryData) {
  if (!userStoryData || !userStoryData.relations) return null;
  
  const auth = btoa(":" + pat);
  const relations = userStoryData.relations || [];
  
  // Find parent relation
  const parentUrl = relations
    .filter(r => r.rel === 'System.LinkTypes.Hierarchy-Reverse')
    .map(r => r.url)[0];
  
  if (!parentUrl) return null;
  
  try {
    const response = await fetch(parentUrl, {
      headers: { "Authorization": `Basic ${auth}` }
    });
    
    if (response.ok) {
      const parentData = await response.json();
      if (parentData.fields['System.WorkItemType'] === 'Feature') {
        return parentData;
      }
    }
  } catch (e) {
    console.error('Error fetching parent Feature:', e);
  }
  
  return null;
}

function displayInsightsResults(insights) {
  // Show summary
  document.getElementById('insightsSummary').classList.remove('hidden');
  document.getElementById('featureCount').textContent = insights.features.length;
  document.getElementById('storyCount').textContent = insights.stories.length;
  document.getElementById('taskCountInsights').textContent = insights.tasks.length;
  
  // Count incomplete items
  const incompleteCount = insights.allItems.filter(i => !i.isComplete).length;
  document.getElementById('incompleteCount').textContent = incompleteCount;
  
  // Count timeline issues
  const timelineIssueCount = insights.timelineIssues?.length || 0;
  const timelineCountEl = document.getElementById('timelineIssueCount');
  if (timelineCountEl) {
    timelineCountEl.textContent = timelineIssueCount;
    timelineCountEl.parentElement.style.display = timelineIssueCount > 0 ? 'flex' : 'none';
  }
  
  // Show/hide auto-fix button based on incomplete count
  const autoFixSection = document.getElementById('autoFixSection');
  if (incompleteCount > 0) {
    autoFixSection.classList.remove('hidden');
  } else {
    autoFixSection.classList.add('hidden');
  }
  
  // Show results
  const resultsEl = document.getElementById('insightsResults');
  resultsEl.classList.remove('hidden');
  
  // Features
  const featureComplete = insights.features.filter(f => f.isComplete).length;
  document.getElementById('featureStats').textContent = `${featureComplete}/${insights.features.length} complete`;
  document.getElementById('featureInsights').innerHTML = insights.features.length ?
    insights.features.map(f => renderInsightItem(f, 'feature')).join('') :
    '<div class="empty-state"><span class="empty-state-text">No features found</span></div>';
  
  // Stories
  const storyComplete = insights.stories.filter(s => s.isComplete).length;
  document.getElementById('storyStats').textContent = `${storyComplete}/${insights.stories.length} complete`;
  document.getElementById('storyInsights').innerHTML = insights.stories.length ?
    insights.stories.map(s => renderInsightItem(s, 'story')).join('') :
    '<div class="empty-state"><span class="empty-state-text">No user stories found</span></div>';
  
  // Tasks
  const taskComplete = insights.tasks.filter(t => t.isComplete).length;
  document.getElementById('taskStats').textContent = `${taskComplete}/${insights.tasks.length} complete`;
  document.getElementById('taskInsights').innerHTML = insights.tasks.length ?
    insights.tasks.map(t => renderInsightItem(t, 'task')).join('') :
    '<div class="empty-state"><span class="empty-state-text">No tasks found</span></div>';
}

function renderInsightItem(item, type) {
  // Get all fields that need fixing for suggestions
  const fieldsToFix = item.fieldsToFix || item.missingFields || [];
  const suggestion = generateDateSuggestion(item, type);
  const projectInfo = item.projectName ? `<span class="project-badge">${escapeHtml(item.projectName)}</span>` : '';
  
  // Check for timeline/date warnings
  const hasTimelineIssue = item.timelineWarning || item.crossesParentDeadline;
  const timelineWarningHtml = hasTimelineIssue ? `
    <div class="timeline-warning">
      <span class="warning-icon">⏰</span>
      <span class="warning-text">${escapeHtml(item.timelineWarning || 'Date issue detected!')}</span>
    </div>
  ` : '';
  
  // Determine status
  const hasInvalidFields = item.invalidFields && item.invalidFields.length > 0;
  const hasMissingFields = item.missingFields && item.missingFields.length > 0;
  const needsFix = hasMissingFields || hasInvalidFields;
  
  let statusBadge = '';
  if (!item.isComplete) {
    statusBadge = '<span class="status-badge incomplete">⚠️ Incomplete</span>';
  } else {
    statusBadge = '<span class="status-badge complete">✅ Complete</span>';
  }
  
  return `
    <div class="insight-item ${hasTimelineIssue ? 'has-timeline-issue' : ''} ${hasInvalidFields ? 'has-invalid-fields' : ''}" data-item-id="${item.id}">
      <div class="insight-item-header">
        <span class="insight-item-id">#${item.id}</span>
        ${projectInfo}
        ${statusBadge}
        ${hasTimelineIssue ? '<span class="status-badge timeline-issue">⏰ Date Issues</span>' : ''}
      </div>
      <div class="insight-item-title">${escapeHtml(item.title)}</div>
      ${timelineWarningHtml}
      ${hasMissingFields ? `
        <div class="missing-fields">
          <div class="missing-fields-label">❌ Missing Fields</div>
          <div class="missing-field-tags">
            ${item.missingFields.map(f => `<span class="missing-field-tag required">${escapeHtml(f)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      ${hasInvalidFields ? `
        <div class="missing-fields invalid">
          <div class="missing-fields-label">🚫 Invalid Values</div>
          <div class="missing-field-tags">
            ${item.invalidFields.map(f => `<span class="missing-field-tag invalid">${escapeHtml(f)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      ${needsFix ? `
        <div class="insight-suggestion">
          <div class="insight-suggestion-label">💡 AI Suggested Fix</div>
          <div class="insight-suggestion-text">${suggestion}</div>
        </div>
        <div class="insight-actions">
          <button class="btn btn-success btn-sm" data-action="fixItem" data-id="${item.id}" data-type="${item.type}">
            🔧 Auto-Fix This Item
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// Generate intelligent date suggestion based on planned dates
function generateDateSuggestion(item, type) {
  const fieldsToFix = item.fieldsToFix || item.missingFields || [];
  if (fieldsToFix.length === 0) return 'All required fields are filled!';
  
  const suggestions = [];
  const plannedStart = item.plannedStartDate ? new Date(item.plannedStartDate) : null;
  const plannedEnd = item.plannedEndDate ? new Date(item.plannedEndDate) : null;
  const originalEstimate = item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.OriginalEstimate'];
  const storyPoints = item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'];
  
  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', '');
  };
  
  for (const field of fieldsToFix) {
    if (field === 'QA Ready Date' && plannedEnd) {
      const qaDate = new Date(plannedEnd);
      qaDate.setDate(qaDate.getDate() - 2);
      suggestions.push(`<strong>QA Ready Date</strong>: ${formatDate(qaDate)} (2 days before Planned End)`);
    } else if (field === 'Actual Start Date' && plannedStart) {
      suggestions.push(`<strong>Actual Start Date</strong>: ${formatDate(plannedStart)} (same as Planned Start)`);
    } else if (field === 'Actual End Date' && plannedEnd) {
      suggestions.push(`<strong>Actual End Date</strong>: ${formatDate(plannedEnd)} (same as Planned End)`);
    } else if (field === 'Planned End Date' && type === 'story' && plannedStart && storyPoints) {
      // Calculate User Story Planned End Date based on Story Points
      const points = parseFloat(storyPoints) || 3;
      const hoursPerPoint = 8;
      const hoursPerDay = 6;
      const totalHours = points * hoursPerPoint;
      const daysNeeded = Math.ceil(totalHours / hoursPerDay);
      const endDate = new Date(plannedStart);
      endDate.setDate(endDate.getDate() + daysNeeded - 1);
      suggestions.push(`<strong>Planned End Date</strong>: ${formatDate(endDate)} (${points} SP × 8h = ${totalHours}h @ 6h/day = ${daysNeeded} days)`);
    } else if (field === 'Finish Date' && type === 'task' && plannedStart && originalEstimate) {
      // Calculate Task Finish Date based on Original Estimate
      const hours = parseFloat(originalEstimate) || 4;
      const hoursPerDay = 6;
      const daysNeeded = Math.ceil(hours / hoursPerDay);
      const finishDate = new Date(plannedStart);
      if (hours > hoursPerDay) {
        finishDate.setDate(finishDate.getDate() + (daysNeeded - 1));
      }
      const dayText = daysNeeded === 1 ? 'same day' : `${daysNeeded} days`;
      suggestions.push(`<strong>Finish Date</strong>: ${formatDate(finishDate)} (${hours}h @ 6h/day = ${dayText})`);
    } else if (field === 'Planned Start Date') {
      suggestions.push(`<strong>Planned Start Date</strong>: Set based on sprint planning`);
    } else if (field === 'Planned End Date') {
      suggestions.push(`<strong>Planned End Date</strong>: Set based on sprint end date`);
    } else if (field === 'Story Points') {
      suggestions.push(`<strong>Story Points</strong>: Estimate complexity (1,2,3,5,8,13)`);
    } else if (field === 'Priority') {
      suggestions.push(`<strong>Priority</strong>: 2 (High)`);
    } else if (field === 'Risk') {
      suggestions.push(`<strong>Risk</strong>: 2 - Medium`);
    } else if (field === 'Original Estimate' || field === 'Remaining Work' || field === 'Completed Work') {
      // Get work tracking data for calculation
      const orig = parseFloat(item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.OriginalEstimate']) || 0;
      const rem = parseFloat(item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.RemainingWork']) || 0;
      const comp = parseFloat(item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.CompletedWork']) || 0;
      
      if (field === 'Completed Work' && orig > 0 && rem > 0) {
        const calculated = Math.max(0, orig - rem);
        suggestions.push(`<strong>Completed Work</strong>: ${calculated}h (Original ${orig}h - Remaining ${rem}h)`);
      } else if (field === 'Remaining Work' && orig > 0 && comp > 0) {
        const calculated = Math.max(0, orig - comp);
        suggestions.push(`<strong>Remaining Work</strong>: ${calculated}h (Original ${orig}h - Completed ${comp}h)`);
      } else if (field === 'Original Estimate' && rem > 0 && comp > 0) {
        const calculated = rem + comp;
        suggestions.push(`<strong>Original Estimate</strong>: ${calculated}h (Remaining ${rem}h + Completed ${comp}h)`);
      } else {
        suggestions.push(`<strong>${field}</strong>: Will be calculated based on work tracking formula`);
      }
    } else {
      suggestions.push(`<strong>${field}</strong>: Will be auto-filled`);
    }
  }
  
  return suggestions.join('<br>');
}

// Event handler for insights clicks
function handleInsightsClick(e) {
  const target = e.target.closest('button');
  if (!target) return;
  
  if (target.dataset.action === 'fixItem') {
    const id = parseInt(target.dataset.id, 10);
    const type = target.dataset.type;
    autoFixSingleItem(id, type);
  }
}

function generateSuggestion(missingFields, type) {
  if (missingFields.length === 0) return 'All required fields are filled!';
  
  const suggestions = {
    'Priority': 'Set priority based on business impact (1=Critical, 2=High, 3=Medium, 4=Low)',
    'Risk': 'Assess risk level considering technical complexity and dependencies',
    'Effort': 'Estimate effort in hours based on scope and complexity',
    'Business Value': 'Rate business value from 1-100 based on customer impact',
    'Time Criticality': 'Rate urgency from 1-100 based on deadline requirements',
    'Start Date': 'Set start date based on sprint planning',
    'Target Date': 'Set target date allowing buffer for testing and review',
    'Story Points': 'Estimate complexity using Fibonacci sequence (1,2,3,5,8,13)',
    'QA Ready Date': 'Set QA date at least 2 days before sprint end',
    'Original Estimate': 'Set realistic hours based on task complexity',
    'Remaining Work': 'Update remaining hours as work progresses',
    'Completed Work': 'Log completed hours daily',
    'Activity': 'Categorize as Development, Testing, Design, etc.',
    'Finish Date': 'Set finish date accounting for dependencies'
  };
  
  const relevantSuggestions = missingFields
    .map(f => suggestions[f] || `Fill in ${f}`)
    .slice(0, 2);
  
  return relevantSuggestions.join('. ');
}

// Generate default values for missing fields
// plannedStart and plannedEnd are ISO date strings from the work item
// For Tasks: originalEstimate contains work tracking values from the item
function generateDefaultValues(fieldsToFix, type, itemTitle, plannedStart, plannedEnd, originalEstimate, workTrackingData) {
  const today = new Date();
  
  // Use planned dates if available, otherwise use defaults
  const plannedStartDate = plannedStart ? new Date(plannedStart) : today;
  let plannedEndDate = plannedEnd ? new Date(plannedEnd) : new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Calculate User Story Planned End Date based on Story Points (if not available)
  if (type === 'User Story' && !plannedEnd) {
    // Get Story Points from the item (will be in fieldsToFix or already set)
    const storyPoints = originalEstimate || 3; // Use originalEstimate parameter for story points
    const hoursPerPoint = 8; // Assuming 8 hours per story point
    const hoursPerDay = 6;
    const totalHours = storyPoints * hoursPerPoint;
    const daysNeeded = Math.ceil(totalHours / hoursPerDay);
    
    plannedEndDate = new Date(plannedStartDate);
    plannedEndDate.setDate(plannedEndDate.getDate() + daysNeeded - 1);
  }
  
  // Calculate QA Ready Date: 2 days before planned end
  // Ensure QA Ready Date is between start and end
  const qaReadyDate = new Date(plannedEndDate);
  qaReadyDate.setDate(qaReadyDate.getDate() - 2);
  
  // If QA Ready Date would be before start date, set it to 1 day before end
  if (qaReadyDate < plannedStartDate) {
    qaReadyDate.setTime(plannedEndDate.getTime());
    qaReadyDate.setDate(qaReadyDate.getDate() - 1);
    
    // If still before start, use the same day as start
    if (qaReadyDate < plannedStartDate) {
      qaReadyDate.setTime(plannedStartDate.getTime());
    }
  }
  
  // Calculate default dates based on planned dates
  const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  // For Task work tracking: Calculate Original Estimate, Remaining, and Completed
  let calcOriginal = 4;
  let calcRemaining = 4;
  let calcCompleted = 0;
  
  if (type === 'Task' && workTrackingData) {
    const orig = parseFloat(workTrackingData.original) || 0;
    const rem = parseFloat(workTrackingData.remaining) || 0;
    const comp = parseFloat(workTrackingData.completed) || 0;
    
    // Apply formula: Original = Remaining + Completed
    // Determine which field to recalculate based on fieldsToFix
    const fixOriginal = fieldsToFix.includes('Original Estimate');
    const fixRemaining = fieldsToFix.includes('Remaining Work');
    const fixCompleted = fieldsToFix.includes('Completed Work');
    
    // Priority: Fix the field that's marked as needing fix
    if (fixCompleted && orig > 0 && rem >= 0) {
      // Fix Completed: Completed = Original - Remaining
      calcOriginal = orig;
      calcRemaining = rem;
      calcCompleted = Math.max(0, orig - rem);
    } else if (fixRemaining && orig > 0 && comp >= 0) {
      // Fix Remaining: Remaining = Original - Completed
      calcOriginal = orig;
      calcCompleted = comp;
      calcRemaining = Math.max(0, orig - comp);
    } else if (fixOriginal && rem >= 0 && comp >= 0) {
      // Fix Original: Original = Remaining + Completed
      calcRemaining = rem;
      calcCompleted = comp;
      calcOriginal = rem + comp;
    } else if (orig > 0 && rem > 0 && comp > 0) {
      // All three exist - use Original and Remaining as source of truth
      calcOriginal = orig;
      calcRemaining = rem;
      calcCompleted = Math.max(0, orig - rem);
    } else if (orig > 0 && rem > 0) {
      // Have Original and Remaining, calculate Completed
      calcOriginal = orig;
      calcRemaining = rem;
      calcCompleted = Math.max(0, orig - rem);
    } else if (orig > 0 && comp > 0) {
      // Have Original and Completed, calculate Remaining
      calcOriginal = orig;
      calcCompleted = comp;
      calcRemaining = Math.max(0, orig - comp);
    } else if (rem > 0 && comp > 0) {
      // Have Remaining and Completed, calculate Original
      calcRemaining = rem;
      calcCompleted = comp;
      calcOriginal = rem + comp;
    } else if (orig > 0) {
      // Only have Original
      calcOriginal = orig;
      calcRemaining = orig;
      calcCompleted = 0;
    } else if (rem > 0) {
      // Only have Remaining
      calcRemaining = rem;
      calcOriginal = rem;
      calcCompleted = 0;
    } else if (comp > 0) {
      // Only have Completed
      calcCompleted = comp;
      calcOriginal = comp;
      calcRemaining = 0;
    } else {
      // None exist - use AI estimate based on title (simple heuristic)
      // TODO: Could call AI API here for better estimates
      const titleWords = itemTitle?.toLowerCase() || '';
      if (titleWords.includes('complex') || titleWords.includes('integration')) {
        calcOriginal = 8;
      } else if (titleWords.includes('simple') || titleWords.includes('fix')) {
        calcOriginal = 2;
      } else {
        calcOriginal = 4;
      }
      calcRemaining = calcOriginal;
      calcCompleted = 0;
    }
  }
  
  // For Remaining Work, use calculated value for Tasks, or Original Estimate for User Stories
  const defaultRemainingWork = type === 'Task' ? calcRemaining : 
    (originalEstimate !== undefined && originalEstimate !== null && originalEstimate !== '' ? originalEstimate : 4);
  
  // Calculate Task Finish Date based on Original Estimate (6 hours per day)
  let taskFinishDate = plannedEndDate;
  if (type === 'Task') {
    const hours = calcOriginal || 4;
    const hoursPerDay = 6;
    const daysNeeded = Math.ceil(hours / hoursPerDay);
    
    // Start from the task's start date
    const taskStart = plannedStartDate;
    taskFinishDate = new Date(taskStart);
    
    // If hours <= 6, finish same day; otherwise add days
    if (hours > hoursPerDay) {
      taskFinishDate.setDate(taskFinishDate.getDate() + (daysNeeded - 1));
    }
  }
  
  // Define default values - Risk uses string enum values for Azure DevOps
  const defaults = {
    'Priority': 2, // High
    'Risk': '2 - Medium', // Risk is a string enum: "1 - High", "2 - Medium", "3 - Low"
    'Effort': 8,
    'Business Value': 50,
    'Time Criticality': 50,
    'Start Date': plannedStartDate.toISOString(),
    'Target Date': twoWeeks.toISOString(),
    'Planned Start Date': plannedStartDate.toISOString(),
    'Planned End Date': plannedEndDate.toISOString(),
    'Story Points': 3,
    'QA Ready Date': qaReadyDate.toISOString(),              // 2 days before planned end
    'Original Estimate': calcOriginal,                       // Calculated based on existing values
    'Remaining Work': calcRemaining,                         // Calculated: Original - Completed
    'Completed Work': calcCompleted,                         // From existing or 0
    'Activity': 'Development',
    'Finish Date': taskFinishDate.toISOString(),             // Calculated for Tasks based on Original Estimate
    'Actual Start Date': plannedStartDate.toISOString(),    // Same as planned start
    'Actual End Date': plannedEndDate.toISOString()         // Same as planned end
  };
  
  // Different field mappings based on work item type
  const fieldMappingByType = {
    'Feature': {
      'Priority': 'Microsoft.VSTS.Common.Priority',
      'Risk': 'Microsoft.VSTS.Common.Risk',
      'Effort': 'Microsoft.VSTS.Scheduling.Effort',
      'Business Value': 'Microsoft.VSTS.Common.BusinessValue',
      'Time Criticality': 'Microsoft.VSTS.Common.TimeCriticality',
      'Start Date': 'Microsoft.VSTS.Scheduling.StartDate',
      'Target Date': 'Microsoft.VSTS.Scheduling.TargetDate'
    },
    'User Story': {
      'Story Points': 'Microsoft.VSTS.Scheduling.StoryPoints',
      'Priority': 'Microsoft.VSTS.Common.Priority',
      'Risk': 'Microsoft.VSTS.Common.Risk',
      'QA Ready Date': 'Custom.QAReadyDateK',
      'Planned Start Date': 'Microsoft.VSTS.Scheduling.StartDate',
      'Planned End Date': 'Microsoft.VSTS.Scheduling.FinishDate',
      'Actual Start Date': 'Custom.ActualStartDateK',
      'Actual End Date': 'Custom.ActualEndDateK'
    },
    'Task': {
      'Priority': 'Microsoft.VSTS.Common.Priority',
      'Activity': 'Microsoft.VSTS.Common.Activity',
      'Start Date': 'Microsoft.VSTS.Scheduling.StartDate',
      'Finish Date': 'Microsoft.VSTS.Scheduling.FinishDate',
      'Original Estimate': 'Microsoft.VSTS.Scheduling.OriginalEstimate',
      'Remaining Work': 'Microsoft.VSTS.Scheduling.RemainingWork',
      'Completed Work': 'Microsoft.VSTS.Scheduling.CompletedWork'
    }
  };
  
  const fieldMapping = fieldMappingByType[type] || fieldMappingByType['Task'];
  
  const updates = [];
  for (const field of fieldsToFix) {
    const apiField = fieldMapping[field];
    const value = defaults[field];
    if (apiField && value !== undefined) {
      updates.push({
        op: 'add',
        path: `/fields/${apiField}`,
        value: value
      });
    }
  }
  
  return updates;
}

// Auto-fix a single item
async function autoFixSingleItem(itemId, itemType) {
  const { org, pat } = getSettings();
  
  if (!org || !pat) {
    showResult('Please configure settings first', 'error');
    return;
  }
  
  // Find the item in current insights
  const item = currentInsights?.allItems.find(i => i.id === itemId);
  if (!item) {
    showResult('Item not found', 'error');
    return;
  }
  
  // Check if there are actually fields to fix
  const fieldsToFix = item.fieldsToFix || item.missingFields || [];
  if (fieldsToFix.length === 0 && !item.hasIssues) {
    showResult('No fields to fix - item is already complete', 'error');
    return;
  }
  
  const projectName = item.projectName || document.getElementById('filterProject').value;
  if (!projectName) {
    showResult('Cannot determine project for this item', 'error');
    return;
  }
  
  try {
    showLoading('insightsLoading', true, `Updating item #${itemId}...`);
    
    const auth = btoa(":" + pat);
    
    // For Tasks: pass work tracking data; For User Stories: pass Story Points
    let estimateValue;
    let workTrackingData = null;
    
    if (itemType === 'Task') {
      // Get all work tracking fields for calculation
      workTrackingData = {
        original: item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.OriginalEstimate'],
        remaining: item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.RemainingWork'],
        completed: item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.CompletedWork']
      };
      estimateValue = workTrackingData.original;
    } else if (itemType === 'User Story') {
      estimateValue = item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'];
    }
    
    // For User Stories with same-day start/end dates, fetch child tasks to calculate proper end date
    let adjustedPlannedEndDate = item.plannedEndDate;
    
    if (itemType === 'User Story' && fieldsToFix.includes('Planned End Date')) {
      const startDate = item.plannedStartDate ? new Date(item.plannedStartDate) : null;
      const endDate = item.plannedEndDate ? new Date(item.plannedEndDate) : null;
      
      if (startDate && endDate && startDate.toDateString() === endDate.toDateString()) {
        // Fetch child tasks to calculate total hours
        try {
          const childTasks = await fetchChildTasksForStory(org, projectName, auth, itemId);
          let totalHours = 0;
          
          for (const task of childTasks) {
            const taskHours = parseFloat(task.fields['Microsoft.VSTS.Scheduling.OriginalEstimate']) || 0;
            totalHours += taskHours;
          }
          
          if (totalHours > 0) {
            // Calculate new end date: total hours / 6 hours per day
            const hoursPerDay = 6;
            const daysNeeded = Math.ceil(totalHours / hoursPerDay);
            const calculatedEndDate = new Date(startDate);
            calculatedEndDate.setDate(calculatedEndDate.getDate() + daysNeeded - 1);
            adjustedPlannedEndDate = calculatedEndDate.toISOString();
          } else {
            // No child tasks or no hours - use Story Points estimate
            const storyPoints = estimateValue || item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] || 3;
            const hoursPerPoint = 8;
            const hoursPerDay = 6;
            const totalHours = storyPoints * hoursPerPoint;
            const daysNeeded = Math.ceil(totalHours / hoursPerDay);
            const calculatedEndDate = new Date(startDate);
            calculatedEndDate.setDate(calculatedEndDate.getDate() + daysNeeded - 1);
            adjustedPlannedEndDate = calculatedEndDate.toISOString();
          }
        } catch (e) {
          console.error('Error fetching child tasks:', e);
          // Fallback to Story Points
          const storyPoints = estimateValue || item.rawItem?.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] || 3;
          const hoursPerPoint = 8;
          const hoursPerDay = 6;
          const totalHours = storyPoints * hoursPerPoint;
          const daysNeeded = Math.ceil(totalHours / hoursPerDay);
          const calculatedEndDate = new Date(startDate);
          calculatedEndDate.setDate(calculatedEndDate.getDate() + daysNeeded - 1);
          adjustedPlannedEndDate = calculatedEndDate.toISOString();
        }
      }
    }
    
    // Use fieldsToFix which includes both missing and invalid fields
    const fieldsToUpdate = item.fieldsToFix || item.missingFields || [];
    
    const updates = generateDefaultValues(
      fieldsToUpdate, 
      itemType, 
      item.title,
      item.plannedStartDate,
      adjustedPlannedEndDate, // Use adjusted end date
      estimateValue,
      workTrackingData
    );
    
    if (updates.length === 0) {
      showLoading('insightsLoading', false);
      showResult('No fields to update', 'error');
      return;
    }
    
    const response = await fetch(
      `https://dev.azure.com/${org}/${encodeURIComponent(projectName)}/_apis/wit/workitems/${itemId}?api-version=7.0`,
      {
        method: 'PATCH',
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json-patch+json"
        },
        body: JSON.stringify(updates)
      }
    );
    
    showLoading('insightsLoading', false);
    
    if (response.ok) {
      showResult(`✓ Updated ${updates.length} fields in #${itemId}`, 'success');
      // Refresh the insights
      applyInsightFilters();
    } else {
      const errorText = await response.text();
      showResult(`Failed to update: ${response.status}`, 'error');
      console.error('Update error:', errorText);
    }
  } catch (error) {
    showLoading('insightsLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// Auto-fix all incomplete items
async function autoFixAllIncomplete() {
  const { org, pat } = getSettings();
  
  if (!org || !pat) {
    showResult('Please configure settings first', 'error');
    return;
  }
  
  const incompleteItems = currentInsights?.allItems.filter(i => !i.isComplete) || [];
  
  if (incompleteItems.length === 0) {
    showResult('No incomplete items to fix', 'error');
    return;
  }
  
  if (!confirm(`This will auto-fill missing fields for ${incompleteItems.length} work items. Continue?`)) {
    return;
  }
  
  try {
    showLoading('insightsLoading', true, `Updating ${incompleteItems.length} items...`);
    
    const auth = btoa(":" + pat);
    let updated = 0, failed = 0;
    
    for (const item of incompleteItems) {
      const projectName = item.projectName;
      if (!projectName) {
        failed++;
        continue;
      }
      
      const updates = generateDefaultValues(item.missingFields, item.type, item.title);
      
      if (updates.length === 0) {
        continue;
      }
      
      try {
        const response = await fetch(
          `https://dev.azure.com/${org}/${encodeURIComponent(projectName)}/_apis/wit/workitems/${item.id}?api-version=7.0`,
          {
            method: 'PATCH',
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/json-patch+json"
            },
            body: JSON.stringify(updates)
          }
        );
        
        if (response.ok) {
          updated++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
    
    showLoading('insightsLoading', false);
    
    if (failed === 0) {
      showResult(`✓ Successfully updated ${updated} items!`, 'success');
    } else {
      showResult(`Updated ${updated} items, ${failed} failed`, 'error');
    }
    
    // Refresh the insights
    await fetchUserWorkItems();
    
  } catch (error) {
    showLoading('insightsLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// ============================================
// Utility Functions
// ============================================

function getSettings() {
  return {
    org: document.getElementById('org').value.trim(),
    project: document.getElementById('project').value.trim(),
    pat: document.getElementById('pat').value.trim()
  };
}

// Get the AI API key
function getAIApiKey() {
  return document.getElementById('apiKey').value.trim();
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function togglePasswordVisibility(fieldId) {
  const field = document.getElementById(fieldId);
  const button = document.getElementById(`toggle${fieldId.charAt(0).toUpperCase() + fieldId.slice(1)}Visibility`);
  
  if (field.type === 'password') {
    field.type = 'text';
    button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    button.title = 'Hide';
  } else {
    field.type = 'password';
    button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    button.title = 'Show';
  }
}

function showLoading(elementId, show, message = 'Loading...') {
  const loading = document.getElementById(elementId);
  if (show) {
    loading.classList.remove('hidden');
    loading.querySelector('p').textContent = message;
  } else {
    loading.classList.add('hidden');
  }
}

function showResult(message, type) {
  const result = document.getElementById('result');
  result.textContent = message;
  result.className = `result-message ${type}`;
  result.classList.remove('hidden');
  
  setTimeout(() => {
    result.classList.add('hidden');
  }, 4000);
}

// Show warning when tasks already exist for a user story
// Check for existing child items (User Stories for Feature, Tasks for User Story)
async function checkForExistingChildItems(org, project, pat, parentData, parentType) {
  const auth = btoa(":" + pat);
  const relations = parentData.relations || [];
  
  // Filter child relations
  const childUrls = relations
    .filter(r => r.rel === 'System.LinkTypes.Hierarchy-Forward')
    .map(r => r.url);
  
  if (childUrls.length === 0) return { count: 0, items: [] };
  
  const expectedChildType = parentType === 'Feature' ? 'User Story' : 'Task';
  let count = 0;
  
  for (const url of childUrls) {
    try {
      const response = await fetch(url, {
        headers: { "Authorization": `Basic ${auth}` }
      });
      if (response.ok) {
        const itemData = await response.json();
        if (itemData.fields['System.WorkItemType'] === expectedChildType) {
          count++;
        }
      }
    } catch (e) {
      console.error('Error checking child item:', e);
    }
  }
  
  return { count, expectedChildType };
}

function showExistingChildItemsWarning(itemCount, workItemId, parentType) {
  const section = document.getElementById('tasksSection');
  section.classList.remove('hidden');
  
  const isFeature = parentType === 'Feature';
  const childTypeName = isFeature ? 'User Stories' : 'Tasks';
  const childTypeSingular = isFeature ? 'User Story' : 'Task';
  const parentTypeName = isFeature ? 'Feature' : 'User Story';
  const evalType = isFeature ? 'Feature' : 'User Story';
  
  document.getElementById('tasksList').innerHTML = `
    <div class="existing-tasks-warning">
      <div class="warning-icon">⚠️</div>
      <div class="warning-content">
        <h4>${childTypeName} Already Exist</h4>
        <p>This ${parentTypeName} (#${workItemId}) already has <strong>${itemCount} ${itemCount === 1 ? childTypeSingular : childTypeName}</strong> created.</p>
        <p>Would you like to evaluate the existing ${childTypeName.toLowerCase()} instead?</p>
        <div class="warning-actions">
          <button class="btn btn-primary" data-action="goToEvaluate" data-work-item-id="${workItemId}" data-eval-type="${evalType}">
            📊 Go to Evaluate Tab
          </button>
          <button class="btn btn-ghost" data-action="forceGenerate">
            Generate Anyway
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('taskCount').textContent = '';
  document.getElementById('totalEstimate').innerHTML = '';
  document.getElementById('createAllTasks').classList.add('hidden');
  document.getElementById('clearTasks').classList.add('hidden');
}

// Go to evaluate tab with work item ID pre-filled
function goToEvaluateTab(workItemId, evalType) {
  // Switch to evaluate tab
  switchTab('evaluate');
  
  // Set the work item type selector
  if (evalType) {
    document.getElementById('evalWorkItemType').value = evalType;
    selectedEvalWorkItemType = evalType;
  }
  
  // Pre-fill the work item ID
  document.getElementById('evalStoryId').value = workItemId;
  
  // Clear the create tab
  document.getElementById('tasksSection').classList.add('hidden');
  
  const childType = evalType === 'Feature' ? 'User Stories' : 'Tasks';
  showResult(`Work Item ID copied to Evaluate tab. Click "Fetch & Evaluate" to review existing ${childType}.`, 'success');
}

// Force generate tasks even if some exist
async function forceGenerateTasks() {
  // Hide the warning and show buttons again
  document.getElementById('createAllTasks').classList.remove('hidden');
  document.getElementById('clearTasks').classList.remove('hidden');
  document.getElementById('tasksSection').classList.add('hidden');
  
  // Call the original generate logic but skip the check
  const aiApiKey = getAIApiKey();
  const title = document.getElementById('workItemTitle').value;
  const description = document.getElementById('workItemDescription').value;
  const level = document.getElementById('level').value;
  const daysToComplete = parseInt(document.getElementById('daysToComplete').value) || 5;
  
  const userStory = `Title: ${title}\n\n${description}`;
  
  try {
    showLoading('createLoading', true, `${getAIConfig().name} AI is analyzing and breaking down the work item...`);
    
    const experienceContext = EXPERIENCE_CONFIG[level].promptContext;
    const multiplier = EXPERIENCE_CONFIG[level].multiplier;
    const totalHoursAvailable = daysToComplete * 6;
    const hoursForAI = Math.floor(totalHoursAvailable / multiplier);
    
    const tasks = await callAI(userStory, experienceContext, aiApiKey, hoursForAI, totalHoursAvailable);
    
    const validActivities = ['Deployment', 'Design', 'Development', 'Documentation', 'Requirements', 'Testing'];
    
    generatedTasks = tasks.map((task, index) => ({
      ...task,
      id: index + 1,
      hours: Math.round(task.hours * multiplier * 10) / 10,
      originalHours: task.hours,
      activity: validActivities.includes(task.activity) ? task.activity : 'Development',
      selected: true
    }));
    
    showLoading('createLoading', false);
    displayTasks();
    
  } catch (error) {
    showLoading('createLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}
