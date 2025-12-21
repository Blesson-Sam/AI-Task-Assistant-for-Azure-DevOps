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
  document.getElementById('fetchEvalStory').onclick = fetchEvalStory;
  document.getElementById('evaluateTasks').onclick = evaluateTasks;
  
  // Event delegation for dynamically created buttons in Evaluate tab
  document.getElementById('evaluationResults').addEventListener('click', handleEvaluationClick);
  document.getElementById('evalSummary').addEventListener('click', handleEvaluationClick);
  
  // Tab 3: Insights
  document.getElementById('fetchUserWorkItems').onclick = fetchUserWorkItems;
  document.getElementById('analyzeInsights').onclick = analyzeInsights;
  
  // Security controls
  document.getElementById('togglePatVisibility').onclick = () => togglePasswordVisibility('pat');
  document.getElementById('toggleGroqVisibility').onclick = () => togglePasswordVisibility('groq');
  document.getElementById('clearAllData').onclick = clearAllStoredData;
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
    const storyId = target.dataset.storyId;
    goToEvaluateTab(storyId);
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
      groqKey: document.getElementById('groq').value
    };
  }
}

// Session-only credentials (not persisted)
let sessionCredentials = {
  pat: null,
  groqKey: null
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
    chrome.storage.local.get(['org', 'project', 'pat', 'groqKey', 'rememberCredentials'], (data) => {
      if (data.org) document.getElementById('org').value = data.org;
      if (data.project) document.getElementById('project').value = data.project;
      
      // Only load sensitive data if "remember" was enabled
      if (data.rememberCredentials !== false) {
        if (data.pat) document.getElementById('pat').value = data.pat;
        if (data.groqKey) document.getElementById('groq').value = data.groqKey;
      }
      
      // Also check session credentials
      if (sessionCredentials.pat) document.getElementById('pat').value = sessionCredentials.pat;
      if (sessionCredentials.groqKey) document.getElementById('groq').value = sessionCredentials.groqKey;
    });
  }
}

