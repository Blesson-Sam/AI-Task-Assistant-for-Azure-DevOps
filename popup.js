// ============================================
// AI Task Assistant for Azure DevOps
// Modern Redesigned Version with 3 Tabs
// ============================================

let generatedTasks = [];
let userStoryData = null;
let iterationPath = null;
let assignedTo = null;
let areaPath = null;
let selectedWorkItemType = 'User Story';
let selectedAIProvider = 'groq'; // Default AI provider

// Evaluate tab state
let currentEvaluation = null;
let currentEvalStoryId = null;
let currentEvalStoryData = null;

// AI Provider configurations
const AI_PROVIDERS = {
  groq: {
    name: 'Groq',
    model: 'llama-3.1-8b-instant',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    description: 'Free and fast, uses Llama 3.1'
  },
  openai: {
    name: 'OpenAI',
    model: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    description: 'Paid, more advanced capabilities'
  }
};

// Experience level multipliers and descriptions
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

// Validation rules for different work item types
const VALIDATION_RULES = {
  Feature: [
    { field: 'Microsoft.VSTS.Common.Priority', label: 'Priority' },
    { field: 'Microsoft.VSTS.Common.Risk', label: 'Risk' },
    { field: 'Microsoft.VSTS.Scheduling.Effort', label: 'Effort' },
    { field: 'Microsoft.VSTS.Common.BusinessValue', label: 'Business Value' },
    { field: 'Microsoft.VSTS.Common.TimeCriticality', label: 'Time Criticality' },
    { field: 'Microsoft.VSTS.Scheduling.StartDate', label: 'Start Date' },
    { field: 'Microsoft.VSTS.Scheduling.TargetDate', label: 'Target Date' }
  ],
  'User Story': [
    { field: 'Microsoft.VSTS.Scheduling.StoryPoints', label: 'Story Points' },
    { field: 'Microsoft.VSTS.Common.Priority', label: 'Priority' },
    { field: 'Microsoft.VSTS.Common.Risk', label: 'Risk' },
    { field: 'Custom.QAReadyDate', label: 'QA Ready Date' },
    { field: 'Microsoft.VSTS.Scheduling.StartDate', label: 'Planned Start Date' },
    { field: 'Microsoft.VSTS.Scheduling.FinishDate', label: 'Planned End Date' },
    { field: 'Microsoft.VSTS.Scheduling.ActualStartDate', label: 'Actual Start Date' },
    { field: 'Microsoft.VSTS.Scheduling.ActualEndDate', label: 'Actual End Date' }
  ],
  Task: [
    { field: 'Microsoft.VSTS.Common.Priority', label: 'Priority' },
    { field: 'Microsoft.VSTS.Common.Activity', label: 'Activity' },
    { field: 'Microsoft.VSTS.Scheduling.StartDate', label: 'Start Date' },
    { field: 'Microsoft.VSTS.Scheduling.FinishDate', label: 'Finish Date' },
    { field: 'Microsoft.VSTS.Scheduling.OriginalEstimate', label: 'Original Estimate' },
    { field: 'Microsoft.VSTS.Scheduling.RemainingWork', label: 'Remaining Work' },
    { field: 'Microsoft.VSTS.Scheduling.CompletedWork', label: 'Completed Work' }
  ]
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
  updateExperienceInfo();
});

