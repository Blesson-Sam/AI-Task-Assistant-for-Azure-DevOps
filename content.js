// Content script for Azure DevOps pages
// This script runs on Azure DevOps pages to extract User Story information

(function() {
  'use strict';

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getUserStory') {
      const storyData = extractUserStoryFromPage();
      sendResponse(storyData);
    }
    return true;
  });

  // Extract User Story data from the current ADO page
  function extractUserStoryFromPage() {
    try {
      // Try to get the work item ID from URL
      const urlMatch = window.location.href.match(/workitem[s]?\/(\d+)/i);
      const workItemId = urlMatch ? urlMatch[1] : null;

      // Try to extract title
      const titleElement = document.querySelector('.work-item-form-title input') ||
                          document.querySelector('[aria-label="Title Field"]') ||
                          document.querySelector('.witform-layout-content-container .title-container input');
      const title = titleElement ? titleElement.value : '';

      // Try to extract description
      const descriptionElement = document.querySelector('[aria-label="Description"]') ||
                                 document.querySelector('.description-control') ||
                                 document.querySelector('[data-field-name="System.Description"]');
      const description = descriptionElement ? descriptionElement.innerText || descriptionElement.value : '';

      // Try to extract acceptance criteria
      const acceptanceCriteriaElement = document.querySelector('[aria-label="Acceptance Criteria"]') ||
                                        document.querySelector('[data-field-name="Microsoft.VSTS.Common.AcceptanceCriteria"]');
      const acceptanceCriteria = acceptanceCriteriaElement ? 
                                 acceptanceCriteriaElement.innerText || acceptanceCriteriaElement.value : '';

      return {
        success: true,
        workItemId,
        title,
        description,
        acceptanceCriteria
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Highlight the extension is active (optional visual indicator)
  console.log('🚀 AI Task Assistant extension loaded on Azure DevOps');
})();