// Save settings to chrome storage
function saveSettings() {
  const remember = document.getElementById('rememberCredentials').checked;
  
  const settings = {
    org: document.getElementById('org').value,
    project: document.getElementById('project').value,
    rememberCredentials: remember
  };
  
  // Only save sensitive data if "remember" is checked
  if (remember) {
    settings.pat = document.getElementById('pat').value;
    settings.groqKey = document.getElementById('groq').value;
  } else {
    // Store in session only
    sessionCredentials = {
      pat: document.getElementById('pat').value,
      groqKey: document.getElementById('groq').value
    };
    // Clear from persistent storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['pat', 'groqKey']);
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
        document.getElementById('rememberCredentials').checked = true;
        
        // Clear session
        sessionCredentials = { pat: null, groqKey: null };
        
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
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${storyId}?api-version=7.0`;
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    
    const data = await response.json();
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
    
    showLoading('createLoading', false);
    showResult(`Fetched: ${title}`, 'success');
    
  } catch (error) {
    showLoading('createLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// Generate tasks using Groq AI
async function generateTasks() {
  const { org, project, pat } = getSettings();
  const groqKey = document.getElementById('groq').value;
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
  
  if (!groqKey) {
    showResult('Please enter your Groq API Key in Settings', 'error');
    return;
  }
  
  // Check if tasks already exist for this User Story
  if (storyId && org && project && pat) {
    try {
      showLoading('createLoading', true, 'Checking for existing tasks...');
      const existingTasks = await fetchLinkedTasks(org, project, pat, storyId);
      
      if (existingTasks.length > 0) {
        showLoading('createLoading', false);
        showExistingTasksWarning(existingTasks.length, storyId);
        return;
      }
    } catch (e) {
      // Continue if check fails
      console.log('Could not check existing tasks:', e);
    }
  }
  
  try {
    showLoading('createLoading', true, 'AI is analyzing and breaking down the work item...');
    
    const experienceContext = EXPERIENCE_CONFIG[level].promptContext;
    const multiplier = EXPERIENCE_CONFIG[level].multiplier;
    const totalHoursAvailable = daysToComplete * 6;
    const hoursForAI = Math.floor(totalHoursAvailable / multiplier);
    
    const tasks = await callGroqAI(userStory, experienceContext, groqKey, hoursForAI, totalHoursAvailable);
    
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

// Call Groq AI API
async function callGroqAI(userStory, experienceContext, apiKey, hoursForAI, totalHoursAvailable) {
  const prompt = `You are an expert Agile project manager. Break down the following work item into detailed, actionable development tasks.

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

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
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
  
  section.classList.remove('hidden');
  countBadge.textContent = `${generatedTasks.length} tasks`;
  
  const priorityLabels = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' };
  const priorityColors = { 1: '#ef4444', 2: '#f59e0b', 3: '#3b82f6', 4: '#10b981' };
  
  list.innerHTML = generatedTasks.map((task) => {
    const priorityNum = task.priority || 2;
    return `
    <div class="task-card" data-id="${task.id}">
      <div class="task-header">
        <span class="task-number">Task ${task.id}</span>
        <span class="task-estimate">${task.hours}h</span>
      </div>
      
      <div class="task-meta">
        <span class="task-priority" style="background:${priorityColors[priorityNum]}">${priorityLabels[priorityNum]}</span>
        <span class="task-activity">${task.activity || 'Development'}</span>
      </div>
      
      <div class="task-checkbox">
        <input type="checkbox" id="task-check-${task.id}" data-task-id="${task.id}" ${task.selected ? 'checked' : ''}>
        <label for="task-check-${task.id}">Include in ADO</label>
      </div>
      
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-description">${escapeHtml(task.description).replace(/\\n/g, '<br>')}</div>
      
      <div class="edit-fields">
        <input type="text" class="edit-title" value="${escapeHtml(task.title)}" placeholder="Task title">
        <textarea class="edit-description" rows="3" placeholder="Description">${escapeHtml(task.description)}</textarea>
        <div class="edit-row">
          <input type="number" class="edit-hours" value="${task.hours}" min="0.5" step="0.5" placeholder="Hours">
          <select class="edit-priority">
            ${[1,2,3,4].map(p => `<option value="${p}" ${priorityNum === p ? 'selected' : ''}>${priorityLabels[p]}</option>`).join('')}
          </select>
          <select class="edit-activity">
            ${['Deployment','Design','Development','Documentation','Requirements','Testing'].map(a => 
              `<option ${task.activity === a ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
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
    task.hours = parseFloat(card.querySelector('.edit-hours').value) || task.hours;
    task.priority = parseInt(card.querySelector('.edit-priority').value) || 2;
    task.activity = card.querySelector('.edit-activity').value || 'Development';
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
  const totalHours = selectedTasks.reduce((sum, t) => sum + t.hours, 0);
  const days = Math.ceil(totalHours / 6);
  
  document.getElementById('totalEstimate').innerHTML = `
    <div class="estimate-label">Total Estimate (${selectedTasks.length} tasks)</div>
    <div class="estimate-value">${totalHours}h (~${days} days)</div>
  `;
}

// Create all tasks in ADO
async function createAllTasksInADO() {
  const { org, project, pat } = getSettings();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first', 'error');
    return;
  }
  
  const selectedTasks = generatedTasks.filter(t => t.selected);
  if (selectedTasks.length === 0) {
    showResult('No tasks selected', 'error');
    return;
  }
  
  try {
    showLoading('createLoading', true, `Creating ${selectedTasks.length} tasks...`);
    
    const auth = btoa(":" + pat);
    let created = 0, failed = 0;
    
    for (const task of selectedTasks) {
      try {
        const body = [
          { "op": "add", "path": "/fields/System.Title", "value": task.title },
          { "op": "add", "path": "/fields/System.Description", "value": task.description.replace(/\\n/g, '<br>') },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.OriginalEstimate", "value": task.hours },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.RemainingWork", "value": task.hours },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.CompletedWork", "value": 0 },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": task.priority || 2 },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Common.Activity", "value": task.activity || "Development" }
        ];
        
        if (areaPath) body.push({ "op": "add", "path": "/fields/System.AreaPath", "value": areaPath });
        if (assignedTo) body.push({ "op": "add", "path": "/fields/System.AssignedTo", "value": assignedTo.uniqueName || assignedTo.displayName });
        if (iterationPath) body.push({ "op": "add", "path": "/fields/System.IterationPath", "value": iterationPath });
        
        if (userStoryData && userStoryData.id) {
          body.push({
            "op": "add",
            "path": "/relations/-",
            "value": { "rel": "System.LinkTypes.Hierarchy-Reverse", "url": userStoryData.url }
          });
        }
        
        const response = await fetch(
          `https://dev.azure.com/${org}/${project}/_apis/wit/workitems/$Task?api-version=7.0`,
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
      showResult(`✓ Created ${created} tasks in Azure DevOps!`, 'success');
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
// TAB 2: Evaluate Tasks
// ============================================

async function fetchEvalStory() {
  const { org, project, pat } = getSettings();
  const storyId = document.getElementById('evalStoryId').value.trim();
  
  if (!org || !project || !pat || !storyId) {
    showResult('Please configure settings and enter Story ID', 'error');
    return;
  }
  
  try {
    showLoading('evaluateLoading', true, 'Fetching user story...');
    
    const auth = btoa(":" + pat);
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${storyId}?api-version=7.0`;
    
    const response = await fetch(url, {
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    
    const data = await response.json();
    
    document.getElementById('evalStoryTitle').value = data.fields['System.Title'] || '';
    document.getElementById('evalStoryDescription').value = 
      `${stripHtml(data.fields['System.Description'] || '')}\n\n${stripHtml(data.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '')}`;
    
    // Store User Story data for task creation
    currentEvalStoryData = {
      iterationPath: data.fields['System.IterationPath'] || null,
      areaPath: data.fields['System.AreaPath'] || null,
      assignedTo: data.fields['System.AssignedTo'] || null,
      plannedStartDate: data.fields['Microsoft.VSTS.Scheduling.StartDate'] || null,
      plannedEndDate: data.fields['Microsoft.VSTS.Scheduling.FinishDate'] || null,
      targetDate: data.fields['Microsoft.VSTS.Scheduling.TargetDate'] || null
    };
    
    // Calculate available days if dates exist
    let dateInfo = '';
    if (currentEvalStoryData.plannedStartDate && currentEvalStoryData.plannedEndDate) {
      const start = new Date(currentEvalStoryData.plannedStartDate);
      const end = new Date(currentEvalStoryData.plannedEndDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      dateInfo = ` | Timeline: ${days} days (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
    }
    
    const assigneeInfo = currentEvalStoryData.assignedTo?.displayName ? ` | Assigned: ${currentEvalStoryData.assignedTo.displayName}` : '';
    
    showLoading('evaluateLoading', false);
    showResult(`Story fetched!${dateInfo}${assigneeInfo} Click "Analyze" to evaluate.`, 'success');
    
  } catch (error) {
    showLoading('evaluateLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// Store current evaluation data for saving
let currentEvaluation = null;
let currentEvalStoryId = null;
let currentEvalStoryData = null; // Store User Story dates, iteration, area, assignee

async function evaluateTasks() {
  const { org, project, pat } = getSettings();
  const groqKey = document.getElementById('groq').value;
  const storyId = document.getElementById('evalStoryId').value.trim();
  const storyTitle = document.getElementById('evalStoryTitle').value.trim();
  const storyDescription = document.getElementById('evalStoryDescription').value.trim();
  
  // Only title is required
  if (!storyTitle) {
    showResult('Please enter User Story Title', 'error');
    return;
  }
  
  if (!groqKey) {
    showResult('Please configure Groq API Key in Settings', 'error');
    return;
  }
  
  // Store story ID for later use
  currentEvalStoryId = storyId;
  
  try {
    showLoading('evaluateLoading', true, 'Fetching linked tasks...');
    
    let linkedTasks = [];
    
    if (storyId && org && project && pat) {
      linkedTasks = await fetchLinkedTasks(org, project, pat, storyId);
    }
    
    showLoading('evaluateLoading', true, 'AI is analyzing tasks...');
    
    // Calculate available hours from User Story dates
    let availableHours = null;
    if (currentEvalStoryData?.plannedStartDate && currentEvalStoryData?.plannedEndDate) {
      const start = new Date(currentEvalStoryData.plannedStartDate);
      const end = new Date(currentEvalStoryData.plannedEndDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      availableHours = days * 6; // 6 productive hours per day
    }
    
    const evaluation = await evaluateWithAI(storyTitle, storyDescription, linkedTasks, groqKey, availableHours);
    
    // Store evaluation for saving
    currentEvaluation = evaluation;
    
    showLoading('evaluateLoading', false);
    displayEvaluationResults(evaluation);
    
  } catch (error) {
    showLoading('evaluateLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

async function fetchLinkedTasks(org, project, pat, storyId) {
  const auth = btoa(":" + pat);
  
  // First get the work item with relations
  const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${storyId}?$expand=relations&api-version=7.0`;
  
  const response = await fetch(url, {
    headers: { "Authorization": `Basic ${auth}` }
  });
  
  if (!response.ok) return [];
  
  const data = await response.json();
  const relations = data.relations || [];
  
  // Filter child relations
  const childUrls = relations
    .filter(r => r.rel === 'System.LinkTypes.Hierarchy-Forward')
    .map(r => r.url);
  
  if (childUrls.length === 0) return [];
  
  // Fetch each child task
  const tasks = [];
  for (const url of childUrls) {
    try {
      const taskResponse = await fetch(url, {
        headers: { "Authorization": `Basic ${auth}` }
      });
      if (taskResponse.ok) {
        const taskData = await taskResponse.json();
        if (taskData.fields['System.WorkItemType'] === 'Task') {
          tasks.push({
            id: taskData.id,
            title: taskData.fields['System.Title'],
            description: stripHtml(taskData.fields['System.Description'] || ''),
            estimate: taskData.fields['Microsoft.VSTS.Scheduling.OriginalEstimate'] || 0,
            activity: taskData.fields['Microsoft.VSTS.Common.Activity'] || '',
            state: taskData.fields['System.State']
          });
        }
      }
    } catch (e) {
      console.error('Error fetching task:', e);
    }
  }
  
  return tasks;
}

async function evaluateWithAI(storyTitle, storyDescription, existingTasks, apiKey, availableHours = null) {
  const tasksJson = JSON.stringify(existingTasks, null, 2);
  const descText = storyDescription ? `\nDescription: ${storyDescription}` : '';
  
  // Calculate existing task hours
  const existingHours = existingTasks.reduce((sum, t) => sum + (t.estimate || 0), 0);
  
  // Time constraint for new tasks
  let timeConstraint = '';
  if (availableHours) {
    const remainingHours = Math.max(0, availableHours - existingHours);
    timeConstraint = `\n\nTIME CONSTRAINT:\n- Total available hours: ${availableHours}h\n- Existing tasks total: ${existingHours}h\n- Remaining hours for new tasks: ${remainingHours}h\n- NEW TASKS MUST FIT WITHIN ${remainingHours} HOURS TOTAL. Do not suggest tasks if no time remains.`;
  }
  
  const prompt = `You are an expert Agile coach. Evaluate the tasks created for this User Story.

USER STORY:
Title: ${storyTitle}${descText}${timeConstraint}

EXISTING TASKS:
${tasksJson || 'No tasks found'}

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
  "newTasks": [
    { "title": "string", "description": "string", "hours": number, "reason": "why needed" }
  ],
  "summary": "Overall assessment in 1-2 sentences"
}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
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

function displayEvaluationResults(evaluation) {
  const resultsEl = document.getElementById('evaluationResults');
  resultsEl.classList.remove('hidden');
  
  // Correct tasks
  document.getElementById('correctTasks').innerHTML = 
    evaluation.correct?.length ? evaluation.correct.map(t => `
      <div class="eval-item">
        <div class="eval-item-header">
          <span class="eval-item-id">#${t.id || 'New'}</span>
        </div>
        <div class="eval-item-title">${escapeHtml(t.title)}</div>
        <div class="eval-item-reason">${escapeHtml(t.reason)}</div>
      </div>
    `).join('') : '<div class="empty-state"><span class="empty-state-text">No correct tasks identified</span></div>';
  
  // Tasks to update
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
    `).join('') : '<div class="empty-state"><span class="empty-state-text">No updates needed</span></div>';
  
  // Tasks to delete
  document.getElementById('deleteTasks').innerHTML = 
    evaluation.toDelete?.length ? evaluation.toDelete.map(t => `
      <div class="eval-item">
        <div class="eval-item-header">
          <span class="eval-item-id">#${t.id || 'New'}</span>
        </div>
        <div class="eval-item-title">${escapeHtml(t.title)}</div>
        <div class="eval-item-reason">${escapeHtml(t.reason)}</div>
      </div>
    `).join('') : '<div class="empty-state"><span class="empty-state-text">No tasks to delete</span></div>';
  
  // Suggested new tasks
  document.getElementById('suggestedTasks').innerHTML = 
    evaluation.newTasks?.length ? evaluation.newTasks.map((t, idx) => `
      <div class="eval-item">
        <div class="eval-item-title">${escapeHtml(t.title)}</div>
        <div class="eval-item-reason">${escapeHtml(t.description)}</div>
        <div class="eval-item-suggestion">⏱️ ${t.hours}h - ${escapeHtml(t.reason)}</div>
        <div class="eval-item-actions">
          <button class="btn btn-success btn-sm" data-action="createTask" data-index="${idx}">➕ Create Task</button>
        </div>
      </div>
    `).join('') : '<div class="empty-state"><span class="empty-state-text">No new tasks suggested</span></div>';
  
  // Summary with action buttons
  const hasUpdates = evaluation.toUpdate?.length > 0;
  const hasNew = evaluation.newTasks?.length > 0;
  
  document.getElementById('evalSummary').innerHTML = `
    <h4>📊 Summary</h4>
    <p>${escapeHtml(evaluation.summary || 'Evaluation complete.')}</p>
    ${(hasNew) ? `
      <div class="eval-actions">
        <button class="btn btn-success" data-action="createAllTasks">➕ Create All Suggested Tasks</button>
      </div>
    ` : ''}
  `;
}

// Create a single suggested task in ADO
async function createSuggestedTask(index) {
  const { org, project, pat } = getSettings();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  if (!currentEvaluation?.newTasks?.[index]) {
    showResult('Task not found', 'error');
    return;
  }
  
  const task = currentEvaluation.newTasks[index];
  
  try {
    showLoading('evaluateLoading', true, 'Creating task...');
    
    const auth = btoa(":" + pat);
    const body = [
      { "op": "add", "path": "/fields/System.Title", "value": task.title },
      { "op": "add", "path": "/fields/System.Description", "value": task.description || '' },
      { "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.OriginalEstimate", "value": task.hours || 4 },
      { "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.RemainingWork", "value": task.hours || 4 },
      { "op": "add", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": 2 },
      { "op": "add", "path": "/fields/Microsoft.VSTS.Common.Activity", "value": "Development" }
    ];
    
    // Add Iteration Path from User Story
    if (currentEvalStoryData?.iterationPath) {
      body.push({ "op": "add", "path": "/fields/System.IterationPath", "value": currentEvalStoryData.iterationPath });
    }
    
    // Add Area Path from User Story
    if (currentEvalStoryData?.areaPath) {
      body.push({ "op": "add", "path": "/fields/System.AreaPath", "value": currentEvalStoryData.areaPath });
    }
    
    // Assign to same user as User Story (if exists)
    if (currentEvalStoryData?.assignedTo?.uniqueName) {
      body.push({ "op": "add", "path": "/fields/System.AssignedTo", "value": currentEvalStoryData.assignedTo.uniqueName });
    }
    
    // Link to parent story if we have the ID
    if (currentEvalStoryId) {
      const storyUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${currentEvalStoryId}`;
      body.push({
        "op": "add",
        "path": "/relations/-",
        "value": { "rel": "System.LinkTypes.Hierarchy-Reverse", "url": storyUrl }
      });
    }
    
    const response = await fetch(
      `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/$Task?api-version=7.0`,
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
      showResult(`✓ Created task #${created.id}: ${task.title}`, 'success');
      // Remove from suggestions
      currentEvaluation.newTasks.splice(index, 1);
      displayEvaluationResults(currentEvaluation);
    } else {
      const error = await response.text();
      showResult(`Failed to create task: ${response.status}`, 'error');
    }
  } catch (error) {
    showLoading('evaluateLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
}

// Create all suggested tasks
async function createAllSuggestedTasks() {
  const { org, project, pat } = getSettings();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  if (!currentEvaluation?.newTasks?.length) {
    showResult('No tasks to create', 'error');
    return;
  }
  
  try {
    showLoading('evaluateLoading', true, `Creating ${currentEvaluation.newTasks.length} tasks...`);
    
    const auth = btoa(":" + pat);
    let created = 0, failed = 0;
    
    for (const task of currentEvaluation.newTasks) {
      try {
        const body = [
          { "op": "add", "path": "/fields/System.Title", "value": task.title },
          { "op": "add", "path": "/fields/System.Description", "value": task.description || '' },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.OriginalEstimate", "value": task.hours || 4 },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Scheduling.RemainingWork", "value": task.hours || 4 },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": 2 },
          { "op": "add", "path": "/fields/Microsoft.VSTS.Common.Activity", "value": "Development" }
        ];
        
        // Add Iteration Path from User Story
        if (currentEvalStoryData?.iterationPath) {
          body.push({ "op": "add", "path": "/fields/System.IterationPath", "value": currentEvalStoryData.iterationPath });
        }
        
        // Add Area Path from User Story
        if (currentEvalStoryData?.areaPath) {
          body.push({ "op": "add", "path": "/fields/System.AreaPath", "value": currentEvalStoryData.areaPath });
        }
        
        // Assign to same user as User Story (if exists)
        if (currentEvalStoryData?.assignedTo?.uniqueName) {
          body.push({ "op": "add", "path": "/fields/System.AssignedTo", "value": currentEvalStoryData.assignedTo.uniqueName });
        }
        
        if (currentEvalStoryId) {
          const storyUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${currentEvalStoryId}`;
          body.push({
            "op": "add",
            "path": "/relations/-",
            "value": { "rel": "System.LinkTypes.Hierarchy-Reverse", "url": storyUrl }
          });
        }
        
        const response = await fetch(
          `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/$Task?api-version=7.0`,
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
      showResult(`✓ Created ${created} tasks in Azure DevOps!`, 'success');
      currentEvaluation.newTasks = [];
      displayEvaluationResults(currentEvaluation);
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

async function fetchUserWorkItems() {
  const { org, project, pat } = getSettings();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  const userName = document.getElementById('insightUserName').value.trim();
  if (!userName) {
    showResult('Please enter a user name', 'error');
    return;
  }
  await analyzeInsights();
}

async function analyzeInsights() {
  const { org, project, pat } = getSettings();
  const userName = document.getElementById('insightUserName').value.trim();
  
  if (!org || !project || !pat) {
    showResult('Please configure settings first (click ⚙️)', 'error');
    return;
  }
  
  if (!userName) {
    showResult('Please enter a user name', 'error');
    return;
  }
  
  try {
    showLoading('insightsLoading', true, 'Fetching work items...');
    
    const auth = btoa(":" + pat);
    
    // WIQL query to get all work items assigned to user
    const wiql = {
      query: `SELECT [System.Id], [System.Title], [System.WorkItemType] 
              FROM WorkItems 
              WHERE [System.AssignedTo] CONTAINS '${userName}' 
              AND [System.State] <> 'Closed' 
              AND [System.State] <> 'Removed'
              ORDER BY [System.WorkItemType]`
    };
    
    const wiqlResponse = await fetch(
      `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.0`,
      {
        method: 'POST',
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(wiql)
      }
    );
    
    if (!wiqlResponse.ok) throw new Error('Failed to query work items');
    
    const wiqlData = await wiqlResponse.json();
    const workItemIds = wiqlData.workItems?.map(w => w.id) || [];
    
    if (workItemIds.length === 0) {
      showLoading('insightsLoading', false);
      showResult('No work items found for this user', 'error');
      return;
    }
    
    showLoading('insightsLoading', true, `Validating ${workItemIds.length} work items...`);
    
    // Fetch details for all work items
    const workItems = await fetchWorkItemDetails(org, project, auth, workItemIds);
    
    // Categorize and validate
    const insights = {
      features: [],
      stories: [],
      tasks: []
    };
    
    for (const item of workItems) {
      const type = item.fields['System.WorkItemType'];
      const validated = validateWorkItem(item, type);
      
      if (type === 'Feature') {
        insights.features.push(validated);
      } else if (type === 'User Story') {
        insights.stories.push(validated);
      } else if (type === 'Task') {
        insights.tasks.push(validated);
      }
    }
    
    showLoading('insightsLoading', false);
    displayInsightsResults(insights);
    
  } catch (error) {
    showLoading('insightsLoading', false);
    showResult(`Error: ${error.message}`, 'error');
  }
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
  
  return `
    <div class="insight-item">
      <div class="insight-item-header">
        <span class="insight-item-id">#${item.id}</span>
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
      ` : ''}
    </div>
  `;
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
function showExistingTasksWarning(taskCount, storyId) {
  const section = document.getElementById('tasksSection');
  section.classList.remove('hidden');
  
  document.getElementById('tasksList').innerHTML = `
    <div class="existing-tasks-warning">
      <div class="warning-icon">⚠️</div>
      <div class="warning-content">
        <h4>Tasks Already Exist</h4>
        <p>This User Story (#${storyId}) already has <strong>${taskCount} task(s)</strong> created.</p>
        <p>Would you like to evaluate the existing tasks instead?</p>
        <div class="warning-actions">
          <button class="btn btn-primary" data-action="goToEvaluate" data-story-id="${storyId}">
            Go to Evaluate Tab
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

// Go to evaluate tab with story ID pre-filled
function goToEvaluateTab(storyId) {
  // Switch to evaluate tab
  switchTab('evaluate');
  
  // Pre-fill the story ID
  document.getElementById('evalStoryId').value = storyId;
  
  // Copy title and description if available
  const title = document.getElementById('workItemTitle').value;
  const description = document.getElementById('workItemDescription').value;
  
  if (title) document.getElementById('evalStoryTitle').value = title;
  if (description) document.getElementById('evalStoryDescription').value = description;
  
  // Clear the create tab
  document.getElementById('tasksSection').classList.add('hidden');
  
  showResult('Story ID copied to Evaluate tab. Click "Analyze & Evaluate" to review existing tasks.', 'success');
}

// Force generate tasks even if some exist
async function forceGenerateTasks() {
  // Hide the warning and show buttons again
  document.getElementById('createAllTasks').classList.remove('hidden');
  document.getElementById('clearTasks').classList.remove('hidden');
  document.getElementById('tasksSection').classList.add('hidden');
  
  // Call the original generate logic but skip the check
  const groqKey = document.getElementById('groq').value;
  const title = document.getElementById('workItemTitle').value;
  const description = document.getElementById('workItemDescription').value;
  const level = document.getElementById('level').value;
  const daysToComplete = parseInt(document.getElementById('daysToComplete').value) || 5;
  
  const userStory = `Title: ${title}\n\n${description}`;
  
  try {
    showLoading('createLoading', true, 'AI is analyzing and breaking down the work item...');
    
    const experienceContext = EXPERIENCE_CONFIG[level].promptContext;
    const multiplier = EXPERIENCE_CONFIG[level].multiplier;
    const totalHoursAvailable = daysToComplete * 6;
    const hoursForAI = Math.floor(totalHoursAvailable / multiplier);
    
    const tasks = await callGroqAI(userStory, experienceContext, groqKey, hoursForAI, totalHoursAvailable);
    
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