// Setup all event listeners
function setupEventListeners() {
  // Settings
  document.getElementById('settingsBtn').onclick = openSettingsModal;
  document.getElementById('closeSettings').onclick = closeSettingsModal;
  document.getElementById('saveSettings').onclick = saveSettings;
  document.getElementById('testConnection').onclick = testADOConnection;
  
  // Close modal on overlay click
  document.getElementById('settingsModal').onclick = (e) => {
    if (e.target.id === 'settingsModal') closeSettingsModal();
  };
  
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  
  // Work item type selection
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.onclick = () => selectWorkItemType(btn);
  });
  
  // Initialize hint text for default selection (User Story)
  initializeWorkItemTypeHint();
  
  // Tab 1: Create Task
  document.getElementById('fetchWorkItem').onclick = fetchWorkItem;
  document.getElementById('generateTasks').onclick = generateTasks;
  document.getElementById('createAllTasks').onclick = createAllTasksInADO;
  document.getElementById('clearTasks').onclick = clearTasks;
  document.getElementById('level').onchange = updateExperienceInfo;
  
  // Event delegation for dynamically created task cards
  document.getElementById('tasksList').addEventListener('click', handleTaskListClick);
  document.getElementById('tasksList').addEventListener('change', handleTaskCheckboxChange);
  
  // Tab 2: Evaluate Tasks
  document.getElementById('fetchEvalStory').onclick = fetchAndEvaluate;
  document.getElementById('evalTypeFeature').onclick = () => selectEvalWorkItemType('Feature');
  document.getElementById('evalTypeUserStory').onclick = () => selectEvalWorkItemType('User Story');
  
  // Event delegation for dynamically created buttons in Evaluate tab
  document.getElementById('evaluationResults').addEventListener('click', handleEvaluationClick);
  document.getElementById('evalSummary').addEventListener('click', handleEvaluationClick);
  
  // Tab 3: Insights
  document.getElementById('fetchUserWorkItems').onclick = fetchUserWorkItems;
  document.getElementById('applyFilters').onclick = applyInsightFilters;
  document.getElementById('autoFixAll').onclick = autoFixAllIncomplete;
  
  // Event delegation for insights results
  document.getElementById('insightsResults').addEventListener('click', handleInsightsClick);
  
  // Security controls
  document.getElementById('togglePatVisibility').onclick = () => togglePasswordVisibility('pat');
  document.getElementById('toggleGroqVisibility').onclick = () => togglePasswordVisibility('groq');
  document.getElementById('toggleOpenaiVisibility').onclick = () => togglePasswordVisibility('openaiKey');
  document.getElementById('aiProvider').onchange = handleAIProviderChange;
  document.getElementById('clearAllData').onclick = clearAllStoredData;
}

// Handle AI provider change
function handleAIProviderChange() {
  const provider = document.getElementById('aiProvider').value;
  selectedAIProvider = provider;
  
  const groqGroup = document.getElementById('groqKeyGroup');
  const openaiGroup = document.getElementById('openaiKeyGroup');
  const hintEl = document.getElementById('aiProviderHint');
  
  if (provider === 'groq') {
    groqGroup.classList.remove('hidden');
    openaiGroup.classList.add('hidden');
    hintEl.textContent = '🆓 Groq is free and fast. Great for everyday use!';
  } else if (provider === 'openai') {
    groqGroup.classList.add('hidden');
    openaiGroup.classList.remove('hidden');
    hintEl.textContent = '💎 OpenAI GPT-4o-mini offers advanced capabilities.';
  }
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
}

// Event delegation handler for Evaluate tab buttons
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

// Event delegation handler for task list clicks
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

// Event delegation handler for task checkbox changes
function handleTaskCheckboxChange(e) {
  const checkbox = e.target;
  if (checkbox.type === 'checkbox' && checkbox.dataset.taskId) {
    const taskId = parseInt(checkbox.dataset.taskId, 10);
    toggleTask(taskId);
  }
}

// ============================================
// Settings Modal
// ============================================

function openSettingsModal() {
  document.getElementById('settingsModal').classList.remove('hidden');
  // Load remember preference
  loadRememberPreference();
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.add('hidden');
  // If "remember" is unchecked, clear sensitive data from form (but keep session)
  const remember = document.getElementById('rememberCredentials').checked;
  if (!remember) {
    // Keep in session memory but will be cleared on popup close
    sessionCredentials = {
      pat: document.getElementById('pat').value,
      groqKey: document.getElementById('groq').value,
      openaiKey: document.getElementById('openaiKey').value
    };
  }
}

// Session-only credentials (not persisted)
let sessionCredentials = {
  pat: null,
  groqKey: null,
  openaiKey: null
};

// Load remember preference
function loadRememberPreference() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['rememberCredentials'], (data) => {
      const checkbox = document.getElementById('rememberCredentials');
      if (data.rememberCredentials === false) {
        checkbox.checked = false;
      } else {
        checkbox.checked = true;
      }
    });
  }
}

// Load saved settings from chrome storage
function loadSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['org', 'project', 'pat', 'groqKey', 'openaiKey', 'rememberCredentials', 'aiProvider'], (data) => {
      if (data.org) document.getElementById('org').value = data.org;
      if (data.project) document.getElementById('project').value = data.project;
      
      // Load AI provider
      if (data.aiProvider) {
        document.getElementById('aiProvider').value = data.aiProvider;
        selectedAIProvider = data.aiProvider;
        handleAIProviderChange(); // Update UI
      }
      
      // Only load sensitive data if "remember" was enabled
      if (data.rememberCredentials !== false) {
        if (data.pat) document.getElementById('pat').value = data.pat;
        if (data.groqKey) document.getElementById('groq').value = data.groqKey;
        if (data.openaiKey) document.getElementById('openaiKey').value = data.openaiKey;
      }
      
      // Also check session credentials
      if (sessionCredentials.pat) document.getElementById('pat').value = sessionCredentials.pat;
      if (sessionCredentials.groqKey) document.getElementById('groq').value = sessionCredentials.groqKey;
      if (sessionCredentials.openaiKey) document.getElementById('openaiKey').value = sessionCredentials.openaiKey;
    });
  }
}

// Save settings to chrome storage
function saveSettings() {
  const remember = document.getElementById('rememberCredentials').checked;
  const aiProvider = document.getElementById('aiProvider').value;
  
  const settings = {
    org: document.getElementById('org').value,
    project: document.getElementById('project').value,
    rememberCredentials: remember,
    aiProvider: aiProvider
  };
  
  // Update global provider
  selectedAIProvider = aiProvider;
  
  // Only save sensitive data if "remember" is checked
  if (remember) {
    settings.pat = document.getElementById('pat').value;
    settings.groqKey = document.getElementById('groq').value;
    settings.openaiKey = document.getElementById('openaiKey').value;
  } else {
    // Store in session only
    sessionCredentials = {
      pat: document.getElementById('pat').value,
      groqKey: document.getElementById('groq').value,
      openaiKey: document.getElementById('openaiKey').value
    };
    // Clear from persistent storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['pat', 'groqKey', 'openaiKey']);
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
        document.getElementById('groq').value = '';
        document.getElementById('openaiKey').value = '';
        document.getElementById('aiProvider').value = 'groq';
        document.getElementById('rememberCredentials').checked = true;
        
        // Reset AI provider
        selectedAIProvider = 'groq';
        handleAIProviderChange();
        
        // Clear session
        sessionCredentials = { pat: null, groqKey: null, openaiKey: null };
        
        showResult('All stored data cleared!', 'success');
      });
    } else {
      showResult('Data cleared (local mode)', 'success');
    }
  }
}

// Test ADO Connection
async function testADOConnection() {
  const org = document.getElementById('org').value.trim();
  const project = document.getElementById('project').value.trim();
  const pat = document.getElementById('pat').value.trim();
  const statusEl = document.getElementById('connectionStatus');
  
  if (!org || !project || !pat) {
    statusEl.className = 'connection-status error';
    statusEl.textContent = 'Please fill in all fields';
    statusEl.classList.remove('hidden');
    return;
  }
  
  try {
    statusEl.className = 'connection-status';
    statusEl.textContent = 'Testing connection...';
    statusEl.classList.remove('hidden');
    
    const auth = btoa(":" + pat);
    const testUrl = `https://dev.azure.com/${org}/_apis/projects?api-version=7.0`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: { "Authorization": `Basic ${auth}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      const projectNames = data.value.map(p => p.name);
      
      if (projectNames.includes(project)) {
        statusEl.className = 'connection-status success';
        statusEl.textContent = `✓ Connected! Project "${project}" found.`;
      } else {
        statusEl.className = 'connection-status error';
        statusEl.textContent = `Project not found. Available: ${projectNames.slice(0, 3).join(', ')}...`;
      }
    } else {
      statusEl.className = 'connection-status error';
      statusEl.textContent = `Connection failed: ${response.status}. Check PAT permissions.`;
    }
  } catch (error) {
    statusEl.className = 'connection-status error';
    statusEl.textContent = `Error: ${error.message}`;
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
  const daysToComplete = parseInt(document.getElementById('daysToComplete').value) || 5;
  const storyId = document.getElementById('workItemId').value.trim();
  
  const userStory = `Title: ${title}\n\n${description}`;
  
  if (!userStory.trim() || userStory.trim() === 'Title:') {
    showResult('Please enter or fetch a work item first', 'error');
    return;
  }
  
  if (!aiApiKey) {
    const providerName = AI_PROVIDERS[selectedAIProvider].name;
    showResult(`Please enter your ${providerName} API Key in Settings`, 'error');
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
    const providerName = AI_PROVIDERS[selectedAIProvider].name;
    showLoading('createLoading', true, `${providerName} AI is analyzing and breaking down the work item...`);
    
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

// Call AI API (supports Groq and OpenAI)
async function callAI(userStory, experienceContext, apiKey, hoursForAI, totalHoursAvailable) {
  // Determine what to generate based on selected work item type
  const isFeature = selectedWorkItemType === 'Feature';
  const itemToGenerate = isFeature ? 'User Stories' : 'Tasks';
  const maxItems = isFeature ? 3 : 5;
  const itemDescription = isFeature 
    ? 'User Stories with clear acceptance criteria' 
    : 'development tasks';
  
  const prompt = isFeature 
    ? `You are an expert Agile project manager. Break down the following Feature into User Stories.

FEATURE:
${userStory}

DEVELOPER CONTEXT:
User Stories will be assigned to ${experienceContext}.

INSTRUCTIONS:
1. Break down into 1-3 specific, actionable User Stories (MAXIMUM 3)
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
    : `You are an expert Agile project manager. Break down the following work item into detailed, actionable development tasks.

WORK ITEM:
${userStory}

DEVELOPER CONTEXT:
Tasks will be assigned to ${experienceContext}.

TIME CONSTRAINT:
- Maximum hours for all tasks: ${hoursForAI} hours
- Each task should be 1-6 hours

INSTRUCTIONS:
1. Break down into 2-5 specific, actionable tasks
2. Total hours MUST NOT exceed ${hoursForAI} hours
3. Focus on essential tasks only

RESPOND WITH ONLY A VALID JSON ARRAY:
[
  {
    "title": "Clear task title",
    "description": "What needs to be done and how",
    "hours": number,
    "priority": 1 | 2 | 3 | 4,
    "activity": "Development" | "Testing" | "Design" | "Documentation" | "Deployment" | "Requirements"
  }
]`;

  // Get the appropriate API key and provider config
  const provider = AI_PROVIDERS[selectedAIProvider];
  
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: "You output only valid JSON arrays. No markdown, no explanations." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
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
  
  try {
    showLoading('createLoading', true, `Creating ${selectedTasks.length} ${itemLabel}...`);
    
    const auth = btoa(":" + pat);
    let created = 0, failed = 0;
    
    for (const task of selectedTasks) {
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
        } else {
          // For Tasks: use time estimates
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.OriginalEstimate", "value": task.hours });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.RemainingWork", "value": task.hours });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.CompletedWork", "value": 0 });
          body.push({ "op": "add", "path": "/fields/Microsoft.VSTS.Common.Activity", "value": task.activity || "Development" });
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
    const providerName = AI_PROVIDERS[selectedAIProvider].name;
    showResult(`Please configure ${providerName} API Key in Settings`, 'error');
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
    const providerName = AI_PROVIDERS[selectedAIProvider].name;
    showLoading('evaluateLoading', true, `${providerName} AI is analyzing items...`);
    
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

  // Get the appropriate provider config
  const provider = AI_PROVIDERS[selectedAIProvider];

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: "You output only valid JSON. No markdown, no explanations." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
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
    
    for (const proj of projects) {
      try {
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
              allInsightWorkItems.push(item);
              projectSet.add(proj.name);
              const iterationPath = item.fields['System.IterationPath'] || '';
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
    populateFilterDropdowns(Array.from(projectSet), Array.from(sprintSet));
    
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

function populateFilterDropdowns(projects, sprints) {
  const projectSelect = document.getElementById('filterProject');
  const sprintSelect = document.getElementById('filterSprint');
  
  // Clear existing options except first
  projectSelect.innerHTML = '<option value="">All Projects</option>';
  sprintSelect.innerHTML = '<option value="">All Sprints</option>';
  
  // Add projects
  projects.sort().forEach(proj => {
    const option = document.createElement('option');
    option.value = proj;
    option.textContent = proj;
    projectSelect.appendChild(option);
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

function applyInsightFilters() {
  const projectFilter = document.getElementById('filterProject').value;
  const sprintFilter = document.getElementById('filterSprint').value;
  const typeFilter = document.getElementById('filterWorkItemType').value;
  
  filteredInsightWorkItems = allInsightWorkItems.filter(item => {
    const matchProject = !projectFilter || item.projectName === projectFilter;
    const matchSprint = !sprintFilter || item.fields['System.IterationPath'] === sprintFilter;
    const matchType = !typeFilter || item.fields['System.WorkItemType'] === typeFilter;
    return matchProject && matchSprint && matchType;
  });
  
  analyzeAndDisplayInsights();
}

function analyzeAndDisplayInsights() {
  showLoading('insightsLoading', true, `Validating ${filteredInsightWorkItems.length} work items...`);
  
  // Categorize and validate
  const insights = {
    features: [],
    stories: [],
    tasks: [],
    allItems: [] // Store all for auto-fix
  };
  
  for (const item of filteredInsightWorkItems) {
    const type = item.fields['System.WorkItemType'];
    const validated = validateWorkItem(item, type);
    validated.projectName = item.projectName;
    validated.rawItem = item; // Keep reference for updates
    
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

async function analyzeInsights() {
  // This is now handled by fetchUserWorkItems
  await fetchUserWorkItems();
}

async function fetchWorkItemDetails(org, project, auth, ids) {
  // Batch fetch in groups of 200
  const batchSize = 200;
  const allItems = [];
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems?ids=${batch.join(',')}&api-version=7.0`;
    
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

function validateWorkItem(item, type) {
  const rules = VALIDATION_RULES[type] || [];
  const missingFields = [];
  
  for (const rule of rules) {
    const value = item.fields[rule.field];
    if (value === undefined || value === null || value === '' || value === 0) {
      missingFields.push(rule.label);
    }
  }
  
  return {
    id: item.id,
    title: item.fields['System.Title'],
    type: type,
    state: item.fields['System.State'],
    missingFields: missingFields,
    isComplete: missingFields.length === 0
  };
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
  const suggestion = generateSuggestion(item.missingFields, type);
  const projectInfo = item.projectName ? `<span class="project-badge">${escapeHtml(item.projectName)}</span>` : '';
  
  return `
    <div class="insight-item" data-item-id="${item.id}">
      <div class="insight-item-header">
        <span class="insight-item-id">#${item.id}</span>
        ${projectInfo}
        <span class="status-badge ${item.isComplete ? 'complete' : 'incomplete'}">
          ${item.isComplete ? '✅ Complete' : '⚠️ Incomplete'}
        </span>
      </div>
      <div class="insight-item-title">${escapeHtml(item.title)}</div>
      ${item.missingFields.length ? `
        <div class="missing-fields">
          <div class="missing-fields-label">Missing Fields</div>
          <div class="missing-field-tags">
            ${item.missingFields.map(f => `<span class="missing-field-tag">${escapeHtml(f)}</span>`).join('')}
          </div>
        </div>
        <div class="insight-suggestion">
          <div class="insight-suggestion-label">AI Suggestion</div>
          <div class="insight-suggestion-text">${escapeHtml(suggestion)}</div>
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
function generateDefaultValues(missingFields, type, itemTitle) {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  const defaults = {
    'Priority': 2, // High
    'Risk': 2, // Medium
    'Effort': 8,
    'Business Value': 50,
    'Time Criticality': 50,
    'Start Date': today.toISOString(),
    'Target Date': twoWeeks.toISOString(),
    'Planned Start Date': today.toISOString(),
    'Planned End Date': nextWeek.toISOString(),
    'Story Points': 3,
    'QA Ready Date': nextWeek.toISOString(),
    'Original Estimate': 4,
    'Remaining Work': 4,
    'Completed Work': 0,
    'Activity': 'Development',
    'Finish Date': nextWeek.toISOString(),
    'Actual Start Date': today.toISOString(),
    'Actual End Date': nextWeek.toISOString()
  };
  
  const fieldMapping = {
    'Priority': 'Microsoft.VSTS.Common.Priority',
    'Risk': 'Microsoft.VSTS.Common.Risk',
    'Effort': 'Microsoft.VSTS.Scheduling.Effort',
    'Business Value': 'Microsoft.VSTS.Common.BusinessValue',
    'Time Criticality': 'Microsoft.VSTS.Common.TimeCriticality',
    'Start Date': 'Microsoft.VSTS.Scheduling.StartDate',
    'Target Date': 'Microsoft.VSTS.Scheduling.TargetDate',
    'Planned Start Date': 'Microsoft.VSTS.Scheduling.StartDate',
    'Planned End Date': 'Microsoft.VSTS.Scheduling.FinishDate',
    'Story Points': 'Microsoft.VSTS.Scheduling.StoryPoints',
    'QA Ready Date': 'Custom.QAReadyDate',
    'Original Estimate': 'Microsoft.VSTS.Scheduling.OriginalEstimate',
    'Remaining Work': 'Microsoft.VSTS.Scheduling.RemainingWork',
    'Completed Work': 'Microsoft.VSTS.Scheduling.CompletedWork',
    'Activity': 'Microsoft.VSTS.Common.Activity',
    'Finish Date': 'Microsoft.VSTS.Scheduling.FinishDate',
    'Actual Start Date': 'Microsoft.VSTS.Scheduling.ActualStartDate',
    'Actual End Date': 'Microsoft.VSTS.Scheduling.ActualEndDate'
  };
  
  const updates = [];
  for (const field of missingFields) {
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
  if (!item || item.isComplete) {
    showResult('Item not found or already complete', 'error');
    return;
  }
  
  const projectName = item.projectName || document.getElementById('filterProject').value;
  if (!projectName) {
    showResult('Cannot determine project for this item', 'error');
    return;
  }
  
  try {
    showLoading('insightsLoading', true, `Updating item #${itemId}...`);
    
    const updates = generateDefaultValues(item.missingFields, itemType, item.title);
    
    if (updates.length === 0) {
      showLoading('insightsLoading', false);
      showResult('No fields to update', 'error');
      return;
    }
    
    const auth = btoa(":" + pat);
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
      showResult(`✓ Updated ${item.missingFields.length} fields in #${itemId}`, 'success');
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

// Get the appropriate AI API key based on selected provider
function getAIApiKey() {
  if (selectedAIProvider === 'openai') {
    return document.getElementById('openaiKey').value.trim();
  }
  return document.getElementById('groq').value.trim();
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
    const providerName = AI_PROVIDERS[selectedAIProvider].name;
    showLoading('createLoading', true, `${providerName} AI is analyzing and breaking down the work item...`);
    
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
